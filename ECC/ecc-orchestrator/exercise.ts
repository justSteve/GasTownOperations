#!/usr/bin/env bun
/**
 * Explorer Engine Exercise Script
 *
 * Runs the engine with full logging infrastructure for post-execution review.
 * Unlike demo-live.ts (presentation mode), this focuses on observability.
 *
 * Output:
 * - logs/<timestamp>/engine.jsonl  - Engine operation logs
 * - logs/<timestamp>/events.jsonl  - Hook-captured events
 *
 * Usage:
 *   bun exercise.ts [scene-path] [options]
 *
 * Options:
 *   --verbose       Show detailed output during execution
 *   --log-dir=PATH  Custom log directory (default: ./logs)
 */

import { join, basename } from 'node:path';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import {
  loadScene,
  resolveParameters,
  generateConfig,
  createExecutor,
  createEventEmitter,
  createLogger,
  FileTransport,
} from './src/index.js';

const SCENES_DIR = join(import.meta.dir, 'scenes');
const OBSERVER_SCRIPT = join(import.meta.dir, 'scripts', 'observer.sh');

// Parse arguments
const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--'));
const positional = args.filter((a) => !a.startsWith('--'));

// Extract flag values
function getFlag(name: string): string | undefined {
  const flag = flags.find((f) => f.startsWith(`--${name}=`));
  return flag?.split('=')[1];
}

// Configuration
const CONFIG = {
  scenePath: positional[0] || join(SCENES_DIR, 'scene-0.1-pipeline-test.yaml'),
  claudeCliPath: process.env.CLAUDE_CLI || 'claude',
  verbose: flags.includes('--verbose'),
  logDir: getFlag('log-dir') || './logs',
  timeoutMs: 120000, // 2 minutes
};

async function main() {
  // Create timestamped log directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const runLogDir = join(CONFIG.logDir, timestamp);
  mkdirSync(runLogDir, { recursive: true });

  const engineLogPath = join(runLogDir, 'engine.jsonl');
  const eventsLogPath = join(runLogDir, 'events.jsonl');

  console.log('\n' + '='.repeat(60));
  console.log('  Explorer Engine - Exercise Mode');
  console.log('='.repeat(60) + '\n');

  console.log('Log directory:', runLogDir);
  console.log('Engine log:  ', engineLogPath);
  console.log('Events log:  ', eventsLogPath);
  console.log();

  // Step 1: Set up logging infrastructure
  const emitter = createEventEmitter();
  const fileTransport = new FileTransport({ filePath: engineLogPath });
  const logger = createLogger({
    level: 'DEBUG', // Capture all log levels for full observability
    transports: [fileTransport],
    defaultContext: {
      component: 'exercise',
      runId: timestamp,
    },
  });

  logger.info('Exercise started', {
    scenePath: CONFIG.scenePath,
    logDir: runLogDir,
  });

  // Step 2: Load Scene
  console.log('Loading scene...');
  const scene = loadScene(CONFIG.scenePath);
  console.log(`  Scene: ${scene.scene.id}`);
  console.log(`  Title: ${scene.scene.title}`);

  logger.info('Scene loaded', {
    sceneId: scene.scene.id,
    title: scene.scene.title,
    steps: scene.executionSteps.length,
  });

  // Step 3: Resolve Parameters
  const params = resolveParameters(scene, {});

  logger.info('Parameters resolved', { params });

  // Step 4: Generate Config
  console.log('Generating configuration...');
  const config = generateConfig(scene, params, {
    observerScript: OBSERVER_SCRIPT,
    cleanupOnExit: false, // Keep config for inspection
  });

  logger.info('Configuration generated', {
    configDir: config.configDir,
    settingsPath: config.settingsPath,
  });

  // Step 5: Wire up event logging
  emitter.on('scene:start', (data) => {
    logger.info('Scene started', data);
    console.log(`\nScene started: ${data.sceneId}`);
  });

  emitter.on('scene:step', (data) => {
    logger.info('Step executing', data);
    if (CONFIG.verbose) {
      console.log(`  Step ${data.step}: ${data.action}`);
    }
  });

  emitter.on('scene:complete', (data) => {
    logger.info('Scene completed', data);
    console.log(`\nScene completed: ${data.stepsCompleted} steps in ${data.durationMs}ms`);
  });

  emitter.on('scene:error', (data) => {
    logger.error('Scene error', data);
    console.log(`\nScene error at step ${data.step}: ${data.error.message}`);
  });

  // Step 6: Create Executor
  // Note: NOT using dangerouslySkipPermissions - this is exercise mode
  const executor = createExecutor({
    claudeCliPath: CONFIG.claudeCliPath,
    timeoutMs: CONFIG.timeoutMs,
    eventEmitter: emitter,
    workingDir: config.configDir,
  });

  // Log executor output
  executor.on('output', ({ type, data }: { type: string; data: string }) => {
    logger.debug('CLI output', { type, data: data.trim() });
    if (CONFIG.verbose) {
      process.stdout.write(data);
    }
  });

  executor.on('warning', ({ step, message }: { step: number; message: string }) => {
    logger.warn('Executor warning', { step, message });
    console.log(`  Warning at step ${step}: ${message}`);
  });

  // Step 7: Execute
  console.log('\nExecuting scene...\n');
  console.log('-'.repeat(60));

  const result = await executor.execute(scene, config, params);

  console.log('-'.repeat(60));

  // Step 8: Log Results
  logger.info('Execution completed', {
    success: result.success,
    stepsCompleted: result.stepsCompleted,
    totalSteps: result.totalSteps,
    durationMs: result.durationMs,
    error: result.error,
  });

  // Flush logs
  await fileTransport.flush();

  // Step 9: Report
  console.log('\nExecution Results:');
  console.log(`  Success: ${result.success}`);
  console.log(`  Steps: ${result.stepsCompleted}/${result.totalSteps}`);
  console.log(`  Duration: ${result.durationMs}ms`);

  if (result.error) {
    console.log(`  Error: ${result.error.message}`);
  }

  // Step 10: Show log summary
  console.log('\nLogs created:');

  // Engine logs
  if (existsSync(engineLogPath)) {
    const lines = readFileSync(engineLogPath, 'utf-8').trim().split('\n').filter(Boolean);
    console.log(`  Engine log: ${lines.length} entries`);
    console.log(`    ${engineLogPath}`);
  }

  // Hook events
  const hookEventsPath = join(config.configDir, 'events.jsonl');
  if (existsSync(hookEventsPath)) {
    const events = readFileSync(hookEventsPath, 'utf-8').trim().split('\n').filter(Boolean);
    console.log(`  Hook events: ${events.length} entries`);
    console.log(`    ${hookEventsPath}`);
  }

  console.log('\nTo review logs:');
  console.log(`  cat ${engineLogPath} | jq .`);
  console.log(`  grep '"level":"ERROR"' ${engineLogPath}`);

  console.log('\n' + '='.repeat(60));
  console.log('  Exercise Complete');
  console.log('='.repeat(60) + '\n');

  process.exit(result.success ? 0 : 1);
}

// Run
main().catch((err) => {
  console.error('Exercise failed:', err);
  process.exit(1);
});
