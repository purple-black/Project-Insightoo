import { marked } from "marked";
import DOMPurify from "dompurify";
import { postJson, streamPost } from "./api";
import { getActivePageData } from "./page";
import type { PageData } from "./types";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const statusEl = $("status");
const outputEl = $("output");
const pageTitleEl = $("page-title");
const stopBtn = $<HTMLButtonElement>("stop");
const actionsEl = $("output-actions");
const copyBtn = $<HTMLButtonElement>("copy");
const actionButtons = document.querySelectorAll<HTMLButtonElement>("button.primary");

// Open links from model output in a new tab, never inside the panel.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

let controller: AbortController | null = null;
let lastText = "";

function render(markdown: string) {
  const html = marked.parse(markdown, { async: false }) as string;
  outputEl.innerHTML = DOMPurify.sanitize(html);
}

function setBusy(busy: boolean) {
  actionButtons.forEach((b) => (b.disabled = busy));
  stopBtn.classList.toggle("hidden", !busy);
}

async function session(work: (signal: AbortSignal) => Promise<void>) {
  controller?.abort();
  controller = new AbortController();
  const { signal } = controller;

  lastText = "";
  outputEl.innerHTML = "";
  actionsEl.classList.add("hidden");
  setBusy(true);
  statusEl.textContent = "Reading page...";

  try {
    await work(signal);
  } catch (err) {
    const e = err as Error;
    statusEl.textContent = e.name === "AbortError" ? "Stopped." : e.message;
  } finally {
    setBusy(false);
    if (lastText) actionsEl.classList.remove("hidden");
  }
}

function run(path: string, buildBody: (page: PageData) => unknown) {
  return session(async (signal) => {
    const page = await getActivePageData();
    pageTitleEl.textContent = page.title || page.url;
    statusEl.textContent =
      "Thinking..." + (page.truncated ? " (long page: using the first part)" : "");

    for await (const ev of streamPost(path, buildBody(page), signal)) {
      if (ev.type === "text") {
        lastText += ev.text;
        statusEl.textContent = "";
        render(lastText);
      } else if (ev.type === "error") {
        statusEl.textContent = ev.message;
      }
    }
  });
}

interface ExtractResponse {
  data: Record<string, unknown>;
  ungrounded: string[];
}

function runExtract() {
  return session(async (signal) => {
    const page = await getActivePageData();
    pageTitleEl.textContent = page.title || page.url;
    statusEl.textContent = "Extracting...";

    const kind = $<HTMLSelectElement>("schema").value;
    const res = await postJson<ExtractResponse>(
      "/extract",
      { url: page.url, title: page.title, text: page.text, json_ld: page.jsonLd, kind },
      signal
    );

    lastText = JSON.stringify(res.data, null, 2);
    // textContent (not innerHTML) so the JSON can never be treated as markup.
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = lastText;
    pre.append(code);
    outputEl.append(pre);

    statusEl.textContent = res.ungrounded.length
      ? `Check these values, they were not found on the page: ${res.ungrounded.join("; ")}`
      : "";
  });
}

// Tabs
const tabs = document.querySelectorAll<HTMLButtonElement>(".tab");
const modes = document.querySelectorAll<HTMLElement>(".mode");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const mode = tab.dataset.mode;
    tabs.forEach((t) => t.classList.toggle("active", t === tab));
    modes.forEach((m) => m.classList.toggle("hidden", m.id !== `mode-${mode}`));
  });
});

// Summarize
$("run-summarize").addEventListener("click", () =>
  run("/summarize", (p) => ({ url: p.url, title: p.title, text: p.text }))
);

$("run-extract").addEventListener("click", () => runExtract());

// Stop and Copy
stopBtn.addEventListener("click", () => controller?.abort());
copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(lastText);
  copyBtn.textContent = "Copied";
  setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
});