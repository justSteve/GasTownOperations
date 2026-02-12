/**
 * @fileoverview Rule Artifact Handler
 *
 * Handles CRUD operations for Rule artifacts stored as markdown files.
 * Rules are simple markdown files with YAML frontmatter stored in
 * `.claude/rules/{name}.md`.
 *
 * @module @ecc/crud/artifacts/rule-handler
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import type { EccRule } from '../types/artifact-types.js';
import type { ArtifactType } from '../types/operation-types.js';
import type { OperationResult } from '../types/result-types.js';

// ============================================================================
// Constants
// ============================================================================

/** Base path for rule files relative to project root */
const RULES_PATH = '.claude/rules';

/** File extension for rule files */
const RULE_EXTENSION = '.md';

// ============================================================================
// Handler Interface
// ============================================================================

/**
 * Generic artifact handler interface for CRUD operations.
 *
 * @template T - The artifact type this handler manages
 */
export interface ArtifactHandler<T> {
  /** The artifact type this handler manages */
  artifactType: ArtifactType;

  /**
   * Create a new artifact.
   *
   * @param projectRoot - Root directory of the project
   * @param artifact - The artifact data to create
   * @param options - Create options
   * @returns Operation result with the created artifact
   */
  create(
    projectRoot: string,
    artifact: T,
    options?: { overwrite?: boolean; dryRun?: boolean }
  ): Promise<OperationResult<T>>;

  /**
   * Read an existing artifact by ID.
   *
   * @param projectRoot - Root directory of the project
   * @param id - The artifact identifier (name)
   * @param options - Read options
   * @returns Operation result with the artifact data
   */
  read(
    projectRoot: string,
    id: string,
    options?: { includeContent?: boolean }
  ): Promise<OperationResult<T>>;

  /**
   * Update an existing artifact.
   *
   * @param projectRoot - Root directory of the project
   * @param id - The artifact identifier (name)
   * @param changes - Partial changes to apply
   * @param options - Update options
   * @returns Operation result with the updated artifact
   */
  update(
    projectRoot: string,
    id: string,
    changes: Partial<T>,
    options?: { merge?: boolean; dryRun?: boolean }
  ): Promise<OperationResult<T>>;

  /**
   * Delete an existing artifact.
   *
   * @param projectRoot - Root directory of the project
   * @param id - The artifact identifier (name)
   * @param options - Delete options
   * @returns Operation result confirming deletion
   */
  delete(
    projectRoot: string,
    id: string,
    options?: { soft?: boolean; dryRun?: boolean }
  ): Promise<OperationResult<void>>;

  /**
   * List all artifacts of this type.
   *
   * @param projectRoot - Root directory of the project
   * @returns Operation result with array of all artifacts
   */
  list(projectRoot: string): Promise<OperationResult<T[]>>;

  /**
   * Get the file path for an artifact.
   *
   * @param projectRoot - Root directory of the project
   * @param id - The artifact identifier (name)
   * @returns Absolute file path
   */
  getPath(projectRoot: string, id: string): string;

  /**
   * Check if an artifact exists.
   *
   * @param projectRoot - Root directory of the project
   * @param id - The artifact identifier (name)
   * @returns True if the artifact exists
   */
  exists(projectRoot: string, id: string): Promise<boolean>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse YAML frontmatter from markdown content.
 *
 * @param content - Raw markdown content
 * @returns Tuple of [frontmatter object, body content]
 */
function parseFrontmatter(content: string): [Record<string, unknown>, string] {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    // No frontmatter, entire content is body
    return [{}, content];
  }

  // Regex guarantees match[1] and match[2] exist when match succeeds
  const frontmatterStr = match[1] as string;
  const body = match[2] as string;

  // Simple YAML parser for flat key: value pairs
  const frontmatter: Record<string, unknown> = {};
  const lines = frontmatterStr.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    let value: string | null = trimmed.slice(colonIndex + 1).trim();

