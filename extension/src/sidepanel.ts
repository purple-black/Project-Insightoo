import { marked } from "marked";
import DOMPurify from "dompurify";
import { streamPost } from "./api";
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

async function run(path: string, buildBody: (page: PageData) => unknown) {
  controller?.abort();
  controller = new AbortController();
  const { signal } = controller;

  lastText = "";
  outputEl.innerHTML = "";
  actionsEl.classList.add("hidden");
  setBusy(true);
  statusEl.textContent = "Reading page...";

  try {
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
  } catch (err) {
    const e = err as Error;
    statusEl.textContent = e.name === "AbortError" ? "Stopped." : e.message;
  } finally {
    setBusy(false);
    if (lastText) actionsEl.classList.remove("hidden");
  }
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

// Stop and Copy
stopBtn.addEventListener("click", () => controller?.abort());
copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(lastText);
  copyBtn.textContent = "Copied";
  setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
});