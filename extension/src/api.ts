import { API_BASE } from "./config";

export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };

export async function* streamPost(
  path: string,
  body: unknown,
  signal: AbortSignal
): AsyncGenerator<StreamEvent> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    yield { type: "error", message: "Could not reach the server. Is it running?" };
    return;
  }

  if (!res.ok || !res.body) {
    yield { type: "error", message: `The server returned an error (${res.status}).` };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    // Events are separated by a blank line. The last piece may be incomplete,
    // so keep it in the buffer until more data arrives.
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const raw of events) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      yield JSON.parse(line.slice(5).trim()) as StreamEvent;
    }
  }
}

export async function postJson<T>(
  path: string,
  body: unknown,
  signal: AbortSignal
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new Error("Could not reach the server. Is it running?");
  }
  if (!res.ok) throw new Error(`The server returned an error (${res.status}).`);
  return (await res.json()) as T;
}