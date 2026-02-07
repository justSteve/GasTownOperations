/**
 * Tests for the logging subsystem
 * @module @ecc/orchestrator/tests/logging
 */

import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import {
  createLogger,
  createNullLogger,
  createJsonFormatter,
  createPrettyFormatter,
  DEFAULT_DEV_CONFIG,
  DEFAULT_PROD_CONFIG,
  type LoggingConfig,
  type LogEntry,
  type LogLevel,
  LOG_LEVEL_VALUES,
} from '../src/index.js';

// ============================================================================
// Logger Creation Tests
// ============================================================================

describe('Logger Creation', () => {
  test('createLogger with dev config returns a working logger', () => {
    const logger = createLogger(DEFAULT_DEV_CONFIG);
    expect(logger).toBeDefined();
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.child).toBe('function');
    expect(typeof logger.event).toBe('function');
  });

  test('createLogger with prod config returns a working logger', () => {
    const logger = createLogger(DEFAULT_PROD_CONFIG);
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
  });

  test('createLogger with custom config', () => {
    const config: LoggingConfig = {
      level: 'WARN',
      format: 'json',
      transports: [{ type: 'console' }],
    };
    const logger = createLogger(config);
    expect(logger).toBeDefined();
  });

  test('createNullLogger returns a no-op logger', () => {
    const logger = createNullLogger();
    expect(logger).toBeDefined();
    // These should not throw
    logger.debug('test');
    logger.info('test');
    logger.warn('test');
    logger.error('test', new Error('test'));
    logger.event('test', {});
    const child = logger.child({ key: 'value' });
    expect(child).toBe(logger); // Should return itself
  });
});

// ============================================================================
// Level Filtering Tests
// ============================================================================

