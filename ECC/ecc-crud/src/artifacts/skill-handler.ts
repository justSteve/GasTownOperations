/**
 * Skill Artifact Handler
 *
 * CRUD operations for Claude Code Skills stored in hierarchical paths:
 * `.claude/skills/{category}/{name}/SKILL.md`
 *
 * Skills use YAML frontmatter for metadata and markdown body for content.
 *
 * @module artifacts/skill-handler
 */

import { readdir, readFile, writeFile, rm, mkdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import * as yaml from 'yaml';

import type { EccSkill } from '../types/artifact-types.js';
import type { ArtifactType } from '../types/operation-types.js';
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
 * Parsed skill file structure
 */
interface ParsedSkillFile {
  frontmatter: Record<string, unknown>;
  body: string;
}

// ============================================================================
// Constants
// ============================================================================

const SKILLS_BASE_PATH = '.claude/skills';
const SKILL_FILENAME = 'SKILL.md';
const DEFAULT_CATEGORY = 'general';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse a skill file into frontmatter and body
 */
function parseSkillFile(content: string): ParsedSkillFile {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);

  if (frontmatterMatch && frontmatterMatch[1] !== undefined) {
    const frontmatterText = frontmatterMatch[1];
    const body = content.slice(frontmatterMatch[0].length);

    try {
      const parsed = yaml.parse(frontmatterText);
      const frontmatter: Record<string, unknown> = typeof parsed === 'object' && parsed !== null ? parsed : {};
      return { frontmatter, body };
    } catch {
      // If YAML parsing fails, treat as body only
      return { frontmatter: {}, body: content };
    }
  }

  return { frontmatter: {}, body: content };
}

/**
 * Generate YAML frontmatter from skill properties
 */
function generateFrontmatter(skill: EccSkill): string | null {
  const frontmatterProps: Record<string, unknown> = {};

  if (skill.hotReload !== undefined) {
    frontmatterProps.hotReload = skill.hotReload;
  }
  if (skill.contextMode) {
    frontmatterProps.contextMode = skill.contextMode;
  }
  if (skill.allowedTools && skill.allowedTools.length > 0) {
    frontmatterProps.allowedTools = skill.allowedTools;
  }

  if (Object.keys(frontmatterProps).length === 0) {
    return null;
  }

  return `---\n${yaml.stringify(frontmatterProps)}---`;
}

/**
 * Generate the full skill file content
 */
