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

// "/how-it-works" sat in this list and has never existed. A 404 has nothing to
// overflow, so it passed every run while testing nothing — a page list is only
// as good as its worst entry, and the run now fails loudly on a missing page.
const PAGES = [
  "/",
  "/venues",
  "/venues/delhi-ncr",
  "/vendors",
  "/vendors/delhi-ncr",
  "/vendors/mumbai/photographers",
  "/trust-and-safety",
  "/for-vendors",
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
  // A scroller that hides content behind a hidden scrollbar is navigation the
  // visitor cannot know exists. This is how "Business settings" disappeared
  // below 640px: overflow-x-auto plus scrollbar-none, no fade, no arrow.
  for (const el of document.querySelectorAll("*")) {
    const cs = getComputedStyle(el);
    const scrolls = cs.overflowX === "auto" || cs.overflowX === "scroll";
    if (!scrolls) continue;
    const hidden = el.scrollWidth - el.clientWidth;
    if (hidden <= 1) continue;
    // A native scrollbar is an affordance; suppressing it removes the only cue.
    const suppressed =
      cs.scrollbarWidth === "none" || el.offsetHeight === el.clientHeight;
    const links = el.querySelectorAll("a, button").length;
    if (suppressed && links > 0) {
      out.push({
        kind: "scroller-hides-links-with-no-scrollbar",
        detail: hidden + "px hidden, " + links + " interactive",
        tag: el.tagName.toLowerCase(),
        name: (el.getAttribute("aria-label") || el.className || "").slice(0, 40),
      });
    }
  }

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

    // 44px is the WCAG 2.2 target-size minimum, with the exemptions that
    // standard allows -- otherwise the check drowns in noise and stops being
    // read, which is worse than not having it.
    //
    //  - an inline link inside a sentence is sized by its text
    //  - a control wrapped in a label is activated by the whole label
    //  - a card whose image is a stretched link already has a large target
    const inline =
      el.tagName === "A" &&
      cs.display.startsWith("inline") &&
      el.parentElement &&
      (el.parentElement.textContent || "").trim().length >
        (el.textContent || "").trim().length;
    const labelBox = el.closest("label")?.getBoundingClientRect();
    const labelCovers = Boolean(labelBox && labelBox.height >= 44);
    const cardCovers = Boolean(
      el.closest("article")?.querySelector("a.absolute.inset-0"),
    );
    // A stretched pseudo-element is the other way a small link owns a big
    // target -- \`after:absolute after:inset-0\` over a positioned card. It has
    // no box of its own to measure, so ask the computed style.
    const pseudoCovers = ["::before", "::after"].some((pseudo) => {
      const ps = getComputedStyle(el, pseudo);
      return (
        ps.content !== "none" &&
        ps.position === "absolute" &&
        ["top", "right", "bottom", "left"].every(
          (side) => parseFloat(ps[side]) <= 0,
        )
      );
    });
    if (
      !inline &&
      !labelCovers &&
      !cardCovers &&
      !pseudoCovers &&
      (r.height < 44 || r.width < 24)
    ) {
      out.push({
        kind: "tap-target-under-44px",
        detail: Math.round(r.width) + "x" + Math.round(r.height),
        tag: el.tagName.toLowerCase(),
        name: el.name || el.id || (el.textContent || "").trim().slice(0, 30) ||
          el.getAttribute("aria-label") || "",
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
    // Ask for the status directly rather than inferring it from the rendered
    // page. This matched "404" in the title, which let a genuinely missing
    // route through: Next's not-found page does not put the number there, so
    // "/for-vendors/pricing" sat in this list passing every run while it 404'd
    // — the same blind spot "/how-it-works" had.
    const probe = await fetch(BASE + path, { redirect: "manual" });
    if (probe.status >= 400) {
      findings++;
      console.log(
        `  ${String(width).padEnd(5)} ${path.padEnd(30)} PAGE-MISSING  HTTP ${probe.status}`,
      );
      continue;
    }

    const nav = await cdp(ws, "Page.navigate", { url: BASE + path });
    await new Promise((r) => setTimeout(r, 900));
    if (nav.errorText) {
      findings++;
      console.log(
        `  ${String(width).padEnd(5)} ${path.padEnd(30)} NAVIGATION-FAILED  ${nav.errorText}`,
      );
      continue;
    }
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
