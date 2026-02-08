/**
 * @fileoverview Result types for CRUD Engine operations
 *
 * Defines the structure of operation results including success/error states,
 * timing information, versioning snapshots, and logging references.
 *
 * @module @ecc/crud/types/result-types
 */

import type { CrudOperation } from './operation-types.js';

/**
 * Error information for failed operations
 */
export interface OperationError {
  /** Error code for programmatic handling (e.g., 'NOT_FOUND', 'VALIDATION_FAILED') */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional context about the error */
  context?: Record<string, unknown>;
}

/**
 * Result of a CRUD operation
 *
 * @template T - The type of data returned on success
 *
 * @example
 * ```typescript
 * // Success result
 * const result: OperationResult<EccSkill> = {
 *   success: true,
 *   operation: { type: 'read', artifactType: 'skill', id: 'my-skill' },
 *   timestamp: '2026-02-08T12:00:00.000Z',
 *   durationMs: 5,
 *   data: { name: 'my-skill', description: '...' },
 *   path: '.claude/skills/core/my-skill/SKILL.md'
 * };
 *
 * // Error result
 * const errorResult: OperationResult<EccSkill> = {
 *   success: false,
 *   operation: { type: 'read', artifactType: 'skill', id: 'missing' },
 *   timestamp: '2026-02-08T12:00:00.000Z',
 *   durationMs: 2,
 *   error: { code: 'NOT_FOUND', message: 'Skill not found' }
 * };
 * ```
 */
export interface OperationResult<T = unknown> {
  /** Whether the operation completed successfully */
  success: boolean;

  /** The operation that was executed */
  operation: CrudOperation;

  /** ISO 8601 timestamp when the operation completed */
  timestamp: string;

  /** Duration of the operation in milliseconds */
  durationMs: number;

  /** The data returned on success (artifact, list, etc.) */
  data?: T;

  /** File path affected by the operation */
  path?: string;

  /** Error details on failure */
  error?: OperationError;

  /** State of the artifact before the operation (for versioning) */
  beforeState?: T;

  /** State of the artifact after the operation (for versioning) */
  afterState?: T;

  /** Reference to the traffic log entry for this operation */
  logId?: string;
}

/**
 * Successful operation result with required data
 *
 * Use this type when you need to guarantee the result contains data.
 *
 * @template T - The type of data returned
 *
 * @example
 * ```typescript
 * function getSkill(id: string): Promise<SuccessResult<EccSkill>> {
 *   // Returns a result where data is guaranteed to be present
 * }
 * ```
 */
export type SuccessResult<T> = Omit<OperationResult<T>, 'success' | 'data' | 'error'> & {
  /** Always true for success results */
  success: true;
  /** The data is required for success results */
  data: T;
  /** Error is never present on success */
  error?: never;
};

/**
 * Failed operation result with required error
 *
 * Use this type when handling error cases where error details are guaranteed.
 *
 * @example
 * ```typescript
 * function handleError(result: ErrorResult): void {
 *   console.error(`Error ${result.error.code}: ${result.error.message}`);
 * }
 * ```
 */
export type ErrorResult = Omit<OperationResult<never>, 'success' | 'data' | 'error'> & {
  /** Always false for error results */
  success: false;
  /** Data is never present on error */
  data?: never;
  /** Error details are required for error results */
  error: OperationError;
};

/**
 * Type guard to check if a result is successful
 *
 * @param result - The operation result to check
 * @returns True if the result is a success result with data
 *
 * @example
 * ```typescript
 * const result = await crudEngine.read('skill', 'my-skill');
 * if (isSuccessResult(result)) {
 *   console.log(result.data.name); // TypeScript knows data exists
 * }
 * ```
 */
export function isSuccessResult<T>(result: OperationResult<T>): result is SuccessResult<T> {
  return result.success === true && result.data !== undefined;
}

/**
 * Type guard to check if a result is an error
 *
 * @param result - The operation result to check
 * @returns True if the result is an error result
 *
 * @example
 * ```typescript
 * const result = await crudEngine.read('skill', 'my-skill');
 * if (isErrorResult(result)) {
 *   console.error(result.error.message); // TypeScript knows error exists
 * }
 * ```
 */
export function isErrorResult<T>(result: OperationResult<T>): result is ErrorResult {
  return result.success === false && result.error !== undefined;
}
