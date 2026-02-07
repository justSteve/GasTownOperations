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
 * Options for creating a logger with custom transports
 */
export interface CreateLoggerOptions {
  /** Log level (default: 'INFO') */
  level?: LogLevel;
  /** Transport instances to use */
  transports: LogTransport[];
  /** Default context to include in all log entries */
  defaultContext?: LogContext;
}

/**
 * Create a logger instance from configuration
 */
export function createLogger(config: LoggingConfig | CreateLoggerOptions): Logger {
  // Check if we're using the new options format (transport instances)
  if ('transports' in config && config.transports.length > 0 && 'write' in config.transports[0]) {
    // New format: transport instances passed directly
    const options = config as CreateLoggerOptions;
    const logConfig: LoggingConfig = {
      level: options.level || 'INFO',
      format: 'json',
      transports: [], // Not used when passing instances
    };
    return new LoggerImpl(logConfig, options.transports, options.defaultContext);
  }

  // Original format: transport configs
  const legacyConfig = config as LoggingConfig;

  // Create formatter based on config
  const formatter =
    legacyConfig.format === 'json' ? createJsonFormatter() : createPrettyFormatter();

  // Create transports based on config
  const transports: LogTransport[] = [];

  for (const transportConfig of legacyConfig.transports) {
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

  return new LoggerImpl(legacyConfig, transports);
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

// ============================================================================
// Zgent Logger Factory
// ============================================================================

import { ZgentTransport, type ZgentTransportOptions } from './transports/zgent.js';

/**
 * Options for creating a Zgent logger
 */
export interface CreateZgentLoggerOptions {
  /** Zgent identifier (e.g., "dreader", "explorer") */
  zgentId: string;
  /** Optional Zgent version */
  zgentVersion?: string;
  /** Session ID for correlating logs within a run (auto-generated if not provided) */
  sessionId?: string;
  /** Log level (default: 'INFO') */
  level?: LogLevel;
  /** Base directory for Zgent data (default: ~/.zgents) */
  baseDir?: string;
  /** Human-readable name for registry (default: zgentId) */
  zgentName?: string;
  /** Description for registry */
  zgentDescription?: string;
  /** Additional default context to include in all log entries */
  defaultContext?: LogContext;
  /** Also log to console (default: false in production) */
  alsoLogToConsole?: boolean;
}

/**
 * Create a logger configured for a Zgent with centralized logging.
 *
 * This is the recommended way for Zgents to initialize logging. It:
 * - Writes to the standard Zgent log directory (~/.zgents/logs/{zgentId}/)
 * - Registers the Zgent in the ecosystem registry
 * - Adds zgentId and sessionId to all log entries automatically
 *
 * @example
 * ```typescript
 * // Simple usage - just provide zgentId
 * const logger = createZgentLogger({ zgentId: 'dreader' });
 *
 * // Logs are written to ~/.zgents/logs/dreader/<timestamp>.jsonl
 * logger.info('Starting Discord collection', { channelCount: 5 });
 *
 * // Full configuration
 * const logger = createZgentLogger({
 *   zgentId: 'dreader',
 *   zgentVersion: '1.0.0',
 *   zgentName: 'Discord Reader',
 *   zgentDescription: 'Collects messages from Discord channels',
 *   level: 'DEBUG',
 *   alsoLogToConsole: true,
 * });
 * ```
 */
export function createZgentLogger(options: CreateZgentLoggerOptions): Logger {
  const transportOptions: ZgentTransportOptions = {
    zgentId: options.zgentId,
    zgentVersion: options.zgentVersion,
    sessionId: options.sessionId,
    baseDir: options.baseDir,
    zgentName: options.zgentName,
    zgentDescription: options.zgentDescription,
  };

  const zgentTransport = new ZgentTransport(transportOptions);
  const transports: LogTransport[] = [zgentTransport];

  // Optionally add console transport
  if (options.alsoLogToConsole) {
    transports.push(new ConsoleTransport(createPrettyFormatter()));
  }

  return createLogger({
    level: options.level,
    transports,
    defaultContext: options.defaultContext,
  });
}
