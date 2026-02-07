/**
 * File Transport for ECC Orchestrator
 *
 * Writes log entries to a file in JSON Lines format for persistent storage
 * and post-execution review. Core infrastructure for all Zgent operations.
 */

import { appendFileSync, existsSync, mkdirSync, statSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { LogTransport, LogEntry } from '../types.js';

/**
 * Configuration options for FileTransport
 */
export interface FileTransportOptions {
  /** Path to the log file */
  filePath: string;
  /** Maximum file size in bytes before rotation (optional, default: no rotation) */
  maxSizeBytes?: number;
  /** Maximum number of rotated files to keep (default: 5) */
  maxFiles?: number;
  /** Whether to append to existing file or overwrite (default: true = append) */
  append?: boolean;
}

/**
 * Transport that writes log entries to a file in JSON Lines format.
 *
 * Each log entry is written as a single JSON object on its own line,
 * making it easy to parse, grep, and analyze with standard tools.
 *
 * Features:
 * - JSON Lines format (one JSON object per line)
 * - Automatic directory creation
 * - Optional size-based rotation
 * - Synchronous writes for reliability
 *
 * @example
 * ```typescript
 * const transport = new FileTransport({
 *   filePath: './logs/engine.jsonl',
 *   maxSizeBytes: 10 * 1024 * 1024, // 10MB
 *   maxFiles: 3,
 * });
 *
 * transport.write({
 *   timestamp: new Date().toISOString(),
 *   level: 'INFO',
 *   message: 'Engine started',
 *   context: { sceneId: '1.1' }
 * });
 *
 * // Review logs:
 * // cat logs/engine.jsonl | jq .
 * // grep '"level":"ERROR"' logs/engine.jsonl
 * ```
 */
export class FileTransport implements LogTransport {
  readonly name = 'file';
  private filePath: string;
  private maxSizeBytes: number | undefined;
  private maxFiles: number;

  constructor(options: FileTransportOptions) {
    this.filePath = options.filePath;
    this.maxSizeBytes = options.maxSizeBytes;
    this.maxFiles = options.maxFiles !== undefined ? options.maxFiles : 5;

    // Initialize on construction
    this.ensureDirectory();

    // Clear file if not appending
    if (options.append === false && existsSync(this.filePath)) {
      // Truncate by writing empty string
      require('node:fs').writeFileSync(this.filePath, '');
    }
  }

  /**
   * Write a log entry to the file.
   *
   * The entry is serialized as JSON and appended as a single line.
   * If rotation is configured and the file exceeds maxSizeBytes,
   * rotation occurs before writing.
   *
   * @param entry - The log entry to write
   */
  write(entry: LogEntry): void {
    // Check rotation before writing
    if (this.maxSizeBytes) {
      this.rotateIfNeeded();
    }

    // Serialize entry as single-line JSON
    const line = JSON.stringify(entry) + '\n';

    // Synchronous write for reliability
    appendFileSync(this.filePath, line, 'utf-8');
  }

  /**
   * Flush pending writes.
   * For synchronous file transport, this is a no-op.
   */
  async flush(): Promise<void> {
    // Synchronous writes - nothing to flush
  }

  /**
   * Close the transport.
   * For file transport, this is a no-op as we use synchronous writes.
   */
  async close(): Promise<void> {
    // No cleanup needed for synchronous file access
  }

  /**
   * Get current log file path (useful for telling users where to find logs)
   */
  getFilePath(): string {
    return this.filePath;
  }

  /**
   * Ensure the directory for the log file exists.
   */
  private ensureDirectory(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Rotate log files if current file exceeds maxSizeBytes.
   *
   * Rotation scheme:
   * - engine.jsonl -> engine.1.jsonl -> engine.2.jsonl -> ...
   * - Oldest files beyond maxFiles are deleted
   */
  private rotateIfNeeded(): void {
    if (!existsSync(this.filePath)) {
      return;
    }

    try {
      const stats = statSync(this.filePath);
      if (stats.size < (this.maxSizeBytes ?? Infinity)) {
        return;
      }

      // Rotate files
      this.rotateFiles();
    } catch {
      // If we can't stat, just continue writing
    }
  }

  /**
   * Perform file rotation.
   */
  private rotateFiles(): void {
    const ext = this.filePath.match(/\.[^.]+$/)?.[0] ?? '';
    const base = ext ? this.filePath.slice(0, -ext.length) : this.filePath;

    // Delete oldest file if it exists and exceeds maxFiles
    const oldestPath = `${base}.${this.maxFiles}${ext}`;
    if (existsSync(oldestPath)) {
      require('node:fs').unlinkSync(oldestPath);
    }

    // Shift existing rotated files
    for (let i = this.maxFiles - 1; i >= 1; i--) {
      const from = `${base}.${i}${ext}`;
      const to = `${base}.${i + 1}${ext}`;
      if (existsSync(from)) {
        renameSync(from, to);
      }
    }

    // Rotate current file to .1
    const firstRotated = `${base}.1${ext}`;
    renameSync(this.filePath, firstRotated);
  }
}

/**
 * Create a FileTransport with sensible defaults for engine logging.
 *
 * @param logDir - Directory for log files (default: ./logs)
 * @param prefix - Log file prefix (default: 'engine')
 * @returns Configured FileTransport
 */
export function createFileTransport(
  logDir = './logs',
  prefix = 'engine'
): FileTransport {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filePath = join(logDir, `${prefix}-${timestamp}.jsonl`);

  return new FileTransport({
    filePath,
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    append: true,
  });
}
