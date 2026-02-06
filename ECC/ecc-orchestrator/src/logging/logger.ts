/**
 * Logger implementation
 * @module @ecc/orchestrator/logging
 */

import type {
  LogContext,
  LogEntry,
  LogFormatter,
  LoggingConfig,
  LogLevel,
  LogTransport,
} from './types.js';
import { LOG_LEVEL_VALUES } from './types.js';
import { createJsonFormatter } from './formatters/json.js';
import { createPrettyFormatter } from './formatters/pretty.js';

/**
 * Logger interface for structured logging
 */
export interface Logger {
  /**
   * Log a debug message
   */
  debug(message: string, context?: LogContext): void;

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void;

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void;

  /**
   * Log an error message with optional Error object
   */
  error(message: string, error?: Error, context?: LogContext): void;

  /**
   * Create a child logger with merged context
   */
  child(context: LogContext): Logger;

  /**
   * Log a structured event at INFO level
   */
  event(type: string, data: Record<string, unknown>): void;
}

/**
 * Console transport - writes to stdout/stderr
 */
class ConsoleTransport implements LogTransport {
  name = 'console';

  constructor(private formatter: LogFormatter) {}

  write(entry: LogEntry): void {
    const formatted = this.formatter.format(entry);

    // Use stderr for WARN and ERROR, stdout for others
    if (entry.level === 'ERROR' || entry.level === 'WARN') {
      console.error(formatted);
    } else {
      console.log(formatted);
    }
  }
}

/**
 * Logger implementation
 */
class LoggerImpl implements Logger {
  private readonly minLevel: number;
  private readonly transports: LogTransport[];
  private readonly baseContext: LogContext;

  constructor(
    config: LoggingConfig,
    transports: LogTransport[],
    baseContext: LogContext = {}
  ) {
    this.minLevel = LOG_LEVEL_VALUES[config.level];
    this.transports = transports;
    this.baseContext = baseContext;
  }

  debug(message: string, context?: LogContext): void {
    this.log('DEBUG', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('INFO', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('WARN', message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const entry = this.createEntry('ERROR', message, context);

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
      };
      // Only set optional properties if they have values
      if (error.stack) {
        entry.error.stack = error.stack;
      }
      const code = (error as NodeJS.ErrnoException).code;
      if (code) {
        entry.error.code = code;
      }
    }

    this.writeEntry(entry);
  }

  child(context: LogContext): Logger {
    // Merge base context with new context
    const mergedContext = { ...this.baseContext, ...context };

    // Create new logger with same config but merged context
    return new ChildLogger(this, mergedContext);
  }

  event(type: string, data: Record<string, unknown>): void {
    const context: LogContext = {
      ...data,
      eventType: type,
    };

    this.log('INFO', `Event: ${type}`, context);
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    const entry = this.createEntry(level, message, context);
    this.writeEntry(entry);
  }

  /**
   * Create a log entry
   */
  private createEntry(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    // Merge base context with entry-specific context
    const mergedContext = { ...this.baseContext, ...context };
    if (Object.keys(mergedContext).length > 0) {
      entry.context = mergedContext;
    }

    return entry;
  }

  /**
   * Write entry to all transports if level passes filter
   */
  private writeEntry(entry: LogEntry): void {
    // Level filtering
    if (LOG_LEVEL_VALUES[entry.level] < this.minLevel) {
      return;
    }

    // Write to all transports
    for (const transport of this.transports) {
      try {
        transport.write(entry);
      } catch (err) {
        // Fallback: log transport errors to console
        console.error(`[Logger] Transport "${transport.name}" failed:`, err);
      }
    }
  }
}

/**
 * Child logger that wraps a parent with additional context
 */
class ChildLogger implements Logger {
  constructor(
    private readonly parent: Logger,
    private readonly context: LogContext
  ) {}

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, this.mergeContext(context));
  }

  info(message: string, context?: LogContext): void {
    this.parent.info(message, this.mergeContext(context));
  }

  warn(message: string, context?: LogContext): void {
    this.parent.warn(message, this.mergeContext(context));
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.parent.error(message, error, this.mergeContext(context));
  }

  child(context: LogContext): Logger {
    return new ChildLogger(this, context);
  }

  event(type: string, data: Record<string, unknown>): void {
    this.parent.event(type, { ...this.context, ...data });
  }

  private mergeContext(context?: LogContext): LogContext {
    return { ...this.context, ...context };
  }
}

/**
 * Create a logger instance from configuration
 */
export function createLogger(config: LoggingConfig): Logger {
  // Create formatter based on config
  const formatter =
    config.format === 'json' ? createJsonFormatter() : createPrettyFormatter();

  // Create transports based on config
  const transports: LogTransport[] = [];

  for (const transportConfig of config.transports) {
    switch (transportConfig.type) {
      case 'console':
        transports.push(new ConsoleTransport(formatter));
        break;

      case 'file':
      case 'stream':
      case 'event':
        // These transport types can be implemented later
        console.warn(
          `[Logger] Transport type "${transportConfig.type}" not yet implemented`
        );
        break;

      default:
        console.warn(
          `[Logger] Unknown transport type: ${(transportConfig as { type: string }).type}`
        );
    }
  }

  // Default to console transport if none configured
  if (transports.length === 0) {
    transports.push(new ConsoleTransport(formatter));
  }

  return new LoggerImpl(config, transports);
}

/**
 * Create a no-op logger (useful for testing or disabling logging)
 */
export function createNullLogger(): Logger {
  const noop = () => {};

  const nullLogger: Logger = {
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    child: () => nullLogger,
    event: noop,
  };

  return nullLogger;
}

/**
 * Default development logger configuration
 */
export const DEFAULT_DEV_CONFIG: LoggingConfig = {
  level: 'DEBUG',
  format: 'pretty',
  transports: [{ type: 'console' }],
};

/**
 * Default production logger configuration
 */
export const DEFAULT_PROD_CONFIG: LoggingConfig = {
  level: 'INFO',
  format: 'json',
  transports: [{ type: 'console' }],
};
