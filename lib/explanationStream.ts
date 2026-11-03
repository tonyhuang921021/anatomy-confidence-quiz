// Bounded SSE decoding shared by provider and browser. A truncated stream is
// never a completed generation; callers must require their final event.
export async function readJsonEvents(body: ReadableStream<Uint8Array>, onEvent: (event: any) => void) {
  const reader = body.getReader(), decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer = (buffer + decoder.decode(value, { stream: !done })).replace(/\r\n/g, "\n");
      if (buffer.length > 262144) throw Error("stream frame too large");
      let end: number;
      while ((end = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        const data = frame.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
        if (data && data !== "[DONE]") onEvent(JSON.parse(data));
      }
      if (done) break;
    }
  } finally { reader.releaseLock(); }
}

// Only the first root property requested by our prompt may be previewed.
// Incomplete escapes and unmatched surrogate halves stay hidden. Final JSON
// still passes the existing complete-payload validation before any persistence.
export function explanationPrefix(json: string): string {
  const start = /^\s*(?:```(?:json)?\s*)?\{\s*"explanation"\s*:\s*"/.exec(json);
  if (!start) return "";
  let i = start[0].length, end = i;
  while (i < json.length) {
    const c = json[i];
    if (c === '"') break;
    if (c === '\\') {
      if (i + 1 >= json.length) break;
      if (json[i + 1] === 'u') {
        if (!/^[0-9a-fA-F]{4}$/.test(json.slice(i + 2, i + 6))) break;
        i += 6;
      } else { if (!'"\\/bfnrt'.includes(json[i + 1])) break; i += 2; }
    } else { if (c.charCodeAt(0) < 32) break; i++; }
    end = i;
  }
  try {
    const text = JSON.parse('"' + json.slice(start[0].length, end) + '"') as string;
    return text.replace(/[\uD800-\uDBFF]$/, "");
  } catch { return ""; }
}
