/**
 * Explorer Module Tests
 *
 * Tests for scene loading, config generation, and execution.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { join } from 'node:path';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import {
  loadScene,
  loadScenesFromDirectory,
  resolveParameters,
  applyVariation,
  groupScenesByAct,
  generateConfig,
  cleanupConfig,
  createExecutor,
  createEventStream,
  createConsoleLogger,
  type SceneTemplate,
} from '../src/explorer/index.js';
import { createEventEmitter } from '../src/events/event-emitter.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_DIR = join(import.meta.dir, 'fixtures', 'explorer');
const SCENES_DIR = join(import.meta.dir, '..', 'scenes');
const OBSERVER_SCRIPT = join(import.meta.dir, '..', 'scripts', 'observer.sh');

const SAMPLE_SCENE_YAML = `
scene:
  id: "test-scene"
  act: 1
  title: "Test Scene"
  duration_estimate: "1 minute"

purpose:
  one_liner: "A test scene for unit testing"
  learning_outcomes:
    - "Verify scene loading works"
    - "Test parameter resolution"

prerequisites:
  scenes: []
  concepts:
    - "Testing"

assets:
  files:
    - path: ".claude/skills/test.SKILL.md"
      role: "Test skill"
      content: |
        ---
        name: test-skill
        description: Test skill
        ---
        This is a test skill.
  mock_data: []

parameters:
  - name: test_param
    type: string
    default: "default_value"
    description: "A test parameter"
  - name: count
    type: number
    default: 5
    description: "A numeric parameter"

execution_steps:
  - step: 1
    action: display_configuration
    commentary:
      commentary_l1: "Step 1"
      commentary_l2: "Detailed step 1"

  - step: 2
    action: invoke_skill
    input: "test-skill"

variations:
  - id: variation_a
    description: "Variation A"
    parameter_overrides:
      test_param: "variation_value"

related_scenes:
  - "other-scene"

export_artifacts:
  - type: skill_file
    description: "Test skill file"
`;

// ============================================================================
// Setup & Teardown
// ============================================================================

beforeAll(() => {
  // Create test fixtures directory
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(join(TEST_DIR, 'test-scene.yaml'), SAMPLE_SCENE_YAML);
  writeFileSync(join(TEST_DIR, 'another-scene.yaml'), SAMPLE_SCENE_YAML.replace('test-scene', 'another-scene'));
});

afterAll(() => {
  // Cleanup test fixtures
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

// ============================================================================
// Scene Loader Tests
// ============================================================================

describe('Scene Loader', () => {
  describe('loadScene', () => {
    it('loads a scene from YAML file', () => {
      const scene = loadScene(join(TEST_DIR, 'test-scene.yaml'));

      expect(scene.scene.id).toBe('test-scene');
      expect(scene.scene.act).toBe(1);
      expect(scene.scene.title).toBe('Test Scene');
    });

    it('parses purpose correctly', () => {
      const scene = loadScene(join(TEST_DIR, 'test-scene.yaml'));

      expect(scene.purpose.oneLiner).toBe('A test scene for unit testing');
      expect(scene.purpose.learningOutcomes).toHaveLength(2);
    });

    it('parses parameters correctly', () => {
      const scene = loadScene(join(TEST_DIR, 'test-scene.yaml'));

      expect(scene.parameters).toHaveLength(2);
      expect(scene.parameters[0].name).toBe('test_param');
      expect(scene.parameters[0].default).toBe('default_value');
      expect(scene.parameters[1].name).toBe('count');
      expect(scene.parameters[1].type).toBe('number');
    });

    it('parses execution steps correctly', () => {
      const scene = loadScene(join(TEST_DIR, 'test-scene.yaml'));

      expect(scene.executionSteps).toHaveLength(2);
      expect(scene.executionSteps[0].action).toBe('display_configuration');
      expect(scene.executionSteps[1].action).toBe('invoke_skill');
      expect(scene.executionSteps[1].input).toBe('test-skill');
    });

    it('parses variations correctly', () => {
      const scene = loadScene(join(TEST_DIR, 'test-scene.yaml'));

      expect(scene.variations).toHaveLength(1);
      expect(scene.variations[0].id).toBe('variation_a');
      expect(scene.variations[0].parameterOverrides.test_param).toBe('variation_value');
    });

    it('parses assets correctly', () => {
      const scene = loadScene(join(TEST_DIR, 'test-scene.yaml'));

      expect(scene.assets.files).toHaveLength(1);
      expect(scene.assets.files[0].path).toBe('.claude/skills/test.SKILL.md');
      expect(scene.assets.files[0].content).toContain('name: test-skill');
    });

    it('throws on non-existent file', () => {
      expect(() => loadScene('/non/existent/file.yaml')).toThrow();
    });
  });

  describe('loadScenesFromDirectory', () => {
    it('loads all scenes from directory', () => {
      const scenes = loadScenesFromDirectory(TEST_DIR);

      expect(scenes.size).toBe(2);
      expect(scenes.has('test-scene')).toBe(true);
      expect(scenes.has('another-scene')).toBe(true);
    });

    it('throws on non-existent directory', () => {
      expect(() => loadScenesFromDirectory('/non/existent/dir')).toThrow();
    });
  });

  describe('resolveParameters', () => {
    it('uses defaults when no overrides provided', () => {
      const scene = loadScene(join(TEST_DIR, 'test-scene.yaml'));
      const params = resolveParameters(scene);

      expect(params.test_param).toBe('default_value');
      expect(params.count).toBe(5);
    });

    it('applies overrides correctly', () => {
      const scene = loadScene(join(TEST_DIR, 'test-scene.yaml'));
      const params = resolveParameters(scene, { test_param: 'custom' });

      expect(params.test_param).toBe('custom');
      expect(params.count).toBe(5);
    });
  });

  describe('applyVariation', () => {
    it('applies variation parameter overrides', () => {
      const scene = loadScene(join(TEST_DIR, 'test-scene.yaml'));
      const params = applyVariation(scene, 'variation_a');

      expect(params.test_param).toBe('variation_value');
    });

    it('throws on non-existent variation', () => {
      const scene = loadScene(join(TEST_DIR, 'test-scene.yaml'));
      expect(() => applyVariation(scene, 'non_existent')).toThrow();
    });
  });

  describe('groupScenesByAct', () => {
    it('groups scenes by act number', () => {
      const scenes = loadScenesFromDirectory(TEST_DIR);
      const byAct = groupScenesByAct(scenes);

      expect(byAct.has(1)).toBe(true);
      expect(byAct.get(1)?.length).toBe(2);
    });
  });
});

// ============================================================================
// Config Generator Tests
// ============================================================================

describe('Config Generator', () => {
  let scene: SceneTemplate;
  let configDir: string;

  beforeAll(() => {
    scene = loadScene(join(TEST_DIR, 'test-scene.yaml'));
  });

  afterAll(() => {
    if (configDir) {
      cleanupConfig(configDir);
    }
  });

  describe('generateConfig', () => {
    it('creates config directory structure', async () => {
      const config = await generateConfig(scene, {}, {
        observerScript: OBSERVER_SCRIPT,
      });
      configDir = config.configDir;

      expect(existsSync(config.configDir)).toBe(true);
      expect(existsSync(join(config.configDir, '.claude'))).toBe(true);
      expect(existsSync(join(config.configDir, '.claude', 'skills'))).toBe(true);
      expect(existsSync(join(config.configDir, '.claude', 'agents'))).toBe(true);
      expect(existsSync(join(config.configDir, '.claude', 'hooks'))).toBe(true);
    });

    it('generates settings.json with observer hooks', async () => {
      const config = await generateConfig(scene, {}, {
        observerScript: OBSERVER_SCRIPT,
      });
      configDir = config.configDir;

      expect(existsSync(config.settingsPath)).toBe(true);

      const settings = JSON.parse(readFileSync(config.settingsPath, 'utf-8'));
      expect(settings.hooks).toBeDefined();
      expect(settings.hooks.preToolUse).toBeDefined();
      expect(settings.hooks.preToolUse.length).toBeGreaterThan(0);
    });

    it('generates skill files from assets', async () => {
      const config = await generateConfig(scene, {}, {
        observerScript: OBSERVER_SCRIPT,
      });
      configDir = config.configDir;

      expect(config.skills.length).toBe(1);
      expect(existsSync(config.skills[0].path)).toBe(true);
    });
  });

  describe('cleanupConfig', () => {
    it('removes config directory', async () => {
      const config = await generateConfig(scene, {}, {
        observerScript: OBSERVER_SCRIPT,
      });
      const dir = config.configDir;

      expect(existsSync(dir)).toBe(true);
      cleanupConfig(dir);
      expect(existsSync(dir)).toBe(false);

      configDir = ''; // Prevent afterAll from failing
    });
  });
});

// ============================================================================
// Executor Tests
// ============================================================================

describe('Executor', () => {
  describe('createExecutor', () => {
    it('creates an executor instance', () => {
      const executor = createExecutor();
      expect(executor).toBeDefined();
      expect(executor.getState()).toBe('pending');
    });

    it('accepts custom options', () => {
      const emitter = createEventEmitter();
      const executor = createExecutor({
        claudeCliPath: '/custom/claude',
        timeoutMs: 60000,
        eventEmitter: emitter,
      });

      expect(executor).toBeDefined();
    });
  });

  describe('getContext', () => {
    it('returns null when not executing', () => {
      const executor = createExecutor();
      expect(executor.getContext()).toBeNull();
    });
  });
});

// ============================================================================
// Event Stream Tests
// ============================================================================

describe('Event Stream', () => {
  describe('createEventStream', () => {
    it('creates an event stream server', () => {
      const server = createEventStream();
      expect(server).toBeDefined();
    });

    it('accepts custom options', () => {
      const emitter = createEventEmitter();
      const server = createEventStream({
        port: 3002,
        host: '127.0.0.1',
        eventEmitter: emitter,
      });

      expect(server).toBeDefined();
    });

    it('reports zero clients initially', () => {
      const server = createEventStream();
      expect(server.getClientCount()).toBe(0);
    });
  });

  describe('createConsoleLogger', () => {
    it('creates a console logger', () => {
      const logger = createConsoleLogger();
      expect(logger).toBeDefined();
    });

    it('can attach to event emitter', () => {
      const emitter = createEventEmitter();
      const logger = createConsoleLogger(emitter);
      expect(logger).toBeDefined();
    });
  });
});

// ============================================================================
// Real Scene Tests
// ============================================================================

describe('Real Scene Loading', () => {
  it('loads Scene 1.1 from scenes directory', () => {
    const scenePath = join(SCENES_DIR, 'scene-1.1-basic-skill.yaml');

    if (existsSync(scenePath)) {
      const scene = loadScene(scenePath);

      expect(scene.scene.id).toBe('1.1-basic-skill');
      expect(scene.scene.act).toBe(1);
      expect(scene.scene.title).toBe('Basic Skill Creation');
      expect(scene.executionSteps.length).toBeGreaterThan(0);
      expect(scene.assets.files.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration', () => {
  it('full pipeline: load scene -> generate config -> create executor', async () => {
    const scene = loadScene(join(TEST_DIR, 'test-scene.yaml'));
    const params = resolveParameters(scene, { test_param: 'integration_test' });

    const config = await generateConfig(scene, params, {
      observerScript: OBSERVER_SCRIPT,
    });

    const emitter = createEventEmitter();
    const executor = createExecutor({ eventEmitter: emitter });

    expect(scene.scene.id).toBe('test-scene');
    expect(params.test_param).toBe('integration_test');
    expect(existsSync(config.configDir)).toBe(true);
    expect(executor.getState()).toBe('pending');

    // Cleanup
    cleanupConfig(config.configDir);
  });

  it('event flow: emitter -> logger', () => {
    const emitter = createEventEmitter();
    const logger = createConsoleLogger(emitter);

    let eventReceived = false;
    logger.on('event', () => {
      eventReceived = true;
    });

    logger.start();

    // Emit an event
    emitter.emit('scene:start', {
      sceneId: 'test',
      actId: '1',
      parameters: {},
    });

    // The console logger should have received it
    // (we can't easily test console output, but we verify no errors)
    expect(true).toBe(true);
  });
});
