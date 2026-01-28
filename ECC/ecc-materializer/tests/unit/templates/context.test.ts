/**
 * Context Template Unit Tests (Layer 2)
 *
 * Tests the generateContextFile template generator.
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateContextFile, getContextFilePath } from '../../../src/templates/template-context.ts';
import type { EccContext } from '../../../src/ecc-types.ts';

describe('Context Template', () => {
  describe('generateContextFile', () => {
    it('generates minimal context', () => {
      const context: EccContext = {
        id: 'test-context',
        pluginId: 'test-plugin',
        name: 'minimal-context',
      };

      const output = generateContextFile(context);

      assert.ok(output.includes('# minimal-context'));
    });

    it('generates context with description', () => {
      const context: EccContext = {
        id: 'test-context',
        pluginId: 'test-plugin',
        name: 'described-context',
        description: 'A context for testing purposes',
      };

      const output = generateContextFile(context);

      assert.ok(output.includes('A context for testing purposes'));
    });

    it('generates context with non-zero priority', () => {
      const context: EccContext = {
        id: 'test-context',
        pluginId: 'test-plugin',
        name: 'priority-context',
        priority: 10,
      };

      const output = generateContextFile(context);

      assert.ok(output.includes('**Priority:** 10'));
    });

    it('does not show priority when zero', () => {
      const context: EccContext = {
        id: 'test-context',
        pluginId: 'test-plugin',
        name: 'zero-priority',
        priority: 0,
      };

      const output = generateContextFile(context);

      assert.ok(!output.includes('**Priority:**'));
    });

    it('generates context with applicableWhen', () => {
      const context: EccContext = {
        id: 'test-context',
        pluginId: 'test-plugin',
        name: 'applicable-context',
        applicableWhen: 'Working on test files',
      };

      const output = generateContextFile(context);

      assert.ok(output.includes('## Applies When'));
      assert.ok(output.includes('Working on test files'));
    });

    it('generates context with system prompt override', () => {
      const context: EccContext = {
        id: 'test-context',
        pluginId: 'test-plugin',
        name: 'override-context',
        systemPromptOverride: 'You are in a special mode.\n\nBe extra careful.',
      };

      const output = generateContextFile(context);

      assert.ok(output.includes('## System Prompt Override'));
      assert.ok(output.includes('You are in a special mode.'));
      assert.ok(output.includes('Be extra careful.'));
    });

    it('generates context with allow-only tool restrictions', () => {
      const context: EccContext = {
        id: 'test-context',
        pluginId: 'test-plugin',
        name: 'allow-context',
        toolRestrictions: {
          allow: ['Read', 'Grep', 'Glob'],
        },
      };

      const output = generateContextFile(context);

      assert.ok(output.includes('## Tool Restrictions'));
      assert.ok(output.includes('**Allowed:**'));
      assert.ok(output.includes('- Read'));
      assert.ok(output.includes('- Grep'));
      assert.ok(output.includes('- Glob'));
      assert.ok(!output.includes('**Denied:**'));
    });

    it('generates context with deny-only tool restrictions', () => {
      const context: EccContext = {
        id: 'test-context',
        pluginId: 'test-plugin',
        name: 'deny-context',
        toolRestrictions: {
          deny: ['Bash', 'Write'],
        },
      };

      const output = generateContextFile(context);

      assert.ok(output.includes('## Tool Restrictions'));
      assert.ok(!output.includes('**Allowed:**'));
      assert.ok(output.includes('**Denied:**'));
      assert.ok(output.includes('- Bash'));
      assert.ok(output.includes('- Write'));
    });

    it('generates context with both allow and deny restrictions', () => {
      const context: EccContext = {
        id: 'test-context',
        pluginId: 'test-plugin',
        name: 'mixed-context',
        toolRestrictions: {
          allow: ['Read'],
          deny: ['Bash'],
        },
      };

      const output = generateContextFile(context);

      assert.ok(output.includes('**Allowed:**'));
      assert.ok(output.includes('- Read'));
      assert.ok(output.includes('**Denied:**'));
      assert.ok(output.includes('- Bash'));
    });

    it('handles empty tool restrictions', () => {
      const context: EccContext = {
        id: 'test-context',
        pluginId: 'test-plugin',
        name: 'empty-restrictions',
        toolRestrictions: {},
      };

      const output = generateContextFile(context);

      // Should not show Tool Restrictions section if both are empty
      assert.ok(!output.includes('**Allowed:**'));
      assert.ok(!output.includes('**Denied:**'));
    });

    it('generates fully populated context', () => {
      const context: EccContext = {
        id: 'full-context',
        pluginId: 'test-plugin',
        name: 'full-context',
        description: 'A complete context',
        systemPromptOverride: 'Override prompt',
        applicableWhen: 'Always',
        priority: 5,
        toolRestrictions: {
          allow: ['Read'],
          deny: ['Bash'],
        },
      };

      const output = generateContextFile(context);

      assert.ok(output.includes('# full-context'));
      assert.ok(output.includes('A complete context'));
      assert.ok(output.includes('**Priority:** 5'));
      assert.ok(output.includes('## Applies When'));
      assert.ok(output.includes('## System Prompt Override'));
      assert.ok(output.includes('## Tool Restrictions'));
    });
  });

  describe('getContextFilePath', () => {
    it('generates correct path for context', () => {
      const context: EccContext = {
        id: 'test',
        pluginId: 'plugin',
        name: 'my-context',
      };

      const path = getContextFilePath(context);

      assert.equal(path, 'contexts/my-context.md');
    });
  });
});
