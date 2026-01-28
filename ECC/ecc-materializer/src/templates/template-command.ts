/**
 * Command Template Generator
 *
 * Generates .claude/commands/{name}.md files from EccCommand entities.
 */

import type { EccCommand } from '../ecc-types.js';

/**
 * Generate markdown content for a command file
 */
export function generateCommandFile(command: EccCommand): string {
  const lines: string[] = [];

  // Header with slash prefix
  lines.push(`# /${command.name}`);
  lines.push('');

  // Description
  if (command.description) {
    lines.push(command.description);
    lines.push('');
  }

  // Allowed tools
  if (command.allowedTools && command.allowedTools.length > 0) {
    lines.push('## Allowed Tools');
    for (const tool of command.allowedTools) {
      lines.push(`- ${tool}`);
    }
    lines.push('');
  }

  // Invokes agent
  if (command.invokesAgentRef) {
    lines.push('## Delegates To');
    lines.push(`Agent: ${command.invokesAgentRef}`);
    lines.push('');
  }

  // Wait for confirmation
  if (command.waitForConfirmation) {
    lines.push('## Options');
    lines.push('- Wait for user confirmation before executing');
    lines.push('');
  }

  // Content (the main command prompt)
  if (command.content) {
    lines.push('## Content');
    lines.push('');
    lines.push(command.content);
    lines.push('');
  }

  // Phases (multi-step commands)
  if (command.phases && command.phases.length > 0) {
    lines.push('## Phases');
    lines.push('');

    // Sort by phase number
    const sorted = [...command.phases].sort((a, b) => a.number - b.number);

    for (const phase of sorted) {
      const phaseName = phase.name ? `: ${phase.name}` : '';
      lines.push(`### Phase ${phase.number}${phaseName}`);
      lines.push('');

      if (phase.description) {
        lines.push(phase.description);
        lines.push('');
      }

      if (phase.steps && phase.steps.length > 0) {
        lines.push('**Steps:**');
        for (let i = 0; i < phase.steps.length; i++) {
          lines.push(`${i + 1}. ${phase.steps[i]}`);
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

/**
 * Get the output file path for a command
 */
export function getCommandFilePath(command: EccCommand): string {
  return `commands/${command.name}.md`;
}
