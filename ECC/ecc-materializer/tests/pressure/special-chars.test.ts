/**
 * Special Characters Pressure Tests (Layer 5)
 *
 * Tests handling of Unicode, special characters, and edge case strings.
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateAgentFile, getAgentFilePath } from '../../src/templates/template-agent.ts';
import { generateSkillFile, getSkillFilePath } from '../../src/templates/template-skill.ts';
import { generateRuleFile } from '../../src/templates/template-rule.ts';
import { generateCommandFile } from '../../src/templates/template-command.ts';
import { generateHooksJson } from '../../src/templates/template-hooks-json.ts';
import { generateSettingsJson } from '../../src/templates/template-settings-json.ts';
import type { EccAgent, EccSkill, EccRule, EccCommand, EccHook, EccMcpServer } from '../../src/ecc-types.ts';

describe('Special Characters Handling', () => {
  describe('Unicode in Names', () => {
    it('preserves Unicode in agent name', () => {
      const agent: EccAgent = {
        id: 'unicode-agent',
        pluginId: 'test',
        name: 'agent-café-naïve',
        description: 'Agent with accented characters',
      };

      const output = generateAgentFile(agent);

      assert.ok(output.includes('# agent-café-naïve'));
    });

    it('preserves Unicode in skill content', () => {
      const skill: EccSkill = {
        id: 'unicode-skill',
        pluginId: 'test',
        name: 'international-skill',
        description: 'Names: José, François, Björk, 北京, München',
        content: 'Special symbols: → ← ↑ ↓ ✓ ★ ♠ ♣ ♥ ♦',
      };

      const output = generateSkillFile(skill);

      assert.ok(output.includes('José'));
      assert.ok(output.includes('François'));
      assert.ok(output.includes('Björk'));
      assert.ok(output.includes('北京'));
      assert.ok(output.includes('München'));
      assert.ok(output.includes('→'));
      assert.ok(output.includes('✓'));
      assert.ok(output.includes('★'));
    });

    it('handles emoji in descriptions', () => {
      const agent: EccAgent = {
        id: 'emoji-agent',
        pluginId: 'test',
        name: 'emoji-agent',
        description: 'An agent with emojis 🎉 🚀 💡 ✨',
      };

      const output = generateAgentFile(agent);

      assert.ok(output.includes('🎉'));
      assert.ok(output.includes('🚀'));
      assert.ok(output.includes('💡'));
      assert.ok(output.includes('✨'));
    });

    it('handles Japanese characters', () => {
      const skill: EccSkill = {
        id: 'jp-skill',
        pluginId: 'test',
        name: 'japanese-skill',
        content: 'Japanese: 日本語テスト ひらがな カタカナ',
      };

      const output = generateSkillFile(skill);

      assert.ok(output.includes('日本語テスト'));
      assert.ok(output.includes('ひらがな'));
      assert.ok(output.includes('カタカナ'));
    });

    it('handles Arabic and Hebrew (RTL)', () => {
      const skill: EccSkill = {
        id: 'rtl-skill',
        pluginId: 'test',
        name: 'rtl-skill',
        content: 'Arabic: مرحبا | Hebrew: שלום',
      };

      const output = generateSkillFile(skill);

      assert.ok(output.includes('مرحبا'));
      assert.ok(output.includes('שלום'));
    });
  });

  describe('Markdown Special Characters', () => {
    it('preserves markdown heading syntax in content', () => {
      const skill: EccSkill = {
        id: 'md-skill',
        pluginId: 'test',
        name: 'markdown-skill',
        content: '# Inner Heading\n\n## Subheading\n\nParagraph text.',
      };

      const output = generateSkillFile(skill);

      // The content should preserve the markdown
      assert.ok(output.includes('# Inner Heading'));
      assert.ok(output.includes('## Subheading'));
    });

    it('preserves code blocks in content', () => {
      const command: EccCommand = {
        id: 'code-cmd',
        pluginId: 'test',
        name: 'code-command',
        content: '```javascript\nconst x = "test";\nconsole.log(x);\n```',
      };

      const output = generateCommandFile(command);

      assert.ok(output.includes('```javascript'));
      assert.ok(output.includes('const x = "test"'));
      assert.ok(output.includes('```'));
    });

    it('preserves inline code', () => {
      const rule: EccRule = {
        id: 'inline-rule',
        pluginId: 'test',
        name: 'inline-code-rule',
        content: 'Use `const` instead of `let` when the value will not be reassigned.',
      };

      const output = generateRuleFile(rule);

      assert.ok(output.includes('`const`'));
      assert.ok(output.includes('`let`'));
    });

    it('preserves markdown links', () => {
      const skill: EccSkill = {
        id: 'link-skill',
        pluginId: 'test',
        name: 'link-skill',
        content: 'See [documentation](https://example.com) for more info.',
      };

      const output = generateSkillFile(skill);

      assert.ok(output.includes('[documentation](https://example.com)'));
    });

    it('handles asterisks and underscores (bold/italic)', () => {
      const rule: EccRule = {
        id: 'format-rule',
        pluginId: 'test',
        name: 'format-rule',
        content: 'Use **bold** for emphasis and *italic* for terms. Also __double__ and _single_.',
      };

      const output = generateRuleFile(rule);

      assert.ok(output.includes('**bold**'));
      assert.ok(output.includes('*italic*'));
      assert.ok(output.includes('__double__'));
      assert.ok(output.includes('_single_'));
    });
  });

  describe('HTML-like Characters', () => {
    it('preserves angle brackets', () => {
      const rule: EccRule = {
        id: 'angle-rule',
        pluginId: 'test',
        name: 'angle-bracket-rule',
        content: 'Use <component> syntax. Type definitions: Array<string>.',
      };

      const output = generateRuleFile(rule);

      assert.ok(output.includes('<component>'));
      assert.ok(output.includes('Array<string>'));
    });

    it('preserves HTML entities', () => {
      const skill: EccSkill = {
        id: 'entity-skill',
        pluginId: 'test',
        name: 'entity-skill',
        content: 'Entities: &amp; &lt; &gt; &quot; &apos;',
      };

      const output = generateSkillFile(skill);

      assert.ok(output.includes('&amp;'));
      assert.ok(output.includes('&lt;'));
      assert.ok(output.includes('&gt;'));
    });
  });

  describe('JSON Special Characters', () => {
    it('handles quotes in hook names', () => {
      const hooks: EccHook[] = [
        {
          id: 'quote-hook',
          pluginId: 'test',
          name: 'hook-with-"quotes"',
          eventType: 'PreToolUse',
        },
      ];

      const output = generateHooksJson(hooks);
      const parsed = JSON.parse(output);

      assert.equal(parsed.hooks[0].name, 'hook-with-"quotes"');
    });

    it('handles backslashes in content', () => {
      const hooks: EccHook[] = [
        {
          id: 'slash-hook',
          pluginId: 'test',
          name: 'slash-hook',
          eventType: 'PreToolUse',
          actions: [
            {
              id: 'a1',
              hookId: 'slash-hook',
              actionType: 'command',
              command: 'echo "path\\to\\file"',
              actionOrder: 1,
            },
          ],
        },
      ];

      const output = generateHooksJson(hooks);
      const parsed = JSON.parse(output);

      assert.ok(parsed.hooks[0].actions[0].command.includes('\\'));
    });

    it('handles newlines in settings values', () => {
      const servers: EccMcpServer[] = [
        {
          id: 'newline-server',
          pluginId: 'test',
          name: 'newline-server',
          env: { MULTILINE: 'line1\nline2\nline3' },
        },
      ];

      const output = generateSettingsJson(servers);
      const parsed = JSON.parse(output);

      assert.equal(parsed.mcpServers['newline-server'].env.MULTILINE, 'line1\nline2\nline3');
    });
  });

  describe('Path-safe Names', () => {
    it('skill path handles category with slashes', () => {
      const skill: EccSkill = {
        id: 'path-skill',
        pluginId: 'test',
        name: 'deep-skill',
        category: 'level1/level2/level3',
      };

      const path = getSkillFilePath(skill);

      assert.equal(path, 'skills/level1/level2/level3/deep-skill/SKILL.md');
    });

    it('agent path handles hyphenated names', () => {
      const agent: EccAgent = {
        id: 'hyphen-agent',
        pluginId: 'test',
        name: 'my-complex-agent-name',
      };

      const path = getAgentFilePath(agent);

      assert.equal(path, 'agents/my-complex-agent-name.md');
    });

    it('agent path handles underscored names', () => {
      const agent: EccAgent = {
        id: 'underscore-agent',
        pluginId: 'test',
        name: 'my_underscored_agent',
      };

      const path = getAgentFilePath(agent);

      assert.equal(path, 'agents/my_underscored_agent.md');
    });
  });

  describe('Empty and Whitespace Strings', () => {
    it('handles empty description gracefully', () => {
      const agent: EccAgent = {
        id: 'empty-agent',
        pluginId: 'test',
        name: 'empty-desc-agent',
        description: '',
      };

      const output = generateAgentFile(agent);

      // Should not crash and should still have the name
      assert.ok(output.includes('# empty-desc-agent'));
    });

    it('handles whitespace-only content', () => {
      const skill: EccSkill = {
        id: 'ws-skill',
        pluginId: 'test',
        name: 'whitespace-skill',
        content: '   \n\n   \t\t   ',
      };

      // Should not crash
      const output = generateSkillFile(skill);
      assert.ok(output.includes('# whitespace-skill'));
    });

    it('preserves intentional leading/trailing whitespace in code', () => {
      const command: EccCommand = {
        id: 'indent-cmd',
        pluginId: 'test',
        name: 'indent-command',
        content: '    indented line\n        double indented',
      };

      const output = generateCommandFile(command);

      assert.ok(output.includes('    indented line'));
      assert.ok(output.includes('        double indented'));
    });
  });

  describe('Very Long Strings', () => {
    it('handles very long description', () => {
      const longText = 'A'.repeat(10000);
      const agent: EccAgent = {
        id: 'long-agent',
        pluginId: 'test',
        name: 'long-agent',
        description: longText,
      };

      const output = generateAgentFile(agent);

      assert.ok(output.includes(longText));
      assert.ok(output.length > 10000);
    });

    it('handles many checklist items', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i}`,
        agentId: 'many-agent',
        item: `Checklist item number ${i}`,
        itemOrder: i,
      }));

      const agent: EccAgent = {
        id: 'many-agent',
        pluginId: 'test',
        name: 'many-items-agent',
        checklistItems: items,
      };

      const output = generateAgentFile(agent);

      assert.ok(output.includes('Checklist item number 0'));
      assert.ok(output.includes('Checklist item number 99'));
    });
  });
});
