/** One fenced code block: its info string and the lines between its fences. */
export type FencedBlock = { info: string; lines: string[] };

const FENCE = /^(`{3,}|~{3,})(.*)$/;
const CLOSING_FENCE = /^(`{3,}|~{3,})[ \t]*$/;
const LIST_ITEM = /^( *)([-*+]|\d{1,9}[.)])( +|$)/;

/** Leading whitespace width, with a tab advancing to the next multiple of four. */
function indentOf(line: string): number {
  let width = 0;
  for (const character of line) {
    if (character === " ") width += 1;
    else if (character === "\t") width += 4 - (width % 4);
    else break;
  }
  return width;
}

/**
 * Split text into the lines outside fenced code blocks and the blocks themselves, following
 * the CommonMark fence rules every check relies on:
 * - a fence opens at most three columns right of its container: the document, or the
 *   content column of the list item it belongs to, so a more indented line is not a fence;
 * - it closes on a line of the opening character repeated at least as many times;
 * - a fence inside a list item ends with that item, and an unclosed fence elsewhere runs
 *   to the end of the text;
 * - a backtick fence's info string has no backtick, so inline code is not a fence.
 */
export function scanFences(text: string): { outside: string[]; blocks: FencedBlock[] } {
  const outside: string[] = [];
  const blocks: FencedBlock[] = [];
  let open: { char: string; length: number; base: number; block: FencedBlock } | null = null;
  let listContent: number | null = null;
  for (const line of text.split(/\r\n|\r|\n/)) {
    const indent = indentOf(line);
    const blank = line.trim() === "";
    if (open) {
      if (open.base > 0 && !blank && indent < open.base) {
        // The list item ended, and its fence with it; read this line outside any block.
        open = null;
        listContent = null;
      } else {
        const closing = line.trim().match(CLOSING_FENCE);
        if (
          closing &&
          indent - open.base <= 3 &&
          closing[1][0] === open.char &&
          closing[1].length >= open.length
        ) {
          open = null;
        } else {
          open.block.lines.push(line);
        }
        continue;
      }
    }

    let base = listContent ?? 0;
    let candidate = line;
    let relative = indent - base;
    const item = line.match(LIST_ITEM);
    if (item) {
      listContent = item[1].length + item[2].length + Math.min(Math.max(item[3].length, 1), 4);
      base = listContent;
      candidate = line.slice(item[0].length);
      relative = 0;
    } else if (!blank && listContent != null && indent < listContent) {
      listContent = null;
      base = 0;
      relative = indent;
    }

    const opening = relative <= 3 ? candidate.trimStart().match(FENCE) : null;
    if (opening && !(opening[1][0] === "`" && opening[2].includes("`"))) {
      const block: FencedBlock = { info: opening[2].trim(), lines: [] };
      blocks.push(block);
      open = { char: opening[1][0], length: opening[1].length, base, block };
      continue;
    }
    outside.push(line);
  }
  return { outside, blocks };
}
