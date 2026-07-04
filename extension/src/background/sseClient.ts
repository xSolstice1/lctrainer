import type { GuidanceChunk } from "@lctrainer/shared";

/** Parses a `text/event-stream` ReadableStream body into GuidanceChunk events. */
export async function* parseSseStream(body: ReadableStream<Uint8Array>): AsyncGenerator<GuidanceChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 2);

        const dataLine = rawEvent
          .split("\n")
          .find((line) => line.startsWith("data:"));
        if (!dataLine) continue;

        try {
          const chunk: GuidanceChunk = JSON.parse(dataLine.slice("data:".length).trim());
          yield chunk;
        } catch {
          // ignore malformed event
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
