/**
 * Agent Template Generator
 *
 * Generates .claude/agents/{name}.md files from EccAgent entities.
 */

import type { EccAgent } from '../ecc-types.js';

/**
 * Generate markdown content for an agent file
 */
export function generateAgentFile(agent: EccAgent): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${agent.name}`);
  lines.push('');

  // Description
  if (agent.description) {
    lines.push(agent.description);
    lines.push('');
  }

  // Model
  if (agent.model) {
    lines.push('## Model');
    lines.push(agent.model);
    lines.push('');
  }

  // Role
  if (agent.roleDescription) {
    lines.push('## Role');
    lines.push(agent.roleDescription);
    lines.push('');
  }

  // Instructions
  if (agent.instructions) {
    lines.push('## Instructions');
    lines.push(agent.instructions);
    lines.push('');
  }

  // Tools
  if (agent.tools && agent.tools.length > 0) {
    lines.push('## Tools');
    for (const tool of agent.tools) {
      lines.push(`- ${tool}`);
    }
    lines.push('');
  }

  // Skill references
  if (agent.skillRefs && agent.skillRefs.length > 0) {
    lines.push('## Skills');
    for (const skill of agent.skillRefs) {
      lines.push(`- ${skill}`);
    }
    lines.push('');
  }

  // Rule references
  if (agent.ruleRefs && agent.ruleRefs.length > 0) {
    lines.push('## Rules');
    for (const rule of agent.ruleRefs) {
      lines.push(`- ${rule}`);
    }
    lines.push('');
  }

  // Checklist items
  if (agent.checklistItems && agent.checklistItems.length > 0) {
    lines.push('## Checklist');
    // Sort by itemOrder
    const sorted = [...agent.checklistItems].sort((a, b) => (a.itemOrder ?? 0) - (b.itemOrder ?? 0));
    for (const item of sorted) {
      const priority = item.priority ? ` (${item.priority})` : '';
      lines.push(`- [ ] ${item.item}${priority}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get the output file path for an agent
 */
export function getAgentFilePath(agent: EccAgent): string {
  return `agents/${agent.name}.md`;
}
