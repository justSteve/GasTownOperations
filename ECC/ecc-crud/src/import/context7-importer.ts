/**
 * Context7 Skills Importer
 *
 * Imports skills from Context7's Agent Skills format into our ECC pipeline.
 * Context7 uses the standard Agent Skills format (SKILL.md with YAML frontmatter).
 *
 * @module @ecc/crud/import/context7-importer
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, basename, dirname } from 'node:path';
import * as yaml from 'yaml';
import type { EccSkill } from '../types/artifact-types.js';
import type { OperationResult } from '../types/result-types.js';
import type { CrudEngine } from '../core/crud-engine.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Context7/Agent Skills frontmatter format
 */
export interface C7SkillFrontmatter {
  /** Required: skill name (lowercase, hyphens only) */
  name: string;
  /** Required: description of what skill does */
  description: string;
  /** Optional: license */
  license?: string;
  /** Optional: compatibility notes */
  compatibility?: string;
  /** Optional: space-delimited allowed tools */
  'allowed-tools'?: string;
  /** Optional: arbitrary metadata */
  metadata?: Record<string, string>;
}

/**
 * Parsed Context7 skill
 */
export interface ParsedC7Skill {
  frontmatter: C7SkillFrontmatter;
  body: string;
  sourcePath: string;
}

/**
 * Options for importing skills
 */
export interface C7ImportOptions {
  /** Category to assign imported skills (default: 'context7') */
  category?: string;
  /** Plugin ID for imported skills (default: 'context7-import') */
  pluginId?: string;
  /** Overwrite existing skills with same name */
  overwrite?: boolean;
  /** Dry run - parse and validate but don't persist */
  dryRun?: boolean;
}

/**
 * Result of an import operation
 */
