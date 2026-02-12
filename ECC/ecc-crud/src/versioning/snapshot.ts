/**
 * @fileoverview Snapshot capture module for artifact versioning
 *
 * Provides functionality to capture before/after state for mutating operations,
 * enabling operation history tracking and potential undo functionality.
 *
 * @module @ecc/crud/versioning/snapshot
 */

import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { ArtifactType } from '../types/operation-types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a point-in-time snapshot of an artifact's state.
 *
 * Used for tracking changes during CRUD operations and supporting
 * features like operation history and undo functionality.
 *
 * @template T - The artifact type being snapshotted
 *
 * @example
 * ```typescript
 * const snapshot: ArtifactSnapshot<EccSkill> = {
 *   timestamp: '2026-02-08T12:00:00.000Z',
 *   artifactType: 'skill',
 *   artifactId: 'core/my-skill',
 *   state: { name: 'my-skill', description: '...' },
 *   filePath: '/project/.claude/skills/core/my-skill/SKILL.md',
 *   fileHash: 'sha256:abc123...'
 * };
 * ```
 */
export interface ArtifactSnapshot<T> {
  /** ISO 8601 timestamp when the snapshot was captured */
  timestamp: string;

  /** The type of artifact being snapshotted */
  artifactType: ArtifactType;

  /** Unique identifier for the artifact */
  artifactId: string;

  /** The artifact state at snapshot time. null for pre-create or post-delete. */
  state: T | null;

  /** Absolute file path to the artifact */
  filePath: string;

  /** SHA-256 hash of the serialized state for integrity verification */
  fileHash?: string;
}

// ============================================================================
// Path Helpers
// ============================================================================

/**
 * Artifact path patterns for each artifact type.
 *
 * Defines the file system structure for Claude Code 2.1 artifacts.
 */
const ARTIFACT_PATHS: Record<ArtifactType, string> = {
  skill: '.claude/skills',
  hook: '.claude/settings.json',
  subagent: '.claude/agents',
  rule: '.claude/rules',
  agent: '.claude/agents',
  command: '.claude/commands',
  'mcp-server': '.claude/settings.json',
};

/**
 * Resolve the file path for an artifact based on its type and ID.
 *
 * Different artifact types have different path structures:
 * - Skills: `.claude/skills/{category}/{name}/SKILL.md`
 * - Hooks: `.claude/settings.json` (section within file)
 * - SubAgents: `.claude/agents/{name}.md`
 * - Rules: `.claude/rules/{name}.md`
 * - Agents: `.claude/agents/{name}.md`
 * - Commands: `.claude/commands/{name}.md`
 * - MCP Servers: `.claude/settings.json` (section within file)
 *
 * @param artifactType - The type of artifact
 * @param artifactId - The artifact's unique identifier
 * @param projectRoot - The project root directory
 * @returns The resolved absolute file path
 *
 * @example
 * ```typescript
 * const path = getArtifactPath('skill', 'core/my-skill', '/home/user/project');
 * // Returns: '/home/user/project/.claude/skills/core/my-skill/SKILL.md'
 * ```
 */
export function getArtifactPath(
  artifactType: ArtifactType,
  artifactId: string,
  projectRoot: string
): string {
  const basePath = ARTIFACT_PATHS[artifactType];

  switch (artifactType) {
    case 'skill': {
      // Skills have format: {category}/{name} -> .claude/skills/{category}/{name}/SKILL.md
      const parts = artifactId.split('/');
      if (parts.length === 2 && parts[0] && parts[1]) {
        return join(projectRoot, basePath, parts[0], parts[1], 'SKILL.md');
      }
      // Default to general category if no category specified
      return join(projectRoot, basePath, 'general', artifactId, 'SKILL.md');
    }

    case 'hook':
    case 'mcp-server':
      // These are sections within settings.json
      return join(projectRoot, basePath);

    case 'subagent':
    case 'agent':
      // Agents and subagents are markdown files
      return join(projectRoot, basePath, `${artifactId}.md`);

    case 'rule':
      // Rules are markdown files
      return join(projectRoot, basePath, `${artifactId}.md`);

    case 'command':
      // Commands are markdown files
      return join(projectRoot, basePath, `${artifactId}.md`);

    default: {
      // Exhaustive check - should never reach here with valid ArtifactType
      const _exhaustive: never = artifactType;
      throw new Error(`Unknown artifact type: ${_exhaustive}`);
    }
  }
}

// ============================================================================
// Hash Generation
// ============================================================================

/**
 * Generate a SHA-256 hash of the given content.
 *
 * Used for integrity verification of artifact state. The hash is prefixed
 * with 'sha256:' to indicate the algorithm used.
 *
 * @param content - The content string to hash
 * @returns The SHA-256 hash prefixed with 'sha256:'
 *
 * @example
 * ```typescript
 * const hash = generateFileHash('{"name":"my-skill"}');
 * // Returns: 'sha256:a1b2c3d4...'
 * ```
 */
export function generateFileHash(content: string): string {
  const hash = createHash('sha256').update(content, 'utf-8').digest('hex');
  return `sha256:${hash}`;
}

// ============================================================================
// Snapshot Capture
// ============================================================================

