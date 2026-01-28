/**
 * Context Template Generator
 *
 * Generates .claude/contexts/{name}.md files from EccContext entities.
 */

import type { EccContext } from '../ecc-types.js';

/**
 * Generate markdown content for a context file
 */
export function generateContextFile(context: EccContext): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${context.name}`);
  lines.push('');

  // Description
  if (context.description) {
    lines.push(context.description);
    lines.push('');
  }

  // Priority
  if (context.priority !== undefined && context.priority !== 0) {
    lines.push(`**Priority:** ${context.priority}`);
    lines.push('');
  }

  // Applies when
  if (context.applicableWhen) {
    lines.push('## Applies When');
    lines.push('');
    lines.push(context.applicableWhen);
    lines.push('');
  }

  // System prompt override
  if (context.systemPromptOverride) {
    lines.push('## System Prompt Override');
    lines.push('');
    lines.push(context.systemPromptOverride);
    lines.push('');
  }

  // Tool restrictions
  if (context.toolRestrictions) {
    lines.push('## Tool Restrictions');
    lines.push('');

    if (context.toolRestrictions.allow && context.toolRestrictions.allow.length > 0) {
      lines.push('**Allowed:**');
      for (const tool of context.toolRestrictions.allow) {
        lines.push(`- ${tool}`);
      }
      lines.push('');
    }

    if (context.toolRestrictions.deny && context.toolRestrictions.deny.length > 0) {
      lines.push('**Denied:**');
      for (const tool of context.toolRestrictions.deny) {
        lines.push(`- ${tool}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Get the output file path for a context
 */
export function getContextFilePath(context: EccContext): string {
  return `contexts/${context.name}.md`;
}
