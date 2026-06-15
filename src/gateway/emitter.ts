/**
 * A tiny, dependency-free typed event emitter. Keys of the event map are event names and
 * values are payload types. Listeners are stored per name, plus a catch-all set that
 * receives every emitted event. Adding a listener returns an unsubscribe function.
 */

/** A listener for the payload type `P`. A `void` payload is called with no argument. */
export type Listener<P> = [P] extends [void] ? () => void : (payload: P) => void;

/** A catch-all listener receiving the event name and its payload. */
export type AnyListener<M> = <K extends keyof M>(name: K, payload: M[K]) => void;

/** Removes a previously added listener. Safe to call more than once. */
export type Unsubscribe = () => void;

/**
 * A strongly-typed event emitter over a `{ name: payload }` map.
 *
 * @example
 * interface Events { ping: void; data: { value: number } }
 * const emitter = new TypedEmitter<Events>();
 * const off = emitter.on("data", (d) => console.log(d.value));
 * emitter.emit("data", { value: 1 });
 * off();
 *
 * @example
 * emitter.onAny((name, payload) => console.log(name, payload));
 */
export class TypedEmitter<M> {
  private readonly listeners = new Map<keyof M, Set<(payload: unknown) => void>>();
  private readonly anyListeners = new Set<(name: keyof M, payload: unknown) => void>();

  /** Subscribes to an event. Returns a function that unsubscribes. */
  on<K extends keyof M>(name: K, listener: Listener<M[K]>): Unsubscribe {
    const set = this.listeners.get(name) ?? new Set();
    const wrapped = listener as (payload: unknown) => void;
    set.add(wrapped);
    this.listeners.set(name, set);
    return () => this.removeListener(name, wrapped);
  }

  /** Subscribes to an event for a single emission, then unsubscribes automatically. */
  once<K extends keyof M>(name: K, listener: Listener<M[K]>): Unsubscribe {
    const off = this.on(name, ((payload: M[K]) => {
      off();
      (listener as (payload: M[K]) => void)(payload);
    }) as Listener<M[K]>);
    return off;
  }

  /** Removes a listener for an event, or all listeners for the event when none is given. */
  off<K extends keyof M>(name: K, listener?: Listener<M[K]>): void {
    if (!listener) {
      this.listeners.delete(name);
      return;
    }
    this.removeListener(name, listener as (payload: unknown) => void);
  }

  /** Subscribes a catch-all listener invoked for every emitted event. Returns an unsubscribe. */
  onAny(listener: AnyListener<M>): Unsubscribe {
    const wrapped = listener as (name: keyof M, payload: unknown) => void;
    this.anyListeners.add(wrapped);
    return () => {
      this.anyListeners.delete(wrapped);
    };
  }

  /** Removes a previously added catch-all listener. */
  offAny(listener: AnyListener<M>): void {
    this.anyListeners.delete(listener as (name: keyof M, payload: unknown) => void);
  }

  /** Emits an event to its listeners and to every catch-all listener. */
  emit<K extends keyof M>(name: K, ...args: [M[K]] extends [void] ? [] : [M[K]]): void {
    const payload = (args.length > 0 ? args[0] : undefined) as M[K];
    const set = this.listeners.get(name);
    if (set) {
      // Copy so a listener can safely unsubscribe during dispatch.
      for (const listener of [...set]) {
        listener(payload);
      }
    }
    if (this.anyListeners.size > 0) {
      for (const listener of [...this.anyListeners]) {
        listener(name, payload);
      }
    }
  }

  /** Number of listeners registered for an event (excluding catch-all listeners). */
  listenerCount<K extends keyof M>(name: K): number {
    return this.listeners.get(name)?.size ?? 0;
  }

  /** Removes every listener, including catch-all listeners. */
  removeAllListeners(): void {
    this.listeners.clear();
    this.anyListeners.clear();
  }

  private removeListener(name: keyof M, listener: (payload: unknown) => void): void {
    const set = this.listeners.get(name);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) this.listeners.delete(name);
  }
}