function generateSkillFileContent(skill: EccSkill): string {
  const lines: string[] = [];

  // YAML frontmatter (optional)
  const frontmatter = generateFrontmatter(skill);
  if (frontmatter) {
    lines.push(frontmatter);
    lines.push('');
  }

  // Header
  lines.push(`# ${skill.title ?? skill.name}`);
  lines.push('');

  // Description
  if (skill.description) {
    lines.push(skill.description);
    lines.push('');
  }

  // Main content
  if (skill.content) {
    lines.push('## Content');
    lines.push('');
    lines.push(skill.content);
    lines.push('');
  }

  // Patterns
  if (skill.patterns && skill.patterns.length > 0) {
    lines.push('## Patterns');
    lines.push('');

    for (const pattern of skill.patterns) {
      lines.push(`### ${pattern.name}`);
      lines.push('');

      if (pattern.description) {
        lines.push(pattern.description);
        lines.push('');
      }

      if (pattern.applicability) {
        lines.push('**When to use:**');
        lines.push(pattern.applicability);
        lines.push('');
      }

      if (pattern.implementation) {
        lines.push('**Implementation:**');
        lines.push(pattern.implementation);
        lines.push('');
      }
    }
  }

  // Workflows
  if (skill.workflows && skill.workflows.length > 0) {
    lines.push('## Workflows');
    lines.push('');

    for (const workflow of skill.workflows) {
      lines.push(`### ${workflow.name}`);
      lines.push('');

      if (workflow.steps && workflow.steps.length > 0) {
        lines.push('**Steps:**');
        for (let i = 0; i < workflow.steps.length; i++) {
          lines.push(`${i + 1}. ${workflow.steps[i]}`);
        }
        lines.push('');
      }

      if (workflow.expectedOutcome) {
        lines.push('**Expected Outcome:**');
        lines.push(workflow.expectedOutcome);
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

/**
 * Parse skill content from markdown body into EccSkill properties
 */
function parseSkillContent(body: string): Partial<EccSkill> {
  const result: Partial<EccSkill> = {};

  // Extract title from first heading
  const titleMatch = body.match(/^#\s+(.+)$/m);
  if (titleMatch && titleMatch[1]) {
    result.title = titleMatch[1].trim();
  }

  // Extract description (text between title and first ## heading)
  const descMatch = body.match(/^#\s+.+\n\n([\s\S]*?)(?=\n##|\n*$)/m);
  if (descMatch && descMatch[1]) {
    const desc = descMatch[1].trim();
    if (desc && !desc.startsWith('##')) {
      result.description = desc;
    }
  }

  // Extract content section
  const contentMatch = body.match(/## Content\n\n([\s\S]*?)(?=\n##|\n*$)/);
  if (contentMatch && contentMatch[1]) {
    result.content = contentMatch[1].trim();
  }

  return result;
}

/**
 * Parse skill ID into category and name
 */
function parseSkillId(id: string): { category: string | undefined; name: string } {
  const parts = id.split('/');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { category: parts[0], name: parts[1] };
  }
  return { category: undefined, name: id };
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
// Skill Handler Implementation
// ============================================================================

/**
 * Skill artifact handler for CRUD operations
 */
export const skillHandler: ArtifactHandler<EccSkill> = {
  artifactType: 'skill',

  /**
   * Get the file path for a skill
   *
   * Skill ID format: "{category}/{name}" or just "{name}" (uses default category)
   */
  getPath(projectRoot: string, id: string): string {
    const { category, name } = parseSkillId(id);
    const effectiveCategory = category ?? DEFAULT_CATEGORY;
    return join(projectRoot, SKILLS_BASE_PATH, effectiveCategory, name, SKILL_FILENAME);
  },

  /**
   * Check if a skill exists
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
   * Create a new skill
   */
  async create(
    projectRoot: string,
    artifact: EccSkill,
    options: { overwrite?: boolean; dryRun?: boolean } = {}
  ): Promise<OperationResult<EccSkill>> {
    const startTime = Date.now();
    const { overwrite = false, dryRun = false } = options;

    // Determine skill ID and path
    // Skill ID always includes category for consistent path resolution
    const category = artifact.category ?? DEFAULT_CATEGORY;
    const skillId = `${category}/${artifact.name}`;
    const skillPath = this.getPath(projectRoot, skillId);

    const operation = {
      type: 'create' as const,
      artifactType: 'skill' as const,
      artifact,
      options,
    };

    // Check if skill already exists
    const skillExists = await this.exists(projectRoot, skillId);
    if (skillExists && !overwrite) {
      return createErrorResult(operation, {
        code: 'ALREADY_EXISTS',
        message: `Skill '${skillId}' already exists. Use overwrite option to replace.`,
        context: { skillId, path: skillPath },
      }, startTime, skillPath);
    }

    if (dryRun) {
      return createSuccessResult(operation, artifact, startTime, skillPath);
    }

    try {
      // Ensure directory exists
      const skillDir = dirname(skillPath);
      await mkdir(skillDir, { recursive: true });

      // Generate and write skill file
      const content = generateSkillFileContent(artifact);
      await writeFile(skillPath, content, 'utf-8');

      return createSuccessResult(operation, artifact, startTime, skillPath, undefined, artifact);
    } catch (err) {
      return createErrorResult(operation, {
        code: 'WRITE_ERROR',
        message: `Failed to create skill: ${err instanceof Error ? err.message : String(err)}`,
        context: { skillId, path: skillPath },
      }, startTime, skillPath);
    }
  },

  /**
   * Read a skill by ID
   */
  async read(
    projectRoot: string,
    id: string,
    options: { includeContent?: boolean } = {}
  ): Promise<OperationResult<EccSkill>> {
    const startTime = Date.now();
    const { includeContent = true } = options;

    const skillPath = this.getPath(projectRoot, id);
    const { category, name } = parseSkillId(id);

    const operation = {
      type: 'read' as const,
      artifactType: 'skill' as const,
      id,
      options,
    };

    try {
      const content = await readFile(skillPath, 'utf-8');
      const { frontmatter, body } = parseSkillFile(content);
      const parsedContent = parseSkillContent(body);

      // Build skill object, only adding optional properties when they have values
      const skill: EccSkill = {
        id,
        pluginId: '', // Not stored in file, caller should set
        name,
        category: category ?? DEFAULT_CATEGORY,
      };

      // Add optional parsed content properties
      if (parsedContent.title !== undefined) {
        skill.title = parsedContent.title;
      }
      if (parsedContent.description !== undefined) {
        skill.description = parsedContent.description;
      }
      if (includeContent && parsedContent.content !== undefined) {
        skill.content = parsedContent.content;
      }

      // Add optional frontmatter properties
      if (typeof frontmatter.hotReload === 'boolean') {
        skill.hotReload = frontmatter.hotReload;
      }
      if (typeof frontmatter.contextMode === 'string') {
        skill.contextMode = frontmatter.contextMode;
      }
      if (Array.isArray(frontmatter.allowedTools)) {
        skill.allowedTools = frontmatter.allowedTools as string[];
      }

      return createSuccessResult(operation, skill, startTime, skillPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return createErrorResult(operation, {
          code: 'NOT_FOUND',
          message: `Skill '${id}' not found`,
          context: { skillId: id, path: skillPath },
        }, startTime, skillPath);
      }

      return createErrorResult(operation, {
        code: 'READ_ERROR',
        message: `Failed to read skill: ${err instanceof Error ? err.message : String(err)}`,
        context: { skillId: id, path: skillPath },
      }, startTime, skillPath);
    }
  },

  /**
   * Update an existing skill
   */
  async update(
    projectRoot: string,
    id: string,
    changes: Partial<EccSkill>,
    options: { merge?: boolean; dryRun?: boolean } = {}
  ): Promise<OperationResult<EccSkill>> {
    const startTime = Date.now();
    const { merge = true, dryRun = false } = options;

    const skillPath = this.getPath(projectRoot, id);

    const operation = {
      type: 'update' as const,
      artifactType: 'skill' as const,
      id,
      changes,
      options,
    };

    // Read existing skill
    const readResult = await this.read(projectRoot, id, { includeContent: true });
    if (!readResult.success) {
      return createErrorResult(operation, readResult.error!, startTime, skillPath);
    }

    const existingSkill = readResult.data!;

    // Merge or replace
    const updatedSkill: EccSkill = merge
      ? { ...existingSkill, ...changes }
      : { id, pluginId: existingSkill.pluginId, name: existingSkill.name, ...changes };

    if (dryRun) {
      return createSuccessResult(operation, updatedSkill, startTime, skillPath, existingSkill, updatedSkill);
    }

    try {
      // Generate and write updated content
      const content = generateSkillFileContent(updatedSkill);
      await writeFile(skillPath, content, 'utf-8');

      return createSuccessResult(operation, updatedSkill, startTime, skillPath, existingSkill, updatedSkill);
    } catch (err) {
      return createErrorResult(operation, {
        code: 'WRITE_ERROR',
        message: `Failed to update skill: ${err instanceof Error ? err.message : String(err)}`,
        context: { skillId: id, path: skillPath },
      }, startTime, skillPath);
    }
  },

  /**
   * Delete a skill
   */
  async delete(
    projectRoot: string,
    id: string,
    options: { soft?: boolean; dryRun?: boolean } = {}
  ): Promise<OperationResult<void>> {
    const startTime = Date.now();
    const { soft = false, dryRun = false } = options;

    const skillPath = this.getPath(projectRoot, id);
    const skillDir = dirname(skillPath);

    const operation = {
      type: 'delete' as const,
      artifactType: 'skill' as const,
      id,
      options,
    };

    // Check existence
    const skillExists = await this.exists(projectRoot, id);
    if (!skillExists) {
      return createErrorResult<void>(operation, {
        code: 'NOT_FOUND',
        message: `Skill '${id}' not found`,
        context: { skillId: id, path: skillPath },
      }, startTime, skillPath);
    }

    if (dryRun) {
      return {
        success: true,
        operation,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        path: skillPath,
      };
    }

    try {
      if (soft) {
        // Soft delete: rename to .deleted
        const deletedPath = skillPath + '.deleted';
        const content = await readFile(skillPath, 'utf-8');
        await writeFile(deletedPath, content, 'utf-8');
        await rm(skillPath);
      } else {
        // Hard delete: remove the entire skill directory
        await rm(skillDir, { recursive: true });
      }

      return {
        success: true,
        operation,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        path: skillPath,
      };
    } catch (err) {
      return createErrorResult<void>(operation, {
        code: 'DELETE_ERROR',
        message: `Failed to delete skill: ${err instanceof Error ? err.message : String(err)}`,
        context: { skillId: id, path: skillPath },
      }, startTime, skillPath);
    }
  },

  /**
   * List all skills in the project
   */
  async list(projectRoot: string): Promise<OperationResult<EccSkill[]>> {
    const startTime = Date.now();
    const skillsDir = join(projectRoot, SKILLS_BASE_PATH);

    const operation = {
      type: 'query' as const,
      artifactType: 'skill' as const,
    };

    const skills: EccSkill[] = [];

    try {
      // Check if skills directory exists
      try {
        await stat(skillsDir);
      } catch {
        // No skills directory, return empty list
        return createSuccessResult(operation, [], startTime, skillsDir);
      }

      // Read category directories
      const categories = await readdir(skillsDir, { withFileTypes: true });

      for (const categoryEntry of categories) {
        if (!categoryEntry.isDirectory()) continue;

        const categoryPath = join(skillsDir, categoryEntry.name);
        const skillDirs = await readdir(categoryPath, { withFileTypes: true });

        for (const skillEntry of skillDirs) {
          if (!skillEntry.isDirectory()) continue;

          const skillPath = join(categoryPath, skillEntry.name, SKILL_FILENAME);

          try {
            const content = await readFile(skillPath, 'utf-8');
            const { frontmatter, body } = parseSkillFile(content);
            const parsedContent = parseSkillContent(body);

            const skillId = `${categoryEntry.name}/${skillEntry.name}`;

            // Build skill object, only adding optional properties when defined
            const skill: EccSkill = {
              id: skillId,
              pluginId: '', // Not stored in file
              name: skillEntry.name,
              category: categoryEntry.name,
            };

            if (parsedContent.title !== undefined) {
              skill.title = parsedContent.title;
            }
            if (parsedContent.description !== undefined) {
              skill.description = parsedContent.description;
            }
            if (parsedContent.content !== undefined) {
              skill.content = parsedContent.content;
            }
            if (typeof frontmatter.hotReload === 'boolean') {
              skill.hotReload = frontmatter.hotReload;
            }
            if (typeof frontmatter.contextMode === 'string') {
              skill.contextMode = frontmatter.contextMode;
            }
            if (Array.isArray(frontmatter.allowedTools)) {
              skill.allowedTools = frontmatter.allowedTools as string[];
            }

            skills.push(skill);
          } catch {
            // Skip skills that can't be read
            continue;
          }
        }
      }

      return createSuccessResult(operation, skills, startTime, skillsDir);
    } catch (err) {
      return createErrorResult(operation, {
        code: 'LIST_ERROR',
        message: `Failed to list skills: ${err instanceof Error ? err.message : String(err)}`,
        context: { path: skillsDir },
      }, startTime, skillsDir);
    }
  },
};

export default skillHandler;
