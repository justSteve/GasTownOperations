/**
 * Missing Optionals Pressure Tests (Layer 5)
 *
 * Tests graceful handling of entities with only required fields
 * and various combinations of optional fields being undefined/null.
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateAgentFile } from '../../src/templates/template-agent.ts';
import { generateSkillFile } from '../../src/templates/template-skill.ts';
import { generateRuleFile } from '../../src/templates/template-rule.ts';
import { generateCommandFile } from '../../src/templates/template-command.ts';
import { generateContextFile } from '../../src/templates/template-context.ts';
import { generateHooksJson } from '../../src/templates/template-hooks-json.ts';
import { generateSettingsJson } from '../../src/templates/template-settings-json.ts';
import type {
  EccAgent,
  EccSkill,
  EccRule,
  EccCommand,
  EccContext,
  EccHook,
  EccMcpServer,
  EccPluginSettings,
} from '../../src/ecc-types.ts';

describe('Missing Optional Fields', () => {
  describe('Agent with minimal fields', () => {
    it('generates valid output with only required fields', () => {
      const agent: EccAgent = {
        id: 'min-agent',
        pluginId: 'test',
        name: 'minimal-agent',
      };

      const output = generateAgentFile(agent);

      assert.ok(output.includes('# minimal-agent'));
      assert.ok(!output.includes('## Model'));
      assert.ok(!output.includes('## Role'));
      assert.ok(!output.includes('## Instructions'));
      assert.ok(!output.includes('## Tools'));
      assert.ok(!output.includes('## Skills'));
      assert.ok(!output.includes('## Rules'));
      assert.ok(!output.includes('## Checklist'));
    });

    it('handles undefined optional properties', () => {
      const agent: EccAgent = {
        id: 'undef-agent',
        pluginId: 'test',
        name: 'optionals-unset-agent',
        description: undefined,
        model: undefined,
        instructions: undefined,
        roleDescription: undefined,
        tools: undefined,
        checklistItems: undefined,
        skillRefs: undefined,
        ruleRefs: undefined,
      };

      const output = generateAgentFile(agent);

      assert.ok(output.includes('# optionals-unset-agent'));
      // Should not render the literal string 'undefined'
      const lines = output.split('\n').filter(l => !l.includes('optionals-unset-agent'));
      assert.ok(!lines.some(l => l.includes('undefined')), 'Should not contain undefined in output');
    });

    it('handles empty arrays for tools/refs', () => {
      const agent: EccAgent = {
        id: 'empty-agent',
        pluginId: 'test',
        name: 'empty-arrays-agent',
        tools: [],
        checklistItems: [],
        skillRefs: [],
        ruleRefs: [],
      };

      const output = generateAgentFile(agent);

      assert.ok(!output.includes('## Tools'));
      assert.ok(!output.includes('## Skills'));
      assert.ok(!output.includes('## Rules'));
      assert.ok(!output.includes('## Checklist'));
    });
  });

  describe('Skill with minimal fields', () => {
    it('generates valid output with only required fields', () => {
      const skill: EccSkill = {
        id: 'min-skill',
        pluginId: 'test',
        name: 'minimal-skill',
      };

      const output = generateSkillFile(skill);

      assert.ok(output.includes('# minimal-skill'));
      assert.ok(!output.includes('## Content'));
      assert.ok(!output.includes('## Patterns'));
      assert.ok(!output.includes('## Workflows'));
    });

    it('handles patterns without optional fields', () => {
      const skill: EccSkill = {
        id: 'sparse-skill',
        pluginId: 'test',
        name: 'sparse-pattern-skill',
        patterns: [
          {
            id: 'p1',
            skillId: 'sparse-skill',
            name: 'Sparse Pattern',
            // No description, applicability, or implementation
          },
        ],
      };

      const output = generateSkillFile(skill);

      assert.ok(output.includes('### Sparse Pattern'));
      assert.ok(!output.includes('**When to use:**'));
      assert.ok(!output.includes('**Implementation:**'));
    });

    it('handles workflows without optional fields', () => {
      const skill: EccSkill = {
        id: 'sparse-wf-skill',
        pluginId: 'test',
        name: 'sparse-workflow-skill',
        workflows: [
          {
            id: 'w1',
            skillId: 'sparse-wf-skill',
            name: 'Sparse Workflow',
            // No steps or expectedOutcome
          },
        ],
      };

      const output = generateSkillFile(skill);

      assert.ok(output.includes('### Sparse Workflow'));
      assert.ok(!output.includes('**Steps:**'));
      assert.ok(!output.includes('**Expected Outcome:**'));
    });

    it('handles empty patterns array', () => {
      const skill: EccSkill = {
        id: 'empty-patterns',
        pluginId: 'test',
        name: 'empty-patterns-skill',
        patterns: [],
      };

      const output = generateSkillFile(skill);

      assert.ok(!output.includes('## Patterns'));
    });

    it('handles empty workflows array', () => {
      const skill: EccSkill = {
        id: 'empty-wf',
        pluginId: 'test',
        name: 'empty-workflows-skill',
        workflows: [],
      };

      const output = generateSkillFile(skill);

      assert.ok(!output.includes('## Workflows'));
    });
  });

  describe('Rule with minimal fields', () => {
    it('generates valid output with only required fields', () => {
      const rule: EccRule = {
        id: 'min-rule',
        pluginId: 'test',
        name: 'minimal-rule',
      };

      const output = generateRuleFile(rule);

      assert.ok(output.includes('# minimal-rule'));
      assert.ok(!output.includes('**Severity:**'));
      assert.ok(!output.includes('**Category:**'));
      assert.ok(!output.includes('**Applies when:**'));
    });

    it('handles only severity set', () => {
      const rule: EccRule = {
        id: 'sev-rule',
        pluginId: 'test',
        name: 'severity-only-rule',
        severity: 'required',
      };

      const output = generateRuleFile(rule);

      assert.ok(output.includes('**Severity:** required'));
      assert.ok(!output.includes('**Category:**'));
      assert.ok(!output.includes('**Applies when:**'));
    });

    it('handles only category set', () => {
      const rule: EccRule = {
        id: 'cat-rule',
        pluginId: 'test',
        name: 'category-only-rule',
        category: 'testing',
      };

      const output = generateRuleFile(rule);

      assert.ok(output.includes('**Category:** testing'));
      assert.ok(!output.includes('**Severity:**'));
      assert.ok(!output.includes('**Applies when:**'));
    });
  });

  describe('Command with minimal fields', () => {
    it('generates valid output with only required fields', () => {
      const command: EccCommand = {
        id: 'min-cmd',
        pluginId: 'test',
        name: 'minimal-command',
      };

      const output = generateCommandFile(command);

      assert.ok(output.includes('# /minimal-command'));
      assert.ok(!output.includes('## Allowed Tools'));
      assert.ok(!output.includes('## Delegates To'));
      assert.ok(!output.includes('## Options'));
      assert.ok(!output.includes('## Content'));
      assert.ok(!output.includes('## Phases'));
    });

    it('handles empty phases array', () => {
      const command: EccCommand = {
        id: 'empty-phases',
        pluginId: 'test',
        name: 'empty-phases-command',
        phases: [],
      };

      const output = generateCommandFile(command);

      assert.ok(!output.includes('## Phases'));
    });

    it('handles phases without optional fields', () => {
      const command: EccCommand = {
        id: 'sparse-phase-cmd',
        pluginId: 'test',
        name: 'sparse-phase-command',
        phases: [
          {
            id: 'p1',
            commandId: 'sparse-phase-cmd',
            number: 1,
            // No name, description, or steps
          },
        ],
      };

      const output = generateCommandFile(command);

      assert.ok(output.includes('### Phase 1'));
      // Phase 1 followed by newline, not colon
      assert.ok(output.includes('### Phase 1\n'));
    });

    it('handles waitForConfirmation when false', () => {
      const command: EccCommand = {
        id: 'no-confirm-cmd',
        pluginId: 'test',
        name: 'no-confirm-command',
        waitForConfirmation: false,
      };

      const output = generateCommandFile(command);

      assert.ok(!output.includes('## Options'));
      assert.ok(!output.includes('confirmation'));
    });
  });

  describe('Context with minimal fields', () => {
    it('generates valid output with only required fields', () => {
      const context: EccContext = {
        id: 'min-ctx',
        pluginId: 'test',
        name: 'minimal-context',
      };

      const output = generateContextFile(context);

      assert.ok(output.includes('# minimal-context'));
      assert.ok(!output.includes('**Priority:**'));
      assert.ok(!output.includes('## Applies When'));
      assert.ok(!output.includes('## System Prompt Override'));
      assert.ok(!output.includes('## Tool Restrictions'));
    });

    it('handles empty toolRestrictions object', () => {
      const context: EccContext = {
        id: 'empty-restrict',
        pluginId: 'test',
        name: 'empty-restrictions-context',
        toolRestrictions: {},
      };

      const output = generateContextFile(context);

      assert.ok(!output.includes('**Allowed:**'));
      assert.ok(!output.includes('**Denied:**'));
    });

    it('handles empty allow array', () => {
      const context: EccContext = {
        id: 'empty-allow',
        pluginId: 'test',
        name: 'empty-allow-context',
        toolRestrictions: {
          allow: [],
        },
      };

      const output = generateContextFile(context);

      assert.ok(!output.includes('**Allowed:**'));
    });

    it('handles empty deny array', () => {
      const context: EccContext = {
        id: 'empty-deny',
        pluginId: 'test',
        name: 'empty-deny-context',
        toolRestrictions: {
          deny: [],
        },
      };

      const output = generateContextFile(context);

      assert.ok(!output.includes('**Denied:**'));
    });
  });

  describe('Hook with minimal fields', () => {
    it('generates valid JSON with minimal hook', () => {
      const hooks: EccHook[] = [
        {
          id: 'min-hook',
          pluginId: 'test',
          name: 'minimal-hook',
          eventType: 'PreToolUse',
        },
      ];

      const output = generateHooksJson(hooks);
      const parsed = JSON.parse(output);

      assert.equal(parsed.hooks.length, 1);
      assert.equal(parsed.hooks[0].name, 'minimal-hook');
      assert.equal(parsed.hooks[0].event, 'PreToolUse');
      assert.equal(parsed.hooks[0].enabled, true);
      assert.deepEqual(parsed.hooks[0].actions, []);
      assert.ok(!('matcher' in parsed.hooks[0]));
      assert.ok(!('priority' in parsed.hooks[0]));
    });

    it('handles undefined actions', () => {
      const hooks: EccHook[] = [
        {
          id: 'no-actions',
          pluginId: 'test',
          name: 'no-actions-hook',
          eventType: 'SessionStart',
          actions: undefined,
        },
      ];

      const output = generateHooksJson(hooks);
      const parsed = JSON.parse(output);

      assert.deepEqual(parsed.hooks[0].actions, []);
    });

    it('handles empty actions array', () => {
      const hooks: EccHook[] = [
        {
          id: 'empty-actions',
          pluginId: 'test',
          name: 'empty-actions-hook',
          eventType: 'PostToolUse',
          actions: [],
        },
      ];

      const output = generateHooksJson(hooks);
      const parsed = JSON.parse(output);

      assert.deepEqual(parsed.hooks[0].actions, []);
    });
  });

  describe('MCP Server with minimal fields', () => {
    it('generates valid JSON with minimal server', () => {
      const servers: EccMcpServer[] = [
        {
          id: 'min-server',
          pluginId: 'test',
          name: 'minimal-server',
        },
      ];

      const output = generateSettingsJson(servers);
      const parsed = JSON.parse(output);

      assert.ok('mcpServers' in parsed);
      assert.ok('minimal-server' in parsed.mcpServers);
      // Should be empty object since no optional fields set
      assert.deepEqual(parsed.mcpServers['minimal-server'], {});
    });

    it('handles undefined settings', () => {
      const servers: EccMcpServer[] = [];

      const output = generateSettingsJson(servers, undefined);
      const parsed = JSON.parse(output);

      assert.deepEqual(parsed, {});
    });

    it('handles settings with empty permission arrays', () => {
      const servers: EccMcpServer[] = [];
      const settings: EccPluginSettings = {
        id: 'empty-perms',
        pluginId: 'test',
        allowedPermissions: [],
        deniedPermissions: [],
      };

      const output = generateSettingsJson(servers, settings);
      const parsed = JSON.parse(output);

      assert.ok(!('permissions' in parsed));
    });

    it('handles settings with only allowed permissions', () => {
      const servers: EccMcpServer[] = [];
      const settings: EccPluginSettings = {
        id: 'allow-only',
        pluginId: 'test',
        allowedPermissions: ['read'],
        deniedPermissions: [],
      };

      const output = generateSettingsJson(servers, settings);
      const parsed = JSON.parse(output);

      assert.ok('permissions' in parsed);
      assert.deepEqual(parsed.permissions.allow, ['read']);
      assert.ok(!('deny' in parsed.permissions));
    });

    it('handles settings with only denied permissions', () => {
      const servers: EccMcpServer[] = [];
      const settings: EccPluginSettings = {
        id: 'deny-only',
        pluginId: 'test',
        allowedPermissions: [],
        deniedPermissions: ['execute'],
      };

      const output = generateSettingsJson(servers, settings);
      const parsed = JSON.parse(output);

      assert.ok('permissions' in parsed);
      assert.ok(!('allow' in parsed.permissions));
      assert.deepEqual(parsed.permissions.deny, ['execute']);
    });
  });

  describe('Combined minimal entities', () => {
    it('generates output for all entity types with minimal fields', () => {
      // Agent
      const agentOutput = generateAgentFile({
        id: 'a1', pluginId: 'test', name: 'test-agent',
      });
      assert.ok(agentOutput.length > 0);

      // Skill
      const skillOutput = generateSkillFile({
        id: 's1', pluginId: 'test', name: 'test-skill',
      });
      assert.ok(skillOutput.length > 0);

      // Rule
      const ruleOutput = generateRuleFile({
        id: 'r1', pluginId: 'test', name: 'test-rule',
      });
      assert.ok(ruleOutput.length > 0);

      // Command
      const commandOutput = generateCommandFile({
        id: 'c1', pluginId: 'test', name: 'test-command',
      });
      assert.ok(commandOutput.length > 0);

      // Context
      const contextOutput = generateContextFile({
        id: 'ctx1', pluginId: 'test', name: 'test-context',
      });
      assert.ok(contextOutput.length > 0);

      // Hooks
      const hooksOutput = generateHooksJson([]);
      const hooksParsed = JSON.parse(hooksOutput);
      assert.deepEqual(hooksParsed, { hooks: [] });

      // Settings
      const settingsOutput = generateSettingsJson([]);
      const settingsParsed = JSON.parse(settingsOutput);
      assert.deepEqual(settingsParsed, {});
    });
  });
});
