/**
 * @fileoverview Operation history tracking for the CRUD Engine
 *
 * Provides a rolling buffer of recent operations, enabling:
 * - Operation audit trail
 * - Artifact change history lookup
 * - Foundation for undo capability
 *
 * @module @ecc/crud/versioning/history
 */

import type { CrudOperation, ArtifactType } from '../types/operation-types.js';
import type { OperationResult } from '../types/result-types.js';
import type { ArtifactSnapshot } from './snapshot.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a single field change between two states.
 */
export interface FieldChange {
  /** The name of the field that changed */
  field: string;
  /** The value before the change (undefined if field was added) */
  oldValue: unknown;
  /** The value after the change (undefined if field was removed) */
  newValue: unknown;
}

/**
 * Represents the diff between two artifact states.
 *
 * The type parameter T is kept for API consistency with related types
 * (ArtifactSnapshot<T>, OperationHistoryEntry<T>).
 *
 * @template T - The artifact type being diffed
 *
 * @example
 * ```typescript
 * const diff: ArtifactDiff<EccSkill> = {
 *   artifactType: 'skill',
 *   artifactId: 'core/my-skill',
 *   changes: [
 *     { field: 'description', oldValue: 'Old desc', newValue: 'New desc' },
 *     { field: 'tags', oldValue: ['a'], newValue: ['a', 'b'] }
 *   ],
 *   isStructuralChange: false
 * };
 * ```
 */
export interface ArtifactDiff<T = unknown> {
  /** The type of artifact being diffed */
  artifactType: ArtifactType;

  /** The unique identifier of the artifact */
  artifactId: string;

  /** List of individual field changes */
  changes: FieldChange[];

  /**
   * True if the change affects structural/metadata aspects.
   * For markdown-based artifacts, this means frontmatter changes.
   * For JSON artifacts (hooks, mcp-servers), any change is structural.
   */
  isStructuralChange: boolean;

  /**
   * Phantom type marker to preserve the artifact type.
   * This property is never populated at runtime.
   * @internal
   */
  readonly _artifactType?: T;
}

/**
 * A complete record of a CRUD operation including before/after state.
 *
 * @template T - The artifact type involved in the operation
 *
 * @example
 * ```typescript
 * const entry: OperationHistoryEntry<EccSkill> = {
 *   operationId: 'op-12345',
 *   timestamp: '2026-02-08T12:00:00.000Z',
 *   operation: { type: 'update', artifactType: 'skill', id: 'my-skill', changes: { ... } },
 *   result: { success: true, ... },
 *   before: { state: oldSkill, ... },
 *   after: { state: newSkill, ... },
 *   diff: { changes: [...], isStructuralChange: false }
 * };
 * ```
 */
export interface OperationHistoryEntry<T = unknown> {
  /** Unique identifier for this operation */
  operationId: string;

  /** ISO 8601 timestamp when the operation occurred */
  timestamp: string;

  /** The CRUD operation that was performed */
  operation: CrudOperation;

  /** The result of the operation */
  result: OperationResult<T>;

  /** Snapshot of artifact state before the operation */
  before: ArtifactSnapshot<T>;

  /** Snapshot of artifact state after the operation */
  after: ArtifactSnapshot<T>;

  /** Computed diff between before and after states */
  diff: ArtifactDiff<T>;
}

// ============================================================================
// Constants
// ============================================================================

/** Default maximum number of history entries to retain */
const DEFAULT_MAX_ENTRIES = 100;

/**
 * Fields that are considered structural/metadata for markdown artifacts.
 * Changes to these fields indicate a structural change.
 */
const STRUCTURAL_FIELDS = new Set([
  // Common frontmatter fields
  'name',
  'description',
  'version',
  'author',
  'tags',
  'tools',
  'allowedTools',
  'disallowedTools',
  'permissions',
  // Hook-specific
  'event',
  'matcher',
  'command',
  // Agent-specific
  'model',
  'system',
  'temperature',
  // MCP Server fields
  'command',
  'args',
  'env',
]);

// ============================================================================
// Diff Computation
// ============================================================================

/**
 * Get all keys from an object, handling null/undefined.
 */
function getObjectKeys(obj: unknown): string[] {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return [];
  }
  return Object.keys(obj as Record<string, unknown>);
}

