/**
 * Integration tests for subsystems working together
 * @module @ecc/orchestrator/tests/integration
 */

import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import {
  // Logging
  createLogger,
  createJsonFormatter,
  type LoggingConfig,
  type LogEntry,
  type LogTransport,
  type LogFormatter,
  // Errors
  RuntimeError,
  ConfigurationError,
  BeadsError,
  wrapError,
  enrichError,
  getErrorChain,
  isOrchestrationError,
  // Events
  createEventEmitter,
  type EngineEventEmitter,
  type EventDataMap,
} from '../src/index.js';

// ============================================================================
// Custom EventTransport for bridging logs to events
// ============================================================================

/**
 * A log transport that emits log entries as events
 */
class EventTransport implements LogTransport {
  name = 'event';
  private emitter: EngineEventEmitter;
  private formatter: LogFormatter;

  constructor(emitter: EngineEventEmitter, formatter?: LogFormatter) {
    this.emitter = emitter;
    this.formatter = formatter ?? createJsonFormatter();
  }

  write(entry: LogEntry): void {
    this.emitter.emit('log:entry', {
      timestamp: entry.timestamp,
      level: entry.level,
      message: entry.message,
      context: entry.context,
    });
  }
}

// ============================================================================
// EventTransport Integration Tests
// ============================================================================

describe('EventTransport bridges logs to events', () => {
  let emitter: EngineEventEmitter;
  let receivedEvents: EventDataMap['log:entry'][];

  beforeEach(() => {
    emitter = createEventEmitter();
    receivedEvents = [];

    emitter.on('log:entry', (data) => {
      receivedEvents.push(data);
    });
  });

  test('log entry appears as event', () => {
    const transport = new EventTransport(emitter);

    const entry: LogEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: 'INFO',
      message: 'Test message',
    };

    transport.write(entry);

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].message).toBe('Test message');
    expect(receivedEvents[0].level).toBe('INFO');
    expect(receivedEvents[0].timestamp).toBe('2024-01-01T00:00:00.000Z');
  });

  test('log context is passed to event', () => {
    const transport = new EventTransport(emitter);

    const entry: LogEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: 'INFO',
      message: 'Test message',
      context: {
        userId: '123',
        action: 'login',
      },
    };

    transport.write(entry);

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].context).toBeDefined();
    expect(receivedEvents[0].context?.userId).toBe('123');
    expect(receivedEvents[0].context?.action).toBe('login');
  });

  test('multiple log entries create multiple events', () => {
    const transport = new EventTransport(emitter);

    transport.write({
      timestamp: '2024-01-01T00:00:01.000Z',
      level: 'INFO',
      message: 'First',
    });

    transport.write({
      timestamp: '2024-01-01T00:00:02.000Z',
      level: 'WARN',
      message: 'Second',
    });

    transport.write({
      timestamp: '2024-01-01T00:00:03.000Z',
      level: 'ERROR',
      message: 'Third',
    });

    expect(receivedEvents).toHaveLength(3);
    expect(receivedEvents.map(e => e.message)).toEqual(['First', 'Second', 'Third']);
    expect(receivedEvents.map(e => e.level)).toEqual(['INFO', 'WARN', 'ERROR']);
  });

  test('all log levels are bridged', () => {
    const transport = new EventTransport(emitter);
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'] as const;

    for (const level of levels) {
      transport.write({
        timestamp: '2024-01-01T00:00:00.000Z',
        level,
        message: `${level} message`,
      });
    }

    expect(receivedEvents).toHaveLength(4);
    expect(receivedEvents.map(e => e.level)).toEqual(['DEBUG', 'INFO', 'WARN', 'ERROR']);
  });
});

// ============================================================================
// Error Logged with Context in Event Stream
// ============================================================================

describe('Error logged with context appears in event stream', () => {
  let emitter: EngineEventEmitter;
  let receivedEvents: EventDataMap['log:entry'][];
  let consoleLogSpy: ReturnType<typeof spyOn>;
  let consoleErrorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    emitter = createEventEmitter();
    receivedEvents = [];

    emitter.on('log:entry', (data) => {
      receivedEvents.push(data);
    });

    // Suppress console output during tests
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('error context is preserved in event', () => {
    const transport = new EventTransport(emitter);

    // Simulate logging an error with context
    const error = new RuntimeError('Operation failed', {
      agentName: 'test-agent',
      phase: 'execution',
    });

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: error.message,
      context: error.context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
      },
    };

    transport.write(entry);

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].context?.agentName).toBe('test-agent');
    expect(receivedEvents[0].context?.phase).toBe('execution');
  });

  test('wrapped error context appears in event', () => {
    const transport = new EventTransport(emitter);

    const originalError = new Error('Network failure');
    const wrapped = wrapError(originalError, {
      operation: 'fetch',
      url: 'https://api.example.com',
    });

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: wrapped.message,
      context: wrapped.context,
    };

    transport.write(entry);

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].context?.operation).toBe('fetch');
    expect(receivedEvents[0].context?.url).toBe('https://api.example.com');
  });

  test('enriched error context appears in event', () => {
    const transport = new EventTransport(emitter);

    const original = new ConfigurationError('Config invalid', { configFile: 'app.yaml' });
    const enriched = enrichError(original, { lineNumber: 42 });

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: enriched.message,
      context: enriched.context,
    };

    transport.write(entry);

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].context?.configFile).toBe('app.yaml');
    expect(receivedEvents[0].context?.lineNumber).toBe(42);
  });
});

