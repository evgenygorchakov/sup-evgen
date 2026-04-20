import { HOST, MODEL, REQUEST_TIMEOUT_MS } from "./config.ts";
import type { Message, ToolDefinition } from "./types.ts";

export async function chat(
  messages: Message[],
  tools?: ToolDefinition[],
): Promise<Message> {
  const res = await fetch(`${HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools,
      stream: false,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
  }

  const data: unknown = await res.json();
  if (
    typeof data !== "object" ||
    data === null ||
    !("message" in data) ||
    typeof (data as { message: unknown }).message !== "object"
  ) {
    throw new Error("Ollama returned unexpected response shape");
  }
  return (data as { message: Message }).message;
}