    // Handle quoted strings
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Handle empty values
    if (value === '' || value === '~' || value === 'null') {
      value = null;
    }

    if (value !== null) {
      frontmatter[key] = value;
    }
  }

  return [frontmatter, body];
}

/**
 * Serialize rule to markdown with YAML frontmatter.
 *
 * @param rule - The rule to serialize
 * @returns Markdown content with frontmatter
 */
function serializeRule(rule: EccRule): string {
  const frontmatterParts: string[] = [];

  // Build frontmatter in consistent order
  if (rule.title) {
    frontmatterParts.push(`title: "${rule.title}"`);
  }
  if (rule.severity) {
    frontmatterParts.push(`severity: ${rule.severity}`);
  }
  if (rule.category) {
    frontmatterParts.push(`category: ${rule.category}`);
  }
  if (rule.applicability) {
    frontmatterParts.push(`applicability: "${rule.applicability}"`);
  }

  let content = '';

  if (frontmatterParts.length > 0) {
    content = `---\n${frontmatterParts.join('\n')}\n---\n\n`;
  }

  if (rule.content) {
    content += rule.content;
  }

  return content;
}

/**
 * Parse markdown file content into EccRule.
 *
 * @param name - The rule name (from filename)
 * @param content - Raw file content
 * @param pluginId - Plugin ID (defaults to 'local')
 * @returns Parsed EccRule
 */
function parseRule(name: string, content: string, pluginId: string = 'local'): EccRule {
  const [frontmatter, body] = parseFrontmatter(content);
  const trimmedBody = body.trim();

  // Build rule object, only including optional properties when they have values
  // This satisfies exactOptionalPropertyTypes
  const rule: EccRule = {
    id: `${pluginId}:${name}`,
    pluginId,
    name,
  };

  if (frontmatter.title) {
    rule.title = frontmatter.title as string;
  }
  if (trimmedBody) {
    rule.content = trimmedBody;
  }
  if (frontmatter.severity) {
    rule.severity = frontmatter.severity as NonNullable<EccRule['severity']>;
  }
  if (frontmatter.category) {
    rule.category = frontmatter.category as string;
  }
  if (frontmatter.applicability) {
    rule.applicability = frontmatter.applicability as string;
  }

  return rule;
}

/**
 * Create a standardized operation result.
 *
 * Only includes optional properties when they have defined values
 * to satisfy exactOptionalPropertyTypes.
 *
 * @param params - Result parameters
 * @returns Formatted OperationResult
 */
function createResult<T>(params: {
  success: boolean;
  operation: OperationResult<T>['operation'];
  data?: T;
  error?: OperationResult<T>['error'];
  path?: string;
  startTime: number;
  beforeState?: T;
  afterState?: T;
}): OperationResult<T> {
  const result: OperationResult<T> = {
    success: params.success,
    operation: params.operation,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - params.startTime,
  };

  // Only add optional properties when they are defined
  if (params.data !== undefined) {
    result.data = params.data;
  }
  if (params.error !== undefined) {
    result.error = params.error;
  }
  if (params.path !== undefined) {
    result.path = params.path;
  }
  if (params.beforeState !== undefined) {
    result.beforeState = params.beforeState;
  }
  if (params.afterState !== undefined) {
    result.afterState = params.afterState;
  }

  return result;
}

// ============================================================================
// Rule Handler Implementation
// ============================================================================

/**
 * Handler for Rule artifact CRUD operations.
 *
 * Rules are stored as markdown files in `.claude/rules/{name}.md`.
 * Each file has optional YAML frontmatter for metadata (title, severity,
 * category, applicability) and markdown body for the rule content.
 */
