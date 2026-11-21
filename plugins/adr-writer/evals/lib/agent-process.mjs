import { spawn, spawnSync } from "node:child_process";

/** Run a target in its own process group and finish cancellation before releasing its worker. */
export function runAgentProcess(
  command,
  args,
  { cwd, env, shell = false, input, timeoutMs, stdoutLimit, stderrLimit },
) {
  const started = performance.now();
  return new Promise((resolve) => {
    const windows = process.platform === "win32";
    const child = spawn(command, args, {
      cwd,
      env,
      shell,
      detached: !windows,
      windowsHide: true,
      stdio: "pipe",
    });
    const stdout = [],
      stderr = [];
    let failure = null;
    let cancelling = false;
    let forced = false;
    let forceTimer;

    function signalGroup(signal) {
      try {
        process.kill(-child.pid, signal);
      } catch (error) {
        if (error.code !== "ESRCH") failure = `agent cleanup failed: ${error.code}`;
      }
    }
    function stopSurvivors() {
      if (!cancelling || windows || forced) return;
      forced = true;
      clearTimeout(forceTimer);
      signalGroup("SIGKILL");
    }
    function cancel(reason) {
      if (cancelling || !child.pid) return;
      cancelling = true;
      failure = reason;
      if (windows) {
        const stopped = spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
        if (stopped.status !== 0) {
          failure = `${reason}; agent tree cleanup could not be confirmed`;
          child.kill();
        }
      } else {
        signalGroup("SIGTERM");
        forceTimer = setTimeout(stopSurvivors, 1500);
        if (child.exitCode !== null || child.signalCode !== null) stopSurvivors();
      }
    }
    function collect(stream, chunks, limit, reason) {
      let size = 0;
      stream.on("data", (chunk) => {
        const remaining = limit - size;
        if (remaining > 0) chunks.push(chunk.subarray(0, remaining));
        size += chunk.length;
        if (size > limit) cancel(reason);
      });
    }
    collect(child.stdout, stdout, stdoutLimit, "agent output exceeded limit");
    collect(child.stderr, stderr, stderrLimit, "agent stderr exceeded limit");
    const timer = setTimeout(() => cancel("agent timed out"), timeoutMs);
    child.on("error", (error) => {
      failure ??= error.code ?? error.message;
    });
    child.stdin.on("error", (error) => {
      if (error.code !== "EPIPE") failure ??= error.code ?? error.message;
    });
    child.on("exit", stopSurvivors);
    child.on("close", (status) => {
      clearTimeout(timer);
      clearTimeout(forceTimer);
      // The shell can close its pipes while a descendant with redirected output is still running.
      stopSurvivors();
      resolve({
        ok: !failure && status === 0,
        status,
        error: failure,
        stdout: Buffer.concat(stdout).toString(),
        stderr: Buffer.concat(stderr).toString(),
        ms: performance.now() - started,
      });
    });
    child.stdin.end(input);
  });
}
