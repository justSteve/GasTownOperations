/**
 * @fileoverview MCP Server Artifact Handler
 *
 * CRUD operations for MCP Server configurations in .claude/settings.json.
 *
 * This handler uses the AGGREGATED pattern:
 * - MCP servers are stored in the `mcpServers` object within settings.json
 * - Each server is keyed by its name
 * - Must read entire file, modify the mcpServers section, then write back
 * - Preserves other fields in settings.json (permissions, etc.)
 *
 * @module @ecc/crud/artifacts/mcp-server-handler
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { EccMcpServer } from '../types/artifact-types.js';
import type { OperationResult, OperationError } from '../types/result-types.js';
import type { ArtifactHandler } from './hook-handler.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Internal representation of an MCP server entry in settings.json
 * (differs from EccMcpServer which has additional metadata fields)
 */
interface McpServerEntry {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  type?: string;
  url?: string;
  enabled?: boolean;
}

/**
 * Structure of settings.json file
 */
interface SettingsJson {
  mcpServers?: Record<string, McpServerEntry>;
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
  [key: string]: unknown; // Allow other fields to be preserved
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
async function readSettings(projectRoot: string): Promise<SettingsJson> {
  const settingsPath = getSettingsPath(projectRoot);

  if (!(await fileExists(settingsPath))) {
    return {};
  }

  try {
    const content = await readFile(settingsPath, 'utf-8');
    return JSON.parse(content) as SettingsJson;
  } catch (error) {
    // If file exists but can't be parsed, throw
    throw new Error(
      `Failed to parse settings.json: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Write settings.json, creating .claude directory if needed
 */
async function writeSettings(
  projectRoot: string,
  settings: SettingsJson
): Promise<void> {
  const settingsPath = getSettingsPath(projectRoot);
  const settingsDir = dirname(settingsPath);

  // Ensure .claude directory exists
  await mkdir(settingsDir, { recursive: true });

  // Write with consistent formatting (2-space indent)
  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}

/**
 * Convert EccMcpServer to the format stored in settings.json
 */
function toSettingsEntry(server: EccMcpServer): McpServerEntry {
  const entry: McpServerEntry = {};

  if (server.command) {
    entry.command = server.command;
  }
  if (server.args && server.args.length > 0) {
    entry.args = server.args;
  }
  if (server.env && Object.keys(server.env).length > 0) {
    entry.env = server.env;
  }
  if (server.serverType) {
    entry.type = server.serverType;
  }
  if (server.url) {
    entry.url = server.url;
  }
  if (server.enabled === false) {
    entry.enabled = false;
  }

  return entry;
}

/**
 * Convert settings.json entry back to EccMcpServer format
 */
function fromSettingsEntry(name: string, entry: McpServerEntry): EccMcpServer {
  const server: EccMcpServer = {
    id: name,
    pluginId: '', // Not stored in settings.json
    name,
  };

  // Conditionally add optional fields only if defined
  if (entry.command !== undefined) server.command = entry.command;
  if (entry.args !== undefined) server.args = entry.args;
  if (entry.env !== undefined) server.env = entry.env;
  if (entry.type !== undefined) server.serverType = entry.type;
  if (entry.url !== undefined) server.url = entry.url;
  if (entry.enabled !== undefined) server.enabled = entry.enabled;

  return server;
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
  return {
    success: false,
    operation,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    path,
    error,
  };
}

/**
 * Create a success result
 */
function createSuccessResult<T>(
  operation: OperationResult<T>['operation'],
  data: T,
  startTime: number,
  path?: string,
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

// ============================================================================
// MCP Server Handler Implementation
// ============================================================================

/**
 * Artifact handler for MCP Server configurations
 *
 * MCP servers are stored in .claude/settings.json in the mcpServers object,
 * keyed by server name. This handler manages CRUD operations on that object
 * while preserving other settings.json content.
 *
 * @example
 * ```typescript
 * // Create a new MCP server
 * const result = await mcpServerHandler.create('/path/to/project', {
 *   id: 'my-server',
 *   pluginId: 'my-plugin',
 *   name: 'my-server',
 *   command: 'npx',
 *   args: ['-y', '@my/mcp-server'],
 * });
 *
 * // List all MCP servers
 * const servers = await mcpServerHandler.list('/path/to/project');
 * ```
 */
export const mcpServerHandler: ArtifactHandler<EccMcpServer> = {
  artifactType: 'mcp-server',

  /**
   * Create a new MCP server configuration
   */
  async create(
    projectRoot: string,
    artifact: EccMcpServer,
    options?: { overwrite?: boolean; dryRun?: boolean }
  ): Promise<OperationResult<EccMcpServer>> {
    const startTime = Date.now();
    const path = getSettingsPath(projectRoot);
    const operation = {
      type: 'create' as const,
      artifactType: 'mcp-server' as const,
      artifact,
      options,
    };

    try {
      const settings = await readSettings(projectRoot);
      const serverName = artifact.name;

      // Check if server already exists
      if (settings.mcpServers?.[serverName] && !options?.overwrite) {
        return createErrorResult<EccMcpServer>(
          operation,
          {
            code: 'ALREADY_EXISTS',
            message: `MCP server '${serverName}' already exists. Use overwrite: true to replace.`,
            context: { existingServer: settings.mcpServers[serverName] },
          },
          startTime,
          path
        );
      }

      // Store before state for versioning
      const beforeState = settings.mcpServers?.[serverName]
        ? fromSettingsEntry(serverName, settings.mcpServers[serverName])
        : undefined;

      // If dry run, don't actually write
      if (options?.dryRun) {
        return createSuccessResult(
          operation,
          artifact,
          startTime,
          path,
          beforeState,
          artifact
        );
      }

      // Add/update the server
      if (!settings.mcpServers) {
        settings.mcpServers = {};
      }
      settings.mcpServers[serverName] = toSettingsEntry(artifact);

      // Write back settings
      await writeSettings(projectRoot, settings);

      return createSuccessResult(
        operation,
        artifact,
        startTime,
        path,
        beforeState,
        artifact
      );
    } catch (error) {
      return createErrorResult<EccMcpServer>(
        operation,
        {
          code: 'CREATE_FAILED',
          message: `Failed to create MCP server: ${error instanceof Error ? error.message : String(error)}`,
          context: { artifact },
        },
        startTime,
        path
      );
    }
  },

  /**
   * Read an MCP server configuration by name
   */
  async read(
    projectRoot: string,
    id: string,
    options?: { includeContent?: boolean }
  ): Promise<OperationResult<EccMcpServer>> {
    const startTime = Date.now();
    const path = getSettingsPath(projectRoot);
    const operation = {
      type: 'read' as const,
      artifactType: 'mcp-server' as const,
      id,
      options,
    };

    try {
      const settings = await readSettings(projectRoot);
      const entry = settings.mcpServers?.[id];

      if (!entry) {
        return createErrorResult<EccMcpServer>(
          operation,
          {
            code: 'NOT_FOUND',
            message: `MCP server '${id}' not found`,
            context: { availableServers: Object.keys(settings.mcpServers ?? {}) },
          },
          startTime,
          path
        );
      }

      const server = fromSettingsEntry(id, entry);

      return createSuccessResult(operation, server, startTime, path);
    } catch (error) {
      return createErrorResult<EccMcpServer>(
        operation,
        {
          code: 'READ_FAILED',
          message: `Failed to read MCP server: ${error instanceof Error ? error.message : String(error)}`,
          context: { id },
        },
        startTime,
        path
      );
    }
  },

  /**
   * Update an existing MCP server configuration
   */
  async update(
    projectRoot: string,
    id: string,
    changes: Partial<EccMcpServer>,
    options?: { merge?: boolean; dryRun?: boolean }
  ): Promise<OperationResult<EccMcpServer>> {
    const startTime = Date.now();
    const path = getSettingsPath(projectRoot);
    const operation = {
      type: 'update' as const,
      artifactType: 'mcp-server' as const,
      id,
      changes,
      options,
    };

    try {
      const settings = await readSettings(projectRoot);
      const existingEntry = settings.mcpServers?.[id];

      if (!existingEntry) {
        return createErrorResult<EccMcpServer>(
          operation,
          {
            code: 'NOT_FOUND',
            message: `MCP server '${id}' not found`,
            context: { availableServers: Object.keys(settings.mcpServers ?? {}) },
          },
          startTime,
          path
        );
      }

      const beforeState = fromSettingsEntry(id, existingEntry);

      // Apply changes (merge by default)
      const merge = options?.merge !== false;
      let updatedServer: EccMcpServer;

      if (merge) {
        // Merge changes with existing server
        updatedServer = { ...beforeState, ...changes };
      } else {
        // Replace entire server (but preserve name for identification)
        updatedServer = { ...changes, name: id } as EccMcpServer;
      }

      // Handle name change (server renaming)
      const newName = updatedServer.name;
      if (newName !== id) {
        // Check if new name already exists
        if (settings.mcpServers?.[newName]) {
          return createErrorResult<EccMcpServer>(
            operation,
            {
              code: 'ALREADY_EXISTS',
              message: `Cannot rename: MCP server '${newName}' already exists`,
              context: { oldName: id, newName },
            },
            startTime,
            path
          );
        }
      }

      // If dry run, don't actually write
      if (options?.dryRun) {
        return createSuccessResult(
          operation,
          updatedServer,
          startTime,
          path,
          beforeState,
          updatedServer
        );
      }

      // Handle rename: remove old entry
      if (newName !== id) {
        delete settings.mcpServers![id];
      }

      // Set the updated entry
      if (!settings.mcpServers) {
        settings.mcpServers = {};
      }
      settings.mcpServers[newName] = toSettingsEntry(updatedServer);

      await writeSettings(projectRoot, settings);

      return createSuccessResult(
        operation,
        updatedServer,
        startTime,
        path,
        beforeState,
        updatedServer
      );
    } catch (error) {
      return createErrorResult<EccMcpServer>(
        operation,
        {
          code: 'UPDATE_FAILED',
          message: `Failed to update MCP server: ${error instanceof Error ? error.message : String(error)}`,
          context: { id, changes },
        },
        startTime,
        path
      );
    }
  },

  /**
   * Delete an MCP server configuration
   */
  async delete(
    projectRoot: string,
    id: string,
    options?: { soft?: boolean; dryRun?: boolean }
  ): Promise<OperationResult<void>> {
    const startTime = Date.now();
    const path = getSettingsPath(projectRoot);
    const operation = {
      type: 'delete' as const,
      artifactType: 'mcp-server' as const,
      id,
      options,
    };

    try {
      const settings = await readSettings(projectRoot);
      const existingEntry = settings.mcpServers?.[id];

      if (!existingEntry) {
        return createErrorResult<void>(
          operation,
          {
            code: 'NOT_FOUND',
            message: `MCP server '${id}' not found`,
            context: { availableServers: Object.keys(settings.mcpServers ?? {}) },
          },
          startTime,
          path
        );
      }

      // Store before state for versioning (cast to handle void result)
      const beforeState = fromSettingsEntry(id, existingEntry);

      // If dry run, don't actually write
      if (options?.dryRun) {
        return {
          success: true,
          operation,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          path,
          beforeState: beforeState as unknown as void,
        };
      }

      // Soft delete: mark as disabled instead of removing
      if (options?.soft) {
        settings.mcpServers![id] = { ...existingEntry, enabled: false };
      } else {
        // Hard delete: remove from object
        delete settings.mcpServers![id];

        // Clean up empty mcpServers object
        if (Object.keys(settings.mcpServers!).length === 0) {
          delete settings.mcpServers;
        }
      }

      await writeSettings(projectRoot, settings);

      return {
        success: true,
        operation,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        path,
        beforeState: beforeState as unknown as void,
      };
    } catch (error) {
      return createErrorResult<void>(
        operation,
        {
          code: 'DELETE_FAILED',
          message: `Failed to delete MCP server: ${error instanceof Error ? error.message : String(error)}`,
          context: { id },
        },
        startTime,
        path
      );
    }
  },

  /**
   * List all MCP server configurations
   */
  async list(projectRoot: string): Promise<OperationResult<EccMcpServer[]>> {
    const startTime = Date.now();
    const path = getSettingsPath(projectRoot);
    const operation = {
      type: 'query' as const,
      artifactType: 'mcp-server' as const,
    };

    try {
      const settings = await readSettings(projectRoot);
      const servers: EccMcpServer[] = [];

      if (settings.mcpServers) {
        for (const [name, entry] of Object.entries(settings.mcpServers)) {
          servers.push(fromSettingsEntry(name, entry));
        }
      }

      // Sort by name for consistent ordering
      servers.sort((a, b) => a.name.localeCompare(b.name));

      return createSuccessResult(operation, servers, startTime, path);
    } catch (error) {
      return createErrorResult<EccMcpServer[]>(
        operation,
        {
          code: 'LIST_FAILED',
          message: `Failed to list MCP servers: ${error instanceof Error ? error.message : String(error)}`,
        },
        startTime,
        path
      );
    }
  },

  /**
   * Get the path to settings.json (MCP servers don't have individual paths)
   */
  getPath(projectRoot: string, _id: string): string {
    return getSettingsPath(projectRoot);
  },

  /**
   * Check if an MCP server exists by name
   */
  async exists(projectRoot: string, id: string): Promise<boolean> {
    try {
      const settings = await readSettings(projectRoot);
      return settings.mcpServers?.[id] !== undefined;
    } catch {
      return false;
    }
  },
};
