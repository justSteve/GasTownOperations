/**
 * ECC Data Loader
 *
 * Loads and parses all ECC JSON data files from the data directory.
 */

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type {
  EccPluginsFile,
  EccAgentsFile,
  EccSkillsFile,
  EccRulesFile,
  EccHooksFile,
  EccMcpServersFile,
  EccContextsFile,
  EccCommandsFile,
  EccZgentsFile,
  EccContextProfilesFile,
  EccPlugin,
  EccAgent,
  EccSkill,
  EccRule,
  EccHook,
  EccMcpServer,
  EccContext,
  EccCommand,
  EccZgent,
  EccContextProfile,
} from './ecc-types.js';

/**
 * All loaded ECC data in a single structure
 */
export interface EccData {
  plugins: EccPlugin[];
  agents: EccAgent[];
  skills: EccSkill[];
  rules: EccRule[];
  hooks: EccHook[];
  mcpServers: EccMcpServer[];
  contexts: EccContext[];
  commands: EccCommand[];
  zgents: EccZgent[];
  profiles: EccContextProfile[];
}

/**
 * Load a JSON file and parse it
 */
async function loadJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Load a JSON file with graceful fallback if file doesn't exist
 */
async function loadJsonFileOptional<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
}

/**
 * Load all ECC data from the data directory
 *
 * @param dataDir - Path to the ECC data directory (relative or absolute)
 * @returns All loaded ECC data
 */
export async function loadEccData(dataDir: string): Promise<EccData> {
  const absoluteDataDir = resolve(dataDir);

  // Load all data files in parallel (profiles optional for backward compatibility)
  const [
    pluginsFile,
    agentsFile,
    skillsFile,
    rulesFile,
    hooksFile,
    mcpServersFile,
    contextsFile,
    commandsFile,
    zgentsFile,
    profilesFile,
  ] = await Promise.all([
    loadJsonFile<EccPluginsFile>(join(absoluteDataDir, 'ecc-plugins.json')),
    loadJsonFile<EccAgentsFile>(join(absoluteDataDir, 'ecc-agents.json')),
    loadJsonFile<EccSkillsFile>(join(absoluteDataDir, 'ecc-skills.json')),
    loadJsonFile<EccRulesFile>(join(absoluteDataDir, 'ecc-rules.json')),
    loadJsonFile<EccHooksFile>(join(absoluteDataDir, 'ecc-hooks.json')),
    loadJsonFile<EccMcpServersFile>(join(absoluteDataDir, 'ecc-mcp-servers.json')),
    loadJsonFile<EccContextsFile>(join(absoluteDataDir, 'ecc-contexts.json')),
    loadJsonFile<EccCommandsFile>(join(absoluteDataDir, 'ecc-commands.json')),
    loadJsonFile<EccZgentsFile>(join(absoluteDataDir, 'ecc-zgent-instances.json')),
    loadJsonFileOptional<EccContextProfilesFile>(
      join(absoluteDataDir, 'ecc-context-profiles.json'),
      { profiles: [] }
    ),
  ]);

  return {
    plugins: pluginsFile.plugins,
    agents: agentsFile.agents,
    skills: skillsFile.skills,
    rules: rulesFile.rules,
    hooks: hooksFile.hooks,
    mcpServers: mcpServersFile.mcpServers,
    contexts: contextsFile.contexts,
    commands: commandsFile.commands,
    zgents: zgentsFile.zgents,
    profiles: profilesFile.profiles,
  };
}

/**
 * Save updated zgents data back to the file
 *
 * @param dataDir - Path to the ECC data directory
 * @param zgents - Updated zgents array
 */
export async function saveZgents(dataDir: string, zgents: EccZgent[]): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  const absoluteDataDir = resolve(dataDir);
  const filePath = join(absoluteDataDir, 'ecc-zgent-instances.json');

  const zgentsFile: EccZgentsFile = {
    $schema: '../schema/ecc-zgent-instances.schema.json',
    description: 'Zgent instances - materialized deployments of Plugin templates',
    zgents,
  };

  await writeFile(filePath, JSON.stringify(zgentsFile, null, 2) + '\n', 'utf-8');
}
