// A disconnected reader is not a cancellation of already-started paid work.
// Keep accounting and durable commit registered for the invocation lifetime.
export async function backgroundExplanationResponse(
  run: (emit: (event: any) => void) => Promise<Response>,
  waitUntil: (work: Promise<unknown>) => void,
  streaming: boolean
): Promise<Response> {
  if (!streaming) { const work = run(() => {}); waitUntil(work); return work; }
  const encoder = new TextEncoder(); let connected = true;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: any) => {
        if (connected) try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); } catch { connected = false; }
      };
      const work = (async () => {
        try { const response = await run(emit); emit({type: "result", status: response.status, data: await response.json()}); }
        finally { if (connected) try { controller.close(); } catch {} }
      })();
      waitUntil(work);
    },
    cancel() { connected = false; }
  });
  return new Response(stream, {headers: {"Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"}});
}
