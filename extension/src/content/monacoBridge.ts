// Runs in the MAIN world (Chrome 111+ declarative main-world injection),
// so it shares window/document with the page and can see window.monaco if
// LeetCode's bundle happens to expose it. Communicates with the isolated-world
// content script via CustomEvents on `document`, since chrome.runtime
// messaging isn't available here. Requests/responses are nonce-correlated
// so overlapping in-flight requests can't be mismatched.
//
// NOT YET VERIFIED against a live leetcode.com page — window.monaco exposure
// and the .view-lines DOM structure both need confirming via DevTools before
// this is trusted in production. See README troubleshooting section.

const REQUEST_EVENT = "lctrainer:getCode:request";
const RESPONSE_EVENT = "lctrainer:getCode:response";

interface CodeExtractionResult {
  code: string;
  language: string;
  possiblyIncomplete: boolean;
}

function getMonacoGlobal(): any {
  return (window as any).monaco;
}

function extractViaMonacoApi(): CodeExtractionResult | null {
  const monaco = getMonacoGlobal();
  if (!monaco?.editor?.getModels) return null;

  const models = monaco.editor.getModels();
  if (!models?.length) return null;

  // LeetCode may keep multiple models around (e.g. a hidden notes/console
  // model); the code editor's model is usually the one with the largest
  // line count, but this heuristic is unverified — flagged for the DevTools
  // spike.
  const model = models.reduce((largest: any, m: any) =>
    m.getLineCount() > largest.getLineCount() ? m : largest
  );

  return {
    code: model.getValue(),
    language: model.getLanguageId?.() ?? "unknown",
    possiblyIncomplete: false,
  };
}

function extractViaDomFallback(): CodeExtractionResult | null {
  const viewLines = document.querySelectorAll<HTMLElement>(".view-lines .view-line");
  if (!viewLines.length) return null;

  const lines = Array.from(viewLines)
    .map((el) => ({ top: parseFloat(el.style.top || "0"), text: el.textContent ?? "" }))
    .sort((a, b) => a.top - b.top)
    .map((l) => l.text);

  return {
    code: lines.join("\n"),
    language: "unknown",
    // Monaco virtualizes off-screen lines, so scrolled-out code is missing
    // from this reconstruction.
    possiblyIncomplete: true,
  };
}

function extractCode(): CodeExtractionResult {
  return (
    extractViaMonacoApi() ??
    extractViaDomFallback() ?? { code: "", language: "unknown", possiblyIncomplete: true }
  );
}

document.addEventListener(REQUEST_EVENT, (event) => {
  const nonce = (event as CustomEvent).detail?.nonce;
  const result = extractCode();
  document.dispatchEvent(new CustomEvent(RESPONSE_EVENT, { detail: { nonce, ...result } }));
});

console.log("[lctrainer] monacoBridge loaded in MAIN world");
