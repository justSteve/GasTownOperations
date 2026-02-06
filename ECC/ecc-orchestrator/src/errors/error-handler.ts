/**
 * Error handling utilities for @ecc/orchestrator
 *
 * Provides functions for wrapping, enriching, and inspecting errors
 * in a consistent way across the orchestration system.
 */

import {
  OrchestrationError,
  RuntimeError,
  type ErrorContext,
} from './error-types.js';

/**
 * Wrap an unknown caught value in an OrchestrationError
 *
 * Handles various thrown types:
 * - OrchestrationError: returned as-is (with optional context enrichment)
 * - Error: wrapped in RuntimeError preserving message and stack
 * - string: converted to RuntimeError with string as message
 * - other: converted to RuntimeError with JSON stringified message
 *
 * @param error - The caught value of unknown type
 * @param context - Optional context to add to the error
 * @returns An OrchestrationError wrapping the original error
 */
export function wrapError(
  error: unknown,
  context?: ErrorContext
): OrchestrationError {
  // Already an OrchestrationError - optionally enrich with context
  if (error instanceof OrchestrationError) {
    if (context) {
      return enrichError(error, context);
    }
    return error;
  }

  // Standard Error - wrap in RuntimeError
  if (error instanceof Error) {
    return new WrappedError(error.message, context, error);
  }

  // String thrown directly
  if (typeof error === 'string') {
    return new WrappedError(error, context);
  }

  // Unknown type - stringify as best we can
  let message: string;
  try {
    message = JSON.stringify(error);
  } catch {
    message = String(error);
  }

  return new WrappedError(`Unknown error: ${message}`, context);
}

/**
 * Internal error class for wrapped non-OrchestrationError values
 */
class WrappedError extends RuntimeError {
  override readonly code: string = 'WRAPPED_ERROR';

  constructor(message: string, context?: ErrorContext, cause?: Error) {
    super(message, context, cause);
  }
}

/**
 * Add context to an existing OrchestrationError
 *
 * Creates a new error instance with merged context, preserving
 * existing context values and adding new ones.
 *
 * @param error - The error to enrich
 * @param context - Additional context to merge
 * @returns A new error with merged context
 */
export function enrichError<T extends OrchestrationError>(
  error: T,
  context: ErrorContext
): T {
  // Merge contexts, new context takes precedence
  const mergedContext: ErrorContext = {
    ...error.context,
    ...context,
  };

  // Create a shallow copy of the error with updated context
  const enriched = Object.create(Object.getPrototypeOf(error)) as T;
  Object.assign(enriched, error);

  // Override the context with merged version
  Object.defineProperty(enriched, 'context', {
    value: mergedContext,
    writable: false,
    enumerable: true,
    configurable: false,
  });

  return enriched;
}

/**
 * Format an error's stack trace for logging
 *
 * Cleans up the stack trace by:
 * - Removing Node.js internals (optional)
 * - Trimming excessive frames
 * - Formatting consistently
 *
 * @param error - The error to format
 * @param options - Formatting options
 * @returns Formatted stack trace string
 */
export function formatStack(
  error: Error,
  options: {
    includeInternals?: boolean;
    maxFrames?: number;
  } = {}
): string {
  const { includeInternals = false, maxFrames = 20 } = options;

  if (!error.stack) {
    return `${error.name}: ${error.message}\n    (no stack trace available)`;
  }

  const lines = error.stack.split('\n');
  const filtered: string[] = [];

  for (const line of lines) {
    // Always include the error message line
    if (!line.startsWith('    at ')) {
      filtered.push(line);
      continue;
    }

    // Filter out internal frames if requested
    if (!includeInternals) {
      if (
        line.includes('node:internal') ||
        line.includes('node_modules') ||
        line.includes('<anonymous>')
      ) {
        continue;
      }
    }

    filtered.push(line);

    // Limit total frames
    if (filtered.filter((l) => l.startsWith('    at ')).length >= maxFrames) {
      filtered.push(`    ... (${lines.length - filtered.length} more frames)`);
      break;
    }
  }

  return filtered.join('\n');
}

/**
 * Type guard to check if an error is an OrchestrationError
 *
 * @param error - The value to check
 * @returns True if error is an OrchestrationError
 */
export function isOrchestrationError(
  error: unknown
): error is OrchestrationError {
  return error instanceof OrchestrationError;
}

/**
 * Extract the full chain of errors from an error with causes
 *
 * Follows the cause chain from the given error to the root cause,
 * returning all errors in order from outermost to innermost.
 *
 * @param error - The error to extract the chain from
 * @returns Array of errors from outermost to root cause
 */
export function getErrorChain(error: Error): Error[] {
  const chain: Error[] = [];
  let current: Error | undefined = error;

  // Protect against circular references
  const seen = new WeakSet<Error>();

  while (current) {
    if (seen.has(current)) {
      break; // Circular reference detected
    }
    seen.add(current);
    chain.push(current);

    // Follow the cause chain
    // Use type assertion since cause may not be typed on all Error subtypes
    const errorWithCause = current as Error & { cause?: unknown };
    const cause: unknown = errorWithCause.cause;
    if (cause instanceof Error) {
      current = cause;
    } else {
      current = undefined;
    }
  }

  return chain;
}

/**
 * Check if an error or any error in its chain matches a predicate
 *
 * @param error - The error to check
 * @param predicate - Function to test each error in the chain
 * @returns True if any error in the chain matches
 */
export function hasErrorInChain(
  error: Error,
  predicate: (err: Error) => boolean
): boolean {
  return getErrorChain(error).some(predicate);
}

/**
 * Find the first error in the chain matching a predicate
 *
 * @param error - The error to search from
 * @param predicate - Function to test each error in the chain
 * @returns The matching error or undefined
 */
export function findErrorInChain<T extends Error>(
  error: Error,
  predicate: (err: Error) => err is T
): T | undefined {
  return getErrorChain(error).find(predicate) as T | undefined;
}

/**
 * Get the root cause of an error chain
 *
 * @param error - The error to find the root cause of
 * @returns The innermost error in the cause chain
 */
export function getRootCause(error: Error): Error {
  const chain = getErrorChain(error);
  const lastError = chain[chain.length - 1];
  return lastError !== undefined ? lastError : error;
}
