/**
 * SubAgent Artifact Handler
 *
 * CRUD operations for EccSubAgent artifacts.
 * SubAgents are stored as markdown files with YAML frontmatter at:
 * `.claude/agents/{name}.md`
 *
 * This is a ONE-TO-ONE pattern: one file per SubAgent artifact.
 *
 * @module artifacts/subagent-handler
 */

import { readFile, writeFile, unlink, readdir, mkdir, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import * as yaml from 'yaml';

import type { EccSubAgent } from '../types/artifact-types.js';
import type {
  ArtifactType,
  CreateOperationOptions,
  ReadOperationOptions,
  UpdateOperationOptions,
  DeleteOperationOptions,
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

// ============================================================================
// Constants
// ============================================================================

const AGENTS_DIR = '.claude/agents';
const FILE_EXTENSION = '.md';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse a SubAgent markdown file into an EccSubAgent object
 */
function parseSubAgentFile(content: string, name: string, pluginId = ''): EccSubAgent {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);

  if (!frontmatterMatch) {
    // No frontmatter, treat entire content as instructions
    const result: EccSubAgent = {
      id: name,
      pluginId,
      name,
      contextMode: 'fork', // Default
    };
    const trimmed = content.trim();
    if (trimmed) {
      result.instructions = trimmed;
    }
    return result;
  }

  const frontmatterText = frontmatterMatch[1] ?? '';
  const body = content.slice(frontmatterMatch[0].length);

  let frontmatter: Record<string, unknown> = {};
  try {
    frontmatter = yaml.parse(frontmatterText) ?? {};
  } catch {
    // If YAML parsing fails, treat as body only
    const result: EccSubAgent = {
      id: name,
      pluginId,
      name,
      contextMode: 'fork',
    };
    const trimmed = content.trim();
    if (trimmed) {
      result.instructions = trimmed;
    }
    return result;
  }

  // Extract known fields from frontmatter
  const contextMode = (frontmatter.contextMode as 'fork' | 'inline') || 'fork';

  // Build result object, only including properties that have values
  const result: EccSubAgent = {
    id: name,
    pluginId,
    name,
    contextMode,
  };

  // Add optional properties only if they have values
  if (typeof frontmatter.description === 'string') {
    result.description = frontmatter.description;
  }
  if (Array.isArray(frontmatter.allowedTools)) {
    result.allowedTools = frontmatter.allowedTools as string[];
  }
  if (Array.isArray(frontmatter.skillRefs)) {
    result.skillRefs = frontmatter.skillRefs as string[];
  }
  if (Array.isArray(frontmatter.hookRefs)) {
    result.hookRefs = frontmatter.hookRefs as string[];
  }

  // Collect remaining fields as frontmatterConfig
  const knownFields = ['contextMode', 'allowedTools', 'description', 'skillRefs', 'hookRefs'];
  const frontmatterConfig: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(frontmatter)) {
    if (!knownFields.includes(key)) {
      frontmatterConfig[key] = value;
    }
  }
  if (Object.keys(frontmatterConfig).length > 0) {
    result.frontmatterConfig = frontmatterConfig;
  }

  // Parse body content for instructions
  const instructions = body.trim();
  if (instructions) {
    result.instructions = instructions;
  }

  return result;
}

/**
 * Serialize an EccSubAgent object to markdown with YAML frontmatter
 */
