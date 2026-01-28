/**
 * Hooks Template Unit Tests (Layer 2)
 *
 * Tests the generateHooksJson template generator.
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateHooksJson, getHooksFilePath } from '../../../src/templates/template-hooks-json.ts';
import type { EccHook } from '../../../src/ecc-types.ts';

describe('Hooks Template', () => {
  describe('generateHooksJson', () => {
    it('generates empty hooks array', () => {
      const hooks: EccHook[] = [];

      const output = generateHooksJson(hooks);
      const parsed = JSON.parse(output);

      assert.deepEqual(parsed, { hooks: [] });
    });

    it('generates single minimal hook', () => {
      const hooks: EccHook[] = [
        {
          id: 'hook1',
          pluginId: 'test-plugin',
          name: 'test-hook',
          eventType: 'PreToolUse',
        },
      ];

      const output = generateHooksJson(hooks);
      const parsed = JSON.parse(output);

      assert.equal(parsed.hooks.length, 1);
      assert.equal(parsed.hooks[0].name, 'test-hook');
      assert.equal(parsed.hooks[0].event, 'PreToolUse');
      assert.equal(parsed.hooks[0].enabled, true);
      assert.deepEqual(parsed.hooks[0].actions, []);
    });

    it('generates hook with matcher', () => {
      const hooks: EccHook[] = [
        {
          id: 'hook1',
          pluginId: 'test-plugin',
          name: 'bash-hook',
          eventType: 'PreToolUse',
          matcher: 'Bash',
        },
      ];

      const output = generateHooksJson(hooks);
      const parsed = JSON.parse(output);

      assert.equal(parsed.hooks[0].matcher, 'Bash');
    });

    it('generates disabled hook', () => {
      const hooks: EccHook[] = [
        {
          id: 'hook1',
          pluginId: 'test-plugin',
          name: 'disabled-hook',
          eventType: 'PreToolUse',
          enabled: false,
        },
      ];

      const output = generateHooksJson(hooks);
      const parsed = JSON.parse(output);

      assert.equal(parsed.hooks[0].enabled, false);
    });

    it('generates hook with non-zero priority', () => {
      const hooks: EccHook[] = [
        {
          id: 'hook1',
          pluginId: 'test-plugin',
          name: 'priority-hook',
          eventType: 'PreToolUse',
          priority: 10,
        },
      ];

      const output = generateHooksJson(hooks);
      const parsed = JSON.parse(output);

      assert.equal(parsed.hooks[0].priority, 10);
    });

    it('does not include priority when zero', () => {
      const hooks: EccHook[] = [
        {
          id: 'hook1',
          pluginId: 'test-plugin',
          name: 'zero-priority',
          eventType: 'PreToolUse',
          priority: 0,
        },
      ];

      const output = generateHooksJson(hooks);
      const parsed = JSON.parse(output);

      assert.ok(!('priority' in parsed.hooks[0]));
    });

    it('generates hook with actions in correct order', () => {
      const hooks: EccHook[] = [
        {
          id: 'hook1',
          pluginId: 'test-plugin',
          name: 'ordered-hook',
          eventType: 'PreToolUse',
          actions: [
            { id: 'a3', hookId: 'hook1', actionType: 'command', command: 'third', actionOrder: 3 },
            { id: 'a1', hookId: 'hook1', actionType: 'command', command: 'first', actionOrder: 1 },
            { id: 'a2', hookId: 'hook1', actionType: 'command', command: 'second', actionOrder: 2 },
          ],
        },
      ];

      const output = generateHooksJson(hooks);
      const parsed = JSON.parse(output);

      assert.equal(parsed.hooks[0].actions.length, 3);
      assert.equal(parsed.hooks[0].actions[0].command, 'first');
      assert.equal(parsed.hooks[0].actions[1].command, 'second');
      assert.equal(parsed.hooks[0].actions[2].command, 'third');
    });

    it('generates hook action with command', () => {
      const hooks: EccHook[] = [
        {
          id: 'hook1',
          pluginId: 'test-plugin',
          name: 'command-hook',
          eventType: 'PreToolUse',
          actions: [
            { id: 'a1', hookId: 'hook1', actionType: 'command', command: 'npm run lint', actionOrder: 1 },
          ],
        },
      ];

      const output = generateHooksJson(hooks);
      const parsed = JSON.parse(output);

      assert.equal(parsed.hooks[0].actions[0].type, 'command');
      assert.equal(parsed.hooks[0].actions[0].command, 'npm run lint');
    });

    it('generates hook action with arguments', () => {
      const hooks: EccHook[] = [
        {
          id: 'hook1',
          pluginId: 'test-plugin',
          name: 'args-hook',
          eventType: 'PreToolUse',
          actions: [
            {
              id: 'a1',
              hookId: 'hook1',
              actionType: 'modify',
              arguments: { key: 'value', flag: true },
              actionOrder: 1,
            },
          ],
        },
      ];

      const output = generateHooksJson(hooks);
      const parsed = JSON.parse(output);

      assert.equal(parsed.hooks[0].actions[0].type, 'modify');
      assert.deepEqual(parsed.hooks[0].actions[0].args, { key: 'value', flag: true });
    });

    it('generates hook action without optional fields', () => {
      const hooks: EccHook[] = [
        {
          id: 'hook1',
          pluginId: 'test-plugin',
          name: 'block-hook',
          eventType: 'PreToolUse',
          actions: [
            { id: 'a1', hookId: 'hook1', actionType: 'block', actionOrder: 1 },
          ],
        },
      ];

      const output = generateHooksJson(hooks);
      const parsed = JSON.parse(output);

      assert.equal(parsed.hooks[0].actions[0].type, 'block');
      assert.ok(!('command' in parsed.hooks[0].actions[0]));
      assert.ok(!('args' in parsed.hooks[0].actions[0]));
    });

    it('generates multiple hooks', () => {
      const hooks: EccHook[] = [
        { id: 'h1', pluginId: 'test-plugin', name: 'hook-one', eventType: 'PreToolUse' },
        { id: 'h2', pluginId: 'test-plugin', name: 'hook-two', eventType: 'PostToolUse' },
        { id: 'h3', pluginId: 'test-plugin', name: 'hook-three', eventType: 'SessionStart' },
      ];

      const output = generateHooksJson(hooks);
      const parsed = JSON.parse(output);

      assert.equal(parsed.hooks.length, 3);
      assert.equal(parsed.hooks[0].name, 'hook-one');
      assert.equal(parsed.hooks[1].name, 'hook-two');
      assert.equal(parsed.hooks[2].name, 'hook-three');
    });

    it('generates valid JSON', () => {
      const hooks: EccHook[] = [
        {
          id: 'full-hook',
          pluginId: 'test-plugin',
          name: 'full-hook',
          eventType: 'PreToolUse',
          matcher: 'Write',
          enabled: true,
          priority: 5,
          actions: [
            { id: 'a1', hookId: 'full-hook', actionType: 'command', command: 'test', actionOrder: 1 },
          ],
        },
      ];

      const output = generateHooksJson(hooks);

      // Should not throw
      const parsed = JSON.parse(output);
      assert.ok(typeof parsed === 'object');
    });

    it('outputs formatted JSON', () => {
      const hooks: EccHook[] = [
        { id: 'h1', pluginId: 'test-plugin', name: 'test', eventType: 'PreToolUse' },
      ];

      const output = generateHooksJson(hooks);

      // Should be pretty-printed with indentation
      assert.ok(output.includes('\n'));
      assert.ok(output.includes('  '));
    });
  });

  describe('getHooksFilePath', () => {
    it('returns correct path', () => {
      const path = getHooksFilePath();
      assert.equal(path, 'hooks/hooks.json');
    });
  });
});
