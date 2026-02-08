/**
 * @module operation-types
 * @description CRUD operation type definitions for the CRUD Engine.
 *
 * Defines the complete type system for artifact operations including
 * create, read, update, delete, and query operations across all
 * Claude Code 2.1 artifact types.
 *
 * @packageDocumentation
 */

// ============================================================================
// Artifact Types
// ============================================================================

/**
 * Supported artifact types for CRUD operations.
 *
 * These represent the 7 Claude Code 2.1 artifact types managed by the CRUD Engine:
 * - `skill` - Skills in `.claude/skills/{category}/{name}/SKILL.md`
 * - `hook` - Hooks in `.claude/settings.json` (hooks section)
 * - `subagent` - SubAgents in `.claude/agents/{name}.md`
 * - `rule` - Rules in `.claude/rules/{name}.md`
 * - `agent` - Agents in `.claude/agents/{name}.md`
 * - `command` - Commands in `.claude/commands/{name}.md`
 * - `mcp-server` - MCP Servers in `.claude/settings.json` (mcpServers section)
 */
export type ArtifactType =
  | 'skill'
  | 'hook'
  | 'subagent'
  | 'rule'
  | 'agent'
  | 'command'
  | 'mcp-server';

// ============================================================================
// Operation Kinds
// ============================================================================

/**
 * The kind of CRUD operation being performed.
 *
 * - `create` - Create a new artifact
 * - `read` - Read an existing artifact
 * - `update` - Update an existing artifact
 * - `delete` - Delete an existing artifact
 * - `query` - Query/search for artifacts matching criteria
 */
export type OperationKind = 'create' | 'read' | 'update' | 'delete' | 'query';

// ============================================================================
// Operation Options
// ============================================================================

/**
 * Options for create operations.
 */
export interface CreateOperationOptions {
  /**
   * If true, overwrite existing artifact with the same identifier.
   * @default false
   */
  overwrite?: boolean;

  /**
   * If true, validate the operation without persisting changes.
   * @default false
   */
  dryRun?: boolean;
}

/**
 * Options for read operations.
 */
export interface ReadOperationOptions {
  /**
   * If true, include the full content of the artifact.
   * @default true
   */
  includeContent?: boolean;

  /**
   * If true, include metadata such as file stats, timestamps, etc.
   * @default false
   */
  includeMetadata?: boolean;
}

/**
 * Options for update operations.
 */
export interface UpdateOperationOptions {
  /**
   * If true, merge changes with existing artifact.
   * If false, replace the entire artifact.
   * @default true
   */
  merge?: boolean;

  /**
   * If true, validate the operation without persisting changes.
   * @default false
   */
  dryRun?: boolean;
}

/**
 * Options for delete operations.
 */
export interface DeleteOperationOptions {
  /**
   * If true, perform a soft delete (mark as deleted rather than remove).
   * @default false
   */
  soft?: boolean;

  /**
   * If true, validate the operation without persisting changes.
   * @default false
   */
  dryRun?: boolean;
}

/**
 * Filter criteria for query operations.
 */
export interface QueryFilter {
  /**
   * Filter by artifact name. Supports string for exact match or RegExp for pattern matching.
   */
  name?: string | RegExp;

  /**
   * Filter by category (applicable to skills).
   */
  category?: string;

  /**
   * Filter by tags. Artifacts must have all specified tags.
   */
  tags?: string[];

  /**
   * Filter for artifacts modified after this date.
   */
  modifiedAfter?: Date;

  /**
   * Filter for artifacts modified before this date.
   */
  modifiedBefore?: Date;
}

/**
 * Options for query operations.
 */
export interface QueryOperationOptions {
  /**
   * Maximum number of results to return.
   */
  limit?: number;

  /**
   * Number of results to skip (for pagination).
   */
  offset?: number;

  /**
   * If true, include the full content of each artifact in results.
   * @default false
   */
  includeContent?: boolean;
}

// ============================================================================
// Operation Interfaces
// ============================================================================

/**
 * Create operation - creates a new artifact.
 *
 * @typeParam T - The artifact type being created
 *
 * @example
 * ```typescript
 * const createSkill: CreateOperation<EccSkill> = {
 *   type: 'create',
 *   artifactType: 'skill',
 *   artifact: {
 *     name: 'my-skill',
 *     description: 'A new skill',
 *     // ... other skill properties
 *   },
 *   options: {
 *     overwrite: false,
 *     dryRun: false
 *   }
 * };
 * ```
 */
export interface CreateOperation<T> {
  /** Discriminator for operation type */
  readonly type: 'create';

  /** The type of artifact being created */
  artifactType: ArtifactType;

  /** The artifact data to create */
  artifact: T;

  /** Optional create operation settings */
  options?: CreateOperationOptions;
}

