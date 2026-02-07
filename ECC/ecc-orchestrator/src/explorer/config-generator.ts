/**
 * Config Generator - Generate temporary Claude Code configuration
 *
 * Creates a temporary .claude/ folder structure for scene execution,
 * injecting observer hooks into settings.json and generating skills/agents.
 */

import { mkdirSync, writeFileSync, rmSync, existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import type {
  SceneTemplate,
  ResolvedParameters,
  GeneratedConfig,
  GeneratedSettings,
  HookConfig,
} from './types.js';

// ============================================================================
// Config Generator
// ============================================================================

/**
 * Options for config generation.
 */
export interface ConfigGeneratorOptions {
  /** Base directory for temp configs (default: system tmpdir) */
  baseDir?: string;
  /** Path to observer.sh script */
  observerScript: string;
  /** Path for event log output */
  eventLogPath?: string;
  /** Whether to clean up on process exit */
  cleanupOnExit?: boolean;
}

/**
 * Generate a complete Claude Code configuration for a scene.
 */
export function generateConfig(
  scene: SceneTemplate,
  parameters: ResolvedParameters,
  options: ConfigGeneratorOptions
): GeneratedConfig {
  const configId = randomUUID().slice(0, 8);
  const baseDir = options.baseDir || tmpdir();
  const configDir = join(baseDir, `explorer-${scene.scene.id}-${configId}`);
  const claudeDir = join(configDir, '.claude');
  const eventLogPath = options.eventLogPath || join(configDir, 'events.jsonl');

  // Create directory structure
  mkdirSync(claudeDir, { recursive: true });
  mkdirSync(join(claudeDir, 'skills'), { recursive: true });
  mkdirSync(join(claudeDir, 'agents'), { recursive: true });
  mkdirSync(join(claudeDir, 'hooks'), { recursive: true });

  // Generate settings.json with observer hooks
  const settings = generateSettings(scene, options.observerScript, eventLogPath);
  const settingsPath = join(claudeDir, 'settings.json');
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

  // Generate skills from scene assets
  const skills = generateSkills(scene, parameters, claudeDir);

  // Generate agents from scene assets
  const agents = generateAgents(scene, parameters, claudeDir);

  // Generate hook scripts from scene assets
  const hooks = generateHooks(scene, parameters, claudeDir);

  // Register cleanup if requested
  if (options.cleanupOnExit) {
    process.on('exit', () => cleanupConfig(configDir));
  }

  return {
    configDir,
    settingsPath,
    settings,
    skills,
    agents,
    hooks,
  };
}

/**
 * Clean up a generated configuration directory.
 */
export function cleanupConfig(configDir: string): void {
  if (existsSync(configDir)) {
    rmSync(configDir, { recursive: true, force: true });
  }
}

// ============================================================================
// Internal Generation Functions
// ============================================================================

function generateSettings(
  scene: SceneTemplate,
  observerScript: string,
  eventLogPath: string
): GeneratedSettings {
  // Base observer hook that wraps all tool calls
  const observerEnv = `OBSERVER_EVENT_LOG="${eventLogPath}" OBSERVER_HOOK_NAME="${scene.scene.id}"`;
  const observerCommand = `${observerEnv} ${observerScript}`;

  // Create hooks config with observer
  const settings: GeneratedSettings = {
    hooks: {
      preToolUse: [
        {
          matcher: '*', // Match all tools
          command: observerCommand,
        },
      ],
    },
  };

  // Add scene-specific hooks from assets
  for (const asset of scene.assets.files) {
    if (asset.path.includes('hooks/') || asset.path.endsWith('.sh')) {
      // This is a hook script, add to appropriate hook type
      const hookType = inferHookType(asset.path);
      if (hookType && settings.hooks) {
        const hooks = settings.hooks[hookType as keyof typeof settings.hooks] || [];
        hooks.push({
          matcher: inferMatcher(asset),
          command: `${observerEnv} OBSERVER_PASSTHROUGH="${asset.path}" ${observerScript}`,
        });
        (settings.hooks as Record<string, HookConfig[]>)[hookType] = hooks;
      }
    }
  }

  return settings;
}

function generateSkills(
  scene: SceneTemplate,
  parameters: ResolvedParameters,
  claudeDir: string
): Array<{ path: string; content: string }> {
  const skills: Array<{ path: string; content: string }> = [];

  for (const asset of scene.assets.files) {
    if (asset.path.includes('skills/') || asset.path.endsWith('.SKILL.md')) {
      const content = asset.content || generateDefaultSkillContent(asset);
      const fileName = asset.path.split('/').pop() || 'skill.md';
      const skillPath = join(claudeDir, 'skills', fileName);

      writeFileSync(skillPath, interpolateParameters(content, parameters));
      skills.push({ path: skillPath, content });
    }
  }

  return skills;
}

function generateAgents(
  scene: SceneTemplate,
  parameters: ResolvedParameters,
  claudeDir: string
): Array<{ path: string; content: string }> {
  const agents: Array<{ path: string; content: string }> = [];

  for (const asset of scene.assets.files) {
    if (asset.path.includes('agents/') || asset.path.endsWith('.AGENT.md')) {
      const content = asset.content || generateDefaultAgentContent(asset);
      const fileName = asset.path.split('/').pop() || 'agent.md';
      const agentPath = join(claudeDir, 'agents', fileName);

      writeFileSync(agentPath, interpolateParameters(content, parameters));
      agents.push({ path: agentPath, content });
    }
  }

  return agents;
}

function generateHooks(
  scene: SceneTemplate,
  parameters: ResolvedParameters,
  claudeDir: string
): Array<{ path: string; content: string }> {
  const hooks: Array<{ path: string; content: string }> = [];

  for (const asset of scene.assets.files) {
    if (asset.path.includes('hooks/') && asset.path.endsWith('.sh')) {
      const content = asset.content || generateDefaultHookContent(asset);
      const fileName = asset.path.split('/').pop() || 'hook.sh';
      const hookPath = join(claudeDir, 'hooks', fileName);

      writeFileSync(hookPath, interpolateParameters(content, parameters));
      // Make executable
      chmodSync(hookPath, 0o755);
      hooks.push({ path: hookPath, content });
    }
  }

  return hooks;
}

function inferHookType(path: string): string | null {
  const name = path.toLowerCase();
  if (name.includes('pretool') || name.includes('pre-tool')) return 'preToolUse';
  if (name.includes('posttool') || name.includes('post-tool')) return 'postToolUse';
  if (name.includes('prompt') || name.includes('submit')) return 'userPromptSubmit';
  if (name.includes('stop')) return 'stop';
  return 'preToolUse'; // Default
}

function inferMatcher(asset: { path: string; role: string }): string {
  // Try to infer matcher from role or path
  const role = asset.role.toLowerCase();
  if (role.includes('bash')) return 'Bash';
  if (role.includes('write')) return 'Write';
  if (role.includes('edit')) return 'Edit';
  if (role.includes('read')) return 'Read';
  return '*'; // Match all
}

function generateDefaultSkillContent(
  asset: { path: string; role: string }
): string {
  const name = asset.path.split('/').pop()?.replace('.SKILL.md', '') || 'skill';
  return `---
name: ${name}
description: ${asset.role || 'Generated skill for Explorer scene'}
---

# ${name}

This skill was generated for the Explorer demonstration.

${asset.role}
`;
}

function generateDefaultAgentContent(
  asset: { path: string; role: string }
): string {
  const name = asset.path.split('/').pop()?.replace('.AGENT.md', '') || 'agent';
  return `---
name: ${name}
description: ${asset.role || 'Generated agent for Explorer scene'}
---

# ${name}

This agent was generated for the Explorer demonstration.

${asset.role}
`;
}

function generateDefaultHookContent(
  asset: { path: string; role: string }
): string {
  return `#!/usr/bin/env bash
# Generated hook for Explorer scene
# Role: ${asset.role}

# Read input from stdin
INPUT=$(cat)

# Default: allow
exit 0
`;
}

function interpolateParameters(content: string, parameters: ResolvedParameters): string {
  let result = content;
  for (const [key, value] of Object.entries(parameters)) {
    // Replace {{param_name}} and {{ param_name }} patterns
    const patterns = [
      new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'),
      new RegExp(`\\$\\{${key}\\}`, 'g'),
    ];
    for (const pattern of patterns) {
      result = result.replace(pattern, String(value));
    }
  }
  return result;
}