export const ruleHandler: ArtifactHandler<EccRule> = {
  artifactType: 'rule',

  getPath(projectRoot: string, id: string): string {
    // Extract name from id if it contains plugin prefix
    const name = id.includes(':') ? id.split(':').pop()! : id;
    return path.join(projectRoot, RULES_PATH, `${name}${RULE_EXTENSION}`);
  },

  async exists(projectRoot: string, id: string): Promise<boolean> {
    const filePath = this.getPath(projectRoot, id);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  },

  async create(
    projectRoot: string,
    artifact: EccRule,
    options?: { overwrite?: boolean; dryRun?: boolean }
  ): Promise<OperationResult<EccRule>> {
    const startTime = Date.now();
    const filePath = this.getPath(projectRoot, artifact.name);

    // Build operation object, only including options if defined
    const operation = {
      type: 'create' as const,
      artifactType: 'rule' as const,
      artifact,
      ...(options !== undefined && { options }),
    };

    try {
      // Check if file already exists
      const fileExists = await this.exists(projectRoot, artifact.name);
      if (fileExists && !options?.overwrite) {
        return createResult({
          success: false,
          operation,
          error: {
            code: 'ALREADY_EXISTS',
            message: `Rule '${artifact.name}' already exists. Use overwrite option to replace.`,
            context: { path: filePath },
          },
          path: filePath,
          startTime,
        });
      }

      // Dry run - just validate
      if (options?.dryRun) {
        return createResult({
          success: true,
          operation,
          data: artifact,
          path: filePath,
          startTime,
        });
      }

      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Serialize and write
      const content = serializeRule(artifact);
      await fs.writeFile(filePath, content, 'utf-8');

      return createResult({
        success: true,
        operation,
        data: artifact,
        path: filePath,
        startTime,
        afterState: artifact,
      });
    } catch (error) {
      return createResult({
        success: false,
        operation,
        error: {
          code: 'CREATE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to create rule',
          context: { path: filePath, error },
        },
        path: filePath,
        startTime,
      });
    }
  },

  async read(
    projectRoot: string,
    id: string,
    options?: { includeContent?: boolean }
  ): Promise<OperationResult<EccRule>> {
    const startTime = Date.now();
    const filePath = this.getPath(projectRoot, id);

    // Build operation object, only including options if defined
    const operation = {
      type: 'read' as const,
      artifactType: 'rule' as const,
      id,
      ...(options !== undefined && { options }),
    };

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const name = id.includes(':') ? id.split(':').pop()! : id;
      const rule = parseRule(name, content);

      // Optionally exclude content
      if (options?.includeContent === false) {
        delete rule.content;
      }

      return createResult({
        success: true,
        operation,
        data: rule,
        path: filePath,
        startTime,
      });
    } catch (error) {
      const isNotFound = (error as NodeJS.ErrnoException).code === 'ENOENT';

      return createResult({
        success: false,
        operation,
        error: {
          code: isNotFound ? 'NOT_FOUND' : 'READ_FAILED',
          message: isNotFound
            ? `Rule '${id}' not found`
            : error instanceof Error ? error.message : 'Failed to read rule',
          context: { path: filePath, error },
        },
        path: filePath,
        startTime,
      });
    }
  },

  async update(
    projectRoot: string,
    id: string,
    changes: Partial<EccRule>,
    options?: { merge?: boolean; dryRun?: boolean }
  ): Promise<OperationResult<EccRule>> {
    const startTime = Date.now();
    const filePath = this.getPath(projectRoot, id);
    const merge = options?.merge !== false; // Default to merge

    // Build operation object, only including options if defined
    const operation = {
      type: 'update' as const,
      artifactType: 'rule' as const,
      id,
      changes,
      ...(options !== undefined && { options }),
    };

    try {
      // Read existing rule
      const readResult = await this.read(projectRoot, id);
      if (!readResult.success || !readResult.data) {
        return createResult({
          success: false,
          operation,
          error: readResult.error || {
            code: 'NOT_FOUND',
            message: `Rule '${id}' not found`,
          },
          path: filePath,
          startTime,
        });
      }

      const existingRule = readResult.data;
      let updatedRule: EccRule;

      if (merge) {
        // Merge changes with existing
        updatedRule = {
          ...existingRule,
          ...changes,
          // Preserve identity fields
          id: existingRule.id,
          pluginId: existingRule.pluginId,
          name: existingRule.name,
        };
      } else {
        // Replace entirely (but keep identity)
        updatedRule = {
          id: existingRule.id,
          pluginId: existingRule.pluginId,
          name: existingRule.name,
          ...changes,
        } as EccRule;
      }

      // Dry run - just validate
      if (options?.dryRun) {
        return createResult({
          success: true,
          operation,
          data: updatedRule,
          path: filePath,
          startTime,
          beforeState: existingRule,
          afterState: updatedRule,
        });
      }

      // Serialize and write
      const content = serializeRule(updatedRule);
      await fs.writeFile(filePath, content, 'utf-8');

      return createResult({
        success: true,
        operation,
        data: updatedRule,
        path: filePath,
        startTime,
        beforeState: existingRule,
        afterState: updatedRule,
      });
    } catch (error) {
      return createResult({
        success: false,
        operation,
        error: {
          code: 'UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to update rule',
          context: { path: filePath, error },
        },
        path: filePath,
        startTime,
      });
    }
  },

  async delete(
    projectRoot: string,
    id: string,
    options?: { soft?: boolean; dryRun?: boolean }
  ): Promise<OperationResult<void>> {
    const startTime = Date.now();
    const filePath = this.getPath(projectRoot, id);

    // Build operation object, only including options if defined
    const operation = {
      type: 'delete' as const,
      artifactType: 'rule' as const,
      id,
      ...(options !== undefined && { options }),
    };

    try {
      // Check if file exists
      const fileExists = await this.exists(projectRoot, id);
      if (!fileExists) {
        return createResult({
          success: false,
          operation,
          error: {
            code: 'NOT_FOUND',
            message: `Rule '${id}' not found`,
            context: { path: filePath },
          },
          path: filePath,
          startTime,
        });
      }

      // Dry run - just validate
      if (options?.dryRun) {
        return createResult({
          success: true,
          operation,
          path: filePath,
          startTime,
        });
      }

      if (options?.soft) {
        // Soft delete: rename to .deleted
        const deletedPath = `${filePath}.deleted`;
        await fs.rename(filePath, deletedPath);
      } else {
        // Hard delete: remove file
        await fs.unlink(filePath);
      }

      return createResult({
        success: true,
        operation,
        path: filePath,
        startTime,
      });
    } catch (error) {
      return createResult({
        success: false,
        operation,
        error: {
          code: 'DELETE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to delete rule',
          context: { path: filePath, error },
        },
        path: filePath,
        startTime,
      });
    }
  },

  async list(projectRoot: string): Promise<OperationResult<EccRule[]>> {
    const startTime = Date.now();
    const rulesDir = path.join(projectRoot, RULES_PATH);

    const operation = {
      type: 'query' as const,
      artifactType: 'rule' as const,
    };

    try {
      // Ensure directory exists
      try {
        await fs.access(rulesDir);
      } catch {
        // Directory doesn't exist, return empty list
        return createResult({
          success: true,
          operation,
          data: [],
          path: rulesDir,
          startTime,
        });
      }

      // Read directory entries
      const entries = await fs.readdir(rulesDir, { withFileTypes: true });
      const rules: EccRule[] = [];

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(RULE_EXTENSION)) {
          continue;
        }

        const name = entry.name.slice(0, -RULE_EXTENSION.length);
        const filePath = path.join(rulesDir, entry.name);

        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const rule = parseRule(name, content);
          rules.push(rule);
        } catch {
          // Skip files that can't be read
          continue;
        }
      }

      return createResult({
        success: true,
        operation,
        data: rules,
        path: rulesDir,
        startTime,
      });
    } catch (error) {
      return createResult({
        success: false,
        operation,
        error: {
          code: 'LIST_FAILED',
          message: error instanceof Error ? error.message : 'Failed to list rules',
          context: { path: rulesDir, error },
        },
        path: rulesDir,
        startTime,
      });
    }
  },
};

export default ruleHandler;
