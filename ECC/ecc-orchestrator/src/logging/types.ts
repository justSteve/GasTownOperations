/**
 * Logging subsystem types
 * @module @ecc/orchestrator/logging
 */

/**
 * Log severity levels in ascending order of severity
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * Arbitrary key-value context attached to log entries
 */
export interface LogContext {
  [key: string]: unknown;
}

/**
 * Structured log entry
 */
export interface LogEntry {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Severity level */
  level: LogLevel;
  /** Human-readable message */
  message: string;
  /** Optional structured context */
  context?: LogContext;
  /** Optional error details */
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * Logger configuration
 */
export interface LoggingConfig {
  /** Minimum level to log (entries below this are filtered) */
  level: LogLevel;
  /** Output format */
  format: 'json' | 'pretty';
  /** Where to send log entries */
  transports: TransportConfig[];
}

/**
 * Transport configuration
 */
export interface TransportConfig {
  /** Transport type */
  type: 'console' | 'file' | 'stream' | 'event';
  /** Transport-specific options */
  options?: Record<string, unknown>;
}

/**
 * Log transport interface - writes log entries to a destination
 */
export interface LogTransport {
  /** Transport identifier */
  name: string;
  /** Write a log entry */
  write(entry: LogEntry): void | Promise<void>;
  /** Flush pending writes (optional) */
  flush?(): Promise<void>;
  /** Close the transport (optional) */
  close?(): Promise<void>;
}

/**
 * Log formatter interface - converts log entries to strings
 */
export interface LogFormatter {
  /** Format a log entry as a string */
  format(entry: LogEntry): string;
}

/**
 * Numeric log level values for comparison
 */
export const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};