function serializeSubAgent(subAgent: EccSubAgent): string {
  const lines: string[] = [];

  // Build frontmatter object
  const frontmatter: Record<string, unknown> = {
    contextMode: subAgent.contextMode,
  };

  if (subAgent.description) {
    frontmatter.description = subAgent.description;
  }

  if (subAgent.allowedTools && subAgent.allowedTools.length > 0) {
    frontmatter.allowedTools = subAgent.allowedTools;
  }

  if (subAgent.skillRefs && subAgent.skillRefs.length > 0) {
    frontmatter.skillRefs = subAgent.skillRefs;
  }

  if (subAgent.hookRefs && subAgent.hookRefs.length > 0) {
    frontmatter.hookRefs = subAgent.hookRefs;
  }

  // Merge in any additional frontmatter config
  if (subAgent.frontmatterConfig) {
    Object.assign(frontmatter, subAgent.frontmatterConfig);
  }

  // Generate YAML frontmatter
  lines.push('---');
  lines.push(yaml.stringify(frontmatter).trim());
  lines.push('---');
  lines.push('');

  // Add instructions as body content
  if (subAgent.instructions) {
    lines.push(subAgent.instructions);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Create an error result
 */
function createErrorResult<T>(
  operation: OperationResult<T>['operation'],
  error: OperationError,
  startTime: number,
  path?: string
): OperationResult<T> {
  const result: OperationResult<T> = {
    success: false,
    operation,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    error,
  };
  if (path !== undefined) {
    result.path = path;
  }
  return result;
}

/**
 * Create a success result
 */
function createSuccessResult<T>(
  operation: OperationResult<T>['operation'],
  data: T,
  startTime: number,
  path: string,
  beforeState?: T,
  afterState?: T
): OperationResult<T> {
  const result: OperationResult<T> = {
    success: true,
    operation,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
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
// SubAgent Handler Implementation
// ============================================================================

/**
 * SubAgent artifact handler
 *
 * Manages CRUD operations for SubAgent artifacts stored as markdown files
 * with YAML frontmatter in `.claude/agents/{name}.md`
 */
export const subAgentHandler: ArtifactHandler<EccSubAgent> = {
  artifactType: 'subagent',

  /**
   * Get the file path for a SubAgent
   */
  getPath(projectRoot: string, id: string): string {
    return join(projectRoot, AGENTS_DIR, `${id}${FILE_EXTENSION}`);
  },

  /**
   * Check if a SubAgent exists
   */
  async exists(projectRoot: string, id: string): Promise<boolean> {
    const path = this.getPath(projectRoot, id);
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Create a new SubAgent
   */
  async create(
    projectRoot: string,
    artifact: EccSubAgent,
    options: CreateOperationOptions = {}
  ): Promise<OperationResult<EccSubAgent>> {
    const startTime = Date.now();
    const { overwrite = false, dryRun = false } = options;
    const subagentPath = this.getPath(projectRoot, artifact.name);

    const operation = {
      type: 'create' as const,
      artifactType: 'subagent' as const,
      artifact,
      options,
    };

    // Check if SubAgent already exists
    const subagentExists = await this.exists(projectRoot, artifact.name);
    if (subagentExists && !overwrite) {
      return createErrorResult(operation, {
        code: 'ALREADY_EXISTS',
        message: `SubAgent '${artifact.name}' already exists. Use overwrite option to replace.`,
        context: { subagentId: artifact.name, path: subagentPath },
      }, startTime, subagentPath);
    }

    if (dryRun) {
      return createSuccessResult(operation, artifact, startTime, subagentPath);
    }

    try {
      // Ensure directory exists
      const agentsDir = join(projectRoot, AGENTS_DIR);
      await mkdir(agentsDir, { recursive: true });

      // Generate and write SubAgent file
      const content = serializeSubAgent(artifact);
      await writeFile(subagentPath, content, 'utf-8');

      return createSuccessResult(operation, artifact, startTime, subagentPath, undefined, artifact);
    } catch (err) {
      return createErrorResult(operation, {
        code: 'WRITE_ERROR',
        message: `Failed to create SubAgent: ${err instanceof Error ? err.message : String(err)}`,
        context: { subagentId: artifact.name, path: subagentPath },
      }, startTime, subagentPath);
    }
  },

  /**
   * Read a SubAgent by ID
   */
  async read(
    projectRoot: string,
    id: string,
    options: ReadOperationOptions = {}
  ): Promise<OperationResult<EccSubAgent>> {
    const startTime = Date.now();
    const { includeContent = true } = options;
    const subagentPath = this.getPath(projectRoot, id);

    const operation = {
      type: 'read' as const,
      artifactType: 'subagent' as const,
      id,
      options,
    };

    try {
      const content = await readFile(subagentPath, 'utf-8');
      const subAgent = parseSubAgentFile(content, id);

      // If includeContent is false, strip instructions
      if (!includeContent) {
        const { instructions: _, ...rest } = subAgent;
        return createSuccessResult(operation, rest as EccSubAgent, startTime, subagentPath);
      }

      return createSuccessResult(operation, subAgent, startTime, subagentPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return createErrorResult(operation, {
          code: 'NOT_FOUND',
          message: `SubAgent '${id}' not found`,
          context: { subagentId: id, path: subagentPath },
        }, startTime, subagentPath);
      }

      return createErrorResult(operation, {
        code: 'READ_ERROR',
        message: `Failed to read SubAgent: ${err instanceof Error ? err.message : String(err)}`,
        context: { subagentId: id, path: subagentPath },
      }, startTime, subagentPath);
    }
  },

  /**
   * Update an existing SubAgent
   */
  async update(
    projectRoot: string,
    id: string,
    changes: Partial<EccSubAgent>,
    options: UpdateOperationOptions = {}
  ): Promise<OperationResult<EccSubAgent>> {
    const startTime = Date.now();
    const { merge = true, dryRun = false } = options;
    const subagentPath = this.getPath(projectRoot, id);

    const operation = {
      type: 'update' as const,
      artifactType: 'subagent' as const,
      id,
      changes,
      options,
    };

    // Read existing SubAgent
    const readResult = await this.read(projectRoot, id, { includeContent: true });
    if (!readResult.success) {
      return createErrorResult(operation, readResult.error!, startTime, subagentPath);
    }

    const existingSubAgent = readResult.data!;

    // Merge or replace
    let updatedSubAgent: EccSubAgent;
    if (merge) {
      updatedSubAgent = {
        ...existingSubAgent,
        ...changes,
        // Preserve identity fields
        id: existingSubAgent.id,
        name: existingSubAgent.name,
      };

      // Merge arrays if both exist
      if (changes.allowedTools && existingSubAgent.allowedTools) {
        updatedSubAgent.allowedTools = [...new Set([...existingSubAgent.allowedTools, ...changes.allowedTools])];
      }
      if (changes.skillRefs && existingSubAgent.skillRefs) {
        updatedSubAgent.skillRefs = [...new Set([...existingSubAgent.skillRefs, ...changes.skillRefs])];
      }
      if (changes.hookRefs && existingSubAgent.hookRefs) {
        updatedSubAgent.hookRefs = [...new Set([...existingSubAgent.hookRefs, ...changes.hookRefs])];
      }
      if (changes.frontmatterConfig && existingSubAgent.frontmatterConfig) {
        updatedSubAgent.frontmatterConfig = { ...existingSubAgent.frontmatterConfig, ...changes.frontmatterConfig };
      }
    } else {
      // Replace mode - build object with only defined properties
      updatedSubAgent = {
        id: existingSubAgent.id,
        pluginId: existingSubAgent.pluginId,
        name: existingSubAgent.name,
        contextMode: changes.contextMode ?? existingSubAgent.contextMode,
      };
      if (changes.description !== undefined) {
        updatedSubAgent.description = changes.description;
      }
      if (changes.instructions !== undefined) {
        updatedSubAgent.instructions = changes.instructions;
      }
      if (changes.allowedTools !== undefined) {
        updatedSubAgent.allowedTools = changes.allowedTools;
      }
      if (changes.frontmatterConfig !== undefined) {
        updatedSubAgent.frontmatterConfig = changes.frontmatterConfig;
      }
      if (changes.skillRefs !== undefined) {
        updatedSubAgent.skillRefs = changes.skillRefs;
      }
      if (changes.hookRefs !== undefined) {
        updatedSubAgent.hookRefs = changes.hookRefs;
      }
    }

    if (dryRun) {
      return createSuccessResult(operation, updatedSubAgent, startTime, subagentPath, existingSubAgent, updatedSubAgent);
    }

    try {
      // Generate and write updated content
      const content = serializeSubAgent(updatedSubAgent);
      await writeFile(subagentPath, content, 'utf-8');

      return createSuccessResult(operation, updatedSubAgent, startTime, subagentPath, existingSubAgent, updatedSubAgent);
    } catch (err) {
      return createErrorResult(operation, {
        code: 'WRITE_ERROR',
        message: `Failed to update SubAgent: ${err instanceof Error ? err.message : String(err)}`,
        context: { subagentId: id, path: subagentPath },
      }, startTime, subagentPath);
    }
  },

  /**
   * Delete a SubAgent
   */
  async delete(
    projectRoot: string,
    id: string,
    options: DeleteOperationOptions = {}
  ): Promise<OperationResult<void>> {
    const startTime = Date.now();
    const { soft = false, dryRun = false } = options;
    const subagentPath = this.getPath(projectRoot, id);

    const operation = {
      type: 'delete' as const,
      artifactType: 'subagent' as const,
      id,
      options,
    };

    // Check existence
    const subagentExists = await this.exists(projectRoot, id);
    if (!subagentExists) {
      return createErrorResult<void>(operation, {
        code: 'NOT_FOUND',
        message: `SubAgent '${id}' not found`,
        context: { subagentId: id, path: subagentPath },
      }, startTime, subagentPath);
    }

    if (dryRun) {
      return {
        success: true,
        operation,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        path: subagentPath,
      };
    }

    try {
      if (soft) {
        // Soft delete: rename to .deleted
        const deletedPath = subagentPath + '.deleted';
        const content = await readFile(subagentPath, 'utf-8');
        await writeFile(deletedPath, content, 'utf-8');
        await unlink(subagentPath);
      } else {
        // Hard delete
        await unlink(subagentPath);
      }

      return {
        success: true,
        operation,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        path: subagentPath,
      };
    } catch (err) {
      return createErrorResult<void>(operation, {
        code: 'DELETE_ERROR',
        message: `Failed to delete SubAgent: ${err instanceof Error ? err.message : String(err)}`,
        context: { subagentId: id, path: subagentPath },
      }, startTime, subagentPath);
    }
  },

  /**
   * List all SubAgents in the project
   */
  async list(projectRoot: string): Promise<OperationResult<EccSubAgent[]>> {
    const startTime = Date.now();
    const agentsDir = join(projectRoot, AGENTS_DIR);

    const operation = {
      type: 'query' as const,
      artifactType: 'subagent' as const,
    };

    const subAgents: EccSubAgent[] = [];

    try {
      // Check if agents directory exists
      try {
        await stat(agentsDir);
      } catch {
        // No agents directory, return empty list
        return createSuccessResult(operation, [], startTime, agentsDir);
      }

      // Read directory entries
      const entries = await readdir(agentsDir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip directories and non-markdown files
        if (!entry.isFile() || !entry.name.endsWith(FILE_EXTENSION)) {
          continue;
        }

        // Skip deleted files
        if (entry.name.endsWith('.deleted')) {
          continue;
        }

        const name = basename(entry.name, FILE_EXTENSION);
        const filePath = join(agentsDir, entry.name);

        try {
          const content = await readFile(filePath, 'utf-8');
          const subAgent = parseSubAgentFile(content, name);
          subAgents.push(subAgent);
        } catch {
          // Skip files that can't be read/parsed
          continue;
        }
      }

      return createSuccessResult(operation, subAgents, startTime, agentsDir);
    } catch (err) {
      return createErrorResult(operation, {
        code: 'LIST_ERROR',
        message: `Failed to list SubAgents: ${err instanceof Error ? err.message : String(err)}`,
        context: { path: agentsDir },
      }, startTime, agentsDir);
    }
  },
};

export default subAgentHandler;
