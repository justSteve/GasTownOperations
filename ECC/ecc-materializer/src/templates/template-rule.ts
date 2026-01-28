/**
 * Rule Template Generator
 *
 * Generates .claude/rules/{name}.md files from EccRule entities.
 */

import type { EccRule } from '../ecc-types.js';

/**
 * Generate markdown content for a rule file
 */
export function generateRuleFile(rule: EccRule): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${rule.title ?? rule.name}`);
  lines.push('');

  // Metadata
  const metadata: string[] = [];
  if (rule.severity) {
    metadata.push(`**Severity:** ${rule.severity}`);
  }
  if (rule.category) {
    metadata.push(`**Category:** ${rule.category}`);
  }
  if (rule.applicability) {
    metadata.push(`**Applies when:** ${rule.applicability}`);
  }

  if (metadata.length > 0) {
    lines.push(...metadata);
    lines.push('');
  }

  // Main content
  if (rule.content) {
    lines.push(rule.content);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get the output file path for a rule
 */
export function getRuleFilePath(rule: EccRule): string {
  return `rules/${rule.name}.md`;
}
