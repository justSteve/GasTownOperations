/**
 * ECC File Writer
 *
 * Materializes ECC entities into the Claude Code .claude/ folder structure.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import type { EccZgent, ResolvedPlugin, EccConfigOverrides } from './ecc-types.js';
import { saveZgents, type EccData } from './ecc-data-loader.js';
import {
  generateAgentFile,
  getAgentFilePath,
  generateCommandFile,
  getCommandFilePath,
  generateSkillFile,
  getSkillFilePath,
  generateRuleFile,
  getRuleFilePath,
  generateContextFile,
  getContextFilePath,
  generateHooksJson,
  getHooksFilePath,
  generateSettingsJson,
  getSettingsFilePath,
} from './templates/index.js';

/**
 * File to be written
 */
interface OutputFile {
  path: string;
  content: string;
}

/**
 * Apply variable substitutions from config overrides to content
 */
function applyVariables(content: string, variables?: Record<string, string>): string {
  if (!variables) return content;

  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    // Replace both {{VAR}} and {VAR} patterns
    result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
  }
  return result;
}

/**
 * Check if a file path should be excluded based on config overrides
 */
function shouldExclude(path: string, exclude?: string[]): boolean {
  if (!exclude || exclude.length === 0) return false;
  return exclude.some((pattern) => path.includes(pattern) || path === pattern);
}

/**
 * Generate all output files for a resolved plugin
 */
function generateOutputFiles(
  resolved: ResolvedPlugin,
  configOverrides?: EccConfigOverrides
): OutputFile[] {
  const files: OutputFile[] = [];
  const exclude = configOverrides?.exclude;
  const variables = configOverrides?.variables;

  // One-to-One patterns: Agents
  for (const agent of resolved.agents) {
    const path = getAgentFilePath(agent);
    if (!shouldExclude(path, exclude)) {
      files.push({
        path,
        content: applyVariables(generateAgentFile(agent), variables),
      });
    }
  }

  // One-to-One patterns: Commands
  for (const command of resolved.commands) {
    const path = getCommandFilePath(command);
    if (!shouldExclude(path, exclude)) {
      files.push({
        path,
        content: applyVariables(generateCommandFile(command), variables),
      });
    }
  }

  // Hierarchical patterns: Skills
  for (const skill of resolved.skills) {
    const path = getSkillFilePath(skill);
    if (!shouldExclude(path, exclude)) {
      files.push({
        path,
        content: applyVariables(generateSkillFile(skill), variables),
      });
    }
  }

  // One-to-One patterns: Rules
  for (const rule of resolved.rules) {
    const path = getRuleFilePath(rule);
    if (!shouldExclude(path, exclude)) {
      files.push({
        path,
        content: applyVariables(generateRuleFile(rule), variables),
      });
    }
  }

  // One-to-One patterns: Contexts
  for (const context of resolved.contexts) {
    const path = getContextFilePath(context);
    if (!shouldExclude(path, exclude)) {
      files.push({
        path,
        content: applyVariables(generateContextFile(context), variables),
      });
    }
  }

  // Aggregated patterns: Hooks
  if (resolved.hooks.length > 0) {
    const path = getHooksFilePath();
    if (!shouldExclude(path, exclude)) {
      files.push({
        path,
        content: applyVariables(generateHooksJson(resolved.hooks), variables),
      });
    }
  }

  // Aggregated patterns: Settings (MCP servers + permissions)
  if (resolved.mcpServers.length > 0 || resolved.settings) {
    const path = getSettingsFilePath();
    if (!shouldExclude(path, exclude)) {
      files.push({
        path,
        content: applyVariables(
          generateSettingsJson(resolved.mcpServers, resolved.settings),
          variables
        ),
      });
    }
  }

  return files;
}

/**
 * Write a file, creating parent directories as needed
 */
async function writeOutputFile(basePath: string, file: OutputFile): Promise<void> {
  const fullPath = join(basePath, file.path);
  const dir = dirname(fullPath);

  // Create directory if it doesn't exist
  await mkdir(dir, { recursive: true });

  // Write the file
  await writeFile(fullPath, file.content, 'utf-8');
}

/**
 * Materialize a zgent instance
 *
 * @param zgent - The zgent to materialize
 * @param resolved - The resolved plugin with all entities
 * @param dataDir - Path to the ECC data directory (for updating zgent status)
 */
export async function materializeZgent(
  zgent: EccZgent,
  resolved: ResolvedPlugin,
  dataDir: string
): Promise<void> {
  const targetPath = resolve(zgent.targetPath);

  // Generate all output files
  const files = generateOutputFiles(resolved, zgent.configOverrides);

  console.log(`\nGenerating ${files.length} files...`);

  // Create the base .claude directory
  await mkdir(targetPath, { recursive: true });

  // Write all files
  for (const file of files) {
    console.log(`  Writing: ${file.path}`);
    await writeOutputFile(targetPath, file);
  }

  // Update zgent status
  const { loadEccData } = await import('./ecc-data-loader.js');
  const eccData = await loadEccData(dataDir);

  const updatedZgents = eccData.zgents.map((z) => {
    if (z.id === zgent.id) {
      return {
        ...z,
        status: 'materialized' as const,
        materializedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return z;
  });

  await saveZgents(dataDir, updatedZgents);
}

/**
 * Preview what files would be generated (dry run)
 */
export function previewMaterialization(
  resolved: ResolvedPlugin,
  configOverrides?: EccConfigOverrides
): OutputFile[] {
  return generateOutputFiles(resolved, configOverrides);
}
