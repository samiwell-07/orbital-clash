import type { Emit, Intent, System, World } from '@/types';

export type IntentHandler = (w: World, intent: Intent, emit: Emit) => boolean;

const handlers: IntentHandler[] = [];
const pending = new WeakMap<World, Intent[]>();

/** Handlers run in registration order; the first to return true consumes the intent. Returns an unregister fn. */
export function registerIntentHandler(fn: IntentHandler): () => void {
  handlers.push(fn);
  return () => {
    const i = handlers.indexOf(fn);
    if (i >= 0) handlers.splice(i, 1);
  };
}

export function queueIntents(w: World, intents: readonly Intent[]): void {
  let q = pending.get(w);
  if (!q) {
    q = [];
    pending.set(w, q);
  }
  for (const it of intents) q.push(it);
}

/** Pipeline stage 'applyIntents': dispatches this tick's queued intents. */
export const applyIntentsSystem: System = (w, _dt, emit) => {
  const q = pending.get(w);
  if (!q || q.length === 0) return;
  const batch = q.splice(0, q.length);
  for (const intent of batch) {
    for (const h of handlers) if (h(w, intent, emit)) break;
  }
};
