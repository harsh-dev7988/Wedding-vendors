/**
 * Layout-overflow audit.
 *
 * Every other suite here reads HTML. This one measures boxes, because the bugs
 * that keep reaching the user are geometric: a control wider than its column, a
 * page that scrolls sideways, text clipped by a fixed height. None of those are
 * visible in markup.
 */
const BASE = process.env.BASE ?? "http://localhost:3235";
const PORT = 9333;

const PAGES = [
  "/",
  "/vendors",
  "/vendors/delhi-ncr/venues",
  "/vendors/mumbai/photographers",
  "/how-it-works",
  "/for-vendors",
  "/for-vendors/pricing",
  "/contact",
  "/sign-in",
  "/account",
  "/shortlist",
  "/for-vendors/apply",
];
const WIDTHS = [360, 414, 768, 1024, 1280, 1536];

const DETECT = `(() => {
  const out = [];
  const docW = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > docW + 1) {
    out.push({ kind: "page-scrolls-sideways", detail: document.documentElement.scrollWidth + " > " + docW });
  }
  const parentBox = (el) => {
    let p = el.parentElement;
    while (p) {
      const cs = getComputedStyle(p);
      if (cs.display.includes("grid") || cs.display.includes("flex")) return p;
      p = p.parentElement;
    }
    return null;
  };
  for (const el of document.querySelectorAll("input, select, textarea, button, a")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.position === "fixed") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const p = parentBox(el);
    if (!p) continue;
    const pr = p.getBoundingClientRect();
    const ps = getComputedStyle(p);
    if (ps.overflowX !== "visible") continue;
    const padL = parseFloat(ps.paddingLeft) || 0, padR = parseFloat(ps.paddingRight) || 0;
    const over = Math.round(Math.max(r.right - (pr.right - padR), (pr.left + padL) - r.left));
    if (over > 1) {
      out.push({
        kind: "control-overflows-its-box",
        detail: over + "px",
        tag: el.tagName.toLowerCase() + (el.type ? "[" + el.type + "]" : ""),
        name: el.name || el.id || (el.textContent || "").trim().slice(0, 30),
      });
    }
  }
  return JSON.stringify(out);
})()`;

async function cdp(
  ws,
  method,
  params = {},
  id = Math.floor(Math.random() * 1e9),
) {
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(method + " timed out")), 30000);
    const on = (e) => {
      const m = JSON.parse(e.data);
      if (m.id !== id) return;
      clearTimeout(t);
      ws.removeEventListener("message", on);
      resolve(m.result);
    };
    ws.addEventListener("message", on);
  });
}

const list = await (await fetch(`http://localhost:${PORT}/json/list`)).json();
const target = list.find((t) => t.type === "page");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
await cdp(ws, "Page.enable");

let findings = 0,
  checks = 0;
for (const width of WIDTHS) {
  await cdp(ws, "Emulation.setDeviceMetricsOverride", {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  for (const path of PAGES) {
    checks++;
    await cdp(ws, "Page.navigate", { url: BASE + path });
    await new Promise((r) => setTimeout(r, 900));
    const { result } = await cdp(ws, "Runtime.evaluate", {
      expression: DETECT,
      returnByValue: true,
    });
    let rows = [];
    try {
      rows = JSON.parse(result.value);
    } catch {
      continue;
    }
    for (const row of rows) {
      findings++;
      console.log(
        `  ${String(width).padEnd(5)} ${path.padEnd(30)} ${row.kind}  ${row.detail}  ${row.tag ?? ""} ${row.name ?? ""}`,
      );
    }
  }
}
console.log(`\nviewports x pages checked: ${checks}`);
console.log(`overflow findings: ${findings}`);
ws.close();
process.exit(findings > 0 ? 1 : 0);