/**
 * Capture the current state of an artifact as a snapshot.
 *
 * This function creates a point-in-time record of an artifact's state
 * for use in versioning, history tracking, and undo operations.
 *
 * @template T - The artifact type being captured
 *
 * @param artifactType - The type of artifact being captured
 * @param artifactId - The unique identifier of the artifact
 * @param projectRoot - The project root directory
 * @param currentState - The current state of the artifact (null for non-existent artifacts)
 * @returns A promise resolving to the captured snapshot
 *
 * @example
 * ```typescript
 * // Capture state before update
 * const beforeSnapshot = await captureSnapshot(
 *   'skill',
 *   'core/my-skill',
 *   '/home/user/project',
 *   existingSkill
 * );
 *
 * // Capture state for new artifact (pre-create)
 * const preCreateSnapshot = await captureSnapshot(
 *   'skill',
 *   'core/new-skill',
 *   '/home/user/project',
 *   null
 * );
 * ```
 */
export async function captureSnapshot<T>(
  artifactType: ArtifactType,
  artifactId: string,
  projectRoot: string,
  currentState: T | null
): Promise<ArtifactSnapshot<T>> {
  const timestamp = new Date().toISOString();
  const filePath = getArtifactPath(artifactType, artifactId, projectRoot);

  // Generate hash from serialized state if state exists
  let fileHash: string | undefined;
  if (currentState !== null) {
    const serialized = JSON.stringify(currentState, null, 2);
    fileHash = generateFileHash(serialized);
  }

  const snapshot: ArtifactSnapshot<T> = {
    timestamp,
    artifactType,
    artifactId,
    state: currentState,
    filePath,
  };

  // Only include fileHash if we have a state
  if (fileHash !== undefined) {
    snapshot.fileHash = fileHash;
  }

  return snapshot;
}

// ============================================================================
// Snapshot Comparison
// ============================================================================

/**
 * Compare two snapshots to determine if the artifact state has changed.
 *
 * Comparison is based on file hash when available, falling back to
 * deep equality comparison of the state objects.
 *
 * @template T - The artifact type being compared
 *
 * @param before - The snapshot representing the earlier state
 * @param after - The snapshot representing the later state
 * @returns True if the snapshots represent the same state, false otherwise
 *
 * @example
 * ```typescript
 * const beforeUpdate = await captureSnapshot('skill', 'my-skill', root, oldSkill);
 * // ... perform update ...
 * const afterUpdate = await captureSnapshot('skill', 'my-skill', root, newSkill);
 *
 * if (!snapshotsEqual(beforeUpdate, afterUpdate)) {
 *   console.log('Artifact was modified');
 * }
 * ```
 */
export function snapshotsEqual<T>(
  before: ArtifactSnapshot<T>,
  after: ArtifactSnapshot<T>
): boolean {
  // Quick checks for obvious mismatches
  if (before.artifactType !== after.artifactType) {
    return false;
  }

  if (before.artifactId !== after.artifactId) {
    return false;
  }

  // Both null means both non-existent (equal)
  if (before.state === null && after.state === null) {
    return true;
  }

  // One null, one not - definitely different
  if (before.state === null || after.state === null) {
    return false;
  }

  // If both have file hashes, compare them (fast path)
  if (before.fileHash !== undefined && after.fileHash !== undefined) {
    return before.fileHash === after.fileHash;
  }

  // Fall back to deep comparison via JSON serialization
  const beforeJson = JSON.stringify(before.state, null, 2);
  const afterJson = JSON.stringify(after.state, null, 2);

  return beforeJson === afterJson;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a pair of before/after snapshots for an operation.
 *
 * Convenience function for capturing the complete state transition
 * of a mutating operation.
 *
 * @template T - The artifact type being captured
 *
 * @param artifactType - The type of artifact
 * @param artifactId - The artifact's unique identifier
 * @param projectRoot - The project root directory
 * @param beforeState - State before the operation (null for create)
 * @param afterState - State after the operation (null for delete)
 * @returns Object containing both snapshots
 *
 * @example
 * ```typescript
 * const { before, after } = await captureOperationSnapshots(
 *   'skill',
 *   'core/my-skill',
 *   projectRoot,
 *   existingSkill,
 *   updatedSkill
 * );
 * ```
 */
export async function captureOperationSnapshots<T>(
  artifactType: ArtifactType,
  artifactId: string,
  projectRoot: string,
  beforeState: T | null,
  afterState: T | null
): Promise<{ before: ArtifactSnapshot<T>; after: ArtifactSnapshot<T> }> {
  const [before, after] = await Promise.all([
    captureSnapshot(artifactType, artifactId, projectRoot, beforeState),
    captureSnapshot(artifactType, artifactId, projectRoot, afterState),
  ]);

  return { before, after };
}

/**
 * Check if a snapshot represents an existing artifact.
 *
 * @param snapshot - The snapshot to check
 * @returns True if the snapshot has non-null state
 */
export function snapshotExists<T>(snapshot: ArtifactSnapshot<T>): boolean {
  return snapshot.state !== null;
}

/**
 * Get the size of the serialized state in bytes.
 *
 * Useful for logging and metrics around artifact sizes.
 *
 * @param snapshot - The snapshot to measure
 * @returns The size in bytes, or 0 if state is null
 */
export function getSnapshotSize<T>(snapshot: ArtifactSnapshot<T>): number {
  if (snapshot.state === null) {
    return 0;
  }

  const serialized = JSON.stringify(snapshot.state);
  return Buffer.byteLength(serialized, 'utf-8');
}
