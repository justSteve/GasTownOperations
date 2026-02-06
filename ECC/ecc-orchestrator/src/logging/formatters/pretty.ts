/**
 * Pretty log formatter for development
 * @module @ecc/orchestrator/logging/formatters
 */

import type { LogEntry, LogFormatter, LogLevel } from '../types.js';

/**
 * ANSI color codes
 */
const COLORS = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
} as const;

/**
 * Level to color mapping
 */
const LEVEL_COLORS: Record<LogLevel, string> = {
  DEBUG: COLORS.gray,
  INFO: COLORS.white,
  WARN: COLORS.yellow,
  ERROR: COLORS.red,
};

/**
 * Pretty formatter - human-readable colored output for development
 *
 * Format: [HH:MM:SS] LEVEL message {context}
 *
 * Features:
 * - ANSI colors (respects NO_COLOR env var)
 * - Indented multi-line messages
 * - Compact context display
 */
export class PrettyFormatter implements LogFormatter {
  private readonly useColors: boolean;

  constructor() {
    // Respect NO_COLOR environment variable (https://no-color.org/)
    this.useColors = !process.env.NO_COLOR;
  }

  /**
   * Format a log entry for human-readable output
   */
  format(entry: LogEntry): string {
    const time = this.formatTime(entry.timestamp);
    const level = this.formatLevel(entry.level);
    const message = this.formatMessage(entry.message, entry.level);
    const context = this.formatContext(entry.context);
    const error = this.formatError(entry.error);

    let output = `${time} ${level} ${message}`;

    if (context) {
      output += ` ${context}`;
    }

    if (error) {
      output += `\n${error}`;
    }

    return output;
  }

  /**
   * Format timestamp as HH:MM:SS
   */
  private formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    const timeStr = `[${hours}:${minutes}:${seconds}]`;

    return this.useColors ? `${COLORS.dim}${timeStr}${COLORS.reset}` : timeStr;
  }

  /**
   * Format log level with color and fixed width
   */
  private formatLevel(level: LogLevel): string {
    const paddedLevel = level.padEnd(5);

    if (!this.useColors) {
      return paddedLevel;
    }

    const color = LEVEL_COLORS[level];
    return `${color}${paddedLevel}${COLORS.reset}`;
  }

  /**
   * Format message, handling multi-line content
   */
  private formatMessage(message: string, level: LogLevel): string {
    if (!message.includes('\n')) {
      return this.colorize(message, level);
    }

    // Indent subsequent lines
    const lines = message.split('\n');
    const indent = '                  '; // Align with message start (after timestamp and level)
    const indentedLines = lines.map((line, i) =>
      i === 0 ? line : `${indent}${line}`
    );

    return this.colorize(indentedLines.join('\n'), level);
  }

  /**
   * Format context as compact JSON-like string
   */
  private formatContext(context?: Record<string, unknown>): string {
    if (!context || Object.keys(context).length === 0) {
      return '';
    }

    const parts: string[] = [];

    for (const [key, value] of Object.entries(context)) {
      const formatted = this.formatValue(value);
      parts.push(`${key}=${formatted}`);
    }

    const contextStr = `{${parts.join(', ')}}`;

    return this.useColors ? `${COLORS.cyan}${contextStr}${COLORS.reset}` : contextStr;
  }

  /**
   * Format a context value for display
   */
  private formatValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';

    if (typeof value === 'string') {
      // Quote strings with spaces or special chars
      if (value.includes(' ') || value.includes(',') || value.includes('{')) {
        return `"${value}"`;
      }
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (typeof value === 'bigint') {
      return `${value}n`;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      if (value.length <= 3) {
        return `[${value.map(v => this.formatValue(v)).join(', ')}]`;
      }
      return `[${value.length} items]`;
    }

    if (typeof value === 'object') {
      const keys = Object.keys(value as object);
      if (keys.length === 0) return '{}';
      if (keys.length <= 2) {
        return JSON.stringify(value);
      }
      return `{${keys.length} keys}`;
    }

    return String(value);
  }

  /**
   * Format error with stack trace
   */
  private formatError(error?: LogEntry['error']): string {
    if (!error) return '';

    const indent = '    ';
    const lines: string[] = [];

    // Error header
    const header = error.code
      ? `${error.name} [${error.code}]: ${error.message}`
      : `${error.name}: ${error.message}`;

    lines.push(`${indent}${this.colorize(header, 'ERROR')}`);

    // Stack trace
    if (error.stack) {
      const stackLines = error.stack.split('\n').slice(1); // Skip first line (already in header)
      for (const line of stackLines) {
        const dimmedLine = this.useColors
          ? `${COLORS.dim}${line.trim()}${COLORS.reset}`
          : line.trim();
        lines.push(`${indent}  ${dimmedLine}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Apply level-based color to text
   */
  private colorize(text: string, level: LogLevel): string {
    if (!this.useColors) return text;

    const color = LEVEL_COLORS[level];
    return `${color}${text}${COLORS.reset}`;
  }
}

/**
 * Create a pretty formatter instance
 */
export function createPrettyFormatter(): LogFormatter {
  return new PrettyFormatter();
}
