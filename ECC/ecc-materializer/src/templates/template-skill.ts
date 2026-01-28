/**
 * Skill Template Generator
 *
 * Generates .claude/skills/{category}/{name}/SKILL.md files from EccSkill entities.
 */

import type { EccSkill } from '../ecc-types.js';

/**
 * Generate markdown content for a skill file
 */
export function generateSkillFile(skill: EccSkill): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${skill.title ?? skill.name}`);
  lines.push('');

  // Description
  if (skill.description) {
    lines.push(skill.description);
    lines.push('');
  }

  // Main content
  if (skill.content) {
    lines.push('## Content');
    lines.push('');
    lines.push(skill.content);
    lines.push('');
  }

  // Patterns
  if (skill.patterns && skill.patterns.length > 0) {
    lines.push('## Patterns');
    lines.push('');

    for (const pattern of skill.patterns) {
      lines.push(`### ${pattern.name}`);
      lines.push('');

      if (pattern.description) {
        lines.push(pattern.description);
        lines.push('');
      }

      if (pattern.applicability) {
        lines.push('**When to use:**');
        lines.push(pattern.applicability);
        lines.push('');
      }

      if (pattern.implementation) {
        lines.push('**Implementation:**');
        lines.push(pattern.implementation);
        lines.push('');
      }
    }
  }

  // Workflows
  if (skill.workflows && skill.workflows.length > 0) {
    lines.push('## Workflows');
    lines.push('');

    for (const workflow of skill.workflows) {
      lines.push(`### ${workflow.name}`);
      lines.push('');

      if (workflow.steps && workflow.steps.length > 0) {
        lines.push('**Steps:**');
        for (let i = 0; i < workflow.steps.length; i++) {
          lines.push(`${i + 1}. ${workflow.steps[i]}`);
        }
        lines.push('');
      }

      if (workflow.expectedOutcome) {
        lines.push('**Expected Outcome:**');
        lines.push(workflow.expectedOutcome);
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

/**
 * Get the output file path for a skill
 *
 * Skills use hierarchical folder structure based on category.
 */
export function getSkillFilePath(skill: EccSkill): string {
  if (skill.category) {
    return `skills/${skill.category}/${skill.name}/SKILL.md`;
  }
  return `skills/${skill.name}/SKILL.md`;
}
