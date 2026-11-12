/** Memory-only, bounded scheduling. This helper never creates payments or holds credentials. */
export const AUTO_RECONCILE_DELAYS_MS = Object.freeze([2500, 8000, 15000, 30000, 60000]);
export const AUTO_RECONCILE_WINDOW_MS = 600000;
export function createSandboxAutoReconciler({ run, onState, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let attempts = 0;
  let timer = null;
  let running = false;
  let paused = false;
  let stopped = false;
  const deadline = now() + AUTO_RECONCILE_WINDOW_MS;
  let nextAt = now() + AUTO_RECONCILE_DELAYS_MS[0];
  const emit = (state) => onState(state);
  function cancel() { stopped = true; if (timer !== null) clearTimer(timer); timer = null; }
  function finish(state) { cancel(); emit(state); }
  function resume() {
    if (stopped) return;
    paused = false;
    if (now() >= deadline || attempts >= AUTO_RECONCILE_DELAYS_MS.length) { finish('exhausted'); return; }
    if (running || timer !== null) return;
    emit('waiting');
    timer = setTimer(async () => {
      timer = null;
      if (stopped || paused) return;
      if (now() >= deadline) { finish('exhausted'); return; }
      running = true; attempts++; emit('running');
      let outcome;
      try { outcome = await run(); } catch { outcome = 'pending'; }
      running = false;
      if (stopped) return;
      if (outcome === 'terminal' || outcome === 'blocked') { finish('stopped'); return; }
      // Sharing the component request lock does not consume an OEN attempt.
      if (outcome === 'busy') attempts--;
      if (now() >= deadline || attempts >= AUTO_RECONCILE_DELAYS_MS.length) { finish('exhausted'); return; }
      nextAt = now() + (outcome === 'busy' ? 1000 : AUTO_RECONCILE_DELAYS_MS[attempts]);
      if (paused) emit('paused'); else resume();
    }, Math.min(Math.max(0, nextAt - now()), Math.max(0, deadline - now())));
  }
  function pause() {
    if (stopped) return;
    paused = true;
    if (timer !== null) clearTimer(timer);
    timer = null;
    if (!running) emit('paused');
  }
  return { resume, pause, cancel, stop: () => finish('stopped') };
}
