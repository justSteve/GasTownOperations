/**
 * @fileoverview Traffic logging decorator for CRUD operations
 *
 * Provides observability for all CRUD operations by logging:
 * - Operation start (with context)
 * - Operation success (with duration, before/after state)
 * - Operation errors (with error details)
 *
 * @module @ecc/crud/logging/traffic-logger
 */

import type { OperationKind, ArtifactType } from '../types/operation-types.js';
import type { OperationResult } from '../types/result-types.js';

// ============================================================================
// Logger Interface (compatible with @ecc/orchestrator Logger)
// ============================================================================

/**
 * Logger context - arbitrary key-value pairs for structured logging.
 */
export type LogContext = Record<string, unknown>;

/**
 * Logger interface for structured logging.
 *
 * This interface is compatible with the Logger from @ecc/orchestrator.
 * Define it locally to avoid hard dependency on the orchestrator package.
 */
export interface Logger {
  /** Log a debug message */
  debug(message: string, context?: LogContext): void;
  /** Log an info message */
  info(message: string, context?: LogContext): void;
  /** Log a warning message */
  warn(message: string, context?: LogContext): void;
  /** Log an error message with optional Error object */
  error(message: string, error?: Error, context?: LogContext): void;
  /** Create a child logger with merged context */
  child(context: LogContext): Logger;
  /** Log a structured event at INFO level */
  event(type: string, data: Record<string, unknown>): void;
}

// ============================================================================
// Types
// ============================================================================

/**
 * A traffic log entry capturing CRUD operation details.
 *
 * Used for observability, debugging, and audit trails.
 */
export interface TrafficLogEntry {
  /** Unique identifier for this operation (for correlation) */
  operationId: string;

  /** ISO 8601 timestamp when the log entry was created */
  timestamp: string;

  /** The kind of CRUD operation (create, read, update, delete, query) */
  operation: OperationKind;

  /** The type of artifact being operated on */
  artifactType: ArtifactType;

  /** The artifact identifier (if applicable) */
  artifactId?: string;

  /** The phase of the operation lifecycle */
  phase: 'start' | 'success' | 'error';

  /** Duration in milliseconds (only on success/error) */
  durationMs?: number;

  /** State of the artifact before the operation (for updates/deletes) */
  beforeState?: unknown;

  /** State of the artifact after the operation (for creates/updates) */
  afterState?: unknown;

  /** File path affected by the operation */
  filePath?: string;

  /** File size in bytes (if applicable) */
  fileSize?: number;

  /** Error details (only on error phase) */
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}

/**
 * Context required to log a CRUD operation.
 */
export interface TrafficLoggingContext {
  /** The kind of CRUD operation */
  operation: OperationKind;

  /** The type of artifact being operated on */
  artifactType: ArtifactType;

  /** The artifact identifier (if applicable) */
  artifactId?: string;

  /** State before the operation (for observability) */
  beforeState?: unknown;
}

/**
 * A traffic logger instance bound to a specific Logger.
 */