/**
 * Get a value from an object by key, handling null/undefined.
 */
function getObjectValue(obj: unknown, key: string): unknown {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return undefined;
  }
  return (obj as Record<string, unknown>)[key];
}

/**
 * Deep equality check for two values.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  if (a === null || b === null) {
    return a === b;
  }

  if (typeof a !== typeof b) {
    return false;
  }

  if (typeof a !== 'object') {
    return a === b;
  }

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((val, i) => deepEqual(val, b[i]));
  }

  // Handle objects
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }

  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);

  if (keysA.length !== keysB.length) {
    return false;
  }

  return keysA.every((key) =>
    deepEqual(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key]
    )
  );
}

/**
 * Check if a field is considered structural.
 */
function isStructuralField(field: string, artifactType: ArtifactType): boolean {
  // For hooks and mcp-servers (stored in settings.json), any change is structural
  if (artifactType === 'hook' || artifactType === 'mcp-server') {
    return true;
  }

  return STRUCTURAL_FIELDS.has(field);
}

/**
 * Compute the diff between two artifact states.
 *
 * Identifies which fields changed between the before and after states,
 * and determines if any structural changes occurred.
 *
 * @template T - The artifact type being diffed
 *
 * @param artifactType - The type of artifact
 * @param artifactId - The unique identifier of the artifact
 * @param before - State before the operation (null for create)
 * @param after - State after the operation (null for delete)
 * @returns The computed diff
 *
 * @example
 * ```typescript
 * // Update operation diff
 * const diff = computeDiff('skill', 'my-skill', oldSkill, newSkill);
 *
 * // Create operation diff (before is null)
 * const createDiff = computeDiff('skill', 'new-skill', null, newSkill);
 *
 * // Delete operation diff (after is null)
 * const deleteDiff = computeDiff('skill', 'old-skill', oldSkill, null);
 * ```
 */
export function computeDiff<T>(
  artifactType: ArtifactType,
  artifactId: string,
  before: T | null,
  after: T | null
): ArtifactDiff<T> {
  const changes: FieldChange[] = [];
  let isStructuralChange = false;

  // Get all unique keys from both states
  const beforeKeys = new Set(getObjectKeys(before));
  const afterKeys = new Set(getObjectKeys(after));
  const allKeys = new Set([...beforeKeys, ...afterKeys]);

  // Check each key for changes
  for (const key of allKeys) {
    const oldValue = getObjectValue(before, key);
    const newValue = getObjectValue(after, key);

    if (!deepEqual(oldValue, newValue)) {
      changes.push({
        field: key,
        oldValue,
        newValue,
      });

      // Check if this is a structural change
      if (isStructuralField(key, artifactType)) {
        isStructuralChange = true;
      }
    }
  }

  // Create or delete operations are always structural
  if (before === null || after === null) {
    isStructuralChange = true;
  }

  return {
    artifactType,
    artifactId,
    changes,
    isStructuralChange,
  };
}

// ============================================================================
// Operation History Class
// ============================================================================

/**
 * Rolling buffer of operation history entries.
 *
 * Maintains a fixed-size history of CRUD operations for:
 * - Audit trail and debugging
 * - Artifact change lookup
 * - Potential undo functionality
 *
 * @example
 * ```typescript
 * const history = new OperationHistory(50); // Keep last 50 operations
 *
 * // Add entries as operations complete
 * history.add(entry);
 *
 * // Look up operations for an artifact
 * const skillHistory = history.findByArtifact('core/my-skill');
 *
 * // Get recent operations
 * const recent = history.getRecent(10);
 * ```
 */
export class OperationHistory {
  private entries: OperationHistoryEntry<unknown>[] = [];
  private readonly maxEntries: number;

  /**
   * Create a new operation history buffer.
   *
   * @param maxEntries - Maximum entries to retain (default: 100)
   */
  constructor(maxEntries: number = DEFAULT_MAX_ENTRIES) {
    this.maxEntries = Math.max(1, maxEntries);
  }

