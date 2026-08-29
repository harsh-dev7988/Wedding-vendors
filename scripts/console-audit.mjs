/**
 * What the browser complains about while rendering each page.
 *
 * Every other suite reads responses. None of them runs the page. A hydration
 * mismatch, a failed image, a React key warning or a thrown effect leaves the
 * HTML looking perfectly correct while the page is broken in the hand — and
 * this codebase now has client islands reading storage, a listbox built by
 * hand, and a city context that deliberately renders differently on the server
 * than after hydration. That last one is exactly the shape that produces a
 * mismatch if it is done wrong.
 *
 *   BASE=http://localhost:3235 node scripts/console-audit.mjs
 */
const BASE = process.env.BASE ?? "http://localhost:3235";
const PORT = Number(process.env.CDP_PORT ?? 9333);

const PAGES = [
  "/",
  "/venues",
  "/venues/delhi-ncr",
  "/venues/delhi-ncr/banquet-halls",
  "/vendors",
  "/vendors/delhi-ncr",
  "/vendors/delhi-ncr/photographers",
  "/vendor/harsh-garden",
  "/for-vendors",
  "/trust-and-safety",
  "/contact",
  "/sign-in",
  "/shortlist",
];

/**
 * Noise that says nothing about this app.
 *
 * Kept deliberately short. A filter that grows every time something is noisy is
 * how a suite stops finding anything.
 */
const IGNORE = [
  /favicon/i,
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /**
   * `upgrade-insecure-requests` is in the production CSP and correct there.
   * Running a production build over plain http — which is what `next start`
   * does locally — makes the browser rewrite Next's own prefetches to https,
   * where nothing is listening. It is an artefact of testing production
   * headers without TLS, not a defect, and it cannot occur on a site actually
   * served over https.
   */
  /ERR_SSL_PROTOCOL_ERROR/,
];

async function cdp(
  ws,
  method,
  params = {},
  id = Math.floor(Math.random() * 1e9),
) {
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${method} timed out`)),
      30000,
    );
    const onMessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      clearTimeout(timer);
      ws.removeEventListener("message", onMessage);
      resolve(message.result);
    };
    ws.addEventListener("message", onMessage);
  });
}

const targets = await (
  await fetch(`http://localhost:${PORT}/json/list`)
).json();
const ws = new WebSocket(
  targets.find((t) => t.type === "page").webSocketDebuggerUrl,
);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));

await cdp(ws, "Page.enable");
await cdp(ws, "Runtime.enable");
await cdp(ws, "Log.enable");
await cdp(ws, "Network.enable");

let current = "";
const findings = [];

const record = (kind, text) => {
  if (!text || IGNORE.some((pattern) => pattern.test(text))) return;
  findings.push({ kind, page: current, text: text.slice(0, 200) });
};

ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);

  if (message.method === "Runtime.consoleAPICalled") {
    const { type, args } = message.params;
    if (type !== "error" && type !== "warning") return;
    record(
      `console.${type}`,
      args.map((a) => a.value ?? a.description ?? "").join(" "),
    );
  }

  if (message.method === "Runtime.exceptionThrown") {
    record(
      "uncaught-exception",
      message.params.exceptionDetails?.exception?.description ??
        message.params.exceptionDetails?.text,
    );
  }

  if (message.method === "Log.entryAdded") {
    const entry = message.params.entry;
    if (entry.level !== "error") return;
    record("browser-error", `${entry.text} ${entry.url ?? ""}`);
  }

  if (message.method === "Network.loadingFailed") {
    // A request cancelled because the page navigated away has not failed — it
    // was abandoned, which is what this harness does at the end of every page.
    // CDP says so explicitly, so read the flag rather than filtering the error
    // string and losing genuine aborts with it.
    if (message.params.canceled) return;
    record("request-failed", message.params.errorText);
  }
});

for (const path of PAGES) {
  current = path;
  await cdp(ws, "Page.navigate", { url: BASE + path });
  // Long enough for hydration, effects and lazy images to settle.
  await new Promise((r) => setTimeout(r, 2500));
}

ws.close();

for (const finding of findings) {
  console.log(
    `  ${finding.kind.padEnd(20)} ${finding.page.padEnd(34)} ${finding.text}`,
  );
}
console.log(`\npages loaded: ${PAGES.length}`);
console.log(`findings: ${findings.length}`);
process.exit(findings.length > 0 ? 1 : 0);