/**
 * Read operation - reads an existing artifact by ID.
 *
 * @example
 * ```typescript
 * const readSkill: ReadOperation = {
 *   type: 'read',
 *   artifactType: 'skill',
 *   id: 'my-skill',
 *   options: {
 *     includeContent: true,
 *     includeMetadata: true
 *   }
 * };
 * ```
 */
export interface ReadOperation {
  /** Discriminator for operation type */
  readonly type: 'read';

  /** The type of artifact being read */
  artifactType: ArtifactType;

  /** The unique identifier of the artifact to read */
  id: string;

  /** Optional read operation settings */
  options?: ReadOperationOptions;
}

/**
 * Update operation - updates an existing artifact.
 *
 * @typeParam T - The artifact type being updated
 *
 * @example
 * ```typescript
 * const updateSkill: UpdateOperation<EccSkill> = {
 *   type: 'update',
 *   artifactType: 'skill',
 *   id: 'my-skill',
 *   changes: {
 *     description: 'Updated description'
 *   },
 *   options: {
 *     merge: true,
 *     dryRun: false
 *   }
 * };
 * ```
 */
export interface UpdateOperation<T> {
  /** Discriminator for operation type */
  readonly type: 'update';

  /** The type of artifact being updated */
  artifactType: ArtifactType;

  /** The unique identifier of the artifact to update */
  id: string;

  /** Partial changes to apply to the artifact */
  changes: Partial<T>;

  /** Optional update operation settings */
  options?: UpdateOperationOptions;
}

/**
 * Delete operation - deletes an existing artifact.
 *
 * @example
 * ```typescript
 * const deleteSkill: DeleteOperation = {
 *   type: 'delete',
 *   artifactType: 'skill',
 *   id: 'my-skill',
 *   options: {
 *     soft: false,
 *     dryRun: false
 *   }
 * };
 * ```
 */
export interface DeleteOperation {
  /** Discriminator for operation type */
  readonly type: 'delete';

  /** The type of artifact being deleted */
  artifactType: ArtifactType;

  /** The unique identifier of the artifact to delete */
  id: string;

  /** Optional delete operation settings */
  options?: DeleteOperationOptions;
}

/**
 * Query operation - searches for artifacts matching specified criteria.
 *
 * @example
 * ```typescript
 * const querySkills: QueryOperation = {
 *   type: 'query',
 *   artifactType: 'skill',
 *   filter: {
 *     category: 'core',
 *     tags: ['utility'],
 *     modifiedAfter: new Date('2026-01-01')
 *   },
 *   options: {
 *     limit: 10,
 *     offset: 0,
 *     includeContent: false
 *   }
 * };
 * ```
 */
export interface QueryOperation {
  /** Discriminator for operation type */
  readonly type: 'query';

  /** The type of artifacts to query */
  artifactType: ArtifactType;

  /** Optional filter criteria for the query */
  filter?: QueryFilter;

  /** Optional query operation settings */
  options?: QueryOperationOptions;
}

// ============================================================================
// Union Types
// ============================================================================

/**
 * Union type representing any CRUD operation.
 *
 * This discriminated union enables type-safe handling of all operation types
 * using the `type` field as the discriminator.
 *
 * @example
 * ```typescript
 * function handleOperation(op: CrudOperation): void {
 *   switch (op.type) {
 *     case 'create':
 *       console.log('Creating artifact:', op.artifact);
 *       break;
 *     case 'read':
 *       console.log('Reading artifact:', op.id);
 *       break;
 *     case 'update':
 *       console.log('Updating artifact:', op.id, 'with:', op.changes);
 *       break;
 *     case 'delete':
 *       console.log('Deleting artifact:', op.id);
 *       break;
 *     case 'query':
 *       console.log('Querying artifacts with filter:', op.filter);
 *       break;
 *   }
 * }
 * ```
 */
export type CrudOperation =
  | CreateOperation<unknown>
  | ReadOperation
  | UpdateOperation<unknown>
  | DeleteOperation
  | QueryOperation;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if an operation is a CreateOperation.
 */
export function isCreateOperation<T>(op: CrudOperation): op is CreateOperation<T> {
  return op.type === 'create';
}

/**
 * Type guard to check if an operation is a ReadOperation.
 */
export function isReadOperation(op: CrudOperation): op is ReadOperation {
  return op.type === 'read';
}

/**
 * Type guard to check if an operation is an UpdateOperation.
 */
export function isUpdateOperation<T>(op: CrudOperation): op is UpdateOperation<T> {
  return op.type === 'update';
}

/**
 * Type guard to check if an operation is a DeleteOperation.
 */
export function isDeleteOperation(op: CrudOperation): op is DeleteOperation {
  return op.type === 'delete';
}

/**
 * Type guard to check if an operation is a QueryOperation.
 */
export function isQueryOperation(op: CrudOperation): op is QueryOperation {
  return op.type === 'query';
}
