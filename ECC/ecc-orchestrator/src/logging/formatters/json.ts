/**
 * JSON log formatter
 * @module @ecc/orchestrator/logging/formatters
 */

import type { LogEntry, LogFormatter } from '../types.js';

/**
 * JSON formatter - outputs single-line JSON log entries
 *
 * Features:
 * - ISO 8601 timestamps
 * - Flattens context into top-level fields
 * - Properly serializes Error objects
 */
export class JsonFormatter implements LogFormatter {
  /**
   * Format a log entry as single-line JSON
   */
  format(entry: LogEntry): string {
    const output: Record<string, unknown> = {
      timestamp: entry.timestamp,
      level: entry.level,
      message: entry.message,
    };

    // Flatten context into top level
    if (entry.context) {
      for (const [key, value] of Object.entries(entry.context)) {
        // Avoid overwriting core fields
        if (key !== 'timestamp' && key !== 'level' && key !== 'message' && key !== 'error') {
          output[key] = this.serializeValue(value);
        } else {
          // Prefix conflicting keys with underscore
          output[`_${key}`] = this.serializeValue(value);
        }
      }
    }

    // Add error if present
    if (entry.error) {
      output.error = {
        name: entry.error.name,
        message: entry.error.message,
        ...(entry.error.stack && { stack: entry.error.stack }),
        ...(entry.error.code && { code: entry.error.code }),
      };
    }

    return JSON.stringify(output);
  }

  /**
   * Serialize a value for JSON output, handling special cases
   */
  private serializeValue(value: unknown): unknown {
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (typeof value === 'function') {
      return `[Function: ${value.name || 'anonymous'}]`;
    }

    if (typeof value === 'symbol') {
      return value.toString();
    }

    if (value === undefined) {
      return null;
    }

    // Handle circular references and other edge cases
    if (typeof value === 'object' && value !== null) {
      try {
        // Test if it's serializable
        JSON.stringify(value);
        return value;
      } catch {
        return '[Circular or non-serializable]';
      }
    }

    return value;
  }
}

/**
 * Create a JSON formatter instance
 */
export function createJsonFormatter(): LogFormatter {
  return new JsonFormatter();
}