  /**
   * Add a new operation entry to the history.
   *
   * If the history exceeds maxEntries, the oldest entries are removed.
   *
   * @param entry - The operation entry to add
   */
  add<T>(entry: OperationHistoryEntry<T>): void {
    this.entries.push(entry as OperationHistoryEntry<unknown>);

    // Trim oldest entries if over limit
    while (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }

  /**
   * Get the most recent operations.
   *
   * @param count - Number of entries to return (default: 10)
   * @returns Array of entries, newest first
   */
  getRecent(count: number = 10): OperationHistoryEntry<unknown>[] {
    const n = Math.min(count, this.entries.length);
    // Return newest first by taking from end and reversing
    return this.entries.slice(-n).reverse();
  }

  /**
   * Find all operations for a specific artifact.
   *
   * @param artifactId - The artifact ID to search for
   * @returns Array of matching entries, newest first
   */
  findByArtifact(artifactId: string): OperationHistoryEntry<unknown>[] {
    return this.entries
      .filter((entry) => {
        // Check the before/after snapshots for the artifact ID
        return (
          entry.before.artifactId === artifactId ||
          entry.after.artifactId === artifactId
        );
      })
      .reverse(); // Newest first
  }

  /**
   * Find an operation by its unique ID.
   *
   * @param operationId - The operation ID to find
   * @returns The matching entry or undefined
   */
  findByOperation(operationId: string): OperationHistoryEntry<unknown> | undefined {
    return this.entries.find((entry) => entry.operationId === operationId);
  }

  /**
   * Get an entry suitable for undo, if the operation can be undone.
   *
   * An operation can be undone if:
   * - Create: Can be deleted (after state exists)
   * - Update: Can restore previous state (before state exists)
   * - Delete: Can recreate (before state exists)
   *
   * @param operationId - The operation ID to find undo candidate for
   * @returns The entry if it can be undone, null otherwise
   */
  getUndoCandidate(operationId: string): OperationHistoryEntry<unknown> | null {
    const entry = this.findByOperation(operationId);

    if (!entry) {
      return null;
    }

    // Determine if this operation can be undone
    const opType = entry.operation.type;

    switch (opType) {
      case 'create':
        // Create can be undone by deleting (after state must exist)
        if (entry.after.state !== null) {
          return entry;
        }
        break;

      case 'update':
        // Update can be undone by restoring before state
        if (entry.before.state !== null) {
          return entry;
        }
        break;

      case 'delete':
        // Delete can be undone by recreating (before state must exist)
        if (entry.before.state !== null) {
          return entry;
        }
        break;

      case 'read':
      case 'query':
        // Read operations cannot be undone (they don't change state)
        return null;
    }

    return null;
  }

  /**
   * Clear all history entries.
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Get the current number of entries in history.
   *
   * @returns The number of entries
   */
  size(): number {
    return this.entries.length;
  }

  /**
   * Get the maximum capacity of the history.
   *
   * @returns The maximum number of entries
   */
  capacity(): number {
    return this.maxEntries;
  }

  /**
   * Check if the history is empty.
   *
   * @returns True if no entries exist
   */
  isEmpty(): boolean {
    return this.entries.length === 0;
  }

  /**
   * Check if the history is at capacity.
   *
   * @returns True if at maximum entries
   */
  isFull(): boolean {
    return this.entries.length >= this.maxEntries;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new operation history entry.
 *
 * Helper function to construct a properly typed history entry
 * from the components of a completed operation.
 *
 * @template T - The artifact type
 *
 * @param operationId - Unique ID for the operation
 * @param operation - The CRUD operation that was performed
 * @param result - The operation result
 * @param before - Snapshot before the operation
 * @param after - Snapshot after the operation
 * @returns A complete history entry
 *
 * @example
 * ```typescript
 * const entry = createHistoryEntry(
 *   generateOperationId(),
 *   updateOp,
 *   result,
 *   beforeSnapshot,
 *   afterSnapshot
 * );
 * history.add(entry);
 * ```
 */
export function createHistoryEntry<T>(
  operationId: string,
  operation: CrudOperation,
  result: OperationResult<T>,
  before: ArtifactSnapshot<T>,
  after: ArtifactSnapshot<T>
): OperationHistoryEntry<T> {
  const diff = computeDiff(
    before.artifactType,
    before.artifactId,
    before.state,
    after.state
  );

  return {
    operationId,
    timestamp: new Date().toISOString(),
    operation,
    result,
    before,
    after,
    diff,
  };
}

// Note: generateOperationId is provided by the logging module.
// Use: import { generateOperationId } from '../logging/index.js';
