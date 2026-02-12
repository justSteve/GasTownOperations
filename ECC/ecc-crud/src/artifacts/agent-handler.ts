/**
 * Agent Artifact Handler
 *
 * CRUD operations for EccAgent artifacts.
 * Agents are stored as markdown files with YAML frontmatter at:
 * `.claude/agents/{name}.md`
 *
 * This is a ONE-TO-ONE pattern: one file per Agent artifact.
 *
 * Note: Agents share the .claude/agents/ directory with SubAgents.
 * The distinction is made by checking frontmatter:
 * - SubAgents have `contextMode` in frontmatter
 * - Agents do NOT have `contextMode` in frontmatter
 *
 * @module @ecc/crud/artifacts/agent-handler
 */

import { readFile, writeFile, unlink, readdir, mkdir, access } from 'fs/promises';
import { join, basename } from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { EccAgent, EccChecklistItem } from '../types/artifact-types.js';
import type { ArtifactType } from '../types/operation-types.js';
import type { OperationResult } from '../types/result-types.js';

// ============================================================================
// Handler Interface
// ============================================================================

/**
 * Generic artifact handler interface for CRUD operations
 */
export interface ArtifactHandler<T> {
  /** The artifact type this handler manages */
  artifactType: ArtifactType;

  /** Create a new artifact */
  create(
    projectRoot: string,
    artifact: T,
    options?: { overwrite?: boolean; dryRun?: boolean }
  ): Promise<OperationResult<T>>;

  /** Read an artifact by ID */
  read(
    projectRoot: string,
    id: string,
    options?: { includeContent?: boolean }
  ): Promise<OperationResult<T>>;

  /** Update an existing artifact */
  update(
    projectRoot: string,
    id: string,
    changes: Partial<T>,
    options?: { merge?: boolean; dryRun?: boolean }
  ): Promise<OperationResult<T>>;

  /** Delete an artifact */
  delete(
    projectRoot: string,
    id: string,
    options?: { soft?: boolean; dryRun?: boolean }
  ): Promise<OperationResult<void>>;

  /** List all artifacts of this type */
  list(projectRoot: string): Promise<OperationResult<T[]>>;

  /** Get the file path for an artifact */
  getPath(projectRoot: string, id: string): string;

