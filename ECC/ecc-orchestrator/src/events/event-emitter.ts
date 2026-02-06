/**
 * Event Emitter for ECC Orchestrator
 *
 * Type-safe event emitter implementation with support for:
 * - Strongly typed events based on EventDataMap
 * - once() handlers that auto-remove
 * - Error isolation between handlers
 * - Listener count management with warnings
 */

import type {
  EngineEventType,
  EventDataMap,
  EngineEventHandler,
  EngineEvent,
} from './event-types.js';

// ============================================================================
// Emitter Interface
// ============================================================================

/**
 * Configuration options for the event emitter.
 */
export interface EventEmitterOptions {
  /**
   * Maximum listeners per event before warning.
   * @default 10
   */
  maxListeners?: number;

  /**
   * Custom warning handler. Defaults to console.warn.
   */
  onWarning?: (message: string) => void;

  /**
   * Custom error handler for exceptions in event handlers.
   * Defaults to console.error.
   */
  onError?: (error: Error, event: EngineEventType) => void;
}

/**
 * Type-safe event emitter interface for engine events.
 */
export interface EngineEventEmitter {
  /**
   * Register a handler for an event type.
   */
  on<T extends EngineEventType>(event: T, handler: EngineEventHandler<T>): void;

  /**
   * Remove a specific handler for an event type.
   */
  off<T extends EngineEventType>(event: T, handler: EngineEventHandler<T>): void;

  /**
   * Register a handler that fires once then auto-removes.
   */
  once<T extends EngineEventType>(event: T, handler: EngineEventHandler<T>): void;

  /**
   * Emit an event to all registered handlers.
   * Automatically adds timestamp to the event.
   */
  emit<T extends EngineEventType>(event: T, data: EventDataMap[T]): void;

  /**
   * Get the number of listeners for an event type.
   */
  listenerCount(event: EngineEventType): number;

  /**
   * Remove all listeners for a specific event, or all events if none specified.
   */
  removeAllListeners(event?: EngineEventType): void;