describe('Level Filtering', () => {
  let consoleSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;
  let capturedLogs: string[];

  beforeEach(() => {
    capturedLogs = [];
    consoleSpy = spyOn(console, 'log').mockImplementation((msg: string) => {
      capturedLogs.push(msg);
    });
    errorSpy = spyOn(console, 'error').mockImplementation((msg: string) => {
      capturedLogs.push(msg);
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('DEBUG logs appear when level=DEBUG', () => {
    const logger = createLogger({
      level: 'DEBUG',
      format: 'json',
      transports: [{ type: 'console' }],
    });

    logger.debug('debug message');
    expect(capturedLogs.length).toBe(1);
    expect(capturedLogs[0]).toContain('debug message');
  });

  test('DEBUG logs do not appear when level=INFO', () => {
    const logger = createLogger({
      level: 'INFO',
      format: 'json',
      transports: [{ type: 'console' }],
    });

    logger.debug('debug message');
    expect(capturedLogs.length).toBe(0);
  });

  test('INFO logs appear when level=INFO', () => {
    const logger = createLogger({
      level: 'INFO',
      format: 'json',
      transports: [{ type: 'console' }],
    });

    logger.info('info message');
    expect(capturedLogs.length).toBe(1);
    expect(capturedLogs[0]).toContain('info message');
  });

  test('INFO logs do not appear when level=WARN', () => {
    const logger = createLogger({
      level: 'WARN',
      format: 'json',
      transports: [{ type: 'console' }],
    });

    logger.info('info message');
    expect(capturedLogs.length).toBe(0);
  });

  test('WARN logs appear when level=WARN', () => {
    const logger = createLogger({
      level: 'WARN',
      format: 'json',
      transports: [{ type: 'console' }],
    });

    logger.warn('warn message');
    expect(capturedLogs.length).toBe(1);
    expect(capturedLogs[0]).toContain('warn message');
  });

  test('ERROR logs always appear regardless of level', () => {
    const logger = createLogger({
      level: 'ERROR',
      format: 'json',
      transports: [{ type: 'console' }],
    });

    logger.debug('debug');
    logger.info('info');
    logger.warn('warn');
    logger.error('error');

    expect(capturedLogs.length).toBe(1);
    expect(capturedLogs[0]).toContain('error');
  });

  test('LOG_LEVEL_VALUES ordering is correct', () => {
    expect(LOG_LEVEL_VALUES.DEBUG).toBeLessThan(LOG_LEVEL_VALUES.INFO);
    expect(LOG_LEVEL_VALUES.INFO).toBeLessThan(LOG_LEVEL_VALUES.WARN);
    expect(LOG_LEVEL_VALUES.WARN).toBeLessThan(LOG_LEVEL_VALUES.ERROR);
  });
});

// ============================================================================
// Child Logger Tests
// ============================================================================

describe('Child Logger Context Merging', () => {
  let capturedLogs: string[];
  let consoleSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    capturedLogs = [];
    consoleSpy = spyOn(console, 'log').mockImplementation((msg: string) => {
      capturedLogs.push(msg);
    });
    errorSpy = spyOn(console, 'error').mockImplementation((msg: string) => {
      capturedLogs.push(msg);
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('child logger inherits parent context', () => {
    const logger = createLogger({
      level: 'DEBUG',
      format: 'json',
      transports: [{ type: 'console' }],
    });

    const child = logger.child({ component: 'test' });
    child.info('test message');

    expect(capturedLogs.length).toBe(1);
    const logData = JSON.parse(capturedLogs[0]);
    expect(logData.component).toBe('test');
  });

  test('child logger context overrides parent for same keys', () => {
    const logger = createLogger({
      level: 'DEBUG',
      format: 'json',
      transports: [{ type: 'console' }],
    });

    const parent = logger.child({ component: 'parent', shared: 'parent-value' });
    const child = parent.child({ component: 'child' });
    child.info('test message');

    expect(capturedLogs.length).toBe(1);
    const logData = JSON.parse(capturedLogs[0]);
    expect(logData.component).toBe('child');
    expect(logData.shared).toBe('parent-value');
  });

  test('nested child loggers accumulate context', () => {
    const logger = createLogger({
      level: 'DEBUG',
      format: 'json',
      transports: [{ type: 'console' }],
    });

    const level1 = logger.child({ depth: 1 });
    const level2 = level1.child({ depth: 2 });
    const level3 = level2.child({ depth: 3 });
    level3.info('deeply nested');

    expect(capturedLogs.length).toBe(1);
    const logData = JSON.parse(capturedLogs[0]);
    expect(logData.depth).toBe(3); // Most recent value wins
  });

  test('child logger merges call-time context', () => {
    const logger = createLogger({
      level: 'DEBUG',
      format: 'json',
      transports: [{ type: 'console' }],
    });

    const child = logger.child({ component: 'test' });
    child.info('test message', { extra: 'data' });

    expect(capturedLogs.length).toBe(1);
    const logData = JSON.parse(capturedLogs[0]);
    expect(logData.component).toBe('test');
    expect(logData.extra).toBe('data');
  });
});

// ============================================================================
// JsonFormatter Tests
// ============================================================================

describe('JsonFormatter', () => {
  test('outputs valid JSON', () => {
    const formatter = createJsonFormatter();
    const entry: LogEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: 'INFO',
      message: 'test message',
    };

    const output = formatter.format(entry);
    const parsed = JSON.parse(output);

    expect(parsed.timestamp).toBe('2024-01-01T00:00:00.000Z');
    expect(parsed.level).toBe('INFO');
    expect(parsed.message).toBe('test message');
  });

  test('flattens context into top-level fields', () => {
    const formatter = createJsonFormatter();
    const entry: LogEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: 'INFO',
      message: 'test',
      context: {
        userId: '123',
        action: 'login',
      },
    };

    const output = formatter.format(entry);
    const parsed = JSON.parse(output);

    expect(parsed.userId).toBe('123');
    expect(parsed.action).toBe('login');
  });

  test('prefixes conflicting context keys with underscore', () => {
    const formatter = createJsonFormatter();
    const entry: LogEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: 'INFO',
      message: 'test',
      context: {
        level: 'custom-level',
        message: 'custom-message',
        timestamp: 'custom-timestamp',
      },
    };

    const output = formatter.format(entry);
    const parsed = JSON.parse(output);

    // Core fields should be preserved
    expect(parsed.level).toBe('INFO');
    expect(parsed.message).toBe('test');
    expect(parsed.timestamp).toBe('2024-01-01T00:00:00.000Z');

    // Conflicting context should be prefixed
    expect(parsed._level).toBe('custom-level');
    expect(parsed._message).toBe('custom-message');
    expect(parsed._timestamp).toBe('custom-timestamp');
  });

  test('serializes error information', () => {
    const formatter = createJsonFormatter();
    const entry: LogEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: 'ERROR',
      message: 'error occurred',
      error: {
        name: 'TypeError',
        message: 'Cannot read property',
        code: 'ERR_INVALID',
        stack: 'TypeError: Cannot read property\n    at test.js:1:1',
      },
    };

    const output = formatter.format(entry);
    const parsed = JSON.parse(output);

    expect(parsed.error).toBeDefined();
    expect(parsed.error.name).toBe('TypeError');
    expect(parsed.error.message).toBe('Cannot read property');
    expect(parsed.error.code).toBe('ERR_INVALID');
    expect(parsed.error.stack).toContain('test.js');
  });

  test('handles Date objects in context', () => {
    const formatter = createJsonFormatter();
    const date = new Date('2024-06-15T12:00:00.000Z');
    const entry: LogEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: 'INFO',
      message: 'test',
      context: { createdAt: date },
    };

    const output = formatter.format(entry);
    const parsed = JSON.parse(output);

    expect(parsed.createdAt).toBe('2024-06-15T12:00:00.000Z');
  });

  test('handles bigint in context', () => {
    const formatter = createJsonFormatter();
    // Use a smaller bigint that can be precisely represented
    const bigValue = BigInt('12345678901234567890');
    const entry: LogEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: 'INFO',
      message: 'test',
      context: { bigNumber: bigValue },
    };

    const output = formatter.format(entry);
    const parsed = JSON.parse(output);

    expect(parsed.bigNumber).toBe('12345678901234567890');
  });

  test('handles undefined values in context', () => {
    const formatter = createJsonFormatter();
    const entry: LogEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: 'INFO',
      message: 'test',
      context: { maybeValue: undefined },
    };

    const output = formatter.format(entry);
    const parsed = JSON.parse(output);

    expect(parsed.maybeValue).toBe(null);
  });

  test('handles functions in context', () => {
    const formatter = createJsonFormatter();
    const entry: LogEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: 'INFO',
      message: 'test',
      context: { callback: function myFunc() {} },
    };

    const output = formatter.format(entry);
    const parsed = JSON.parse(output);

    expect(parsed.callback).toBe('[Function: myFunc]');
  });

  test('handles symbols in context', () => {
    const formatter = createJsonFormatter();
    const entry: LogEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: 'INFO',
      message: 'test',
      context: { sym: Symbol('test') },
    };

    const output = formatter.format(entry);
    const parsed = JSON.parse(output);

    expect(parsed.sym).toBe('Symbol(test)');
  });

  test('handles Error objects in context', () => {
    const formatter = createJsonFormatter();
    const err = new Error('test error');
    const entry: LogEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: 'INFO',
      message: 'test',
      context: { nestedError: err },
    };

    const output = formatter.format(entry);
    const parsed = JSON.parse(output);

    expect(parsed.nestedError.name).toBe('Error');
    expect(parsed.nestedError.message).toBe('test error');
  });
});