export interface C7ImportResult {
  /** Successfully imported skills */
  imported: EccSkill[];
  /** Skills that failed to import */
  errors: Array<{ path: string; error: string }>;
  /** Total skills processed */
  total: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CATEGORY = 'context7';
const DEFAULT_PLUGIN_ID = 'context7-import';
const SKILL_FILENAME = 'SKILL.md';

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parse a Context7 SKILL.md file into structured data
 */
export function parseC7SkillFile(content: string, sourcePath: string): ParsedC7Skill {
  // Match YAML frontmatter
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

  if (!frontmatterMatch || !frontmatterMatch[1]) {
    throw new Error('Invalid SKILL.md: missing YAML frontmatter');
  }

  const frontmatterText = frontmatterMatch[1];
  const body = frontmatterMatch[2] || '';

  let frontmatter: C7SkillFrontmatter;
  try {
    const parsed = yaml.parse(frontmatterText);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Frontmatter is not an object');
    }
    frontmatter = parsed as C7SkillFrontmatter;
  } catch (err) {
    throw new Error(`Failed to parse YAML frontmatter: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Validate required fields
  if (!frontmatter.name || typeof frontmatter.name !== 'string') {
    throw new Error('Invalid SKILL.md: missing required "name" field');
  }
  if (!frontmatter.description || typeof frontmatter.description !== 'string') {
    throw new Error('Invalid SKILL.md: missing required "description" field');
  }

  return {
    frontmatter,
    body: body.trim(),
    sourcePath,
  };
}

/**
 * Transform a parsed Context7 skill into our EccSkill format
 */
export function transformC7ToEccSkill(
  parsed: ParsedC7Skill,
  options: C7ImportOptions = {}
): EccSkill {
  const category = options.category || DEFAULT_CATEGORY;
  const pluginId = options.pluginId || DEFAULT_PLUGIN_ID;
  const { frontmatter, body } = parsed;

  // Build EccSkill
  const skill: EccSkill = {
    id: `${category}/${frontmatter.name}`,
    pluginId,
    name: frontmatter.name,
    category,
    description: frontmatter.description,
  };

  // Map allowed-tools (space-delimited string → array)
  if (frontmatter['allowed-tools']) {
    skill.allowedTools = frontmatter['allowed-tools'].split(/\s+/).filter(Boolean);
  }

  // Build content from body + metadata
  const contentParts: string[] = [];

  // Add provenance comment
  contentParts.push(`<!-- Imported from Context7: ${parsed.sourcePath} -->\n`);

  // Add metadata section if present
  if (frontmatter.metadata) {
    const meta = frontmatter.metadata;
    if (meta.author || meta.version) {
      contentParts.push('## Metadata\n');
      if (meta.author) contentParts.push(`- **Author**: ${meta.author}`);
      if (meta.version) contentParts.push(`- **Version**: ${meta.version}`);
      contentParts.push('');
    }
  }

  // Add license if present
  if (frontmatter.license) {
    contentParts.push(`**License**: ${frontmatter.license}\n`);
  }

  // Add compatibility if present
  if (frontmatter.compatibility) {
    contentParts.push(`**Compatibility**: ${frontmatter.compatibility}\n`);
  }

  // Add the main body content
  if (body) {
    contentParts.push(body);
  }

  skill.content = contentParts.join('\n').trim();

  return skill;
}

// ============================================================================
// Import Functions
// ============================================================================

/**
 * Import a single Context7 skill from a SKILL.md file
 */
export async function importC7Skill(
  skillPath: string,
  engine: CrudEngine,
  options: C7ImportOptions = {}
): Promise<OperationResult<EccSkill>> {
  const startTime = Date.now();

  try {
    // Read the skill file
    const content = await readFile(skillPath, 'utf-8');

    // Parse Context7 format
    const parsed = parseC7SkillFile(content, skillPath);

    // Transform to EccSkill
    const eccSkill = transformC7ToEccSkill(parsed, options);

    // Persist via CrudEngine (unless dry run)
    if (options.dryRun) {
      return {
        success: true,
        operation: {
          type: 'create',
          artifactType: 'skill',
          artifact: eccSkill,
          options: { dryRun: true },
        },
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        data: eccSkill,
        path: skillPath,
      };
    }

    // Use CrudEngine to persist
    const result = await engine.createSkill(eccSkill, {
      overwrite: options.overwrite ?? false,
    });

    return result;
  } catch (err) {
    return {
      success: false,
      operation: {
        type: 'create',
        artifactType: 'skill',
        artifact: { name: 'unknown' } as EccSkill,
      },
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      error: {
        code: 'IMPORT_ERROR',
        message: `Failed to import skill: ${err instanceof Error ? err.message : String(err)}`,
        context: { path: skillPath },
      },
      path: skillPath,
    };
  }
}

/**
 * Import all skills from a directory containing skill folders
 *
 * Expected structure:
 * directory/
 *   skill-one/
 *     SKILL.md
 *   skill-two/
 *     SKILL.md
 */
export async function importC7Directory(
  dirPath: string,
  engine: CrudEngine,
  options: C7ImportOptions = {}
): Promise<C7ImportResult> {
  const result: C7ImportResult = {
    imported: [],
    errors: [],
    total: 0,
  };

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillDir = join(dirPath, entry.name);
      const skillPath = join(skillDir, SKILL_FILENAME);

      // Check if SKILL.md exists in this directory
      try {
        await stat(skillPath);
      } catch {
        // No SKILL.md in this directory, skip
        continue;
      }

      result.total++;

      const importResult = await importC7Skill(skillPath, engine, options);

      if (importResult.success && importResult.data) {
        result.imported.push(importResult.data);
      } else {
        result.errors.push({
          path: skillPath,
          error: importResult.error?.message || 'Unknown error',
        });
      }
    }
  } catch (err) {
    result.errors.push({
      path: dirPath,
      error: `Failed to read directory: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  return result;
}

/**
 * Import a skill directly from a SKILL.md file path
 * (convenience wrapper that handles both file and directory paths)
 */
export async function importC7(
  path: string,
  engine: CrudEngine,
  options: C7ImportOptions = {}
): Promise<C7ImportResult> {
  const stats = await stat(path);

  if (stats.isDirectory()) {
    // Check if it's a skill directory (has SKILL.md) or a parent directory
    const skillPath = join(path, SKILL_FILENAME);
    try {
      await stat(skillPath);
      // It's a skill directory, import the single skill
      const result = await importC7Skill(skillPath, engine, options);
      return {
        imported: result.success && result.data ? [result.data] : [],
        errors: result.success ? [] : [{ path: skillPath, error: result.error?.message || 'Unknown' }],
        total: 1,
      };
    } catch {
      // It's a parent directory, import all skills in it
      return importC7Directory(path, engine, options);
    }
  } else {
    // It's a file, import directly
    const result = await importC7Skill(path, engine, options);
    return {
      imported: result.success && result.data ? [result.data] : [],
      errors: result.success ? [] : [{ path, error: result.error?.message || 'Unknown' }],
      total: 1,
    };
  }
}
