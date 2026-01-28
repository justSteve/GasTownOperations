#!/usr/bin/env node
/**
 * ECC Materializer CLI Entry Point
 *
 * Command-line interface for materializing ECC Plugin templates
 * into Claude Code .claude/ folder structures (zgents).
 */

import { Command } from 'commander';
import { loadEccData } from './ecc-data-loader.js';
import { resolvePlugin } from './ecc-entity-resolver.js';
import { materializeZgent } from './ecc-file-writer.js';
import type { EccZgent } from './ecc-types.js';

const program = new Command();

program
  .name('ecc-materialize')
  .description('Materialize ECC Plugin templates into Claude Code .claude/ folder structures')
  .version('1.0.0');

program
  .command('materialize')
  .description('Materialize a zgent instance from ECC data')
  .requiredOption('--zgent-id <id>', 'ID of the zgent to materialize')
  .option('--data-dir <path>', 'Path to ECC data directory', '../data')
  .option('--dry-run', 'Show what would be created without writing files')
  .action(async (options) => {
    try {
      console.log(`Loading ECC data from: ${options.dataDir}`);
      const eccData = await loadEccData(options.dataDir);

      // Find the zgent
      const zgent = eccData.zgents.find((z: EccZgent) => z.id === options.zgentId);
      if (!zgent) {
        console.error(`Error: Zgent with ID '${options.zgentId}' not found`);
        process.exit(1);
      }

      console.log(`Found zgent: ${zgent.name}`);
      console.log(`  Plugin ID: ${zgent.pluginId}`);
      console.log(`  Target path: ${zgent.targetPath}`);
      console.log(`  Status: ${zgent.status}`);

      // Resolve the plugin and all its entities
      const resolvedPlugin = resolvePlugin(zgent.pluginId, eccData);
      console.log(`\nResolved plugin: ${resolvedPlugin.plugin.name}`);
      console.log(`  Agents: ${resolvedPlugin.agents.length}`);
      console.log(`  Commands: ${resolvedPlugin.commands.length}`);
      console.log(`  Skills: ${resolvedPlugin.skills.length}`);
      console.log(`  Rules: ${resolvedPlugin.rules.length}`);
      console.log(`  Hooks: ${resolvedPlugin.hooks.length}`);
      console.log(`  Contexts: ${resolvedPlugin.contexts.length}`);
      console.log(`  MCP Servers: ${resolvedPlugin.mcpServers.length}`);

      if (options.dryRun) {
        console.log('\n[DRY RUN] Would materialize to:', zgent.targetPath);
        // TODO: Show what files would be created
      } else {
        console.log('\nMaterializing...');
        await materializeZgent(zgent, resolvedPlugin, options.dataDir);
        console.log(`\nSuccess! Materialized zgent to: ${zgent.targetPath}`);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all zgent instances')
  .option('--data-dir <path>', 'Path to ECC data directory', '../data')
  .action(async (options) => {
    try {
      const eccData = await loadEccData(options.dataDir);

      console.log('Zgent Instances:\n');
      if (eccData.zgents.length === 0) {
        console.log('  (none)');
      } else {
        for (const zgent of eccData.zgents) {
          const plugin = eccData.plugins.find((p: { id: string }) => p.id === zgent.pluginId);
          console.log(`  ${zgent.id}`);
          console.log(`    Name: ${zgent.name}`);
          console.log(`    Plugin: ${plugin?.name ?? 'unknown'}`);
          console.log(`    Target: ${zgent.targetPath}`);
          console.log(`    Status: ${zgent.status}`);
          console.log('');
        }
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('plugins')
  .description('List all available plugins')
  .option('--data-dir <path>', 'Path to ECC data directory', '../data')
  .action(async (options) => {
    try {
      const eccData = await loadEccData(options.dataDir);

      console.log('Available Plugins:\n');
      if (eccData.plugins.length === 0) {
        console.log('  (none)');
      } else {
        for (const plugin of eccData.plugins) {
          console.log(`  ${plugin.id}`);
          console.log(`    Name: ${plugin.name}`);
          console.log(`    Version: ${plugin.version ?? 'n/a'}`);
          console.log(`    Description: ${plugin.description ?? 'n/a'}`);
          console.log('');
        }
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