  /**
   * Get all event types that have listeners.
   */
  eventNames(): EngineEventType[];
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Internal handler wrapper to track once handlers.
 */
interface HandlerEntry {
  handler: EngineEventHandler<EngineEventType>;
  once: boolean;
}

/**
 * Creates a new type-safe event emitter instance.
 */
export function createEventEmitter(options?: EventEmitterOptions): EngineEventEmitter {
  const maxListeners = options?.maxListeners ?? 10;
  const onWarning = options?.onWarning ?? console.warn.bind(console);
  const onError = options?.onError ?? ((err) => console.error('[EventEmitter] Handler error:', err));

  // Storage: event type -> set of handler entries
  const listeners = new Map<EngineEventType, Set<HandlerEntry>>();

  // Track warned events to avoid spamming
  const warnedEvents = new Set<EngineEventType>();

  /**
   * Get or create the listener set for an event.
   */
  function getListenerSet(event: EngineEventType): Set<HandlerEntry> {
    let set = listeners.get(event);
    if (!set) {
      set = new Set();
      listeners.set(event, set);
    }
    return set;
  }

  /**
   * Check listener count and warn if exceeded.
   */
  function checkMaxListeners(event: EngineEventType, set: Set<HandlerEntry>): void {
    if (set.size > maxListeners && !warnedEvents.has(event)) {
      warnedEvents.add(event);
      onWarning(
        `[EventEmitter] Possible memory leak: ${set.size} listeners for '${event}' ` +
        `(max: ${maxListeners}). Use removeAllListeners() if intentional.`
      );
    }
  }

  /**
   * Find a handler entry by its handler function.
   */
  function findEntry(
    set: Set<HandlerEntry>,
    handler: EngineEventHandler<EngineEventType>
  ): HandlerEntry | undefined {
    for (const entry of set) {
      if (entry.handler === handler) {
        return entry;
      }
    }
    return undefined;
  }

  const emitter: EngineEventEmitter = {
    on<T extends EngineEventType>(event: T, handler: EngineEventHandler<T>): void {
      const set = getListenerSet(event);
      // Don't add duplicate handlers
      if (!findEntry(set, handler as EngineEventHandler<EngineEventType>)) {
        set.add({
          handler: handler as EngineEventHandler<EngineEventType>,
          once: false,
        });
        checkMaxListeners(event, set);
      }
    },

    off<T extends EngineEventType>(event: T, handler: EngineEventHandler<T>): void {
      const set = listeners.get(event);
      if (!set) return;

      const entry = findEntry(set, handler as EngineEventHandler<EngineEventType>);
      if (entry) {
        set.delete(entry);
        // Clean up empty sets
        if (set.size === 0) {
          listeners.delete(event);
          warnedEvents.delete(event);
        }
      }
    },

    once<T extends EngineEventType>(event: T, handler: EngineEventHandler<T>): void {
      const set = getListenerSet(event);
      // Don't add duplicate handlers
      if (!findEntry(set, handler as EngineEventHandler<EngineEventType>)) {
        set.add({
          handler: handler as EngineEventHandler<EngineEventType>,
          once: true,
        });
        checkMaxListeners(event, set);
      }
    },

    emit<T extends EngineEventType>(event: T, data: EventDataMap[T]): void {
      const set = listeners.get(event);
      if (!set || set.size === 0) return;

      // Create the full event object with timestamp
      const fullEvent: EngineEvent<T> = {
        type: event,
        timestamp: new Date().toISOString(),
        data,
      };

      // Collect entries to iterate (prevents modification during iteration)
      const entries = Array.from(set);
      const toRemove: HandlerEntry[] = [];

      for (const entry of entries) {
        // Mark once handlers for removal
        if (entry.once) {
          toRemove.push(entry);
        }

        // Call handler with error isolation
        try {
          entry.handler(fullEvent.data);
        } catch (err) {
          onError(
            err instanceof Error ? err : new Error(String(err)),
            event
          );
        }
      }

      // Remove once handlers after all have been called
      for (const entry of toRemove) {
        set.delete(entry);
      }

      // Clean up empty sets
      if (set.size === 0) {
        listeners.delete(event);
        warnedEvents.delete(event);
      }
    },

    listenerCount(event: EngineEventType): number {
      return listeners.get(event)?.size ?? 0;
    },

    removeAllListeners(event?: EngineEventType): void {
      if (event !== undefined) {
        listeners.delete(event);
        warnedEvents.delete(event);
      } else {
        listeners.clear();
        warnedEvents.clear();
      }
    },

    eventNames(): EngineEventType[] {
      return Array.from(listeners.keys());
    },
  };

  return emitter;
}

// ============================================================================
// Utility Types and Functions
// ============================================================================

/**
 * Creates a Promise that resolves when an event is emitted.
 * Useful for async/await patterns with events.
 */
export function waitForEvent<T extends EngineEventType>(
  emitter: EngineEventEmitter,
  event: T,
  options?: { timeout?: number }
): Promise<EventDataMap[T]> {
  return new Promise((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const handler: EngineEventHandler<T> = (data) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      resolve(data);
    };

    emitter.once(event, handler);

    if (options?.timeout) {
      timeoutId = setTimeout(() => {
        emitter.off(event, handler);
        reject(new Error(`Timeout waiting for event '${event}'`));
      }, options.timeout);
    }
  });
}

/**
 * Creates a filtered event emitter that only forwards specific events.
 */
export function createFilteredEmitter(
  source: EngineEventEmitter,
  filter: (event: EngineEventType) => boolean
): EngineEventEmitter {
  const filtered = createEventEmitter();

  // Forward filtered events from source to filtered emitter
  const forward = <T extends EngineEventType>(event: T) => {
    if (filter(event)) {
      source.on(event, (data) => {
        filtered.emit(event, data);
      });
    }
  };

  // Set up forwarding for all event types that pass the filter
  // This is done lazily when listeners are added
  const originalOn = filtered.on.bind(filtered);
  let forwardingSetup = false;

  filtered.on = <T extends EngineEventType>(event: T, handler: EngineEventHandler<T>) => {
    if (!forwardingSetup) {
      forwardingSetup = true;
      // We can't iterate EngineEventType at runtime, so forwarding must be set up
      // by the caller using source.on() directly if they need all events
    }
    forward(event);
    originalOn(event, handler);
  };

  return filtered;
}