export interface TrafficLogger {
  /**
   * Wrap an operation with traffic logging.
   *
   * Logs operation start, then executes the operation, then logs
   * success or error with timing information.
   *
   * @param operation - The async operation to execute
   * @param context - Context about the operation being performed
   * @returns The operation result with logId populated
   */
  wrap<T>(
    operation: () => Promise<OperationResult<T>>,
    context: TrafficLoggingContext
  ): Promise<OperationResult<T>>;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Counter for operation IDs within this process.
 * Combined with timestamp for uniqueness.
 */
let operationCounter = 0;

/**
 * Generate a unique operation ID.
 *
 * Format: `op-{timestamp}-{counter}`
 *
 * Uses a combination of timestamp (base36) and process-unique counter
 * to ensure uniqueness within a process lifetime.
 *
 * @returns A unique operation identifier
 */
export function generateOperationId(): string {
  const timestamp = Date.now().toString(36);
  const counter = (++operationCounter).toString(36).padStart(4, '0');
  return `op-${timestamp}-${counter}`;
}

/**
 * Create a traffic log entry.
 *
 * @param operationId - The unique operation ID
 * @param phase - The phase of the operation lifecycle
 * @param context - The operation context
 * @param extras - Additional fields to include
 * @returns A complete traffic log entry
 */
function createLogEntry(
  operationId: string,
  phase: TrafficLogEntry['phase'],
  context: TrafficLoggingContext,
  extras?: Partial<TrafficLogEntry>
): TrafficLogEntry {
  const entry: TrafficLogEntry = {
    operationId,
    timestamp: new Date().toISOString(),
    operation: context.operation,
    artifactType: context.artifactType,
    phase,
  };

  if (context.artifactId) {
    entry.artifactId = context.artifactId;
  }

  if (context.beforeState !== undefined) {
    entry.beforeState = context.beforeState;
  }

  // Merge in any extras
  if (extras) {
    Object.assign(entry, extras);
  }

  return entry;
}

/**
 * Format a log entry as a context object for the Logger.
 *
 * @param entry - The traffic log entry
 * @returns A record suitable for Logger context
 */
function entryToContext(entry: TrafficLogEntry): Record<string, unknown> {
  const context: Record<string, unknown> = {
    operationId: entry.operationId,
    operation: entry.operation,
    artifactType: entry.artifactType,
    phase: entry.phase,
  };

  if (entry.artifactId) {
    context.artifactId = entry.artifactId;
  }

  if (entry.durationMs !== undefined) {
    context.durationMs = entry.durationMs;
  }

  if (entry.filePath) {
    context.filePath = entry.filePath;
  }

  if (entry.fileSize !== undefined) {
    context.fileSize = entry.fileSize;
  }

  if (entry.beforeState !== undefined) {
    context.beforeState = entry.beforeState;
  }

  if (entry.afterState !== undefined) {
    context.afterState = entry.afterState;
  }

  if (entry.error) {
    context.error = entry.error;
  }

  return context;
}

/**
 * Create a traffic logger bound to the given Logger instance.
 *
 * @param logger - The Logger to use for output
 * @returns A TrafficLogger instance
 *
 * @example
 * ```typescript
 * import { createTrafficLogger, type Logger } from './traffic-logger.js';
 *
 * // Logger can be from @ecc/orchestrator or any compatible implementation
 * const logger: Logger = createLogger({ level: 'INFO', format: 'json', transports: [{ type: 'console' }] });
 * const traffic = createTrafficLogger(logger);
 *
 * const result = await traffic.wrap(
 *   () => crudEngine.read('skill', 'my-skill'),
 *   { operation: 'read', artifactType: 'skill', artifactId: 'my-skill' }
 * );
 * ```
 */
export function createTrafficLogger(logger: Logger): TrafficLogger {
  return {
    async wrap<T>(
      operation: () => Promise<OperationResult<T>>,
      context: TrafficLoggingContext
    ): Promise<OperationResult<T>> {
      const operationId = generateOperationId();
      const startTime = performance.now();

      // Log operation start
      const startEntry = createLogEntry(operationId, 'start', context);
      logger.info(
        `CRUD ${context.operation} ${context.artifactType}${context.artifactId ? `: ${context.artifactId}` : ''} - start`,
        entryToContext(startEntry)
      );

      try {
        // Execute the operation
        const result = await operation();

        // Calculate duration
        const durationMs = Math.round(performance.now() - startTime);

        if (result.success) {
          // Log success - build extras carefully for exactOptionalPropertyTypes
          const successExtras: Partial<TrafficLogEntry> = { durationMs };
          const afterState = result.afterState ?? result.data;
          if (afterState !== undefined) {
            successExtras.afterState = afterState;
          }
          if (result.path !== undefined) {
            successExtras.filePath = result.path;
          }
          const successEntry = createLogEntry(operationId, 'success', context, successExtras);

          logger.info(
            `CRUD ${context.operation} ${context.artifactType}${context.artifactId ? `: ${context.artifactId}` : ''} - success (${durationMs}ms)`,
            entryToContext(successEntry)
          );
        } else {
          // Log error (operation returned error result, but didn't throw)
          const errorEntry = createLogEntry(operationId, 'error', context, {
            durationMs,
            error: result.error
              ? {
                  code: result.error.code,
                  message: result.error.message,
                }
              : { code: 'UNKNOWN', message: 'Operation failed without error details' },
          });

          logger.error(
            `CRUD ${context.operation} ${context.artifactType}${context.artifactId ? `: ${context.artifactId}` : ''} - error (${durationMs}ms): ${result.error?.message ?? 'Unknown error'}`,
            undefined,
            entryToContext(errorEntry)
          );
        }

        // Return result with logId populated
        return {
          ...result,
          logId: operationId,
        };
      } catch (error) {
        // Handle thrown errors
        const durationMs = Math.round(performance.now() - startTime);

        // Build error details carefully for exactOptionalPropertyTypes
        const errorDetails: { code: string; message: string; stack?: string } = {
          code: 'EXCEPTION',
          message: error instanceof Error ? error.message : String(error),
        };

        if (error instanceof Error) {
          const errnoCode = (error as NodeJS.ErrnoException).code;
          if (errnoCode) {
            errorDetails.code = errnoCode;
          }
          if (error.stack) {
            errorDetails.stack = error.stack;
          }
        }

        const errorEntry = createLogEntry(operationId, 'error', context, {
          durationMs,
          error: errorDetails,
        });

        logger.error(
          `CRUD ${context.operation} ${context.artifactType}${context.artifactId ? `: ${context.artifactId}` : ''} - exception (${durationMs}ms): ${errorDetails.message}`,
          error instanceof Error ? error : undefined,
          entryToContext(errorEntry)
        );

        // Re-throw the error
        throw error;
      }
    },
  };
}

/**
 * Decorator function that wraps CRUD operations with traffic logging.
 *
 * This is a convenience wrapper around createTrafficLogger for single operations.
 *
 * @param logger - The Logger to use for output
 * @param operation - The async operation to execute
 * @param context - Context about the operation being performed
 * @returns The operation result with logId populated
 *
 * @example
 * ```typescript
 * const result = await withTrafficLogging(
 *   logger,
 *   () => crudEngine.create('skill', skillData),
 *   { operation: 'create', artifactType: 'skill', artifactId: 'new-skill' }
 * );
 * ```
 */
export async function withTrafficLogging<T>(
  logger: Logger,
  operation: () => Promise<OperationResult<T>>,
  context: TrafficLoggingContext
): Promise<OperationResult<T>> {
  const trafficLogger = createTrafficLogger(logger);
  return trafficLogger.wrap(operation, context);
}
