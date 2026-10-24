import { Readability } from "@mozilla/readability";
import type { PageData } from "./types";

const MAX_CHARS = 30_000;
const MIN_ARTICLE_CHARS = 500;

declare global {
  // eslint-disable-next-line no-var
  var __pageInsightExtract: () => Promise<PageData>;
}

function cleanWhitespace(s: string): string {
  return s
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function readJsonLd(): unknown[] {
  const found: unknown[] = [];
  document
    .querySelectorAll('script[type="application/ld+json"]')
    .forEach((el) => {
      try {
        found.push(JSON.parse(el.textContent ?? ""));
      } catch {
        // Some sites ship broken JSON. Skip it.
      }
    });
  return found;
}

function metaDescription(): string {
  const el =
    document.querySelector('meta[name="description"]') ??
    document.querySelector('meta[property="og:description"]');
  return el?.getAttribute("content")?.trim() ?? "";
}

function fallbackText(): string {
  // For pages that are not articles (dashboards, listings, apps).
  const clone = document.body.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(
      "script, style, noscript, nav, footer, header, aside, form, iframe, svg, [hidden], [aria-hidden='true']"
    )
    .forEach((el) => el.remove());
  return clone.textContent ?? "";
}

async function waitForContent(): Promise<void> {
  if (document.readyState !== "complete") {
    await new Promise((r) => window.addEventListener("load", r, { once: true }));
  }
  // Single-page apps may render a moment after load.
  if ((document.body?.innerText ?? "").length < MIN_ARTICLE_CHARS) {
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function extractPage(): Promise<PageData> {
  await waitForContent();

  // Readability edits the document it is given, so give it a copy.
  const copy = document.cloneNode(true) as Document;
  const article = new Readability(copy).parse();

  let text = cleanWhitespace(article?.textContent ?? "");
  let method: PageData["method"] = "readability";
  if (text.length < MIN_ARTICLE_CHARS) {
    text = cleanWhitespace(fallbackText());
    method = "fallback";
  }

  const truncated = text.length > MAX_CHARS;
  return {
    url: location.href,
    title: document.title,
    description: metaDescription(),
    text: text.slice(0, MAX_CHARS),
    method,
    jsonLd: readJsonLd(),
    truncated,
  };
}

// Expose the function so the side panel can call it after injection.
globalThis.__pageInsightExtract = extractPage;