// ============================================================================
// PrettyFormatter Tests
// ============================================================================

describe('PrettyFormatter', () => {
  const originalNoColor = process.env.NO_COLOR;

  afterEach(() => {
    if (originalNoColor === undefined) {
      delete process.env.NO_COLOR;
    } else {
      process.env.NO_COLOR = originalNoColor;
    }
  });

  test('formats time as HH:MM:SS', () => {
    process.env.NO_COLOR = '1';
    const formatter = createPrettyFormatter();
    const entry: LogEntry = {
      timestamp: '2024-01-01T14:30:45.000Z',
      level: 'INFO',
      message: 'test message',
    };

    const output = formatter.format(entry);

    // Time should be in local timezone, but the format should be HH:MM:SS
    expect(output).toMatch(/\[\d{2}:\d{2}:\d{2}\]/);
  });

  test('includes level with fixed width', () => {
    process.env.NO_COLOR = '1';
    const formatter = createPrettyFormatter();

    const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    for (const level of levels) {
      const entry: LogEntry = {
        timestamp: '2024-01-01T00:00:00.000Z',
        level,
        message: 'test',
      };
      const output = formatter.format(entry);
      // Level should be 5 characters (padded)
      expect(output).toContain(level.padEnd(5));
    }
  });

  test('respects NO_COLOR environment variable', () => {
    process.env.NO_COLOR = '1';
    const formatter = createPrettyFormatter();
    const entry: LogEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: 'ERROR',
      message: 'test',
    };

    const output = formatter.format(entry);

    // Should not contain ANSI escape codes
    expect(output).not.toContain('\x1b[');
  });

  test('formats context as key=value pairs', () => {
    process.env.NO_COLOR = '1';
    const formatter = createPrettyFormatter();
    const entry: LogEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: 'INFO',
      message: 'test',
      context: {
        userId: '123',
        action: 'login',
      },
    };

    const output = formatter.format(entry);

    expect(output).toContain('userId=123');
    expect(output).toContain('action=login');
    expect(output).toContain('{');
    expect(output).toContain('}');
  });

  test('quotes string values with spaces', () => {
    process.env.NO_COLOR = '1';
    const formatter = createPrettyFormatter();
    const entry: LogEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: 'INFO',
      message: 'test',
      context: {
        name: 'John Doe',
      },
    };

    const output = formatter.format(entry);

    expect(output).toContain('name="John Doe"');
  });

  test('formats error with stack trace', () => {
    process.env.NO_COLOR = '1';
    const formatter = createPrettyFormatter();
    const entry: LogEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: 'ERROR',
      message: 'error occurred',
      error: {
        name: 'TypeError',
        message: 'Cannot read property',
        stack: 'TypeError: Cannot read property\n    at test.js:1:1\n    at main.js:5:10',
      },
    };

    const output = formatter.format(entry);

    expect(output).toContain('TypeError: Cannot read property');
    expect(output).toContain('test.js:1:1');
  });

  test('formats error with code', () => {
    process.env.NO_COLOR = '1';
    const formatter = createPrettyFormatter();
    const entry: LogEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: 'ERROR',
      message: 'error occurred',
      error: {
        name: 'SystemError',
        message: 'Connection refused',
        code: 'ECONNREFUSED',
      },
    };

    const output = formatter.format(entry);

    expect(output).toContain('SystemError [ECONNREFUSED]: Connection refused');
  });

  test('handles arrays in context', () => {
    process.env.NO_COLOR = '1';
    const formatter = createPrettyFormatter();
    const entry: LogEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: 'INFO',
      message: 'test',
      context: {
        items: ['a', 'b', 'c'],
        longItems: [1, 2, 3, 4, 5, 6],
      },
    };

    const output = formatter.format(entry);

    expect(output).toContain('[a, b, c]');
    expect(output).toContain('[6 items]');
  });

  test('handles objects in context', () => {
    process.env.NO_COLOR = '1';
    const formatter = createPrettyFormatter();
    const entry: LogEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: 'INFO',
      message: 'test',
      context: {
        config: { a: 1, b: 2, c: 3, d: 4 },
        small: { x: 1 },
      },
    };

    const output = formatter.format(entry);

    expect(output).toContain('{4 keys}');
    expect(output).toContain('{"x":1}');
  });
});

