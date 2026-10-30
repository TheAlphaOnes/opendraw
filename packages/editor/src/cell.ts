/**
 * Cell, the smallest observable value: read and write `.value`, subscribe
 * to changes. The editor's transient session state (the live gesture, the
 * marquee, the hover point) lives in cells so the framework-free canvas can
 * react to it, and adapters can mirror it into their own reactivity.
 *
 * Writes that keep the same value (Object.is) notify nobody.
 */
export class Cell<T> {
  private current: T
  private readonly listeners = new Set<(value: T) => void>()

  constructor(initial: T) {
    this.current = initial
  }

  get value(): T {
    return this.current
  }

  set value(next: T) {
    if (Object.is(next, this.current)) {
      return
    }
    this.current = next
    for (const listener of this.listeners) {
      listener(next)
    }
  }

  /** Calls `listener` after every change; returns the unsubscribe. */
  subscribe(listener: (value: T) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}
