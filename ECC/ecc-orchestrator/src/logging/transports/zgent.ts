/**
 * Zgent Transport for Centralized Logging
 *
 * Writes log entries to a convention-based directory structure that enables
 * gtOps to aggregate and view logs across all Zgents in the ecosystem.
 *
 * Directory convention:
 *   ~/.zgents/logs/{zgentId}/{timestamp}.jsonl
 *
 * Each Zgent writes to its own directory, enabling:
 * - Per-Zgent log isolation
 * - Cross-Zgent aggregation via glob patterns
 * - On-demand viewing without daemon overhead
 */

import { appendFileSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import type { LogTransport, LogEntry, ZgentLogEntry } from '../types.js';

/**
 * Default base directory for Zgent logs
 */
export const ZGENT_BASE_DIR = join(homedir(), '.zgents');
export const ZGENT_LOGS_DIR = join(ZGENT_BASE_DIR, 'logs');
export const ZGENT_REGISTRY_PATH = join(ZGENT_BASE_DIR, 'registry.json');

/**
 * Zgent registry entry
 */
export interface ZgentRegistryEntry {
  /** Zgent identifier */
  zgentId: string;
  /** Human-readable name */
  name: string;
  /** Current version */
  version?: string;
  /** Path to Zgent's log directory */
  logDir: string;
  /** When this Zgent was last active */
  lastActive: string;
  /** Optional description */
  description?: string;
}

/**
 * Zgent registry - tracks all Zgents in the ecosystem
 */
export interface ZgentRegistry {
  /** Schema version for forward compatibility */
  schemaVersion: number;
  /** Map of zgentId -> registry entry */
  zgents: Record<string, ZgentRegistryEntry>;
}

/**
 * Configuration options for ZgentTransport
 */
export interface ZgentTransportOptions {
  /** Zgent identifier (e.g., "dreader", "explorer") */
  zgentId: string;
  /** Optional Zgent version */
  zgentVersion?: string;
  /** Session ID for correlating logs within a run */
  sessionId?: string;
  /** Base directory for Zgent data (default: ~/.zgents) */
  baseDir?: string;
  /** Maximum file size in bytes before rotation (optional) */
  maxSizeBytes?: number;
  /** Maximum number of rotated files to keep (default: 10) */
  maxFiles?: number;
  /** Whether to register this Zgent in the registry (default: true) */
  registerZgent?: boolean;
  /** Human-readable name for registry (default: zgentId) */
  zgentName?: string;
  /** Description for registry */
  zgentDescription?: string;
}

/**
 * Transport that writes Zgent logs to the centralized directory structure.
 *
 * Logs are written as ZgentLogEntry objects with first-class identity fields,
 * enabling cross-Zgent aggregation and filtering.
 *
 * @example
 * ```typescript
 * const transport = new ZgentTransport({
 *   zgentId: 'dreader',
 *   zgentVersion: '1.0.0',
 *   sessionId: 'session-abc123',
 * });
 *
 * // Write logs - zgentId/sessionId are automatically added
 * transport.write({
 *   timestamp: new Date().toISOString(),
 *   level: 'INFO',
 *   message: 'Processing Discord messages',
 *   context: { channelId: '123' }
 * });
 *
 * // Logs written to: ~/.zgents/logs/dreader/2026-02-07T10-00-00.jsonl
 * // Entry includes: { zgentId: "dreader", sessionId: "session-abc123", ... }
 * ```
 */
export class ZgentTransport implements LogTransport {
  readonly name = 'zgent';

  private readonly zgentId: string;
  private readonly zgentVersion?: string;
  private readonly sessionId: string;
  private readonly logDir: string;
  private readonly filePath: string;
  private readonly maxSizeBytes?: number;
  private readonly maxFiles: number;

  constructor(options: ZgentTransportOptions) {
    this.zgentId = options.zgentId;
    this.zgentVersion = options.zgentVersion;
    this.sessionId = options.sessionId || this.generateSessionId();

    const baseDir = options.baseDir || ZGENT_BASE_DIR;
    this.logDir = join(baseDir, 'logs', this.zgentId);

    // Generate timestamped filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.filePath = join(this.logDir, `${timestamp}.jsonl`);

    this.maxSizeBytes = options.maxSizeBytes;
    this.maxFiles = options.maxFiles !== undefined ? options.maxFiles : 10;

    // Ensure directory exists
    this.ensureDirectory();

    // Register in Zgent registry if enabled
    if (options.registerZgent !== false) {
      this.registerZgent({
        zgentId: this.zgentId,
        name: options.zgentName || this.zgentId,
        version: this.zgentVersion,
        logDir: this.logDir,
        lastActive: new Date().toISOString(),
        description: options.zgentDescription,
      });
    }
  }

  /**
   * Write a log entry to the file.
   *
   * The entry is enhanced with Zgent identity fields (zgentId, sessionId)
   * and serialized as JSON Lines format.
   */
  write(entry: LogEntry): void {
    // Enhance entry with Zgent identity
    const zgentEntry: ZgentLogEntry = {
      ...entry,
      zgentId: this.zgentId,
      sessionId: this.sessionId,
    };

    if (this.zgentVersion) {
      zgentEntry.zgentVersion = this.zgentVersion;
    }

    // Check rotation before writing
    if (this.maxSizeBytes) {
      this.rotateIfNeeded();
    }

    const line = JSON.stringify(zgentEntry) + '\n';
    appendFileSync(this.filePath, line, 'utf-8');
  }

  /**
   * Flush pending writes.
   */
  async flush(): Promise<void> {
    // Synchronous writes - nothing to flush
  }

  /**
   * Close the transport.
   */
  async close(): Promise<void> {
    // Update last active time in registry
    this.updateLastActive();
  }

  /**
   * Get the current log file path
   */
  getFilePath(): string {
    return this.filePath;
  }

  /**
   * Get the Zgent's log directory
   */
  getLogDir(): string {
    return this.logDir;
  }

  /**
   * Get the session ID for this transport instance
   */
  getSessionId(): string {
    return this.sessionId;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }

  private ensureDirectory(): void {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  private registerZgent(entry: ZgentRegistryEntry): void {
    const registry = this.loadRegistry();
    registry.zgents[entry.zgentId] = entry;
    this.saveRegistry(registry);
  }

  private updateLastActive(): void {
    const registry = this.loadRegistry();
    const entry = registry.zgents[this.zgentId];
    if (entry) {
      entry.lastActive = new Date().toISOString();
      this.saveRegistry(registry);
    }
  }

  private loadRegistry(): ZgentRegistry {
    const registryPath = join(dirname(this.logDir), '..', 'registry.json');

    if (!existsSync(registryPath)) {
      return { schemaVersion: 1, zgents: {} };
    }

    try {
      const content = readFileSync(registryPath, 'utf-8');
      return JSON.parse(content) as ZgentRegistry;
    } catch {
      return { schemaVersion: 1, zgents: {} };
    }
  }

  private saveRegistry(registry: ZgentRegistry): void {
    const registryPath = join(dirname(this.logDir), '..', 'registry.json');
    const dir = dirname(registryPath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n', 'utf-8');
  }

  private rotateIfNeeded(): void {
    if (!existsSync(this.filePath)) {
      return;
    }

    try {
      const { statSync } = require('node:fs');
      const stats = statSync(this.filePath);
      if (stats.size < (this.maxSizeBytes ?? Infinity)) {
        return;
      }
      this.rotateFiles();
    } catch {
      // If we can't stat, just continue writing
    }
  }

  private rotateFiles(): void {
    const { renameSync, unlinkSync, readdirSync } = require('node:fs');

    // Get all log files for this Zgent, sorted by name (timestamp)
    const files = readdirSync(this.logDir)
      .filter((f: string) => f.endsWith('.jsonl'))
      .sort()
      .reverse();

    // Delete oldest files if we have too many
    while (files.length >= this.maxFiles) {
      const oldest = files.pop();
      if (oldest) {
        try {
          unlinkSync(join(this.logDir, oldest));
        } catch {
          // Ignore deletion errors
        }
      }
    }
  }
}

/**
 * Create a ZgentTransport with minimal configuration.
 *
 * @param zgentId - Unique identifier for this Zgent
 * @param options - Optional additional configuration
 * @returns Configured ZgentTransport
 *
 * @example
 * ```typescript
 * const transport = createZgentTransport('dreader');
 * // Logs will be written to ~/.zgents/logs/dreader/<timestamp>.jsonl
 * ```
 */
export function createZgentTransport(
  zgentId: string,
  options?: Partial<Omit<ZgentTransportOptions, 'zgentId'>>
): ZgentTransport {
  return new ZgentTransport({ zgentId, ...options });
}

/**
 * Get the registry of all known Zgents.
 *
 * @param baseDir - Base directory for Zgent data (default: ~/.zgents)
 * @returns The Zgent registry
 */
export function getZgentRegistry(baseDir?: string): ZgentRegistry {
  const registryPath = join(baseDir || ZGENT_BASE_DIR, 'registry.json');

  if (!existsSync(registryPath)) {
    return { schemaVersion: 1, zgents: {} };
  }

  try {
    const content = readFileSync(registryPath, 'utf-8');
    return JSON.parse(content) as ZgentRegistry;
  } catch {
    return { schemaVersion: 1, zgents: {} };
  }
}

/**
 * List all log files for a specific Zgent.
 *
 * @param zgentId - Zgent identifier
 * @param baseDir - Base directory for Zgent data (default: ~/.zgents)
 * @returns Array of log file paths, sorted newest first
 */
export function listZgentLogs(zgentId: string, baseDir?: string): string[] {
  const { readdirSync } = require('node:fs');
  const logDir = join(baseDir || ZGENT_BASE_DIR, 'logs', zgentId);

  if (!existsSync(logDir)) {
    return [];
  }

  return readdirSync(logDir)
    .filter((f: string) => f.endsWith('.jsonl'))
    .sort()
    .reverse()
    .map((f: string) => join(logDir, f));
}

/**
 * List all log files across all Zgents.
 *
 * @param baseDir - Base directory for Zgent data (default: ~/.zgents)
 * @returns Array of log file paths with Zgent info
 */
export function listAllZgentLogs(baseDir?: string): Array<{ zgentId: string; path: string; timestamp: string }> {
  const { readdirSync } = require('node:fs');
  const logsDir = join(baseDir || ZGENT_BASE_DIR, 'logs');

  if (!existsSync(logsDir)) {
    return [];
  }

  const results: Array<{ zgentId: string; path: string; timestamp: string }> = [];

  const zgentDirs = readdirSync(logsDir);
  for (const zgentId of zgentDirs) {
    const zgentLogDir = join(logsDir, zgentId);
    try {
      const files = readdirSync(zgentLogDir).filter((f: string) => f.endsWith('.jsonl'));
      for (const file of files) {
        results.push({
          zgentId,
          path: join(zgentLogDir, file),
          timestamp: file.replace('.jsonl', ''),
        });
      }
    } catch {
      // Skip directories we can't read
    }
  }

  // Sort by timestamp descending
  return results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
