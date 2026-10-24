const ALL_SITES = ["http://*/*", "https://*/*"];

// Turn https://news.example.com/a/b?x=1 into https://news.example.com/*
// (match patterns cannot contain a port or a path).
export function sitePattern(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `${u.protocol}//${u.hostname}/*`;
  } catch {
    return null;
  }
}

export function hasAllSites(): Promise<boolean> {
  return chrome.permissions.contains({ origins: ALL_SITES });
}

export async function hasSiteAccess(url: string): Promise<boolean> {
  const pattern = sitePattern(url);
  return pattern ? chrome.permissions.contains({ origins: [pattern] }) : false;
}

// Call these straight from a click handler. Chrome only shows its permission
// prompt in response to a user action, and waiting on other work first can
// make Chrome treat the request as not user-initiated.
export function requestSite(url: string): Promise<boolean> {
  const pattern = sitePattern(url);
  return pattern ? chrome.permissions.request({ origins: [pattern] }) : Promise.resolve(false);
}

export function requestAllSites(): Promise<boolean> {
  return chrome.permissions.request({ origins: ALL_SITES });
}