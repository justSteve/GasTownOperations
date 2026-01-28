/**
 * JSON Schema Validation Tests (Layer 1)
 *
 * Validates that all JSON data files parse correctly and have required structure.
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const FIXTURES_DIR = join(import.meta.dirname, '../fixtures/data');
const FIXTURE_SETS = ['minimal-plugin', 'complete-plugin', 'edge-cases'];

const REQUIRED_FILES = [
  'ecc-plugins.json',
  'ecc-agents.json',
  'ecc-skills.json',
  'ecc-rules.json',
  'ecc-hooks.json',
  'ecc-mcp-servers.json',
  'ecc-contexts.json',
  'ecc-commands.json',
  'ecc-zgent-instances.json',
];

interface FileStructure {
  file: string;
  rootKey: string;
}

const FILE_STRUCTURES: FileStructure[] = [
  { file: 'ecc-plugins.json', rootKey: 'plugins' },
  { file: 'ecc-agents.json', rootKey: 'agents' },
  { file: 'ecc-skills.json', rootKey: 'skills' },
  { file: 'ecc-rules.json', rootKey: 'rules' },
  { file: 'ecc-hooks.json', rootKey: 'hooks' },
  { file: 'ecc-mcp-servers.json', rootKey: 'mcpServers' },
  { file: 'ecc-contexts.json', rootKey: 'contexts' },
  { file: 'ecc-commands.json', rootKey: 'commands' },
  { file: 'ecc-zgent-instances.json', rootKey: 'zgents' },
];

async function loadJson(path: string): Promise<unknown> {
  const content = await readFile(path, 'utf-8');
  return JSON.parse(content);
}

describe('JSON Schema Validation', () => {
  for (const fixtureSet of FIXTURE_SETS) {
    describe(`Fixture: ${fixtureSet}`, () => {
      it('has all required JSON files', async () => {
        const fixtureDir = join(FIXTURES_DIR, fixtureSet);
        const files = await readdir(fixtureDir);

        for (const required of REQUIRED_FILES) {
          assert.ok(
            files.includes(required),
            `Missing required file: ${required}`
          );
        }
      });

      for (const { file, rootKey } of FILE_STRUCTURES) {
        it(`${file} parses as valid JSON`, async () => {
          const filePath = join(FIXTURES_DIR, fixtureSet, file);
          let data: unknown;

          try {
            data = await loadJson(filePath);
          } catch (error) {
            assert.fail(`Failed to parse ${file}: ${error}`);
          }

          assert.ok(data !== null, `${file} should not be null`);
          assert.equal(typeof data, 'object', `${file} should be an object`);
        });

        it(`${file} has required root structure`, async () => {
          const filePath = join(FIXTURES_DIR, fixtureSet, file);
          const data = (await loadJson(filePath)) as Record<string, unknown>;

          assert.ok(
            rootKey in data,
            `${file} should have '${rootKey}' property`
          );
          assert.ok(
            Array.isArray(data[rootKey]),
            `${file}.${rootKey} should be an array`
          );
        });
      }
    });
  }

  describe('Cross-fixture consistency', () => {
    it('all plugins have unique IDs across fixtures', async () => {
      const pluginIds = new Set<string>();

      for (const fixtureSet of FIXTURE_SETS) {
        const filePath = join(FIXTURES_DIR, fixtureSet, 'ecc-plugins.json');
        const data = (await loadJson(filePath)) as { plugins: Array<{ id: string }> };

        for (const plugin of data.plugins) {
          assert.ok(
            !pluginIds.has(plugin.id),
            `Duplicate plugin ID: ${plugin.id}`
          );
          pluginIds.add(plugin.id);
        }
      }
    });

    it('all zgents have unique IDs across fixtures', async () => {
      const zgentIds = new Set<string>();

      for (const fixtureSet of FIXTURE_SETS) {
        const filePath = join(FIXTURES_DIR, fixtureSet, 'ecc-zgent-instances.json');
        const data = (await loadJson(filePath)) as { zgents: Array<{ id: string }> };

        for (const zgent of data.zgents) {
          assert.ok(
            !zgentIds.has(zgent.id),
            `Duplicate zgent ID: ${zgent.id}`
          );
          zgentIds.add(zgent.id);
        }
      }
    });
  });
});
