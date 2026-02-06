/**
 * SubAgent Template Generator
 *
 * Generates .claude/agents/{name}.md files from EccSubAgent entities.
 * SubAgents use YAML frontmatter to configure context mode and allowed tools.
 */

import type { EccSubAgent } from '../ecc-types.js';

/**
 * Generate YAML frontmatter for a sub-agent file
 */
function generateFrontmatter(subAgent: EccSubAgent): string {
  const lines: string[] = ['---'];

  // Context mode (required)
  lines.push(`contextMode: ${subAgent.contextMode}`);

  // Allowed tools (optional)
  if (subAgent.allowedTools && subAgent.allowedTools.length > 0) {
    lines.push('allowedTools:');
    for (const tool of subAgent.allowedTools) {
      lines.push(`  - ${tool}`);
    }
  }

  // Additional frontmatter config (optional)
  if (subAgent.frontmatterConfig) {
    for (const [key, value] of Object.entries(subAgent.frontmatterConfig)) {
      if (typeof value === 'string') {
        lines.push(`${key}: ${value}`);
      } else if (Array.isArray(value)) {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${item}`);
        }
      } else if (typeof value === 'object' && value !== null) {
        lines.push(`${key}:`);
        for (const [subKey, subValue] of Object.entries(value)) {
          lines.push(`  ${subKey}: ${subValue}`);
        }
      } else if (typeof value === 'boolean' || typeof value === 'number') {
        lines.push(`${key}: ${value}`);
      }
    }
  }

  lines.push('---');
  return lines.join('\n');
}

/**
 * Generate markdown content for a sub-agent file
 */
export function generateSubAgentFile(subAgent: EccSubAgent): string {
  const lines: string[] = [];

  // YAML frontmatter
  lines.push(generateFrontmatter(subAgent));
  lines.push('');

  // Header
  lines.push(`# ${subAgent.name}`);
  lines.push('');

  // Description
  if (subAgent.description) {
    lines.push(subAgent.description);
    lines.push('');
  }

  // Instructions
  if (subAgent.instructions) {
    lines.push('## Instructions');
    lines.push('');
    lines.push(subAgent.instructions);
    lines.push('');
  }

  // Skill references
  if (subAgent.skillRefs && subAgent.skillRefs.length > 0) {
    lines.push('## Skills');
    for (const skill of subAgent.skillRefs) {
      lines.push(`- ${skill}`);
    }
    lines.push('');
  }

  // Hook references (policy islands)
  if (subAgent.hookRefs && subAgent.hookRefs.length > 0) {
    lines.push('## Hooks');
    for (const hook of subAgent.hookRefs) {
      lines.push(`- ${hook}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get the output file path for a sub-agent
 */
export function getSubAgentFilePath(subAgent: EccSubAgent): string {
  return `agents/${subAgent.name}.md`;
}
