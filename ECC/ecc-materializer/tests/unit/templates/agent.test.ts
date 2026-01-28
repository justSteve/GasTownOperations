/**
 * Agent Template Unit Tests (Layer 2)
 *
 * Tests the generateAgentFile template generator.
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateAgentFile, getAgentFilePath } from '../../../src/templates/template-agent.ts';
import type { EccAgent } from '../../../src/ecc-types.ts';

describe('Agent Template', () => {
  describe('generateAgentFile', () => {
    it('generates minimal agent with required fields only', () => {
      const agent: EccAgent = {
        id: 'test-agent',
        pluginId: 'test-plugin',
        name: 'minimal-agent',
      };

      const output = generateAgentFile(agent);

      assert.ok(output.includes('# minimal-agent'), 'Should have name as heading');
      assert.ok(!output.includes('## Model'), 'Should not have Model section');
      assert.ok(!output.includes('## Instructions'), 'Should not have Instructions section');
    });

    it('generates agent with description', () => {
      const agent: EccAgent = {
        id: 'test-agent',
        pluginId: 'test-plugin',
        name: 'described-agent',
        description: 'This is a test agent description',
      };

      const output = generateAgentFile(agent);

      assert.ok(output.includes('# described-agent'));
      assert.ok(output.includes('This is a test agent description'));
    });

    it('generates agent with model', () => {
      const agent: EccAgent = {
        id: 'test-agent',
        pluginId: 'test-plugin',
        name: 'model-agent',
        model: 'sonnet',
      };

      const output = generateAgentFile(agent);

      assert.ok(output.includes('## Model'));
      assert.ok(output.includes('sonnet'));
    });

    it('generates agent with role description', () => {
      const agent: EccAgent = {
        id: 'test-agent',
        pluginId: 'test-plugin',
        name: 'role-agent',
        roleDescription: 'A specialized role for testing',
      };

      const output = generateAgentFile(agent);

      assert.ok(output.includes('## Role'));
      assert.ok(output.includes('A specialized role for testing'));
    });

    it('generates agent with instructions', () => {
      const agent: EccAgent = {
        id: 'test-agent',
        pluginId: 'test-plugin',
        name: 'instructed-agent',
        instructions: 'Follow these steps:\n1. Step one\n2. Step two',
      };

      const output = generateAgentFile(agent);

      assert.ok(output.includes('## Instructions'));
      assert.ok(output.includes('Follow these steps:'));
      assert.ok(output.includes('1. Step one'));
    });

    it('generates agent with tools list', () => {
      const agent: EccAgent = {
        id: 'test-agent',
        pluginId: 'test-plugin',
        name: 'tooled-agent',
        tools: ['Read', 'Write', 'Bash'],
      };

      const output = generateAgentFile(agent);

      assert.ok(output.includes('## Tools'));
      assert.ok(output.includes('- Read'));
      assert.ok(output.includes('- Write'));
      assert.ok(output.includes('- Bash'));
    });

    it('generates agent with skill references', () => {
      const agent: EccAgent = {
        id: 'test-agent',
        pluginId: 'test-plugin',
        name: 'skilled-agent',
        skillRefs: ['skill-one', 'skill-two'],
      };

      const output = generateAgentFile(agent);

      assert.ok(output.includes('## Skills'));
      assert.ok(output.includes('- skill-one'));
      assert.ok(output.includes('- skill-two'));
    });

    it('generates agent with rule references', () => {
      const agent: EccAgent = {
        id: 'test-agent',
        pluginId: 'test-plugin',
        name: 'ruled-agent',
        ruleRefs: ['rule-one', 'rule-two'],
      };

      const output = generateAgentFile(agent);

      assert.ok(output.includes('## Rules'));
      assert.ok(output.includes('- rule-one'));
      assert.ok(output.includes('- rule-two'));
    });

    it('generates agent with checklist items in correct order', () => {
      const agent: EccAgent = {
        id: 'test-agent',
        pluginId: 'test-plugin',
        name: 'checklist-agent',
        checklistItems: [
          { id: 'c3', agentId: 'test-agent', item: 'Third item', itemOrder: 3 },
          { id: 'c1', agentId: 'test-agent', item: 'First item', itemOrder: 1 },
          { id: 'c2', agentId: 'test-agent', item: 'Second item', itemOrder: 2 },
        ],
      };

      const output = generateAgentFile(agent);

      assert.ok(output.includes('## Checklist'));
      assert.ok(output.includes('- [ ] First item'));
      assert.ok(output.includes('- [ ] Second item'));
      assert.ok(output.includes('- [ ] Third item'));

      // Verify order
      const firstIdx = output.indexOf('First item');
      const secondIdx = output.indexOf('Second item');
      const thirdIdx = output.indexOf('Third item');
      assert.ok(firstIdx < secondIdx, 'First should come before Second');
      assert.ok(secondIdx < thirdIdx, 'Second should come before Third');
    });

    it('generates checklist items with priority annotations', () => {
      const agent: EccAgent = {
        id: 'test-agent',
        pluginId: 'test-plugin',
        name: 'priority-agent',
        checklistItems: [
          { id: 'c1', agentId: 'test-agent', item: 'Required item', priority: 'required', itemOrder: 1 },
          { id: 'c2', agentId: 'test-agent', item: 'Recommended item', priority: 'recommended', itemOrder: 2 },
        ],
      };

      const output = generateAgentFile(agent);

      assert.ok(output.includes('- [ ] Required item (required)'));
      assert.ok(output.includes('- [ ] Recommended item (recommended)'));
    });

    it('generates fully populated agent', () => {
      const agent: EccAgent = {
        id: 'full-agent',
        pluginId: 'test-plugin',
        name: 'full-agent',
        description: 'A complete agent',
        model: 'opus',
        instructions: 'Do everything well',
        roleDescription: 'The ultimate agent',
        tools: ['Read', 'Write'],
        skillRefs: ['skill-1'],
        ruleRefs: ['rule-1'],
        checklistItems: [
          { id: 'c1', agentId: 'full-agent', item: 'Check', priority: 'required', itemOrder: 1 },
        ],
      };

      const output = generateAgentFile(agent);

      // Verify all sections present
      assert.ok(output.includes('# full-agent'));
      assert.ok(output.includes('A complete agent'));
      assert.ok(output.includes('## Model'));
      assert.ok(output.includes('## Role'));
      assert.ok(output.includes('## Instructions'));
      assert.ok(output.includes('## Tools'));
      assert.ok(output.includes('## Skills'));
      assert.ok(output.includes('## Rules'));
      assert.ok(output.includes('## Checklist'));
    });
  });

  describe('getAgentFilePath', () => {
    it('generates correct path for agent', () => {
      const agent: EccAgent = {
        id: 'test',
        pluginId: 'plugin',
        name: 'my-agent',
      };

      const path = getAgentFilePath(agent);

      assert.equal(path, 'agents/my-agent.md');
    });

    it('handles agent names with special characters', () => {
      const agent: EccAgent = {
        id: 'test',
        pluginId: 'plugin',
        name: 'my-special_agent',
      };

      const path = getAgentFilePath(agent);

      assert.equal(path, 'agents/my-special_agent.md');
    });
  });
});
