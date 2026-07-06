import { describe, expect, it } from "vitest";
import type { GuidanceChunk } from "@lctrainer/shared";
import { parseSseStream } from "./sseClient.js";

function streamFrom(...pieces: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const piece of pieces) controller.enqueue(encoder.encode(piece));
      controller.close();
    },
  });
}

async function collect(body: ReadableStream<Uint8Array>): Promise<GuidanceChunk[]> {
  const chunks: GuidanceChunk[] = [];
  for await (const chunk of parseSseStream(body)) chunks.push(chunk);
  return chunks;
}

describe("parseSseStream", () => {
  it("parses a single event", async () => {
    const chunks = await collect(streamFrom('data: {"type":"token","delta":"hi"}\n\n'));
    expect(chunks).toEqual([{ type: "token", delta: "hi" }]);
  });

  it("parses multiple events across separate writes", async () => {
    const chunks = await collect(
      streamFrom('data: {"type":"token","delta":"a"}\n\n', 'data: {"type":"token","delta":"b"}\n\n')
    );
    expect(chunks).toEqual([
      { type: "token", delta: "a" },
      { type: "token", delta: "b" },
    ]);
  });

  it("reassembles an event split mid-write", async () => {
    const chunks = await collect(streamFrom('data: {"type":"tok', 'en","delta":"hi"}\n\n'));
    expect(chunks).toEqual([{ type: "token", delta: "hi" }]);
  });

  it("ignores events with no data line", async () => {
    const chunks = await collect(streamFrom("event: ping\n\n", 'data: {"type":"done"}\n\n'));
    expect(chunks).toEqual([{ type: "done" }]);
  });

  it("ignores malformed JSON in a data line", async () => {
    const chunks = await collect(streamFrom("data: not-json\n\n", 'data: {"type":"done"}\n\n'));
    expect(chunks).toEqual([{ type: "done" }]);
  });

  it("yields nothing for an empty stream", async () => {
    const chunks = await collect(streamFrom());
    expect(chunks).toEqual([]);
  });
});
