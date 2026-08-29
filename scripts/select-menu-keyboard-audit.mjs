/** Grouped options must not break arrow keys, Home/End or type-ahead. */
const list = await (await fetch("http://localhost:9333/json/list")).json();
const ws = new WebSocket(
  list.find((t) => t.type === "page").webSocketDebuggerUrl,
);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
const cdp = (m, p = {}, id = Math.floor(Math.random() * 1e9)) => {
  ws.send(JSON.stringify({ id, method: m, params: p }));
  return new Promise((res) => {
    const on = (e) => {
      const x = JSON.parse(e.data);
      if (x.id !== id) return;
      ws.removeEventListener("message", on);
      res(x.result);
    };
    ws.addEventListener("message", on);
  });
};
const evalIn = async (expression) =>
  (await cdp("Runtime.evaluate", { expression, returnByValue: true })).result
    .value;

const key = async (k, code, text) => {
  for (const type of ["keyDown", "keyUp"]) {
    await cdp("Input.dispatchKeyEvent", {
      type: type === "keyDown" && text ? "keyDown" : type,
      key: k,
      code,
      text: type === "keyDown" ? text : undefined,
      windowsVirtualKeyCode:
        code === "ArrowDown"
          ? 40
          : code === "Home"
            ? 36
            : code === "End"
              ? 35
              : 0,
    });
  }
  await new Promise((r) => setTimeout(r, 120));
};

await cdp("Page.enable");
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await cdp("Page.navigate", { url: "http://localhost:3235/vendors" });
await new Promise((r) => setTimeout(r, 2500));

const pass = [];
const fail = [];
const check = (ok, name, detail = "") =>
  (ok ? pass : fail).push(`${name}${detail ? "  — " + detail : ""}`);

await evalIn(`document.querySelector('button[aria-haspopup="listbox"]').focus();
  document.querySelector('button[aria-haspopup="listbox"]').click()`);
await new Promise((r) => setTimeout(r, 400));

const optionCount = await evalIn(
  `document.querySelectorAll('[role="option"]').length`,
);
const headingCount = await evalIn(
  `document.querySelectorAll('[role="group"]').length`,
);
check(optionCount > 10, "the list has every option", `${optionCount} options`);
check(headingCount > 3, "options are grouped", `${headingCount} groups`);
check(
  await evalIn(
    `[...document.querySelectorAll('[role="group"] > span')].every(s => !s.matches('[role="option"]'))`,
  ),
  "a group heading is never an option",
);

const active = () =>
  evalIn(
    `document.querySelector('.bg-muted[role="option"]')?.textContent?.trim() ?? null`,
  );
const first = await active();
await key("ArrowDown", "ArrowDown");
const second = await active();
await key("ArrowDown", "ArrowDown");
const third = await active();
check(
  first !== second && second !== third,
  "arrow keys move through options",
  `${first} → ${second} → ${third}`,
);
// The real risk in grouping: options are rendered inside group wrappers, so
// their DOM order could stop matching the flat array every keyboard path
// indexes into. Two arrow presses must land on the third option in DOM order.
const domThird = await evalIn(
  `document.querySelectorAll('[role="option"]')[2]?.textContent?.trim() ?? null`,
);
check(
  third === domThird,
  "the flat index still matches DOM order after grouping",
  `active=${third} dom[2]=${domThird}`,
);

await key("End", "End");
const last = await active();
check(Boolean(last), "End reaches the final option", last ?? "");
await key("Home", "Home");
check((await active()) === first, "Home returns to the first option");

// Type-ahead: "d" should reach DJs / Decorators, not a heading.
await key("d", "KeyD", "d");
const typed = await active();
check(
  /^d/i.test(typed ?? ""),
  "type-ahead jumps to a matching option",
  typed ?? "",
);

for (const p of pass) console.log("  PASS  " + p);
for (const f of fail) console.log("  FAIL  " + f);
console.log(`\n${pass.length}/${pass.length + fail.length} passed`);
ws.close();
process.exit(fail.length ? 1 : 0);
