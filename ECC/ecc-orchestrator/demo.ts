#!/usr/bin/env bun
/**
 * Explorer Engine Demo
 *
 * Demonstrates the full pipeline:
 * 1. Load Scene 1.1 (Basic Skill)
 * 2. Generate temp config
 * 3. Show event streaming
 */

import { join } from 'node:path';
import {
  loadScene,
  resolveParameters,
  generateConfig,
  cleanupConfig,
  createExecutor,
  createConsoleLogger,
  createEventEmitter,
} from './src/index.js';

const SCENES_DIR = join(import.meta.dir, 'scenes');
const OBSERVER_SCRIPT = join(import.meta.dir, 'scripts', 'observer.sh');

async function demo() {
  console.log('\n========================================');
  console.log('  Explorer Engine Demo');
  console.log('========================================\n');

  // Step 1: Load Scene 1.1
  console.log('📖 Loading Scene 1.1 (Basic Skill Creation)...\n');
  const scenePath = join(SCENES_DIR, 'scene-1.1-basic-skill.yaml');
  const scene = loadScene(scenePath);

  console.log(`  Scene ID: ${scene.scene.id}`);
  console.log(`  Title: ${scene.scene.title}`);
  console.log(`  Act: ${scene.scene.act}`);
  console.log(`  Purpose: ${scene.purpose.oneLiner}`);
  console.log(`  Steps: ${scene.executionSteps.length}`);
  console.log(`  Parameters: ${scene.parameters.map((p) => p.name).join(', ')}`);
  console.log();

  // Step 2: Resolve parameters
  console.log('⚙️  Resolving parameters...\n');
  const params = resolveParameters(scene, {
    skill_name: 'explorer-demo',
    greeting_message: 'Hello from the Explorer Demo!',
  });
  console.log('  Resolved:', JSON.stringify(params, null, 2));
  console.log();

  // Step 3: Generate config
  console.log('🔧 Generating Claude Code configuration...\n');
  const config = generateConfig(scene, params, {
    observerScript: OBSERVER_SCRIPT,
    cleanupOnExit: true,
  });

  console.log(`  Config dir: ${config.configDir}`);
  console.log(`  Settings: ${config.settingsPath}`);
  console.log(`  Skills generated: ${config.skills.length}`);
  console.log(`  Hooks configured: ${Object.keys(config.settings.hooks || {}).length} types`);
  console.log();

  // Step 4: Set up event emitter and logger
  console.log('📡 Setting up event stream...\n');
  const emitter = createEventEmitter();
  const logger = createConsoleLogger(emitter);
  logger.start();

  // Step 5: Create executor (won't actually run Claude, just demo the flow)
  console.log('🎬 Creating executor...\n');
  const executor = createExecutor({
    eventEmitter: emitter,
    claudeCliPath: 'echo', // Use echo instead of claude for demo
    timeoutMs: 5000,
  });

  console.log(`  Executor state: ${executor.getState()}`);
  console.log();

  // Step 6: Simulate scene execution events
  console.log('🎭 Simulating scene execution events...\n');

  emitter.emit('scene:start', {
    sceneId: scene.scene.id,
    actId: String(scene.scene.act),
    parameters: params as Record<string, unknown>,
  });

  for (const step of scene.executionSteps) {
    await delay(500);
    emitter.emit('scene:step', {
      sceneId: scene.scene.id,
      step: step.step,
      action: step.action,
      commentary: step.commentary?.l1,
    });
  }

  await delay(500);
  emitter.emit('scene:complete', {
    sceneId: scene.scene.id,
    durationMs: 1500,
    stepsCompleted: scene.executionSteps.length,
  });

  console.log('\n========================================');
  console.log('  Demo Complete!');
  console.log('========================================\n');

  // Show what was generated
  console.log('📁 Generated skill content:\n');
  if (config.skills[0]) {
    const { readFileSync } = await import('node:fs');
    const skillContent = readFileSync(config.skills[0].path, 'utf-8');
    console.log(skillContent);
  }

  // Cleanup
  console.log('🧹 Cleaning up...');
  cleanupConfig(config.configDir);
  console.log('  Done!\n');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run demo
demo().catch(console.error);
