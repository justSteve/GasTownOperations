/**
 * Event Transport for ECC Orchestrator
 *
 * Bridges the logging system to the event system by emitting log entries
 * as 'log:entry' events on the engine event emitter.
 */

import type { LogTransport, LogEntry } from '../types.js';
import type { EngineEventEmitter } from '../../events/event-emitter.js';

/**
 * Configuration options for EventTransport
 */
export interface EventTransportOptions {
  /** The event emitter to send log events to */
  emitter: EngineEventEmitter;
}

/**
 * Transport that bridges log entries to the event system.
 *
 * Each log entry is emitted as a 'log:entry' event on the provided
 * EngineEventEmitter instance. This allows other parts of the system
 * to subscribe to and react to log events in a type-safe manner.
 *
 * @example
 * ```typescript
 * const emitter = createEventEmitter();
 * const transport = new EventTransport({ emitter });
 *
 * emitter.on('log:entry', (data) => {
 *   console.log(`[${data.level}] ${data.message}`);
 * });
 *
 * transport.write({
 *   timestamp: new Date().toISOString(),
 *   level: 'INFO',
 *   message: 'Hello, events!',
 *   context: { userId: '123' }
 * });
 * // Logs: [INFO] Hello, events!
 * ```
 */
export class EventTransport implements LogTransport {
  readonly name = 'event';
  private emitter: EngineEventEmitter;

  constructor(options: EventTransportOptions) {
    this.emitter = options.emitter;
  }

  /**
   * Write a log entry by emitting it as a 'log:entry' event.
   *
   * Maps the LogEntry structure to the EventDataMap['log:entry'] format.
   * The timestamp, level, message, and optional context are preserved.
   *
   * @param entry - The log entry to emit as an event
   */
  write(entry: LogEntry): void {
    const eventData: {
      timestamp: string;
      level: string;
      message: string;
      context?: Record<string, unknown>;
    } = {
      timestamp: entry.timestamp,
      level: entry.level,
      message: entry.message,
    };

    if (entry.context !== undefined) {
      eventData.context = entry.context;
    }

    this.emitter.emit('log:entry', eventData);
  }
}