  /** Check if an artifact exists */
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
 * Parse an Agent markdown file into an EccAgent object
 */
function parseAgentFile(content: string, name: string, pluginId: string = ''): EccAgent {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  if (!frontmatterMatch) {
    // No frontmatter, treat entire content as instructions
    const agent: EccAgent = {
      id: name,
      pluginId,
      name,
    };
    const trimmed = content.trim();
    if (trimmed) {
      agent.instructions = trimmed;
    }
    return agent;
  }

  const frontmatterStr = frontmatterMatch[1] ?? '';
  const body = frontmatterMatch[2] ?? '';
  const frontmatter = parseYaml(frontmatterStr) as Record<string, unknown>;

  // Extract known fields from frontmatter
  const model = frontmatter.model as EccAgent['model'];
  const tools = frontmatter.tools as string[] | undefined;
  const skillRefs = frontmatter.skillRefs as string[] | undefined;
  const ruleRefs = frontmatter.ruleRefs as string[] | undefined;
  const roleDescription = frontmatter.roleDescription as string | undefined;
  const description = frontmatter.description as string | undefined;

  // Parse body content for instructions and checklist items
  const instructionsMatch = body.match(/## Instructions\n\n([\s\S]*?)(?=\n## |\n*$)/);
  const rawInstructions = instructionsMatch
    ? (instructionsMatch[1] ?? '').trim()
    : body.trim();
  const instructions = rawInstructions || undefined;

  // Parse checklist items if present
  const checklistMatch = body.match(/## Checklist\n\n([\s\S]*?)(?=\n## |\n*$)/);
  let checklistItems: EccChecklistItem[] | undefined;

  if (checklistMatch) {
    const checklistContent = checklistMatch[1] ?? '';
    const items: EccChecklistItem[] = [];
    const itemMatches = checklistContent.matchAll(/^- \[[ x]\] (.+?)(?:\s+\((\w+)\))?$/gm);
    let order = 0;

    for (const match of itemMatches) {
      const itemText = match[1] ?? '';
      const priorityText = match[2];
      const item: EccChecklistItem = {
        id: `${name}-checklist-${order}`,
        agentId: name,
        item: itemText.trim(),
        itemOrder: order,
      };
      if (priorityText) {
        item.priority = priorityText as 'required' | 'recommended' | 'optional';
      }
      items.push(item);
      order++;
    }

    if (items.length > 0) {
      checklistItems = items;
    }
  }

  const agent: EccAgent = {
    id: name,
    pluginId,
    name,
  };

  if (description) agent.description = description;
  if (model) agent.model = model;
  if (instructions) agent.instructions = instructions;
  if (roleDescription) agent.roleDescription = roleDescription;
  if (tools && tools.length > 0) agent.tools = tools;
  if (checklistItems) agent.checklistItems = checklistItems;
  if (skillRefs && skillRefs.length > 0) agent.skillRefs = skillRefs;
  if (ruleRefs && ruleRefs.length > 0) agent.ruleRefs = ruleRefs;

  return agent;
}

/**
 * Serialize an EccAgent object to markdown with YAML frontmatter
 */
function serializeAgent(agent: EccAgent): string {
  const lines: string[] = [];

  // Build frontmatter object
  const frontmatter: Record<string, unknown> = {};

  if (agent.model) {
    frontmatter.model = agent.model;
  }

  if (agent.roleDescription) {
    frontmatter.roleDescription = agent.roleDescription;
  }

  if (agent.description) {
    frontmatter.description = agent.description;
  }

  if (agent.tools && agent.tools.length > 0) {
    frontmatter.tools = agent.tools;
  }

  if (agent.skillRefs && agent.skillRefs.length > 0) {
    frontmatter.skillRefs = agent.skillRefs;
  }

  if (agent.ruleRefs && agent.ruleRefs.length > 0) {
    frontmatter.ruleRefs = agent.ruleRefs;
  }

  // Only add frontmatter if there are fields to write
  if (Object.keys(frontmatter).length > 0) {
    lines.push('---');
    lines.push(stringifyYaml(frontmatter).trim());
    lines.push('---');
    lines.push('');
  }

  // Add header
  lines.push(`# ${agent.name}`);
  lines.push('');

  // Add instructions as body content
  if (agent.instructions) {
    lines.push('## Instructions');
    lines.push('');
    lines.push(agent.instructions);
    lines.push('');
  }

  // Add checklist items
  if (agent.checklistItems && agent.checklistItems.length > 0) {
    lines.push('## Checklist');
    lines.push('');
    for (const item of agent.checklistItems) {
      const priorityStr = item.priority ? ` (${item.priority})` : '';
      lines.push(`- [ ] ${item.item}${priorityStr}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Create a successful operation result
 */
function successResult<T>(
  operation: OperationResult<T>['operation'],
  data: T,
  path: string,
  startTime: number,
  beforeState?: T,
  afterState?: T
): OperationResult<T> {
  return {
    success: true,
    operation,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    data,
    path,
    beforeState,
    afterState,
  };
}

/**
 * Create an error operation result
 */
function errorResult<T>(
  operation: OperationResult<T>['operation'],
  code: string,
  message: string,
  startTime: number,
  context?: Record<string, unknown>
): OperationResult<T> {
  return {
    success: false,
    operation,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    error: { code, message, context },
  };
}

/**
 * Ensure the agents directory exists
 */
async function ensureAgentsDir(projectRoot: string): Promise<void> {
  const agentsPath = join(projectRoot, AGENTS_DIR);
  try {
    await access(agentsPath);
  } catch {
    await mkdir(agentsPath, { recursive: true });
  }
}

/**
 * Check if a file represents an Agent (vs a SubAgent)
 * SubAgents have `contextMode` in frontmatter, Agents do not
 */
function isAgentFile(content: string): boolean {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    // No frontmatter - could be either, but we'll treat it as an Agent
    // if it has agent-like structure
    return true;
  }

  try {
    const frontmatterStr = frontmatterMatch[1] ?? '';
    const frontmatter = parseYaml(frontmatterStr) as Record<string, unknown>;
    // SubAgents have contextMode, Agents do not
    return !('contextMode' in frontmatter);
  } catch {
    return true;
  }
}

// ============================================================================
// Agent Handler Implementation
// ============================================================================

/**
 * Agent artifact handler
 *
 * Manages CRUD operations for Agent artifacts stored as markdown files
 * with YAML frontmatter in `.claude/agents/{name}.md`
 */
export const agentHandler: ArtifactHandler<EccAgent> = {
  artifactType: 'agent',

  getPath(projectRoot: string, id: string): string {
    return join(projectRoot, AGENTS_DIR, `${id}${FILE_EXTENSION}`);
  },

  async exists(projectRoot: string, id: string): Promise<boolean> {
    try {
      const filePath = this.getPath(projectRoot, id);
      await access(filePath);

      // File exists, but is it an Agent or SubAgent?
      const content = await readFile(filePath, 'utf-8');
      return isAgentFile(content);
    } catch {
      return false;
    }
  },

  async create(
    projectRoot: string,
    artifact: EccAgent,
    options?: { overwrite?: boolean; dryRun?: boolean }
  ): Promise<OperationResult<EccAgent>> {
    const startTime = Date.now();
    const filePath = this.getPath(projectRoot, artifact.name);
    const operation = {
      type: 'create' as const,
      artifactType: 'agent' as const,
      artifact,
      options,
    };

    try {
      // Check if file already exists
      const fileExists = await this.exists(projectRoot, artifact.name);
      if (fileExists && !options?.overwrite) {
        return errorResult(
          operation,
          'ALREADY_EXISTS',
          `Agent '${artifact.name}' already exists. Use overwrite option to replace.`,
          startTime,
          { path: filePath }
        );
      }

      // Dry run - validate only
      if (options?.dryRun) {
        return successResult(operation, artifact, filePath, startTime);
      }

      // Ensure directory exists
      await ensureAgentsDir(projectRoot);

      // Serialize and write file
      const content = serializeAgent(artifact);
      await writeFile(filePath, content, 'utf-8');

      return successResult(operation, artifact, filePath, startTime, undefined, artifact);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(operation, 'WRITE_FAILED', `Failed to create Agent: ${message}`, startTime);
    }
  },

  async read(
    projectRoot: string,
    id: string,
    options?: { includeContent?: boolean }
  ): Promise<OperationResult<EccAgent>> {
    const startTime = Date.now();
    const filePath = this.getPath(projectRoot, id);
    const operation = {
      type: 'read' as const,
      artifactType: 'agent' as const,
      id,
      options,
    };

    try {
      // Check if file exists and is an Agent
      try {
        await access(filePath);
      } catch {
        return errorResult(
          operation,
          'NOT_FOUND',
          `Agent '${id}' not found`,
          startTime,
          { path: filePath }
        );
      }

      // Read and check if it's an Agent
      const content = await readFile(filePath, 'utf-8');
      if (!isAgentFile(content)) {
        return errorResult(
          operation,
          'NOT_FOUND',
          `'${id}' is not an Agent (it's a SubAgent)`,
          startTime,
          { path: filePath }
        );
      }

      const agent = parseAgentFile(content, id);

      // If includeContent is explicitly false, strip instructions
      if (options?.includeContent === false) {
        const { instructions: _, ...rest } = agent;
        return successResult(operation, rest as EccAgent, filePath, startTime);
      }

      return successResult(operation, agent, filePath, startTime);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(operation, 'READ_FAILED', `Failed to read Agent: ${message}`, startTime);
    }
  },

  async update(
    projectRoot: string,
    id: string,
    changes: Partial<EccAgent>,
    options?: { merge?: boolean; dryRun?: boolean }
  ): Promise<OperationResult<EccAgent>> {
    const startTime = Date.now();
    const filePath = this.getPath(projectRoot, id);
    const operation = {
      type: 'update' as const,
      artifactType: 'agent' as const,
      id,
      changes,
      options,
    };

    try {
      // Read existing artifact
      const existsResult = await this.exists(projectRoot, id);
      if (!existsResult) {
        return errorResult(
          operation,
          'NOT_FOUND',
          `Agent '${id}' not found`,
          startTime,
          { path: filePath }
        );
      }

      const content = await readFile(filePath, 'utf-8');
      const existing = parseAgentFile(content, id);
      const beforeState = { ...existing };

      // Apply changes
      const shouldMerge = options?.merge !== false; // Default to merge
      let updated: EccAgent;

      if (shouldMerge) {
        // Merge changes into existing
        updated = {
          ...existing,
          ...changes,
          // Preserve identity fields
          id: existing.id,
          name: existing.name,
        };

        // Merge arrays if both exist
        if (changes.tools && existing.tools) {
          updated.tools = [...new Set([...existing.tools, ...changes.tools])];
        }
        if (changes.skillRefs && existing.skillRefs) {
          updated.skillRefs = [...new Set([...existing.skillRefs, ...changes.skillRefs])];
        }
        if (changes.ruleRefs && existing.ruleRefs) {
          updated.ruleRefs = [...new Set([...existing.ruleRefs, ...changes.ruleRefs])];
        }
        if (changes.checklistItems && existing.checklistItems) {
          // Append new checklist items, avoiding duplicates by id
          const existingIds = new Set(existing.checklistItems.map((c) => c.id));
          const newItems = changes.checklistItems.filter((c) => !existingIds.has(c.id));
          updated.checklistItems = [...existing.checklistItems, ...newItems];
        }
      } else {
        // Replace mode - use changes as the new artifact
        updated = {
          id: existing.id,
          pluginId: existing.pluginId,
          name: existing.name,
        };
        if (changes.description !== undefined) updated.description = changes.description;
        if (changes.model !== undefined) updated.model = changes.model;
        if (changes.instructions !== undefined) updated.instructions = changes.instructions;
        if (changes.roleDescription !== undefined) updated.roleDescription = changes.roleDescription;
        if (changes.tools !== undefined) updated.tools = changes.tools;
        if (changes.checklistItems !== undefined) updated.checklistItems = changes.checklistItems;
        if (changes.skillRefs !== undefined) updated.skillRefs = changes.skillRefs;
        if (changes.ruleRefs !== undefined) updated.ruleRefs = changes.ruleRefs;
      }

      // Dry run - validate only
      if (options?.dryRun) {
        return successResult(operation, updated, filePath, startTime, beforeState, updated);
      }

      // Write updated file
      const newContent = serializeAgent(updated);
      await writeFile(filePath, newContent, 'utf-8');

      return successResult(operation, updated, filePath, startTime, beforeState, updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(operation, 'UPDATE_FAILED', `Failed to update Agent: ${message}`, startTime);
    }
  },

  async delete(
    projectRoot: string,
    id: string,
    options?: { soft?: boolean; dryRun?: boolean }
  ): Promise<OperationResult<void>> {
    const startTime = Date.now();
    const filePath = this.getPath(projectRoot, id);
    const operation = {
      type: 'delete' as const,
      artifactType: 'agent' as const,
      id,
      options,
    };

    try {
      // Check if file exists and is an Agent
      const fileExists = await this.exists(projectRoot, id);
      if (!fileExists) {
        return errorResult(
          operation,
          'NOT_FOUND',
          `Agent '${id}' not found`,
          startTime,
          { path: filePath }
        );
      }

      // Read before state for versioning
      const content = await readFile(filePath, 'utf-8');
      const beforeState = parseAgentFile(content, id);

      // Dry run - validate only
      if (options?.dryRun) {
        return {
          success: true,
          operation,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          path: filePath,
          beforeState: beforeState as unknown as void,
        };
      }

      // Soft delete - rename file with .deleted suffix
      if (options?.soft) {
        const deletedPath = `${filePath}.deleted`;
        await writeFile(deletedPath, content, 'utf-8');
        await unlink(filePath);
        return {
          success: true,
          operation,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          path: deletedPath,
          beforeState: beforeState as unknown as void,
        };
      }

      // Hard delete
      await unlink(filePath);

      return {
        success: true,
        operation,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        path: filePath,
        beforeState: beforeState as unknown as void,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(operation, 'DELETE_FAILED', `Failed to delete Agent: ${message}`, startTime);
    }
  },

  async list(projectRoot: string): Promise<OperationResult<EccAgent[]>> {
    const startTime = Date.now();
    const agentsPath = join(projectRoot, AGENTS_DIR);
    const operation = {
      type: 'query' as const,
      artifactType: 'agent' as const,
    };

    try {
      // Check if directory exists
      try {
        await access(agentsPath);
      } catch {
        // Directory doesn't exist - return empty list
        return successResult(operation, [], agentsPath, startTime);
      }

      // Read directory
      const entries = await readdir(agentsPath, { withFileTypes: true });
      const agents: EccAgent[] = [];

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
        const filePath = join(agentsPath, entry.name);

        try {
          const content = await readFile(filePath, 'utf-8');

          // Only include Agents, not SubAgents
          if (!isAgentFile(content)) {
            continue;
          }

          const agent = parseAgentFile(content, name);
          agents.push(agent);
        } catch {
          // Skip files that can't be parsed
          continue;
        }
      }

      return successResult(operation, agents, agentsPath, startTime);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(operation, 'LIST_FAILED', `Failed to list Agents: ${message}`, startTime);
    }
  },
};

// Default export for convenience
export default agentHandler;
