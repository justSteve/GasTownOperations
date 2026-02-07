#!/usr/bin/env bun
/**
 * Explorer Engine Live Demo
 *
 * Full pipeline execution with real Claude CLI:
 * 1. Load Scene 0.1 (Pipeline Test)
 * 2. Generate config with observer hooks
 * 3. Execute via real Claude CLI
 * 4. Capture events to JSONL
 * 5. Report results
 */

import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import {
  loadScene,
  resolveParameters,
  generateConfig,
  createExecutor,
  createConsoleLogger,
  createEventEmitter,
} from './src/index.js';

const SCENES_DIR = join(import.meta.dir, 'scenes');
const OBSERVER_SCRIPT = join(import.meta.dir, 'scripts', 'observer.sh');

// Parse arguments
const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--'));
const positional = args.filter((a) => !a.startsWith('--'));

// Configuration
const CONFIG = {
  scenePath: positional[0] || join(SCENES_DIR, 'scene-0.1-pipeline-test.yaml'),
  claudeCliPath: process.env.CLAUDE_CLI || 'claude',
  preserveConfig: flags.includes('--preserve'),
  verbose: flags.includes('--verbose'),
  timeoutMs: 60000, // 1 minute for simple tests
};

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  Explorer Engine - LIVE Demo');
  console.log('='.repeat(60) + '\n');

  // Step 1: Load Scene
  console.log('📖 Loading scene...');
  const scene = loadScene(CONFIG.scenePath);
  console.log(`   Scene: ${scene.scene.id}`);
  console.log(`   Title: ${scene.scene.title}`);
  console.log(`   Steps: ${scene.executionSteps.length}`);
  console.log();

  // Step 2: Resolve Parameters
  console.log('⚙️  Resolving parameters...');
  const params = resolveParameters(scene, {});
  if (CONFIG.verbose) {
    console.log('   Params:', JSON.stringify(params, null, 2));
  }
  console.log();

  // Step 3: Generate Config with Observer Hooks
  console.log('🔧 Generating configuration...');
  const config = generateConfig(scene, params, {
    observerScript: OBSERVER_SCRIPT,
    cleanupOnExit: !CONFIG.preserveConfig,
  });
  console.log(`   Config dir: ${config.configDir}`);
  console.log(`   Event log: ${config.configDir}/events.jsonl`);
  console.log(`   Observer: ${OBSERVER_SCRIPT}`);
  console.log();

  // Step 4: Set up Event Emitter and Logger
  console.log('📡 Setting up event stream...');
  const emitter = createEventEmitter();
  const logger = createConsoleLogger(emitter);
  logger.start();

  // Listen for executor events
  emitter.on('scene:start', (data) => {
    console.log(`\n🎬 Scene started: ${data.sceneId}`);
  });

  emitter.on('scene:step', (data) => {
    console.log(`   Step ${data.step}: ${data.action}`);
    if (data.commentary) {
      console.log(`   └─ ${data.commentary}`);
    }
  });

  emitter.on('scene:complete', (data) => {
    console.log(`\n✅ Scene complete: ${data.stepsCompleted} steps in ${data.durationMs}ms`);
  });

  emitter.on('scene:error', (data) => {
    console.log(`\n❌ Scene error at step ${data.step}: ${data.error.message}`);
  });

  // Step 5: Create Executor with REAL Claude CLI
  console.log('🎬 Creating executor...');
  const executor = createExecutor({
    claudeCliPath: CONFIG.claudeCliPath,
    timeoutMs: CONFIG.timeoutMs,
    eventEmitter: emitter,
    workingDir: config.configDir, // Run in config dir so .claude/ is found
    // Demo mode: skip permission prompts for automated testing
    // Production code should NOT use this flag
    dangerouslySkipPermissions: true,
  });

  // Listen for executor output
  executor.on('output', ({ type, data }: { type: string; data: string }) => {
    if (CONFIG.verbose) {
      const prefix = type === 'stderr' ? '⚠️ ' : '';
      process.stdout.write(prefix + data);
    }
  });

  executor.on('warning', ({ step, message }: { step: number; message: string }) => {
    console.log(`   ⚠️  Step ${step}: ${message}`);
  });

  console.log(`   CLI: ${CONFIG.claudeCliPath}`);
  console.log(`   Timeout: ${CONFIG.timeoutMs}ms`);
  console.log();

  // Step 6: EXECUTE FOR REAL
  console.log('🚀 Executing scene with LIVE Claude...\n');
  console.log('-'.repeat(60));

  const result = await executor.execute(scene, config, params);

  console.log('-'.repeat(60) + '\n');

  // Step 7: Report Results
  console.log('📊 Execution Results:');
  console.log(`   Success: ${result.success}`);
  console.log(`   Steps: ${result.stepsCompleted}/${result.totalSteps}`);
  console.log(`   Duration: ${result.durationMs}ms`);

  if (result.error) {
    console.log(`   Error: ${result.error.message}`);
  }
  console.log();

  // Step 8: Show Captured Events
  const eventLogPath = join(config.configDir, 'events.jsonl');
  console.log('📁 Event Log:');
  console.log(`   Path: ${eventLogPath}`);

  if (existsSync(eventLogPath)) {
    const events = readFileSync(eventLogPath, 'utf-8')
      .trim()
      .split('\n')
      .filter((l) => l.length > 0);
    console.log(`   Events captured: ${events.length}`);

    if (events.length > 0) {
      console.log('\n   Events:');
      for (const line of events) {
        try {
          const event = JSON.parse(line);
          console.log(`   - [${event.type}] ${event.data?.tool || event.data?.hook || 'unknown'}`);
        } catch {
          console.log(`   - (raw) ${line.slice(0, 80)}...`);
        }
      }
    }
  } else {
    console.log('   ⚠️  No events captured (file not created)');
    console.log('   This may indicate hooks did not fire.');
  }
  console.log();

  // Step 9: Cleanup info
  if (CONFIG.preserveConfig) {
    console.log('💾 Config preserved for inspection:');
    console.log(`   ${config.configDir}/`);
    console.log(`   ├── .claude/settings.json  (hooks config)`);
    console.log(`   ├── .claude/skills/        (generated skills)`);
    console.log(`   └── events.jsonl           (captured events)`);
  } else {
    console.log('🧹 Config will be cleaned up on exit.');
    console.log('   Use --preserve to keep for inspection.');
  }

  console.log('\n' + '='.repeat(60));
  console.log('  Demo Complete');
  console.log('='.repeat(60) + '\n');

  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// Run
main().catch((err) => {
  console.error('❌ Demo failed:', err);
  process.exit(1);
});
