/**
 * Command Artifact Handler
 *
 * CRUD operations for Claude Code command files (.claude/commands/{name}.md).
 * Commands are slash commands that define specialized workflows with optional
 * tool restrictions and confirmation requirements.
 *
 * File Format:
 * - YAML frontmatter with description, allowed-tools, wait-for-confirmation, invokes-agent
 * - Markdown body containing the command instructions
 * - Phases embedded as sections in the content
 *
 * @module @ecc/crud/artifacts/command-handler
 */

import { readFile, writeFile, unlink, readdir, mkdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { EccCommand, EccPhase } from '../types/artifact-types.js';
import type { ArtifactType } from '../types/operation-types.js';
import type { OperationResult } from '../types/result-types.js';

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
 * Parsed command file structure
 */
interface ParsedCommandFile {
  frontmatter: Record<string, unknown>;
  content: string;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): ParsedCommandFile {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, content: content.trim() };
  }

  const yamlContent = match[1] ?? '';
  const markdownContent = match[2] ?? '';

  // Simple YAML parser for frontmatter (handles common cases)
  const frontmatter: Record<string, unknown> = {};

  const lines = yamlContent.split('\n');
  let currentKey = '';
  let currentArray: string[] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Array item
    if (trimmed.startsWith('- ') && currentArray) {
      currentArray.push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ''));
      continue;
    }

    // End of array when we hit a new key
    if (currentArray && !trimmed.startsWith('-')) {
      frontmatter[currentKey] = currentArray;
      currentArray = null;
    }

    // Key-value pair
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();

      currentKey = key;

      if (value === '') {
        // Could be start of an array or object
        currentArray = [];
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // Inline array: ["item1", "item2"]
        const arrayContent = value.slice(1, -1);
        frontmatter[key] = arrayContent
          .split(',')
          .map((item) => item.trim().replace(/^["']|["']$/g, ''))
          .filter((item) => item.length > 0);
      } else if (value === 'true') {
        frontmatter[key] = true;
      } else if (value === 'false') {
        frontmatter[key] = false;
      } else if (!isNaN(Number(value)) && value !== '') {
        frontmatter[key] = Number(value);
      } else {
        // String value - strip quotes if present
        frontmatter[key] = value.replace(/^["']|["']$/g, '');
      }
    }
  }

  // Handle any remaining array
  if (currentArray) {
    frontmatter[currentKey] = currentArray;
  }

  return { frontmatter, content: (markdownContent ?? '').trim() };
}

/**
 * Generate YAML frontmatter from command properties
 */
function generateFrontmatter(command: EccCommand): string {
  const lines: string[] = ['---'];

  // Description (required for commands typically)
  if (command.description) {
    lines.push(`description: "${command.description.replace(/"/g, '\\"')}"`);
  }

  // Allowed tools
  if (command.allowedTools && command.allowedTools.length > 0) {
    const toolsStr = command.allowedTools.map((t) => `"${t}"`).join(', ');
    lines.push(`allowed-tools: [${toolsStr}]`);
  }

  // Wait for confirmation
  if (command.waitForConfirmation !== undefined) {
    lines.push(`wait-for-confirmation: ${command.waitForConfirmation}`);
  }

  // Invokes agent reference
  if (command.invokesAgentRef) {
    lines.push(`invokes-agent: "${command.invokesAgentRef}"`);
  }

  lines.push('---');
  return lines.join('\n');
}

/**
 * Generate markdown content for a command (excluding frontmatter)
 */
function generateContent(command: EccCommand): string {
  const lines: string[] = [];

  // Main content
  if (command.content) {
    lines.push(command.content);
    lines.push('');
  }

  // Phases
  if (command.phases && command.phases.length > 0) {
    const sorted = [...command.phases].sort((a, b) => a.number - b.number);

    for (const phase of sorted) {
      const phaseName = phase.name ? `: ${phase.name}` : '';
      lines.push(`## Phase ${phase.number}${phaseName}`);
      lines.push('');

      if (phase.description) {
        lines.push(phase.description);
        lines.push('');
      }

      if (phase.steps && phase.steps.length > 0) {
        for (let i = 0; i < phase.steps.length; i++) {
          lines.push(`${i + 1}. ${phase.steps[i]}`);
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n').trimEnd();
}

/**
 * Parse phases from markdown content
 */
function parsePhases(content: string, commandId: string): EccPhase[] {
  const phases: EccPhase[] = [];
  const phaseRegex = /^##\s*Phase\s+(\d+)(?:\s*:\s*(.+))?$/gm;

  let match: RegExpExecArray | null;
  interface PhaseMatch {
    index: number;
    number: number;
    name: string | undefined;
  }
  const matches: PhaseMatch[] = [];

  while ((match = phaseRegex.exec(content)) !== null) {
    const phaseNumber = match[1];
    const phaseName = match[2];
    if (phaseNumber !== undefined) {
      matches.push({
        index: match.index,
        number: parseInt(phaseNumber, 10),
        name: phaseName?.trim(),
      });
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];

    if (!current) continue;

    // Extract phase content between this header and the next (or end)
    const startIndex = content.indexOf('\n', current.index) + 1;
    const endIndex = next ? next.index : content.length;
    const phaseContent = content.slice(startIndex, endIndex).trim();

    // Parse description (first paragraph before numbered list)
    const steps: string[] = [];

    const contentLines = phaseContent.split('\n');
    const descriptionLines: string[] = [];
    let inSteps = false;

    for (const line of contentLines) {
      const trimmed = line.trim();
      if (/^\d+\.\s+/.test(trimmed)) {
        inSteps = true;
        steps.push(trimmed.replace(/^\d+\.\s+/, ''));
      } else if (inSteps && trimmed) {
        // Continuation of a step
        if (steps.length > 0) {
          steps[steps.length - 1] += ' ' + trimmed;
        }
      } else if (!inSteps && trimmed) {
        descriptionLines.push(trimmed);
      }
    }

    const description = descriptionLines.join('\n');

    const phase: EccPhase = {
      id: `${commandId}-phase-${current.number}`,
      commandId,
      number: current.number,
    };

    // Only set optional properties if they have values
    if (current.name) {
      phase.name = current.name;
    }
    if (description) {
      phase.description = description;
    }
    if (steps.length > 0) {
      phase.steps = steps;
    }

    phases.push(phase);
  }

  return phases;
}

/**
 * Convert frontmatter to EccCommand properties
 */
function frontmatterToCommand(
  frontmatter: Record<string, unknown>,
  content: string,
  name: string,
  pluginId: string
): EccCommand {
  const command: EccCommand = {
    id: `${pluginId}-command-${name}`,
    pluginId,
    name,
  };

  // Description
  if (typeof frontmatter.description === 'string') {
    command.description = frontmatter.description;
  }

  // Allowed tools (check both kebab-case from file and camelCase)
  const allowedTools =
    frontmatter['allowed-tools'] ?? frontmatter.allowedTools;
  if (Array.isArray(allowedTools)) {
    command.allowedTools = allowedTools.filter(
      (t): t is string => typeof t === 'string'
    );
  }

  // Wait for confirmation
  const waitForConfirmation =
    frontmatter['wait-for-confirmation'] ?? frontmatter.waitForConfirmation;
  if (typeof waitForConfirmation === 'boolean') {
    command.waitForConfirmation = waitForConfirmation;
  }

  // Invokes agent
  const invokesAgent =
    frontmatter['invokes-agent'] ?? frontmatter.invokesAgentRef;
  if (typeof invokesAgent === 'string') {
    command.invokesAgentRef = invokesAgent;
  }

  // Content (the main markdown body)
  // Remove phase sections to get just the intro content
  const phaseIndex = content.search(/^##\s*Phase\s+\d+/m);
  if (phaseIndex > 0) {
    command.content = content.slice(0, phaseIndex).trim();
  } else if (content.trim()) {
    command.content = content.trim();
  }

  // Parse phases from content
  const phases = parsePhases(content, command.id);
  if (phases.length > 0) {
    command.phases = phases;
  }

  return command;
}

/**
 * Create operation result helper
 */
function createResult<T>(
  success: boolean,
  operation: OperationResult<T>['operation'],
  data?: T,
  path?: string,
  error?: { code: string; message: string; context?: Record<string, unknown> },
  beforeState?: T,
  afterState?: T
): OperationResult<T> {
  const result: OperationResult<T> = {
    success,
    operation,
    timestamp: new Date().toISOString(),
    durationMs: 0, // Will be set by caller if needed
  };

  if (data !== undefined) result.data = data;
  if (path) result.path = path;
  if (error) result.error = error;
  if (beforeState !== undefined) result.beforeState = beforeState;
  if (afterState !== undefined) result.afterState = afterState;

  return result;
}

// ============================================================================
// Handler Implementation
// ============================================================================

/**
 * Command artifact handler
 *
 * Manages CRUD operations for Claude Code command files.
 */
export const commandHandler: ArtifactHandler<EccCommand> = {
  artifactType: 'command',

  /**
   * Get the file path for a command
   */
  getPath(projectRoot: string, id: string): string {
    return join(projectRoot, '.claude', 'commands', `${id}.md`);
  },

  /**
   * Check if a command exists
   */
  async exists(projectRoot: string, id: string): Promise<boolean> {
    try {
      const filePath = this.getPath(projectRoot, id);
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Create a new command file
   */
  async create(
    projectRoot: string,
    artifact: EccCommand,
    options?: { overwrite?: boolean; dryRun?: boolean }
  ): Promise<OperationResult<EccCommand>> {
    const startTime = Date.now();
    const filePath = this.getPath(projectRoot, artifact.name);

    const operation = {
      type: 'create' as const,
      artifactType: 'command' as const,
      artifact,
      ...(options ? { options } : {}),
    };

    try {
      // Check if file exists
      const fileExists = await this.exists(projectRoot, artifact.name);
      if (fileExists && !options?.overwrite) {
        const result = createResult<EccCommand>(false, operation, undefined, filePath, {
          code: 'ALREADY_EXISTS',
          message: `Command '${artifact.name}' already exists. Use overwrite option to replace.`,
          context: { path: filePath },
        });
        result.durationMs = Date.now() - startTime;
        return result;
      }

      // Generate file content
      const frontmatter = generateFrontmatter(artifact);
      const content = generateContent(artifact);
      const fileContent = frontmatter + '\n\n' + content;

      if (options?.dryRun) {
        const result = createResult<EccCommand>(
          true,
          operation,
          artifact,
          filePath,
          undefined,
          undefined,
          artifact
        );
        result.durationMs = Date.now() - startTime;
        return result;
      }

      // Ensure directory exists
      const dir = dirname(filePath);
      await mkdir(dir, { recursive: true });

      // Write file
      await writeFile(filePath, fileContent, 'utf-8');

      const result = createResult<EccCommand>(
        true,
        operation,
        artifact,
        filePath,
        undefined,
        undefined,
        artifact
      );
      result.durationMs = Date.now() - startTime;
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const result = createResult<EccCommand>(false, operation, undefined, filePath, {
        code: 'CREATE_FAILED',
        message: `Failed to create command: ${message}`,
        context: { path: filePath, error: message },
      });
      result.durationMs = Date.now() - startTime;
      return result;
    }
  },

  /**
   * Read a command file
   */
  async read(
    projectRoot: string,
    id: string,
    options?: { includeContent?: boolean }
  ): Promise<OperationResult<EccCommand>> {
    const startTime = Date.now();
    const filePath = this.getPath(projectRoot, id);

    const operation = {
      type: 'read' as const,
      artifactType: 'command' as const,
      id,
      ...(options ? { options } : {}),
    };

    try {
      const fileContent = await readFile(filePath, 'utf-8');
      const parsed = parseFrontmatter(fileContent);

      // Use 'default' as pluginId when reading from disk
      const command = frontmatterToCommand(parsed.frontmatter, parsed.content, id, 'default');

      // If includeContent is explicitly false, clear content fields
      if (options?.includeContent === false) {
        delete command.content;
        delete command.phases;
      }

      const result = createResult<EccCommand>(true, operation, command, filePath);
      result.durationMs = Date.now() - startTime;
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code =
        err instanceof Error && 'code' in err && err.code === 'ENOENT'
          ? 'NOT_FOUND'
          : 'READ_FAILED';
      const result = createResult<EccCommand>(false, operation, undefined, filePath, {
        code,
        message: code === 'NOT_FOUND' ? `Command '${id}' not found` : `Failed to read command: ${message}`,
        context: { path: filePath, error: message },
      });
      result.durationMs = Date.now() - startTime;
      return result;
    }
  },

  /**
   * Update an existing command file
   */
  async update(
    projectRoot: string,
    id: string,
    changes: Partial<EccCommand>,
    options?: { merge?: boolean; dryRun?: boolean }
  ): Promise<OperationResult<EccCommand>> {
    const startTime = Date.now();
    const filePath = this.getPath(projectRoot, id);
    const merge = options?.merge !== false; // Default to merge

    const operation = {
      type: 'update' as const,
      artifactType: 'command' as const,
      id,
      changes,
      ...(options ? { options } : {}),
    };

    try {
      // Read existing command
      const readResult = await this.read(projectRoot, id);
      if (!readResult.success || !readResult.data) {
        const result = createResult<EccCommand>(false, operation, undefined, filePath, {
          code: 'NOT_FOUND',
          message: `Command '${id}' not found`,
          context: { path: filePath },
        });
        result.durationMs = Date.now() - startTime;
        return result;
      }

      const beforeState = readResult.data;
      let updatedCommand: EccCommand;

      if (merge) {
        // Merge changes with existing command
        updatedCommand = {
          ...beforeState,
          ...changes,
          // Keep id, pluginId, and name from original
          id: beforeState.id,
          pluginId: beforeState.pluginId,
          name: beforeState.name,
        };

        // Merge arrays if both exist
        if (changes.allowedTools && beforeState.allowedTools && options?.merge !== false) {
          updatedCommand.allowedTools = [
            ...new Set([...beforeState.allowedTools, ...changes.allowedTools]),
          ];
        }

        // Merge phases by number
        if (changes.phases && beforeState.phases) {
          const phaseMap = new Map<number, EccPhase>();
          for (const phase of beforeState.phases) {
            phaseMap.set(phase.number, phase);
          }
          for (const phase of changes.phases) {
            phaseMap.set(phase.number, { ...phaseMap.get(phase.number), ...phase });
          }
          updatedCommand.phases = Array.from(phaseMap.values()).sort(
            (a, b) => a.number - b.number
          );
        }
      } else {
        // Replace entirely (keeping identity fields)
        updatedCommand = {
          id: beforeState.id,
          pluginId: beforeState.pluginId,
          name: beforeState.name,
          ...changes,
        };
      }

      if (options?.dryRun) {
        const result = createResult<EccCommand>(
          true,
          operation,
          updatedCommand,
          filePath,
          undefined,
          beforeState,
          updatedCommand
        );
        result.durationMs = Date.now() - startTime;
        return result;
      }

      // Generate and write updated content
      const frontmatter = generateFrontmatter(updatedCommand);
      const content = generateContent(updatedCommand);
      const fileContent = frontmatter + '\n\n' + content;

      await writeFile(filePath, fileContent, 'utf-8');

      const result = createResult<EccCommand>(
        true,
        operation,
        updatedCommand,
        filePath,
        undefined,
        beforeState,
        updatedCommand
      );
      result.durationMs = Date.now() - startTime;
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const result = createResult<EccCommand>(false, operation, undefined, filePath, {
        code: 'UPDATE_FAILED',
        message: `Failed to update command: ${message}`,
        context: { path: filePath, error: message },
      });
      result.durationMs = Date.now() - startTime;
      return result;
    }
  },

  /**
   * Delete a command file
   */
  async delete(
    projectRoot: string,
    id: string,
    options?: { soft?: boolean; dryRun?: boolean }
  ): Promise<OperationResult<void>> {
    const startTime = Date.now();
    const filePath = this.getPath(projectRoot, id);

    const operation = {
      type: 'delete' as const,
      artifactType: 'command' as const,
      id,
      ...(options ? { options } : {}),
    };

    try {
      // Check if file exists
      const exists = await this.exists(projectRoot, id);
      if (!exists) {
        const result = createResult<void>(false, operation, undefined, filePath, {
          code: 'NOT_FOUND',
          message: `Command '${id}' not found`,
          context: { path: filePath },
        });
        result.durationMs = Date.now() - startTime;
        return result;
      }

      if (options?.dryRun) {
        const result = createResult<void>(true, operation, undefined, filePath);
        result.durationMs = Date.now() - startTime;
        return result;
      }

      if (options?.soft) {
        // Soft delete: rename with .deleted suffix
        const deletedPath = filePath + '.deleted';
        const fs = await import('node:fs/promises');
        await fs.rename(filePath, deletedPath);
      } else {
        // Hard delete
        await unlink(filePath);
      }

      const result = createResult<void>(true, operation, undefined, filePath);
      result.durationMs = Date.now() - startTime;
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const result = createResult<void>(false, operation, undefined, filePath, {
        code: 'DELETE_FAILED',
        message: `Failed to delete command: ${message}`,
        context: { path: filePath, error: message },
      });
      result.durationMs = Date.now() - startTime;
      return result;
    }
  },

  /**
   * List all command files in the project
   */
  async list(projectRoot: string): Promise<OperationResult<EccCommand[]>> {
    const startTime = Date.now();
    const commandsDir = join(projectRoot, '.claude', 'commands');

    const operation = {
      type: 'query' as const,
      artifactType: 'command' as const,
    };

    try {
      // Check if commands directory exists
      try {
        await stat(commandsDir);
      } catch {
        // Directory doesn't exist - return empty list
        const result = createResult<EccCommand[]>(true, operation, [], commandsDir);
        result.durationMs = Date.now() - startTime;
        return result;
      }

      const entries = await readdir(commandsDir, { withFileTypes: true });
      const commands: EccCommand[] = [];

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md') && !entry.name.endsWith('.deleted')) {
          const id = entry.name.slice(0, -3); // Remove .md extension
          const readResult = await this.read(projectRoot, id);
          if (readResult.success && readResult.data) {
            commands.push(readResult.data);
          }
        }
      }

      const result = createResult<EccCommand[]>(true, operation, commands, commandsDir);
      result.durationMs = Date.now() - startTime;
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const result = createResult<EccCommand[]>(false, operation, undefined, commandsDir, {
        code: 'LIST_FAILED',
        message: `Failed to list commands: ${message}`,
        context: { path: commandsDir, error: message },
      });
      result.durationMs = Date.now() - startTime;
      return result;
    }
  },
};
