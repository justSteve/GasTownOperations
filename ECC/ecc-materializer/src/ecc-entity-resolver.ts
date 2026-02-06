/**
 * ECC Entity Resolver
 *
 * Resolves all entities belonging to a Plugin, preparing them for materialization.
 */

import type { EccData } from './ecc-data-loader.js';
import type {
  EccPlugin,
  EccAgent,
  EccSubAgent,
  EccSkill,
  EccRule,
  EccHook,
  EccMcpServer,
  EccContext,
  EccCommand,
  EccPluginSettings,
  ResolvedPlugin,
} from './ecc-types.js';

/**
 * Resolve all entities belonging to a Plugin
 *
 * @param pluginId - The ID of the plugin to resolve
 * @param eccData - All loaded ECC data
 * @returns Resolved plugin with all its entities
 * @throws Error if plugin not found
 */
export function resolvePlugin(pluginId: string, eccData: EccData): ResolvedPlugin {
  // Find the plugin
  const plugin = eccData.plugins.find((p) => p.id === pluginId);
  if (!plugin) {
    throw new Error(`Plugin with ID '${pluginId}' not found`);
  }

  // Filter entities belonging to this plugin
  const agents = eccData.agents.filter((a) => a.pluginId === pluginId);
  const subAgents = eccData.subAgents?.filter((sa) => sa.pluginId === pluginId) ?? [];
  const skills = eccData.skills.filter((s) => s.pluginId === pluginId);
  const rules = eccData.rules.filter((r) => r.pluginId === pluginId);
  const hooks = eccData.hooks.filter((h) => h.pluginId === pluginId);
  const mcpServers = eccData.mcpServers.filter((m) => m.pluginId === pluginId);
  const contexts = eccData.contexts.filter((c) => c.pluginId === pluginId);
  const commands = eccData.commands.filter((c) => c.pluginId === pluginId);

  // TODO: Load plugin settings when implemented

  return {
    plugin,
    agents,
    subAgents,
    skills,
    rules,
    hooks,
    mcpServers,
    contexts,
    commands,
  };
}

/**
 * Validate that all entity references are valid
 *
 * @param resolved - The resolved plugin
 * @returns Array of validation errors (empty if valid)
 */
export function validateResolvedPlugin(resolved: ResolvedPlugin): string[] {
  const errors: string[] = [];

  // Create lookup maps for validation
  const agentNames = new Set(resolved.agents.map((a) => a.name));
  const skillNames = new Set(resolved.skills.map((s) => s.name));
  const ruleNames = new Set(resolved.rules.map((r) => r.name));

  // Validate agent skill/rule references
  for (const agent of resolved.agents) {
    if (agent.skillRefs) {
      for (const skillRef of agent.skillRefs) {
        if (!skillNames.has(skillRef)) {
          errors.push(`Agent '${agent.name}' references unknown skill '${skillRef}'`);
        }
      }
    }
    if (agent.ruleRefs) {
      for (const ruleRef of agent.ruleRefs) {
        if (!ruleNames.has(ruleRef)) {
          errors.push(`Agent '${agent.name}' references unknown rule '${ruleRef}'`);
        }
      }
    }
  }

  // Validate command agent references
  for (const command of resolved.commands) {
    if (command.invokesAgentRef && !agentNames.has(command.invokesAgentRef)) {
      errors.push(`Command '${command.name}' references unknown agent '${command.invokesAgentRef}'`);
    }
  }

  return errors;
}

/**
 * Get statistics about a resolved plugin
 */
export function getPluginStats(resolved: ResolvedPlugin): Record<string, number> {
  return {
    agents: resolved.agents.length,
    skills: resolved.skills.length,
    rules: resolved.rules.length,
    hooks: resolved.hooks.length,
    mcpServers: resolved.mcpServers.length,
    contexts: resolved.contexts.length,
    commands: resolved.commands.length,
    totalEntities:
      resolved.agents.length +
      resolved.skills.length +
      resolved.rules.length +
      resolved.hooks.length +
      resolved.mcpServers.length +
      resolved.contexts.length +
      resolved.commands.length,
  };
}
