/**
 * Settings JSON Template Generator
 *
 * Generates .claude/settings.json file from EccMcpServer and EccPluginSettings entities.
 * This is an AGGREGATED template - all MCP servers and settings combine into one file.
 */

import type { EccMcpServer, EccPluginSettings } from '../ecc-types.js';

/**
 * Output structure for settings.json
 */
interface SettingsJsonOutput {
  mcpServers?: Record<string, McpServerEntry>;
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
}

interface McpServerEntry {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  type?: string;
  url?: string;
  enabled?: boolean;
}

/**
 * Generate the settings.json content from MCP servers and plugin settings
 */
export function generateSettingsJson(
  mcpServers: EccMcpServer[],
  settings?: EccPluginSettings
): string {
  const output: SettingsJsonOutput = {};

  // MCP Servers
  if (mcpServers.length > 0) {
    output.mcpServers = {};
    for (const server of mcpServers) {
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

      output.mcpServers[server.name] = entry;
    }
  }

  // Permissions
  if (settings) {
    const hasAllow = settings.allowedPermissions && settings.allowedPermissions.length > 0;
    const hasDeny = settings.deniedPermissions && settings.deniedPermissions.length > 0;

    if (hasAllow || hasDeny) {
      output.permissions = {};
      if (hasAllow) {
        output.permissions.allow = settings.allowedPermissions;
      }
      if (hasDeny) {
        output.permissions.deny = settings.deniedPermissions;
      }
    }
  }

  return JSON.stringify(output, null, 2);
}

/**
 * Get the output file path for settings
 */
export function getSettingsFilePath(): string {
  return 'settings.json';
}
