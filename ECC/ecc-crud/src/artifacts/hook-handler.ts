/**
 * @fileoverview Artifact handler for Hooks
 *
 * Hooks are stored in .claude/settings.json in the `hooks` array.
 * This is an AGGREGATED pattern - must read whole file, modify section, write back.
 *
 * @module @ecc/crud/artifacts/hook-handler
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { EccHook } from '../types/artifact-types.js';
import type {
  ArtifactType,
  CrudOperation,
  CreateOperation,
  ReadOperation,
  UpdateOperation,
  DeleteOperation,
  QueryOperation,
} from '../types/operation-types.js';
import type { OperationResult, OperationError } from '../types/result-types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Handler interface for artifact CRUD operations
 */
export interface ArtifactHandler<T> {
  artifactType: ArtifactType;

  create(
    projectRoot: string,
    artifact: T,
    options?: { overwrite?: boolean; dryRun?: boolean }
  ): Promise<OperationResult<T>>;

  read(
    projectRoot: string,
    id: string,
    options?: { includeContent?: boolean }
  ): Promise<OperationResult<T>>;

  update(
    projectRoot: string,
    id: string,
    changes: Partial<T>,
    options?: { merge?: boolean; dryRun?: boolean }
  ): Promise<OperationResult<T>>;

  delete(
    projectRoot: string,
    id: string,
    options?: { soft?: boolean; dryRun?: boolean }
  ): Promise<OperationResult<void>>;

  list(projectRoot: string): Promise<OperationResult<T[]>>;

  getPath(projectRoot: string, id: string): string;

  exists(projectRoot: string, id: string): Promise<boolean>;
}

/**
 * Structure of settings.json file
 */
