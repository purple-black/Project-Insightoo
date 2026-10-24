import { getActivePageData } from "./page";
import { hasAllSites, hasSiteAccess, requestAllSites, requestSite, sitePattern } from "./permissions";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const statusEl = $("status");
const outputEl = $("output");
const pageTitleEl = $("page-title");

const tabs = document.querySelectorAll<HTMLButtonElement>(".tab");
const modes = document.querySelectorAll<HTMLElement>(".mode");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const mode = tab.dataset.mode;
    tabs.forEach((t) => t.classList.toggle("active", t === tab));
    modes.forEach((m) => m.classList.toggle("hidden", m.id !== `mode-${mode}`));
  });
});

$("run-summarize").addEventListener("click", async () => {
  outputEl.textContent = "";
  statusEl.textContent = "Reading page...";
  try {
    const page = await getActivePageData();
    pageTitleEl.textContent = page.title;
    statusEl.textContent =
      `Read ${page.text.length} characters using ${page.method}` +
      (page.truncated ? " (truncated)" : "");
    outputEl.textContent = page.text.slice(0, 1000);
  } catch (err) {
    statusEl.textContent = (err as Error).message;
  }
});

const accessBox = $("access");
const accessText = $("access-text");
const accessBtn = $<HTMLButtonElement>("access-btn");
let accessAction: (() => Promise<boolean>) | null = null;

async function refreshAccessBox() {
  accessAction = null;
  const hide = () => accessBox.classList.add("hidden");
  const show = () => accessBox.classList.remove("hidden");

  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab || (await hasAllSites())) return hide();

  if (!tab.url) {
    // Chrome is hiding this tab because the extension has no access to it yet.
    // (This also happens on chrome:// pages, which can never be read.)
    accessText.textContent = "Chrome is hiding this tab from Page Insight until you allow access.";
    accessBtn.textContent = "Allow on all sites";
    accessAction = requestAllSites;
    return show();
  }

  if (sitePattern(tab.url) && !(await hasSiteAccess(tab.url))) {
    const url = tab.url;
    const host = new URL(url).hostname;
    accessText.textContent = `Page Insight can read this tab now. To keep working on ${host} without clicking the toolbar icon each time, allow the site.`;
    accessBtn.textContent = `Always allow on ${host}`;
    accessAction = () => requestSite(url);
    return show();
  }

  hide();
}

accessBtn.addEventListener("click", async () => {
  if (!accessAction) return;
  const granted = await accessAction(); // first await in the handler, so the click still counts
  statusEl.textContent = granted
    ? "Access granted. Press the button again."
    : "Access was not granted.";
  await refreshAccessBox();
});

// Re-check whenever the user changes tabs, a page finishes loading, or permissions change.
chrome.tabs.onActivated.addListener(() => void refreshAccessBox());
chrome.tabs.onUpdated.addListener((_id, info) => {
  if (info.status === "complete") void refreshAccessBox();
});
chrome.permissions.onAdded.addListener(() => void refreshAccessBox());
chrome.permissions.onRemoved.addListener(() => void refreshAccessBox());
void refreshAccessBox();