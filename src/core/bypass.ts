/** True only while we re-trigger a send ourselves; the interceptor lets that one through. */
let active = false;

export function isBypassing(): boolean {
  return active;
}

/** Runs a re-triggered send synchronously with the interceptor switched off for it. */
export function withBypass(send: () => void): void {
  active = true;
  try {
    send();
  } finally {
    active = false;
  }
}

export function deepTarget(event: Event): EventTarget | null {
  return event.composedPath()[0] ?? event.target;
}