interface SettingsFile {
  hooks?: EccHook[];
  mcpServers?: Record<string, unknown>;
  [key: string]: unknown;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the path to settings.json for a project
 */
function getSettingsPath(projectRoot: string): string {
  return join(projectRoot, '.claude', 'settings.json');
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read and parse settings.json, returning empty structure if not found
 */
async function readSettings(projectRoot: string): Promise<SettingsFile> {
  const settingsPath = getSettingsPath(projectRoot);

  if (!(await fileExists(settingsPath))) {
    return {};
  }

  try {
    const content = await readFile(settingsPath, 'utf-8');
    return JSON.parse(content) as SettingsFile;
  } catch (error) {
    // If file exists but can't be parsed, throw
    throw new Error(
      `Failed to parse settings.json: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Write settings.json, preserving all existing fields
 */
async function writeSettings(
  projectRoot: string,
  settings: SettingsFile
): Promise<void> {
  const settingsPath = getSettingsPath(projectRoot);
  const settingsDir = dirname(settingsPath);

  // Ensure .claude directory exists
  await mkdir(settingsDir, { recursive: true });

  // Write with consistent formatting (2-space indent)
  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}

/**
 * Find a hook by name in the hooks array
 */
function findHookByName(hooks: EccHook[], name: string): EccHook | undefined {
  return hooks.find((hook) => hook.name === name);
}

/**
 * Build an error result with proper typing
 */
function buildErrorResult<T>(
  operation: CrudOperation,
  error: OperationError,
  durationMs: number,
  path: string
): OperationResult<T> {
  return {
    success: false,
    operation,
    timestamp: new Date().toISOString(),
    durationMs,
    path,
    error,
  };
}

/**
 * Build a success result with proper typing
 */
function buildSuccessResult<T>(
  operation: CrudOperation,
  data: T,
  durationMs: number,
  path: string,
  beforeState?: T,
  afterState?: T
): OperationResult<T> {
  const result: OperationResult<T> = {
    success: true,
    operation,
    timestamp: new Date().toISOString(),
    durationMs,
    data,
    path,
  };

  if (beforeState !== undefined) {
    result.beforeState = beforeState;
  }
  if (afterState !== undefined) {
    result.afterState = afterState;
  }

  return result;
}

// ============================================================================
// Hook Handler Implementation
// ============================================================================

/**
 * Artifact handler for Hooks.
 *
 * Hooks are stored in `.claude/settings.json` under the `hooks` array.
 * The hook's `name` field serves as its unique identifier.
 *
 * This handler uses the AGGREGATED pattern:
 * - Reads the entire settings.json file
 * - Modifies the hooks array
 * - Writes back the complete file, preserving other fields
 *
 * @example
 * ```typescript
 * import { hookHandler } from './artifacts/hook-handler.js';
 *
 * // Create a new hook
 * const result = await hookHandler.create('/path/to/project', {
 *   id: 'my-hook-1',
 *   pluginId: 'core',
 *   name: 'my-hook',
 *   eventType: 'PreToolUse',
 *   enabled: true
 * });
 *
 * // Read a hook by name
 * const hook = await hookHandler.read('/path/to/project', 'my-hook');
 *
 * // List all hooks
 * const allHooks = await hookHandler.list('/path/to/project');
 * ```
 */
export const hookHandler: ArtifactHandler<EccHook> = {
  artifactType: 'hook',

  /**
   * Create a new hook in settings.json
   */
  async create(
    projectRoot: string,
    artifact: EccHook,
    options?: { overwrite?: boolean; dryRun?: boolean }
  ): Promise<OperationResult<EccHook>> {
    const startTime = Date.now();
    const path = getSettingsPath(projectRoot);

    // Build operation object with proper typing
    const operation: CreateOperation<EccHook> = {
      type: 'create',
      artifactType: 'hook',
      artifact,
    };
    if (options) {
      operation.options = options;
    }

    try {
      // Read current settings
      const settings = await readSettings(projectRoot);
      const hooks = settings.hooks ?? [];

      // Check if hook with same name already exists
      const existingIndex = hooks.findIndex((h) => h.name === artifact.name);

      if (existingIndex !== -1 && !options?.overwrite) {
        return buildErrorResult<EccHook>(
          operation,
          {
            code: 'ALREADY_EXISTS',
            message: `Hook with name '${artifact.name}' already exists`,
            context: { existingHook: hooks[existingIndex] },
          },
          Date.now() - startTime,
          path
        );
      }

      // Store before state for versioning (only if overwriting)
      const beforeState = existingIndex !== -1 ? hooks[existingIndex] : undefined;

      // If dry run, don't actually write
      if (options?.dryRun) {
        return buildSuccessResult(
          operation,
          artifact,
          Date.now() - startTime,
          path,
          beforeState,
          artifact
        );
      }

      // Add or replace hook
      if (existingIndex !== -1) {
        hooks[existingIndex] = artifact;
      } else {
        hooks.push(artifact);
      }

      // Write back settings
      settings.hooks = hooks;
      await writeSettings(projectRoot, settings);

      return buildSuccessResult(
        operation,
        artifact,
        Date.now() - startTime,
        path,
        beforeState,
        artifact
      );
    } catch (error) {
      return buildErrorResult<EccHook>(
        operation,
        {
          code: 'CREATE_FAILED',
          message: `Failed to create hook: ${error instanceof Error ? error.message : String(error)}`,
          context: { artifact },
        },
        Date.now() - startTime,
        path
      );
    }
  },

  /**
   * Read a hook by name from settings.json
   */
  async read(
    projectRoot: string,
    id: string,
    options?: { includeContent?: boolean }
  ): Promise<OperationResult<EccHook>> {
    const startTime = Date.now();
    const path = getSettingsPath(projectRoot);

    // Build operation object with proper typing
    const operation: ReadOperation = {
      type: 'read',
      artifactType: 'hook',
      id,
    };
    if (options) {
      operation.options = options;
    }

    try {
      const settings = await readSettings(projectRoot);
      const hooks = settings.hooks ?? [];

      const hook = findHookByName(hooks, id);

      if (!hook) {
        return buildErrorResult<EccHook>(
          operation,
          {
            code: 'NOT_FOUND',
            message: `Hook with name '${id}' not found`,
            context: { availableHooks: hooks.map((h) => h.name) },
          },
          Date.now() - startTime,
          path
        );
      }

      return buildSuccessResult(operation, hook, Date.now() - startTime, path);
    } catch (error) {
      return buildErrorResult<EccHook>(
        operation,
        {
          code: 'READ_FAILED',
          message: `Failed to read hook: ${error instanceof Error ? error.message : String(error)}`,
          context: { id },
        },
        Date.now() - startTime,
        path
      );
    }
  },

  /**
   * Update a hook in settings.json
   */
  async update(
    projectRoot: string,
    id: string,
    changes: Partial<EccHook>,
    options?: { merge?: boolean; dryRun?: boolean }
  ): Promise<OperationResult<EccHook>> {
    const startTime = Date.now();
    const path = getSettingsPath(projectRoot);

    // Build operation object with proper typing
    const operation: UpdateOperation<EccHook> = {
      type: 'update',
      artifactType: 'hook',
      id,
      changes,
    };
    if (options) {
      operation.options = options;
    }

    try {
      const settings = await readSettings(projectRoot);
      const hooks = settings.hooks ?? [];

      const existingIndex = hooks.findIndex((h) => h.name === id);

      if (existingIndex === -1) {
        return buildErrorResult<EccHook>(
          operation,
          {
            code: 'NOT_FOUND',
            message: `Hook with name '${id}' not found`,
            context: { availableHooks: hooks.map((h) => h.name) },
          },
          Date.now() - startTime,
          path
        );
      }

      // We know existingIndex is valid at this point, use non-null assertion
      const existingHook = hooks[existingIndex]!;
      // Create a deep copy for beforeState to preserve original values
      const beforeState = JSON.parse(JSON.stringify(existingHook)) as EccHook;

      // Apply changes (merge by default)
      const merge = options?.merge !== false;
      let updatedHook: EccHook;

      if (merge) {
        // Merge changes with existing hook - use Object.assign for type safety
        updatedHook = Object.assign({}, existingHook, changes) as EccHook;
      } else {
        // Replace entire hook - requires all required fields
        // Preserve required fields from existing if not in changes
        const baseHook: EccHook = {
          id: changes.id ?? existingHook.id,
          pluginId: changes.pluginId ?? existingHook.pluginId,
          name: changes.name ?? id,
          eventType: changes.eventType ?? existingHook.eventType,
        };
        // Apply optional fields from changes only if they are defined
        if (changes.description !== undefined) baseHook.description = changes.description;
        if (changes.matcher !== undefined) baseHook.matcher = changes.matcher;
        if (changes.enabled !== undefined) baseHook.enabled = changes.enabled;
        if (changes.priority !== undefined) baseHook.priority = changes.priority;
        if (changes.scopeId !== undefined) baseHook.scopeId = changes.scopeId;
        if (changes.exitCodeProtocol !== undefined) baseHook.exitCodeProtocol = changes.exitCodeProtocol;
        if (changes.stdinSchema !== undefined) baseHook.stdinSchema = changes.stdinSchema;
        if (changes.stdoutSchema !== undefined) baseHook.stdoutSchema = changes.stdoutSchema;
        if (changes.timeout !== undefined) baseHook.timeout = changes.timeout;
        if (changes.scopeLevel !== undefined) baseHook.scopeLevel = changes.scopeLevel;
        if (changes.actions !== undefined) baseHook.actions = changes.actions;
        if (changes.matchers !== undefined) baseHook.matchers = changes.matchers;
        updatedHook = baseHook;
      }

      // If dry run, don't actually write
      if (options?.dryRun) {
        return buildSuccessResult(
          operation,
          updatedHook,
          Date.now() - startTime,
          path,
          beforeState,
          updatedHook
        );
      }

      // Update hook in array
      hooks[existingIndex] = updatedHook;
      settings.hooks = hooks;
      await writeSettings(projectRoot, settings);

      return buildSuccessResult(
        operation,
        updatedHook,
        Date.now() - startTime,
        path,
        beforeState,
        updatedHook
      );
    } catch (error) {
      return buildErrorResult<EccHook>(
        operation,
        {
          code: 'UPDATE_FAILED',
          message: `Failed to update hook: ${error instanceof Error ? error.message : String(error)}`,
          context: { id, changes },
        },
        Date.now() - startTime,
        path
      );
    }
  },

  /**
   * Delete a hook from settings.json
   */
  async delete(
    projectRoot: string,
    id: string,
    options?: { soft?: boolean; dryRun?: boolean }
  ): Promise<OperationResult<void>> {
    const startTime = Date.now();
    const path = getSettingsPath(projectRoot);

    // Build operation object with proper typing
    const operation: DeleteOperation = {
      type: 'delete',
      artifactType: 'hook',
      id,
    };
    if (options) {
      operation.options = options;
    }

    try {
      const settings = await readSettings(projectRoot);
      const hooks = settings.hooks ?? [];

      const existingIndex = hooks.findIndex((h) => h.name === id);

      if (existingIndex === -1) {
        return buildErrorResult<void>(
          operation,
          {
            code: 'NOT_FOUND',
            message: `Hook with name '${id}' not found`,
            context: { availableHooks: hooks.map((h) => h.name) },
          },
          Date.now() - startTime,
          path
        );
      }

      // Store before state for reference
      const existingHook = hooks[existingIndex];

      // If dry run, don't actually write
      if (options?.dryRun) {
        return {
          success: true,
          operation,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          path,
        };
      }

      // Soft delete: mark as disabled instead of removing
      if (options?.soft) {
        const disabledHook = Object.assign({}, existingHook, { enabled: false }) as EccHook;
        hooks[existingIndex] = disabledHook;
      } else {
        // Hard delete: remove from array
        hooks.splice(existingIndex, 1);
      }

      settings.hooks = hooks;
      await writeSettings(projectRoot, settings);

      return {
        success: true,
        operation,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        path,
      };
    } catch (error) {
      return buildErrorResult<void>(
        operation,
        {
          code: 'DELETE_FAILED',
          message: `Failed to delete hook: ${error instanceof Error ? error.message : String(error)}`,
          context: { id },
        },
        Date.now() - startTime,
        path
      );
    }
  },

  /**
   * List all hooks from settings.json
   */
  async list(projectRoot: string): Promise<OperationResult<EccHook[]>> {
    const startTime = Date.now();
    const path = getSettingsPath(projectRoot);

    // Build operation object with proper typing
    const operation: QueryOperation = {
      type: 'query',
      artifactType: 'hook',
    };

    try {
      const settings = await readSettings(projectRoot);
      const hooks = settings.hooks ?? [];

      return buildSuccessResult(operation, hooks, Date.now() - startTime, path);
    } catch (error) {
      return buildErrorResult<EccHook[]>(
        operation,
        {
          code: 'LIST_FAILED',
          message: `Failed to list hooks: ${error instanceof Error ? error.message : String(error)}`,
        },
        Date.now() - startTime,
        path
      );
    }
  },

  /**
   * Get the path to settings.json (hooks don't have individual paths)
   */
  getPath(projectRoot: string, _id: string): string {
    return getSettingsPath(projectRoot);
  },

  /**
   * Check if a hook exists by name
   */
  async exists(projectRoot: string, id: string): Promise<boolean> {
    try {
      const settings = await readSettings(projectRoot);
      const hooks = settings.hooks ?? [];
      return hooks.some((h) => h.name === id);
    } catch {
      return false;
    }
  },
};

// ============================================================================
// Exports
// ============================================================================

export { getSettingsPath };
