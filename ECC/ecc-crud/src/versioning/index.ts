/**
 * @fileoverview Versioning module for artifact state tracking
 *
 * Provides snapshot capture, comparison, operation history tracking,
 * and utility functions for tracking artifact state changes during
 * CRUD operations.
 *
 * @module @ecc/crud/versioning
 */

// Snapshot types and functions
export type { ArtifactSnapshot } from './snapshot.js';

export {
  captureSnapshot,
  captureOperationSnapshots,
  generateFileHash,
  getArtifactPath,
  getSnapshotSize,
  snapshotExists,
  snapshotsEqual,
} from './snapshot.js';

// History types and classes
export type {
  FieldChange,
  ArtifactDiff,
  OperationHistoryEntry,
} from './history.js';

export {
  OperationHistory,
  computeDiff,
  createHistoryEntry,
} from './history.js';

// Note: generateOperationId is exported from the logging module, not versioning.
// This avoids duplication and ensures consistent ID generation across the package.
