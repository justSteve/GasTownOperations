/**
 * @fileoverview Comprehensive tests for the CRUD Engine
 *
 * Tests cover:
 * - CrudEngine initialization with different modes
 * - Skill CRUD operations (hierarchical paths)
 * - Hook CRUD operations (aggregated in settings.json)
 * - Rule CRUD operations (markdown files)
 * - Error handling
 * - Traffic logging
 * - Operation history
 *
 * @module @ecc/crud/tests/crud-engine.test
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { createCrudEngine, CrudEngine, DEV_CONFIG, PROD_CONFIG } from '../src/core/crud-engine.js';
import type { CrudEngineConfig } from '../src/core/crud-engine.js';
import type { EccSkill, EccHook, EccRule } from '../src/types/artifact-types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a unique temporary directory for tests.
 */
async function createTempDir(): Promise<string> {
  const baseDir = path.join(tmpdir(), 'ecc-crud-test');
  await fs.mkdir(baseDir, { recursive: true });
  const testDir = path.join(baseDir, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(testDir, { recursive: true });
  return testDir;
}

/**
 * Clean up a temporary directory.
 */
async function cleanupTempDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Create a test skill artifact.
 */
function createTestSkill(overrides: Partial<EccSkill> = {}): EccSkill {
  return {
    id: 'core/test-skill',
    pluginId: 'core',
    name: 'test-skill',
    category: 'core',
    title: 'Test Skill',
    description: 'A skill for testing',
    content: 'Test skill content here.',
    ...overrides,
  };
}

/**
 * Create a test hook artifact.
 */
function createTestHook(overrides: Partial<EccHook> = {}): EccHook {
  return {
    id: 'hook-1',
    pluginId: 'core',
    name: 'test-hook',
    eventType: 'PreToolUse',
    enabled: true,
    ...overrides,
  };
}

/**
 * Create a test rule artifact.
 */
function createTestRule(overrides: Partial<EccRule> = {}): EccRule {
  return {
    id: 'local:test-rule',
    pluginId: 'local',
    name: 'test-rule',
    title: 'Test Rule',
    content: 'This is a test rule.',
    severity: 'warning',
    ...overrides,
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe('CrudEngine', () => {
  let projectRoot: string;
  let engine: CrudEngine;

  beforeEach(async () => {
    projectRoot = await createTempDir();
    engine = createCrudEngine(projectRoot, 'development');
  });

  afterEach(async () => {
    await cleanupTempDir(projectRoot);
  });

  // ==========================================================================
  // Initialization Tests
  // ==========================================================================

  describe('initialization', () => {
    test('creates with development mode config', () => {
      const devEngine = createCrudEngine(projectRoot, 'development');
      const config = devEngine.getConfig();

      expect(config.logging.level).toBe('DEBUG');
      expect(config.logging.includeStateInLogs).toBe(true);
      expect(config.logging.logToConsole).toBe(true);
      expect(config.versioning.captureSnapshots).toBe(true);
      expect(config.versioning.historySize).toBe(100);
    });

    test('creates with production mode config', () => {
      const prodEngine = createCrudEngine(projectRoot, 'production');
      const config = prodEngine.getConfig();

      expect(config.logging.level).toBe('INFO');
      expect(config.logging.includeStateInLogs).toBe(false);
      expect(config.logging.logToConsole).toBe(false);
      expect(config.versioning.captureSnapshots).toBe(true);
      expect(config.versioning.historySize).toBe(20);
    });

    test('creates with custom config', () => {
      const customConfig: CrudEngineConfig = {
        logging: {
          level: 'WARN',
          includeStateInLogs: false,
          logToConsole: false,
        },
        versioning: {
          captureSnapshots: false,
          historySize: 50,
        },
      };

      const customEngine = new CrudEngine(projectRoot, customConfig);
      const config = customEngine.getConfig();

      expect(config.logging.level).toBe('WARN');
      expect(config.versioning.historySize).toBe(50);
    });

    test('defaults to development mode when no mode specified', () => {
      const defaultEngine = createCrudEngine(projectRoot);
      const config = defaultEngine.getConfig();

      expect(config.logging.level).toBe('DEBUG');
    });

    test('returns the correct project root', () => {
      expect(engine.getProjectRoot()).toBe(projectRoot);
    });
  });

  // ==========================================================================
  // Skill CRUD Tests
  // ==========================================================================

  describe('skill CRUD operations', () => {
    test('creates a skill with category', async () => {
      const skill = createTestSkill();
      const result = await engine.createSkill(skill);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe('test-skill');
      expect(result.data?.category).toBe('core');
      expect(result.path).toContain('.claude/skills/core/test-skill/SKILL.md');

      // Verify file exists
      const filePath = path.join(projectRoot, '.claude/skills/core/test-skill/SKILL.md');
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    test('creates a skill with default category when not specified', async () => {
      const skill = createTestSkill({ category: undefined });
      const result = await engine.createSkill(skill);

      expect(result.success).toBe(true);
      expect(result.path).toContain('.claude/skills/general/test-skill/SKILL.md');
    });

    test('reads a skill', async () => {
      const skill = createTestSkill();
      await engine.createSkill(skill);

      const result = await engine.readSkill('core/test-skill');

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('test-skill');
      expect(result.data?.category).toBe('core');
      expect(result.data?.title).toBe('Test Skill');
    });

    test('updates a skill with merge mode', async () => {
      const skill = createTestSkill();
      await engine.createSkill(skill);

      const result = await engine.updateSkill('core/test-skill', {
        description: 'Updated description',
      });

      expect(result.success).toBe(true);
      expect(result.data?.description).toBe('Updated description');
      expect(result.data?.title).toBe('Test Skill'); // Original title preserved
    });

    test('updates a skill with replace mode', async () => {
      const skill = createTestSkill();
      await engine.createSkill(skill);

      const result = await engine.updateSkill(
        'core/test-skill',
        { description: 'Replaced' },
        { merge: false }
      );

      expect(result.success).toBe(true);
      expect(result.data?.description).toBe('Replaced');
    });

    test('deletes a skill', async () => {
      const skill = createTestSkill();
      await engine.createSkill(skill);

      const deleteResult = await engine.deleteSkill('core/test-skill');
      expect(deleteResult.success).toBe(true);

      // Verify file no longer exists
      const readResult = await engine.readSkill('core/test-skill');
      expect(readResult.success).toBe(false);
      expect(readResult.error?.code).toBe('NOT_FOUND');
    });

    test('lists skills', async () => {
      await engine.createSkill(createTestSkill({ name: 'skill-1' }));
      await engine.createSkill(createTestSkill({ name: 'skill-2', category: 'utils' }));

      const result = await engine.listSkills();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBe(2);
    });

    test('returns empty list when no skills exist', async () => {
      const result = await engine.listSkills();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  // ==========================================================================
  // Hook CRUD Tests (Aggregated Pattern)
  // ==========================================================================

  describe('hook CRUD operations (aggregated pattern)', () => {
    test('creates a hook (adds to settings.json hooks array)', async () => {
      const hook = createTestHook();
      const result = await engine.createHook(hook);

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('test-hook');
      expect(result.path).toContain('.claude/settings.json');

      // Verify settings.json structure
      const settingsPath = path.join(projectRoot, '.claude/settings.json');
      const content = await fs.readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content);
      expect(settings.hooks).toHaveLength(1);
      expect(settings.hooks[0].name).toBe('test-hook');
    });

    test('reads a hook', async () => {
      const hook = createTestHook();
      await engine.createHook(hook);

      const result = await engine.readHook('test-hook');

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('test-hook');
      expect(result.data?.eventType).toBe('PreToolUse');
    });

    test('updates a hook', async () => {
      const hook = createTestHook();
      await engine.createHook(hook);

      const result = await engine.updateHook('test-hook', { enabled: false });

      expect(result.success).toBe(true);
      expect(result.data?.enabled).toBe(false);
      expect(result.data?.eventType).toBe('PreToolUse'); // Preserved
    });

    test('deletes a hook', async () => {
      const hook = createTestHook();
      await engine.createHook(hook);

      const deleteResult = await engine.deleteHook('test-hook');
      expect(deleteResult.success).toBe(true);

      const readResult = await engine.readHook('test-hook');
      expect(readResult.success).toBe(false);
      expect(readResult.error?.code).toBe('NOT_FOUND');
    });

    test('lists hooks', async () => {
      await engine.createHook(createTestHook({ name: 'hook-1' }));
      await engine.createHook(createTestHook({ name: 'hook-2' }));

      const result = await engine.listHooks();

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(2);
    });

    test('preserves other settings.json fields when modifying hooks', async () => {
      // Create initial settings with other fields
      const settingsPath = path.join(projectRoot, '.claude/settings.json');
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, JSON.stringify({
        mcpServers: { myServer: { command: 'node' } },
        otherConfig: 'value',
      }, null, 2));

      await engine.createHook(createTestHook());

      const content = await fs.readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content);

      expect(settings.hooks).toHaveLength(1);
      expect(settings.mcpServers).toEqual({ myServer: { command: 'node' } });
      expect(settings.otherConfig).toBe('value');
    });
  });

  // ==========================================================================
  // Rule CRUD Tests
  // ==========================================================================

  describe('rule CRUD operations', () => {
    test('creates a rule', async () => {
      const rule = createTestRule();
      const result = await engine.createRule(rule);

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('test-rule');
      expect(result.path).toContain('.claude/rules/test-rule.md');

      // Verify file exists
      const filePath = path.join(projectRoot, '.claude/rules/test-rule.md');
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('title: "Test Rule"');
    });

    test('reads a rule', async () => {
      const rule = createTestRule();
      await engine.createRule(rule);

      const result = await engine.readRule('test-rule');

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('test-rule');
      expect(result.data?.title).toBe('Test Rule');
      expect(result.data?.severity).toBe('warning');
    });

    test('updates a rule', async () => {
      const rule = createTestRule();
      await engine.createRule(rule);

      const result = await engine.updateRule('test-rule', {
        content: 'Updated rule content',
      });

      expect(result.success).toBe(true);
      expect(result.data?.content).toBe('Updated rule content');
      expect(result.data?.title).toBe('Test Rule'); // Preserved
    });

    test('deletes a rule', async () => {
      const rule = createTestRule();
      await engine.createRule(rule);

      const deleteResult = await engine.deleteRule('test-rule');
      expect(deleteResult.success).toBe(true);

      const readResult = await engine.readRule('test-rule');
      expect(readResult.success).toBe(false);
      expect(readResult.error?.code).toBe('NOT_FOUND');
    });

    test('lists rules', async () => {
      await engine.createRule(createTestRule({ name: 'rule-1' }));
      await engine.createRule(createTestRule({ name: 'rule-2' }));

      const result = await engine.listRules();

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(2);
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('error handling', () => {
    test('read non-existent artifact returns error result', async () => {
      const result = await engine.readSkill('nonexistent/skill');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('NOT_FOUND');
      expect(result.error?.message).toContain('not found');
    });

    test('create duplicate without overwrite fails', async () => {
      const skill = createTestSkill();
      await engine.createSkill(skill);

      const result = await engine.createSkill(skill);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ALREADY_EXISTS');
    });

    test('create duplicate with overwrite succeeds', async () => {
      const skill = createTestSkill();
      await engine.createSkill(skill);

      const updatedSkill = createTestSkill({ description: 'Updated' });
      const result = await engine.createSkill(updatedSkill, { overwrite: true });

      expect(result.success).toBe(true);
      expect(result.data?.description).toBe('Updated');
    });

    test('delete non-existent fails', async () => {
      const result = await engine.deleteSkill('nonexistent/skill');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    test('update non-existent fails', async () => {
      const result = await engine.updateSkill('nonexistent/skill', { description: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    test('read non-existent hook returns error', async () => {
      const result = await engine.readHook('nonexistent-hook');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    test('read non-existent rule returns error', async () => {
      const result = await engine.readRule('nonexistent-rule');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  // ==========================================================================
  // Traffic Logging Tests
  // ==========================================================================

  describe('traffic logging', () => {
    test('operations generate log entries with logId', async () => {
      const skill = createTestSkill();
      const result = await engine.createSkill(skill);

      expect(result.logId).toBeDefined();
      expect(result.logId).toMatch(/^op-[a-z0-9]+-[a-z0-9]+$/);
    });

    test('log entries have operationId, timestamp, and durationMs', async () => {
      const skill = createTestSkill();
      const result = await engine.createSkill(skill);

      expect(result.logId).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    test('read operations generate log entries', async () => {
      const skill = createTestSkill();
      await engine.createSkill(skill);

      const result = await engine.readSkill('core/test-skill');

      expect(result.logId).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    test('failed operations also have log entries', async () => {
      const result = await engine.readSkill('nonexistent/skill');

      expect(result.success).toBe(false);
      expect(result.logId).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // Operation History Tests
  // ==========================================================================

  describe('operation history', () => {
    test('operations are recorded in history', async () => {
      const skill = createTestSkill();
      await engine.createSkill(skill);

      const history = engine.getHistory();
      expect(history.size()).toBe(1);
    });

    test('getRecentOperations returns recent ops', async () => {
      await engine.createSkill(createTestSkill({ name: 'skill-1' }));
      await engine.createSkill(createTestSkill({ name: 'skill-2' }));
      await engine.createSkill(createTestSkill({ name: 'skill-3' }));

      const recent = engine.getRecentOperations(2);

      expect(recent.length).toBe(2);
      // Newest first
      expect(recent[0].operation.type).toBe('create');
    });

    test('getRecentOperations defaults to 10 entries', async () => {
      for (let i = 0; i < 15; i++) {
        await engine.createSkill(createTestSkill({ name: `skill-${i}` }));
      }

      const recent = engine.getRecentOperations();

      expect(recent.length).toBe(10);
    });

    test('history entries contain before and after snapshots', async () => {
      const skill = createTestSkill();
      await engine.createSkill(skill);

      const recent = engine.getRecentOperations(1);

      expect(recent[0].before).toBeDefined();
      expect(recent[0].after).toBeDefined();
      expect(recent[0].before.state).toBeNull(); // Create has null before state
      expect(recent[0].after.state).not.toBeNull();
    });

    test('history entries contain diff information', async () => {
      const skill = createTestSkill();
      await engine.createSkill(skill);

      const recent = engine.getRecentOperations(1);

      expect(recent[0].diff).toBeDefined();
      expect(recent[0].diff.isStructuralChange).toBe(true); // Create is structural
    });

    test('findByArtifact works', async () => {
      await engine.createSkill(createTestSkill({ name: 'skill-1' }));
      await engine.createSkill(createTestSkill({ name: 'skill-2' }));
      await engine.updateSkill('core/skill-1', { description: 'Updated' });

      const history = engine.getHistory();
      const skill1History = history.findByArtifact('core/skill-1');

      expect(skill1History.length).toBe(2); // Create + Update
    });

    test('history respects configured size limit', async () => {
      const smallHistoryEngine = new CrudEngine(projectRoot, {
        ...DEV_CONFIG,
        versioning: {
          ...DEV_CONFIG.versioning,
          historySize: 3,
        },
      });

      for (let i = 0; i < 5; i++) {
        await smallHistoryEngine.createSkill(createTestSkill({ name: `skill-${i}` }));
      }

      const history = smallHistoryEngine.getHistory();
      expect(history.size()).toBe(3);
    });

    test('update operations record before and after state', async () => {
      const skill = createTestSkill();
      await engine.createSkill(skill);
      await engine.updateSkill('core/test-skill', { description: 'Updated' });

      const recent = engine.getRecentOperations(1);

      expect(recent[0].operation.type).toBe('update');
      expect(recent[0].before.state).not.toBeNull();
      expect(recent[0].after.state).not.toBeNull();
    });
  });

  // ==========================================================================
  // Dry Run Tests
  // ==========================================================================

  describe('dry run operations', () => {
    test('create with dryRun does not persist', async () => {
      const skill = createTestSkill();
      const result = await engine.createSkill(skill, { dryRun: true });

      expect(result.success).toBe(true);

      // Verify file was not created
      const readResult = await engine.readSkill('core/test-skill');
      expect(readResult.success).toBe(false);
    });

    test('update with dryRun does not persist', async () => {
      const skill = createTestSkill();
      await engine.createSkill(skill);

      const result = await engine.updateSkill(
        'core/test-skill',
        { description: 'DryRun Update' },
        { dryRun: true }
      );

      expect(result.success).toBe(true);
      expect(result.data?.description).toBe('DryRun Update');

      // Verify original was not modified
      const readResult = await engine.readSkill('core/test-skill');
      expect(readResult.data?.description).toBe('A skill for testing');
    });

    test('delete with dryRun does not persist', async () => {
      const skill = createTestSkill();
      await engine.createSkill(skill);

      const result = await engine.deleteSkill('core/test-skill', { dryRun: true });

      expect(result.success).toBe(true);

      // Verify file still exists
      const readResult = await engine.readSkill('core/test-skill');
      expect(readResult.success).toBe(true);
    });
  });

  // ==========================================================================
  // Generic CRUD Method Tests
  // ==========================================================================

  describe('generic CRUD methods', () => {
    test('create<T> works with type parameter', async () => {
      const skill = createTestSkill();
      const result = await engine.create<EccSkill>('skill', skill);

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('test-skill');
    });

    test('read<T> works with type parameter', async () => {
      await engine.createSkill(createTestSkill());
      const result = await engine.read<EccSkill>('skill', 'core/test-skill');

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('test-skill');
    });

    test('update<T> works with type parameter', async () => {
      await engine.createSkill(createTestSkill());
      const result = await engine.update<EccSkill>('skill', 'core/test-skill', {
        description: 'Generic update',
      });

      expect(result.success).toBe(true);
      expect(result.data?.description).toBe('Generic update');
    });

    test('delete works for different artifact types', async () => {
      await engine.createSkill(createTestSkill());
      const result = await engine.delete('skill', 'core/test-skill');

      expect(result.success).toBe(true);
    });

    test('list<T> works for different artifact types', async () => {
      await engine.createRule(createTestRule({ name: 'rule-1' }));
      await engine.createRule(createTestRule({ name: 'rule-2' }));

      const result = await engine.list<EccRule>('rule');

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(2);
    });
  });

  // ==========================================================================
  // Soft Delete Tests
  // ==========================================================================

  describe('soft delete', () => {
    test('soft delete skill renames file', async () => {
      const skill = createTestSkill();
      await engine.createSkill(skill);

      const result = await engine.deleteSkill('core/test-skill', { soft: true });

      expect(result.success).toBe(true);

      // Original file should not exist
      const readResult = await engine.readSkill('core/test-skill');
      expect(readResult.success).toBe(false);

      // Check for .deleted file
      const deletedPath = path.join(projectRoot, '.claude/skills/core/test-skill/SKILL.md.deleted');
      const exists = await fs.access(deletedPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    test('soft delete hook marks as disabled', async () => {
      const hook = createTestHook({ enabled: true });
      await engine.createHook(hook);

      const result = await engine.deleteHook('test-hook', { soft: true });

      expect(result.success).toBe(true);

      // Hook should still be readable but disabled
      const readResult = await engine.readHook('test-hook');
      expect(readResult.success).toBe(true);
      expect(readResult.data?.enabled).toBe(false);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    test('handles skills with special characters in name', async () => {
      const skill = createTestSkill({ name: 'my-complex_skill.v2' });
      const result = await engine.createSkill(skill);

      expect(result.success).toBe(true);
    });

    test('handles empty settings.json gracefully', async () => {
      const settingsPath = path.join(projectRoot, '.claude/settings.json');
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, '{}');

      const result = await engine.listHooks();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    test('handles rules without frontmatter', async () => {
      const rulesPath = path.join(projectRoot, '.claude/rules');
      await fs.mkdir(rulesPath, { recursive: true });
      await fs.writeFile(
        path.join(rulesPath, 'simple-rule.md'),
        'Just plain markdown content without frontmatter.'
      );

      const result = await engine.readRule('simple-rule');

      expect(result.success).toBe(true);
      expect(result.data?.content).toBe('Just plain markdown content without frontmatter.');
    });

    test('skill with all optional fields', async () => {
      const skill: EccSkill = {
        id: 'full/skill',
        pluginId: 'full',
        name: 'skill',
        category: 'full',
        title: 'Full Skill',
        description: 'A skill with all fields',
        content: 'Main content',
        hotReload: true,
        contextMode: 'manual',
        allowedTools: ['Read', 'Write'],
        patterns: [
          {
            name: 'Pattern1',
            description: 'A pattern',
            applicability: 'When testing',
            implementation: 'Do this',
          },
        ],
        workflows: [
          {
            name: 'Workflow1',
            steps: ['Step 1', 'Step 2'],
            expectedOutcome: 'Success',
          },
        ],
      };

      const createResult = await engine.createSkill(skill);
      expect(createResult.success).toBe(true);

      const readResult = await engine.readSkill('full/skill');
      expect(readResult.success).toBe(true);
      expect(readResult.data?.hotReload).toBe(true);
      expect(readResult.data?.contextMode).toBe('manual');
      expect(readResult.data?.allowedTools).toEqual(['Read', 'Write']);
    });

    test('multiple hooks in same settings.json', async () => {
      await engine.createHook(createTestHook({ name: 'hook-1' }));
      await engine.createHook(createTestHook({ name: 'hook-2', eventType: 'PostToolUse' }));
      await engine.createHook(createTestHook({ name: 'hook-3', eventType: 'Stop' }));

      const listResult = await engine.listHooks();
      expect(listResult.success).toBe(true);
      expect(listResult.data?.length).toBe(3);

      // Update one hook
      await engine.updateHook('hook-2', { enabled: false });

      // Verify others unchanged
      const hook1 = await engine.readHook('hook-1');
      const hook3 = await engine.readHook('hook-3');
      expect(hook1.data?.enabled).toBe(true);
      expect(hook3.data?.enabled).toBe(true);
    });
  });
});

// ============================================================================
// Standalone History Tests
// ============================================================================

describe('OperationHistory', () => {
  test('clear removes all entries', async () => {
    const projectRoot = await createTempDir();
    const engine = createCrudEngine(projectRoot, 'development');

    await engine.createSkill(createTestSkill());
    await engine.createSkill(createTestSkill({ name: 'skill-2' }));

    const history = engine.getHistory();
    expect(history.size()).toBe(2);

    history.clear();
    expect(history.size()).toBe(0);
    expect(history.isEmpty()).toBe(true);

    await cleanupTempDir(projectRoot);
  });

  test('capacity returns max entries', async () => {
    const projectRoot = await createTempDir();

    const customEngine = new CrudEngine(projectRoot, {
      ...DEV_CONFIG,
      versioning: { ...DEV_CONFIG.versioning, historySize: 25 },
    });

    const history = customEngine.getHistory();
    expect(history.capacity()).toBe(25);

    await cleanupTempDir(projectRoot);
  });

  test('isFull returns true when at capacity', async () => {
    const projectRoot = await createTempDir();

    const smallHistoryEngine = new CrudEngine(projectRoot, {
      ...DEV_CONFIG,
      versioning: { ...DEV_CONFIG.versioning, historySize: 2 },
    });

    await smallHistoryEngine.createSkill(createTestSkill({ name: 'skill-1' }));
    expect(smallHistoryEngine.getHistory().isFull()).toBe(false);

    await smallHistoryEngine.createSkill(createTestSkill({ name: 'skill-2' }));
    expect(smallHistoryEngine.getHistory().isFull()).toBe(true);

    await cleanupTempDir(projectRoot);
  });
});
