#!/usr/bin/env bun
/**
 * CrudEngine Integration Demo
 *
 * Demonstrates the Explorer-CrudEngine integration:
 * 1. Load a scene with skills/agents
 * 2. Create CrudEngine pointed at the config directory
 * 3. Generate config using CrudEngine (with traffic logging)
 * 4. Show created artifacts and operation history
 */

import { join } from 'node:path';
import { existsSync, readdirSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import {
  loadScene,
  resolveParameters,
  generateConfig,
  cleanupConfig,
} from './src/index.js';
import { createCrudEngine } from '../ecc-crud/src/index.js';

const SCENES_DIR = join(import.meta.dir, 'scenes');
const OBSERVER_SCRIPT = join(import.meta.dir, 'scripts', 'observer.sh');

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  CrudEngine Integration Demo');
  console.log('='.repeat(60) + '\n');

  // Step 1: Load scene with skills and agents
  console.log('📖 Loading scene...');
  const scenePath = join(SCENES_DIR, 'scene-crud-demo.yaml');
  const scene = loadScene(scenePath);
  console.log(`   Scene: ${scene.scene.id}`);
  console.log(`   Title: ${scene.scene.title}`);
  console.log(`   Assets: ${scene.assets.files.length} files\n`);

  // Step 2: Pre-create the config directory so we can point CrudEngine at it
  const configId = randomUUID().slice(0, 8);
  const configDir = join(tmpdir(), `explorer-${scene.scene.id}-${configId}`);
  mkdirSync(configDir, { recursive: true });
  console.log(`📁 Config directory: ${configDir}\n`);

  // Step 3: Create CrudEngine in development mode (verbose logging)
  console.log('🔧 Creating CrudEngine (development mode)...');
  const engine = createCrudEngine(configDir, 'development');
  console.log('   ✓ Engine created with traffic logging enabled\n');

  // Step 4: Generate config WITH CrudEngine
  console.log('⚙️  Generating config with CrudEngine...\n');
  console.log('─'.repeat(60));
  console.log('Traffic Log (CrudEngine console output):');
  console.log('─'.repeat(60));

  const params = resolveParameters(scene, {});
  const config = await generateConfig(scene, params, {
    observerScript: OBSERVER_SCRIPT,
    baseDir: tmpdir(),
    crudEngine: engine,
  });

  console.log('─'.repeat(60) + '\n');

  // Step 5: Show results
  console.log('📊 Generation Results:\n');
  console.log(`   Config directory: ${config.configDir}`);
  console.log(`   Settings path: ${config.settingsPath}`);
  console.log(`   Skills created: ${config.skills.length}`);
  console.log(`   Agents created: ${config.agents.length}`);
  console.log(`   Hooks created: ${config.hooks.length}\n`);

  // Step 6: Show operation history from CrudEngine
  console.log('📜 CrudEngine Operation History:\n');
  const history = engine.getRecentOperations(10);

  if (history.length === 0) {
    console.log('   (No operations recorded in history)');
    console.log('   Note: Check if artifacts were created via CrudEngine path.\n');
  } else {
    for (const entry of history) {
      const op = entry.operation;
      const opType = 'type' in op ? op.type : 'unknown';
      const artifactType = 'artifactType' in op ? op.artifactType : 'unknown';
      console.log(`   📝 ${entry.timestamp}`);
      console.log(`      Operation: ${opType.toUpperCase()} ${artifactType}`);
      console.log(`      Duration: ${entry.result.durationMs}ms`);
      console.log(`      Success: ${entry.result.success ? '✅' : '❌'}`);
      if (entry.result.path) {
        console.log(`      Path: ${entry.result.path}`);
      }
      console.log('');
    }
  }

  // Step 7: List created files in config directory
  console.log('📂 Created Files in Config Directory:\n');
  const claudeDir = join(config.configDir, '.claude');

  if (existsSync(claudeDir)) {
    const listDir = (dir: string, indent: string = '   ') => {
      if (!existsSync(dir)) return;
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          console.log(`${indent}📁 ${entry.name}/`);
          listDir(fullPath, indent + '   ');
        } else {
          console.log(`${indent}📄 ${entry.name}`);
        }
      }
    };

    console.log('   .claude/');
    listDir(claudeDir, '      ');
  }

  // Step 8: Also check CrudEngine's projectRoot for artifacts
  console.log('\n📂 CrudEngine Project Root (.claude/):\n');
  const engineClaudeDir = join(configDir, '.claude');

  if (existsSync(engineClaudeDir)) {
    const listDir = (dir: string, indent: string = '   ') => {
      if (!existsSync(dir)) return;
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          console.log(`${indent}📁 ${entry.name}/`);
          listDir(fullPath, indent + '   ');
        } else {
          console.log(`${indent}📄 ${entry.name}`);
        }
      }
    };

    console.log('   .claude/');
    listDir(engineClaudeDir, '      ');
  } else {
    console.log('   (No .claude directory created by CrudEngine)');
  }

  // Cleanup
  console.log('\n🧹 Cleaning up...');
  cleanupConfig(config.configDir);
  cleanupConfig(configDir);
  console.log('   ✓ Done\n');

  console.log('='.repeat(60));
  console.log('  Demo Complete!');
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error);