// ============================================================================
// ConsoleTransport Tests
// ============================================================================

describe('ConsoleTransport', () => {
  let consoleLogSpy: ReturnType<typeof spyOn>;
  let consoleErrorSpy: ReturnType<typeof spyOn>;
  let logCalls: string[];
  let errorCalls: string[];

  beforeEach(() => {
    logCalls = [];
    errorCalls = [];
    consoleLogSpy = spyOn(console, 'log').mockImplementation((msg: string) => {
      logCalls.push(msg);
    });
    consoleErrorSpy = spyOn(console, 'error').mockImplementation((msg: string) => {
      errorCalls.push(msg);
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('DEBUG logs go to stdout', () => {
    const logger = createLogger({
      level: 'DEBUG',
      format: 'json',
      transports: [{ type: 'console' }],
    });

    logger.debug('debug message');

    expect(logCalls.length).toBe(1);
    expect(errorCalls.length).toBe(0);
    expect(logCalls[0]).toContain('debug message');
  });

  test('INFO logs go to stdout', () => {
    const logger = createLogger({
      level: 'DEBUG',
      format: 'json',
      transports: [{ type: 'console' }],
    });

    logger.info('info message');

    expect(logCalls.length).toBe(1);
    expect(errorCalls.length).toBe(0);
    expect(logCalls[0]).toContain('info message');
  });

  test('WARN logs go to stderr', () => {
    const logger = createLogger({
      level: 'DEBUG',
      format: 'json',
      transports: [{ type: 'console' }],
    });

    logger.warn('warn message');

    expect(logCalls.length).toBe(0);
    expect(errorCalls.length).toBe(1);
    expect(errorCalls[0]).toContain('warn message');
  });

  test('ERROR logs go to stderr', () => {
    const logger = createLogger({
      level: 'DEBUG',
      format: 'json',
      transports: [{ type: 'console' }],
    });

    logger.error('error message');

    expect(logCalls.length).toBe(0);
    expect(errorCalls.length).toBe(1);
    expect(errorCalls[0]).toContain('error message');
  });

  test('ERROR logs with Error object include error details', () => {
    const logger = createLogger({
      level: 'DEBUG',
      format: 'json',
      transports: [{ type: 'console' }],
    });

    const err = new Error('Something went wrong');
    logger.error('error message', err);

    expect(errorCalls.length).toBe(1);
    const parsed = JSON.parse(errorCalls[0]);
    expect(parsed.error.name).toBe('Error');
    expect(parsed.error.message).toBe('Something went wrong');
  });
});

// ============================================================================
// Logger Event Method Tests
// ============================================================================

describe('Logger event method', () => {
  let capturedLogs: string[];
  let consoleSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    capturedLogs = [];
    consoleSpy = spyOn(console, 'log').mockImplementation((msg: string) => {
      capturedLogs.push(msg);
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('event method logs at INFO level', () => {
    const logger = createLogger({
      level: 'WARN', // Should filter out INFO
      format: 'json',
      transports: [{ type: 'console' }],
    });

    logger.event('user:login', { userId: '123' });

    // Should be filtered out since it's INFO level
    expect(capturedLogs.length).toBe(0);
  });

  test('event method includes eventType in context', () => {
    const logger = createLogger({
      level: 'DEBUG',
      format: 'json',
      transports: [{ type: 'console' }],
    });

    logger.event('user:login', { userId: '123' });

    expect(capturedLogs.length).toBe(1);
    const parsed = JSON.parse(capturedLogs[0]);
    expect(parsed.eventType).toBe('user:login');
    expect(parsed.userId).toBe('123');
    expect(parsed.message).toBe('Event: user:login');
  });
});