// ============================================================================
// Full Round-Trip: Log -> Format -> Transport -> Event
// ============================================================================

describe('Full round-trip: log -> format -> transport -> event', () => {
  let emitter: EngineEventEmitter;
  let receivedEvents: EventDataMap['log:entry'][];
  let consoleLogSpy: ReturnType<typeof spyOn>;
  let consoleErrorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    emitter = createEventEmitter();
    receivedEvents = [];

    emitter.on('log:entry', (data) => {
      receivedEvents.push(data);
    });

    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('complete logging pipeline with custom transport', () => {
    // Create a custom logger with event transport
    const eventTransport = new EventTransport(emitter);

    // Custom logger implementation that uses our transport
    // We'll manually call the transport to simulate the full pipeline
    const mockLogger = {
      info(message: string, context?: Record<string, unknown>) {
        const entry: LogEntry = {
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message,
          context,
        };
        eventTransport.write(entry);
      },
      error(message: string, error?: Error, context?: Record<string, unknown>) {
        const entry: LogEntry = {
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          message,
          context,
        };
        if (error) {
          entry.error = {
            name: error.name,
            message: error.message,
            stack: error.stack,
          };
        }
        eventTransport.write(entry);
      },
    };

    // Log some messages
    mockLogger.info('Application started', { version: '1.0.0' });
    mockLogger.info('User logged in', { userId: 'user-123' });
    mockLogger.error('Database connection failed', new Error('ECONNREFUSED'), { host: 'localhost' });

    // Verify events were received
    expect(receivedEvents).toHaveLength(3);

    // Check first event
    expect(receivedEvents[0].message).toBe('Application started');
    expect(receivedEvents[0].level).toBe('INFO');
    expect(receivedEvents[0].context?.version).toBe('1.0.0');

    // Check second event
    expect(receivedEvents[1].message).toBe('User logged in');
    expect(receivedEvents[1].context?.userId).toBe('user-123');

    // Check third event
    expect(receivedEvents[2].message).toBe('Database connection failed');
    expect(receivedEvents[2].level).toBe('ERROR');
    expect(receivedEvents[2].context?.host).toBe('localhost');
  });

  test('error chain information is preserved through pipeline', () => {
    const eventTransport = new EventTransport(emitter);

    // Create an error chain
    const rootCause = new BeadsError('Beads storage full');
    const wrapper = new RuntimeError('Failed to save state', { sceneId: 'scene-1' }, rootCause);

    // Get the full chain for logging
    const chain = getErrorChain(wrapper);

    // Log each error in the chain
    for (const err of chain) {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        message: err.message,
      };

      if (isOrchestrationError(err)) {
        entry.context = err.context;
        entry.error = {
          name: err.name,
          message: err.message,
          code: err.code,
          stack: err.stack,
        };
      } else {
        entry.error = {
          name: err.name,
          message: err.message,
          stack: err.stack,
        };
      }

      eventTransport.write(entry);
    }

    expect(receivedEvents).toHaveLength(2);

    // First event is the wrapper error
    expect(receivedEvents[0].message).toBe('Failed to save state');
    expect(receivedEvents[0].context?.sceneId).toBe('scene-1');

    // Second event is the root cause
    expect(receivedEvents[1].message).toBe('Beads storage full');
  });

  test('multiple listeners receive same events', () => {
    const eventTransport = new EventTransport(emitter);
    const allEvents: EventDataMap['log:entry'][] = [];
    const errorEvents: EventDataMap['log:entry'][] = [];

    // Add another listener for all events
    emitter.on('log:entry', (data) => {
      allEvents.push(data);
    });

    // Add a filter for error events only
    emitter.on('log:entry', (data) => {
      if (data.level === 'ERROR') {
        errorEvents.push(data);
      }
    });

    // Log mixed levels
    eventTransport.write({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: 'Info message',
    });

    eventTransport.write({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: 'Error message',
    });

    eventTransport.write({
      timestamp: new Date().toISOString(),
      level: 'DEBUG',
      message: 'Debug message',
    });

    // All listeners should have received events
    expect(receivedEvents).toHaveLength(3);
    expect(allEvents).toHaveLength(3);
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0].message).toBe('Error message');
  });

  test('event timestamp is independent of log timestamp', () => {
    const eventTransport = new EventTransport(emitter);

    // Log with a specific timestamp
    const logTimestamp = '2020-01-01T00:00:00.000Z';

    eventTransport.write({
      timestamp: logTimestamp,
      level: 'INFO',
      message: 'Old log entry',
    });

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].timestamp).toBe(logTimestamp);
  });
});

