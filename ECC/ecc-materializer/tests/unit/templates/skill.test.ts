/**
 * Skill Template Unit Tests (Layer 2)
 *
 * Tests the generateSkillFile template generator.
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateSkillFile, getSkillFilePath } from '../../../src/templates/template-skill.ts';
import type { EccSkill } from '../../../src/ecc-types.ts';

describe('Skill Template', () => {
  describe('generateSkillFile', () => {
    it('generates minimal skill', () => {
      const skill: EccSkill = {
        id: 'test-skill',
        pluginId: 'test-plugin',
        name: 'minimal-skill',
      };

      const output = generateSkillFile(skill);

      assert.ok(output.includes('# minimal-skill'));
    });

    it('uses title when provided', () => {
      const skill: EccSkill = {
        id: 'test-skill',
        pluginId: 'test-plugin',
        name: 'skill-name',
        title: 'Skill Display Title',
      };

      const output = generateSkillFile(skill);

      assert.ok(output.includes('# Skill Display Title'));
      assert.ok(!output.includes('# skill-name'));
    });

    it('generates skill with description', () => {
      const skill: EccSkill = {
        id: 'test-skill',
        pluginId: 'test-plugin',
        name: 'described-skill',
        description: 'A detailed skill description',
      };

      const output = generateSkillFile(skill);

      assert.ok(output.includes('A detailed skill description'));
    });

    it('generates skill with content', () => {
      const skill: EccSkill = {
        id: 'test-skill',
        pluginId: 'test-plugin',
        name: 'content-skill',
        content: 'This is the main skill content.\n\nWith multiple paragraphs.',
      };

      const output = generateSkillFile(skill);

      assert.ok(output.includes('## Content'));
      assert.ok(output.includes('This is the main skill content.'));
      assert.ok(output.includes('With multiple paragraphs.'));
    });

    it('generates skill with patterns', () => {
      const skill: EccSkill = {
        id: 'test-skill',
        pluginId: 'test-plugin',
        name: 'pattern-skill',
        patterns: [
          {
            id: 'pat1',
            skillId: 'test-skill',
            name: 'First Pattern',
            description: 'Pattern description',
            applicability: 'When to use this',
            implementation: 'How to implement',
          },
        ],
      };

      const output = generateSkillFile(skill);

      assert.ok(output.includes('## Patterns'));
      assert.ok(output.includes('### First Pattern'));
      assert.ok(output.includes('Pattern description'));
      assert.ok(output.includes('**When to use:**'));
      assert.ok(output.includes('When to use this'));
      assert.ok(output.includes('**Implementation:**'));
      assert.ok(output.includes('How to implement'));
    });

    it('generates skill with multiple patterns', () => {
      const skill: EccSkill = {
        id: 'test-skill',
        pluginId: 'test-plugin',
        name: 'multi-pattern-skill',
        patterns: [
          { id: 'p1', skillId: 'test-skill', name: 'Pattern One' },
          { id: 'p2', skillId: 'test-skill', name: 'Pattern Two' },
        ],
      };

      const output = generateSkillFile(skill);

      assert.ok(output.includes('### Pattern One'));
      assert.ok(output.includes('### Pattern Two'));
    });

    it('generates skill with workflows', () => {
      const skill: EccSkill = {
        id: 'test-skill',
        pluginId: 'test-plugin',
        name: 'workflow-skill',
        workflows: [
          {
            id: 'wf1',
            skillId: 'test-skill',
            name: 'Main Workflow',
            steps: ['First step', 'Second step', 'Third step'],
            expectedOutcome: 'Everything works',
          },
        ],
      };

      const output = generateSkillFile(skill);

      assert.ok(output.includes('## Workflows'));
      assert.ok(output.includes('### Main Workflow'));
      assert.ok(output.includes('**Steps:**'));
      assert.ok(output.includes('1. First step'));
      assert.ok(output.includes('2. Second step'));
      assert.ok(output.includes('3. Third step'));
      assert.ok(output.includes('**Expected Outcome:**'));
      assert.ok(output.includes('Everything works'));
    });

    it('generates skill with multiple workflows', () => {
      const skill: EccSkill = {
        id: 'test-skill',
        pluginId: 'test-plugin',
        name: 'multi-workflow-skill',
        workflows: [
          { id: 'w1', skillId: 'test-skill', name: 'Workflow A' },
          { id: 'w2', skillId: 'test-skill', name: 'Workflow B' },
        ],
      };

      const output = generateSkillFile(skill);

      assert.ok(output.includes('### Workflow A'));
      assert.ok(output.includes('### Workflow B'));
    });

    it('generates fully populated skill', () => {
      const skill: EccSkill = {
        id: 'full-skill',
        pluginId: 'test-plugin',
        name: 'full-skill',
        title: 'Complete Skill',
        description: 'A fully populated skill',
        content: 'Main content here',
        category: 'testing',
        patterns: [
          {
            id: 'p1',
            skillId: 'full-skill',
            name: 'Test Pattern',
            description: 'Pattern desc',
            applicability: 'When to use',
            implementation: 'How to do',
          },
        ],
        workflows: [
          {
            id: 'w1',
            skillId: 'full-skill',
            name: 'Test Workflow',
            steps: ['Step 1'],
            expectedOutcome: 'Success',
          },
        ],
      };

      const output = generateSkillFile(skill);

      assert.ok(output.includes('# Complete Skill'));
      assert.ok(output.includes('A fully populated skill'));
      assert.ok(output.includes('## Content'));
      assert.ok(output.includes('## Patterns'));
      assert.ok(output.includes('## Workflows'));
    });
  });

  describe('getSkillFilePath', () => {
    it('generates path for skill without category', () => {
      const skill: EccSkill = {
        id: 'test',
        pluginId: 'plugin',
        name: 'my-skill',
      };

      const path = getSkillFilePath(skill);

      assert.equal(path, 'skills/my-skill/SKILL.md');
    });

    it('generates path for skill with category', () => {
      const skill: EccSkill = {
        id: 'test',
        pluginId: 'plugin',
        name: 'my-skill',
        category: 'utilities',
      };

      const path = getSkillFilePath(skill);

      assert.equal(path, 'skills/utilities/my-skill/SKILL.md');
    });

    it('generates path for skill with deep category', () => {
      const skill: EccSkill = {
        id: 'test',
        pluginId: 'plugin',
        name: 'deep-skill',
        category: 'category/subcategory/deep',
      };

      const path = getSkillFilePath(skill);

      assert.equal(path, 'skills/category/subcategory/deep/deep-skill/SKILL.md');
    });
  });
});
