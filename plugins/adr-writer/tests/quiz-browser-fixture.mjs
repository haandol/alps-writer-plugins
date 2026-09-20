import { runInNewContext } from "node:vm";

/** Execute emitted quiz JavaScript against event-capable controls parsed from its actual HTML. */
export function quizPage(html) {
  const cards = [...html.matchAll(/<article class="quiz">([\s\S]*?)<\/article>/g)].map((match) => {
    const controls = new Map(),
      inputs = [];
    for (const tag of match[1].matchAll(/<(?:button|div|p|strong|input)\b([^>]*)>/g)) {
      const attributes = Object.fromEntries(
        [...tag[1].matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map((a) => [a[1], a[2] ?? true]),
      );
      const control = {
        hidden: Object.hasOwn(attributes, "hidden"),
        textContent: "",
        checked: false,
        value: attributes.value,
        dataset: Object.fromEntries(
          Object.entries(attributes)
            .filter(([key]) => key.startsWith("data-"))
            .map(([key, value]) => [
              key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()),
              value,
            ]),
        ),
        events: {},
        addEventListener(event, callback) {
          this.events[event] = callback;
        },
        setAttribute() {},
        focus() {},
      };
      for (const name of (attributes.class || "").split(/\s+/))
        if (name) controls.set(`.${name}`, control);
      if (attributes.type === "radio") inputs.push(control);
    }
    controls.get(".quiz__feedback").querySelectorAll = () =>
      [
        ".quiz__result",
        ".quiz__answer",
        ".quiz__selected-feedback",
        ".quiz__criteria",
        ".quiz__evidence",
      ].map((name) => controls.get(name));
    const card = {
      querySelector: (selector) =>
        selector === 'input[type="radio"]' ? inputs[0] : controls.get(selector),
      querySelectorAll: (selector) =>
        selector.endsWith(":checked") ? inputs.filter((input) => input.checked) : inputs,
    };
    return {
      card,
      controls,
      click: (name) => controls.get(`.quiz__${name}`).events.click(),
      select(value) {
        for (const input of inputs) input.checked = input.value === value;
        inputs.find((input) => input.checked).events.change();
      },
    };
  });
  const document = {
    querySelectorAll: (selector) => (selector === ".quiz" ? cards.map((item) => item.card) : []),
    getElementById: () => null,
  };
  for (const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g))
    runInNewContext(script[1], { document, TextDecoder, Uint8Array, atob }, { timeout: 1000 });
  return cards;
}