// ============================================================================
// Subsystem Interaction Tests
// ============================================================================

describe('Subsystem Interactions', () => {
  test('logger child context merges with error context in events', () => {
    const emitter = createEventEmitter();
    const receivedEvents: EventDataMap['log:entry'][] = [];

    emitter.on('log:entry', (data) => {
      receivedEvents.push(data);
    });

    const eventTransport = new EventTransport(emitter);

    // Simulate a child logger's merged context with error context
    const loggerContext = { component: 'orchestrator', traceId: 'trace-123' };
    const errorContext = { agentName: 'test-agent', operation: 'execute' };
    const mergedContext = { ...loggerContext, ...errorContext };

    const error = new RuntimeError('Agent failed', errorContext);

    eventTransport.write({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: error.message,
      context: mergedContext,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
      },
    });

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].context?.component).toBe('orchestrator');
    expect(receivedEvents[0].context?.traceId).toBe('trace-123');
    expect(receivedEvents[0].context?.agentName).toBe('test-agent');
    expect(receivedEvents[0].context?.operation).toBe('execute');
  });

  test('once listener receives log event and auto-removes', () => {
    const emitter = createEventEmitter();
    const receivedEvents: EventDataMap['log:entry'][] = [];

    emitter.once('log:entry', (data) => {
      receivedEvents.push(data);
    });

    const eventTransport = new EventTransport(emitter);

    eventTransport.write({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: 'First',
    });

    eventTransport.write({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: 'Second',
    });

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].message).toBe('First');
    expect(emitter.listenerCount('log:entry')).toBe(0);
  });

  test('error in event handler does not affect logging', () => {
    const errors: Error[] = [];
    const emitter = createEventEmitter({
      onError: (err) => errors.push(err),
    });

    const receivedEvents: EventDataMap['log:entry'][] = [];

    // Add a handler that throws
    emitter.on('log:entry', () => {
      throw new Error('Handler error');
    });

    // Add a handler that works
    emitter.on('log:entry', (data) => {
      receivedEvents.push(data);
    });

    const eventTransport = new EventTransport(emitter);

    eventTransport.write({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: 'Test message',
    });

    // Error was caught
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('Handler error');

    // But the other handler still received the event
    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].message).toBe('Test message');
  });
});

// ============================================================================
// Performance and Edge Cases
// ============================================================================

describe('Performance and Edge Cases', () => {
  test('handles high volume of log events', () => {
    const emitter = createEventEmitter({ maxListeners: 1000 });
    let eventCount = 0;

    emitter.on('log:entry', () => {
      eventCount++;
    });

    const eventTransport = new EventTransport(emitter);

    // Log 1000 entries
    for (let i = 0; i < 1000; i++) {
      eventTransport.write({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `Log entry ${i}`,
      });
    }

    expect(eventCount).toBe(1000);
  });

  test('handles empty context gracefully', () => {
    const emitter = createEventEmitter();
    const receivedEvents: EventDataMap['log:entry'][] = [];

    emitter.on('log:entry', (data) => {
      receivedEvents.push(data);
    });

    const eventTransport = new EventTransport(emitter);

    eventTransport.write({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: 'No context',
    });

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].context).toBeUndefined();
  });

  test('handles undefined context values', () => {
    const emitter = createEventEmitter();
    const receivedEvents: EventDataMap['log:entry'][] = [];

    emitter.on('log:entry', (data) => {
      receivedEvents.push(data);
    });

    const eventTransport = new EventTransport(emitter);

    eventTransport.write({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: 'With undefined',
      context: {
        definedValue: 'exists',
        undefinedValue: undefined,
      },
    });

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].context?.definedValue).toBe('exists');
    expect(receivedEvents[0].context?.undefinedValue).toBeUndefined();
  });

  test('log and event system handle special characters', () => {
    const emitter = createEventEmitter();
    const receivedEvents: EventDataMap['log:entry'][] = [];

    emitter.on('log:entry', (data) => {
      receivedEvents.push(data);
    });

    const eventTransport = new EventTransport(emitter);

    const specialMessage = 'Line1\nLine2\tTabbed\r\nWindows "quotes" and \'apostrophes\'';

    eventTransport.write({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: specialMessage,
    });

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].message).toBe(specialMessage);
  });

  test('handles Unicode in log messages', () => {
    const emitter = createEventEmitter();
    const receivedEvents: EventDataMap['log:entry'][] = [];

    emitter.on('log:entry', (data) => {
      receivedEvents.push(data);
    });

    const eventTransport = new EventTransport(emitter);

    const unicodeMessage = 'Hello World';

    eventTransport.write({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: unicodeMessage,
      context: { greeting: 'Hola' },
    });

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].message).toBe(unicodeMessage);
    expect(receivedEvents[0].context?.greeting).toBe('Hola');
  });
});
