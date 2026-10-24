import type { PageData } from "./types";

const MIN_USEFUL_CHARS = 50;

export async function getActivePageData(): Promise<PageData> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

  if (!tab?.id) throw new Error("No active tab found.");

  // With only the activeTab permission, Chrome hides tab.url until the user
  // has clicked the toolbar icon on that exact tab.
  if (!tab.url) {
    throw new Error(
        "Page Insight does not have access to this tab yet. Use the Allow button above the tabs, or click the toolbar icon on this tab."
    );
  }
  if (!/^https?:/.test(tab.url)) {
    throw new Error(
      "This kind of page (browser settings, new tab, extensions) cannot be read. Try a normal website."
    );
  }

  let page: PageData | undefined;
  try {
    // Step 1: inject the content script (defines the extract function).
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
    // Step 2: call it and receive the result.
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => globalThis.__pageInsightExtract(),
    });
    page = res?.result as PageData | undefined;
  } catch {
    throw new Error(
      "Could not read this page. Click the Page Insight icon on this tab and try again."
    );
  }

  if (!page || page.text.length < MIN_USEFUL_CHARS) {
    throw new Error(
      "This page has no readable text. PDFs and image-only pages are not supported yet."
    );
  }
  return page;
}