/**
 * Integration Tests (Layer 3)
 *
 * Tests the full materialization pipeline from fixture data to output files.
 */

import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdir, rm, readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadEccData } from '../../dist/ecc-data-loader.js';
import { resolvePlugin, validateResolvedPlugin, getPluginStats } from '../../dist/ecc-entity-resolver.js';
import { previewMaterialization } from '../../dist/ecc-file-writer.js';
import {
  assertFileExists,
  assertJsonValid,
  assertMarkdownSections,
  assertNoUnsubstitutedVars,
  assertContains,
  createTempDir,
  cleanupTempDir,
} from '../helpers/assertions.ts';

const FIXTURES_DIR = join(import.meta.dirname, '../fixtures/data');

describe('Integration: Full Materialization', () => {
  describe('Minimal Plugin', () => {
    const fixtureDir = join(FIXTURES_DIR, 'minimal-plugin');

    it('loads minimal plugin data without errors', async () => {
      const data = await loadEccData(fixtureDir);

      assert.equal(data.plugins.length, 1);
      assert.equal(data.plugins[0].id, 'minimal-plugin');
    });

    it('resolves minimal plugin', async () => {
      const data = await loadEccData(fixtureDir);
      const resolved = resolvePlugin('minimal-plugin', data);

      assert.equal(resolved.plugin.id, 'minimal-plugin');
      assert.equal(resolved.agents.length, 0);
      assert.equal(resolved.skills.length, 0);
      assert.equal(resolved.rules.length, 0);
      assert.equal(resolved.hooks.length, 0);
      assert.equal(resolved.mcpServers.length, 0);
      assert.equal(resolved.contexts.length, 0);
      assert.equal(resolved.commands.length, 0);
    });

    it('validates minimal plugin with no errors', async () => {
      const data = await loadEccData(fixtureDir);
      const resolved = resolvePlugin('minimal-plugin', data);
      const errors = validateResolvedPlugin(resolved);

      assert.equal(errors.length, 0);
    });

    it('generates no files for minimal plugin', async () => {
      const data = await loadEccData(fixtureDir);
      const resolved = resolvePlugin('minimal-plugin', data);
      const files = previewMaterialization(resolved);

      assert.equal(files.length, 0, 'Empty plugin should generate no files');
    });
  });

  describe('Complete Plugin', () => {
    const fixtureDir = join(FIXTURES_DIR, 'complete-plugin');

    it('loads complete plugin data without errors', async () => {
      const data = await loadEccData(fixtureDir);

      assert.equal(data.plugins.length, 1);
      assert.equal(data.plugins[0].id, 'complete-plugin');
    });

    it('resolves complete plugin with all entities', async () => {
      const data = await loadEccData(fixtureDir);
      const resolved = resolvePlugin('complete-plugin', data);

      assert.equal(resolved.plugin.id, 'complete-plugin');
      assert.equal(resolved.agents.length, 1);
      assert.equal(resolved.skills.length, 1);
      assert.equal(resolved.rules.length, 1);
      assert.equal(resolved.hooks.length, 2);
      assert.equal(resolved.mcpServers.length, 1);
      assert.equal(resolved.contexts.length, 1);
      assert.equal(resolved.commands.length, 1);
    });

    it('validates complete plugin with no errors', async () => {
      const data = await loadEccData(fixtureDir);
      const resolved = resolvePlugin('complete-plugin', data);
      const errors = validateResolvedPlugin(resolved);

      assert.equal(errors.length, 0, `Validation errors: ${errors.join(', ')}`);
    });

    it('gets correct plugin stats', async () => {
      const data = await loadEccData(fixtureDir);
      const resolved = resolvePlugin('complete-plugin', data);
      const stats = getPluginStats(resolved);

      assert.equal(stats.agents, 1);
      assert.equal(stats.skills, 1);
      assert.equal(stats.rules, 1);
      assert.equal(stats.hooks, 2);
      assert.equal(stats.mcpServers, 1);
      assert.equal(stats.contexts, 1);
      assert.equal(stats.commands, 1);
      assert.equal(stats.totalEntities, 8);
    });

    it('generates expected file count', async () => {
      const data = await loadEccData(fixtureDir);
      const resolved = resolvePlugin('complete-plugin', data);
      const files = previewMaterialization(resolved);

      // 1 agent + 1 command + 1 skill + 1 rule + 1 context + 1 hooks.json + 1 settings.json = 7 files
      assert.equal(files.length, 7, `Expected 7 files, got ${files.length}`);
    });

    it('generates correct file paths', async () => {
      const data = await loadEccData(fixtureDir);
      const resolved = resolvePlugin('complete-plugin', data);
      const files = previewMaterialization(resolved);

      const paths = files.map((f) => f.path);

      assert.ok(paths.includes('agents/test-agent.md'), 'Should have agent file');
      assert.ok(paths.includes('commands/test-command.md'), 'Should have command file');
      assert.ok(paths.includes('skills/testing/test-skill/SKILL.md'), 'Should have skill file');
      assert.ok(paths.includes('rules/test-rule.md'), 'Should have rule file');
      assert.ok(paths.includes('contexts/test-context.md'), 'Should have context file');
      assert.ok(paths.includes('hooks/hooks.json'), 'Should have hooks file');
      assert.ok(paths.includes('settings.json'), 'Should have settings file');
    });

    it('generates valid markdown files', async () => {
      const data = await loadEccData(fixtureDir);
      const resolved = resolvePlugin('complete-plugin', data);
      const files = previewMaterialization(resolved);

      const mdFiles = files.filter((f) => f.path.endsWith('.md'));

      for (const file of mdFiles) {
        // Check that markdown files have a heading
        assert.ok(file.content.startsWith('#'), `${file.path} should start with heading`);
      }
    });

    it('generates valid JSON files', async () => {
      const data = await loadEccData(fixtureDir);
      const resolved = resolvePlugin('complete-plugin', data);
      const files = previewMaterialization(resolved);

      const jsonFiles = files.filter((f) => f.path.endsWith('.json'));

      for (const file of jsonFiles) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(file.content);
        } catch (error) {
          assert.fail(`${file.path} contains invalid JSON: ${error}`);
        }
        assert.ok(parsed !== null, `${file.path} should not be null`);
      }
    });

    it('applies variable substitution', async () => {
      const data = await loadEccData(fixtureDir);
      const resolved = resolvePlugin('complete-plugin', data);
      const zgent = data.zgents.find((z) => z.pluginId === 'complete-plugin');
      const files = previewMaterialization(resolved, zgent?.configOverrides);

      const commandFile = files.find((f) => f.path === 'commands/test-command.md');
      assert.ok(commandFile, 'Command file should exist');

      // Variables should be substituted
      assert.ok(!commandFile.content.includes('{{TARGET}}'), 'TARGET should be substituted');
      assert.ok(!commandFile.content.includes('{{MODE}}'), 'MODE should be substituted');
      assert.ok(commandFile.content.includes('test-target'), 'Should contain substituted value');
      assert.ok(commandFile.content.includes('verbose'), 'Should contain substituted mode');
    });
  });

  describe('Edge Cases Plugin', () => {
    const fixtureDir = join(FIXTURES_DIR, 'edge-cases');

    it('loads edge cases plugin data', async () => {
      const data = await loadEccData(fixtureDir);

      assert.equal(data.plugins.length, 1);
      assert.equal(data.plugins[0].id, 'edge-plugin');
    });

    it('resolves edge cases plugin', async () => {
      const data = await loadEccData(fixtureDir);
      const resolved = resolvePlugin('edge-plugin', data);

      assert.equal(resolved.agents.length, 2);
      assert.equal(resolved.skills.length, 2);
      assert.equal(resolved.rules.length, 3);
      assert.equal(resolved.hooks.length, 2);
      assert.equal(resolved.mcpServers.length, 1);
      assert.equal(resolved.contexts.length, 3);
      assert.equal(resolved.commands.length, 2);
    });

    it('handles deep skill category path', async () => {
      const data = await loadEccData(fixtureDir);
      const resolved = resolvePlugin('edge-plugin', data);
      const files = previewMaterialization(resolved);

      const deepSkill = files.find((f) => f.path.includes('category/subcategory/deep'));
      assert.ok(deepSkill, 'Should have deep nested skill path');
      assert.equal(
        deepSkill.path,
        'skills/category/subcategory/deep/nested/deep-nested-skill/SKILL.md'
      );
    });

    it('applies exclude filter', async () => {
      const data = await loadEccData(fixtureDir);
      const resolved = resolvePlugin('edge-plugin', data);
      const zgent = data.zgents.find((z) => z.pluginId === 'edge-plugin');
      const files = previewMaterialization(resolved, zgent?.configOverrides);

      const hooksFile = files.find((f) => f.path === 'hooks/hooks.json');
      const settingsFile = files.find((f) => f.path === 'settings.json');

      assert.ok(!hooksFile, 'hooks.json should be excluded');
      assert.ok(!settingsFile, 'settings.json should be excluded');
    });

    it('handles disabled hooks correctly', async () => {
      const data = await loadEccData(fixtureDir);
      const resolved = resolvePlugin('edge-plugin', data);

      // Get files without exclude filter
      const files = previewMaterialization(resolved);
      const hooksFile = files.find((f) => f.path === 'hooks/hooks.json');

      if (hooksFile) {
        const parsed = JSON.parse(hooksFile.content);
        const disabledHook = parsed.hooks.find((h: any) => h.name === 'disabled-hook');
        assert.ok(disabledHook, 'Disabled hook should be in output');
        assert.equal(disabledHook.enabled, false, 'Hook should be disabled');
      }
    });
  });

  describe('Error Handling', () => {
    it('throws error for non-existent plugin', async () => {
      const data = await loadEccData(join(FIXTURES_DIR, 'minimal-plugin'));

      try {
        resolvePlugin('non-existent-plugin', data);
        assert.fail('Should throw error');
      } catch (error: any) {
        assert.ok(error.message.includes('not found'));
      }
    });

    it('throws error for non-existent fixture directory', async () => {
      try {
        await loadEccData('/non/existent/path');
        assert.fail('Should throw error');
      } catch (error) {
        assert.ok(error instanceof Error);
      }
    });
  });

  describe('Output File Content Verification', () => {
    const fixtureDir = join(FIXTURES_DIR, 'complete-plugin');

    it('agent file contains checklist section', async () => {
      const data = await loadEccData(fixtureDir);
      const resolved = resolvePlugin('complete-plugin', data);
      const files = previewMaterialization(resolved);

      const agentFile = files.find((f) => f.path === 'agents/test-agent.md');
      assert.ok(agentFile);
      assert.ok(agentFile.content.includes('## Checklist'));
      assert.ok(agentFile.content.includes('- [ ]'));
    });

    it('command file contains phases', async () => {
      const data = await loadEccData(fixtureDir);
      const resolved = resolvePlugin('complete-plugin', data);
      const files = previewMaterialization(resolved);

      const commandFile = files.find((f) => f.path === 'commands/test-command.md');
      assert.ok(commandFile);
      assert.ok(commandFile.content.includes('## Phases'));
      assert.ok(commandFile.content.includes('Phase 1'));
      assert.ok(commandFile.content.includes('Phase 2'));
      assert.ok(commandFile.content.includes('Phase 3'));
    });

    it('skill file contains patterns and workflows', async () => {
      const data = await loadEccData(fixtureDir);
      const resolved = resolvePlugin('complete-plugin', data);
      const files = previewMaterialization(resolved);

      const skillFile = files.find((f) => f.path === 'skills/testing/test-skill/SKILL.md');
      assert.ok(skillFile);
      assert.ok(skillFile.content.includes('## Patterns'));
      assert.ok(skillFile.content.includes('## Workflows'));
    });

    it('hooks.json contains all hooks with actions', async () => {
      const data = await loadEccData(fixtureDir);
      const resolved = resolvePlugin('complete-plugin', data);
      const files = previewMaterialization(resolved);

      const hooksFile = files.find((f) => f.path === 'hooks/hooks.json');
      assert.ok(hooksFile);

      const parsed = JSON.parse(hooksFile.content);
      assert.equal(parsed.hooks.length, 2);
      assert.ok(parsed.hooks[0].actions.length > 0);
    });

    it('settings.json contains MCP server', async () => {
      const data = await loadEccData(fixtureDir);
      const resolved = resolvePlugin('complete-plugin', data);
      const files = previewMaterialization(resolved);

      const settingsFile = files.find((f) => f.path === 'settings.json');
      assert.ok(settingsFile);

      const parsed = JSON.parse(settingsFile.content);
      assert.ok('mcpServers' in parsed);
      assert.ok('test-server' in parsed.mcpServers);
    });
  });
});
