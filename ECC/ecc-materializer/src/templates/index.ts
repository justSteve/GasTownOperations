/**
 * Template Index
 *
 * Re-exports all template generators for convenient importing.
 */

export { generateAgentFile, getAgentFilePath } from './template-agent.js';
export { generateSubAgentFile, getSubAgentFilePath } from './template-subagent.js';
export { generateCommandFile, getCommandFilePath } from './template-command.js';
export { generateSkillFile, getSkillFilePath } from './template-skill.js';
export { generateRuleFile, getRuleFilePath } from './template-rule.js';
export { generateContextFile, getContextFilePath } from './template-context.js';
export { generateHooksJson, getHooksFilePath } from './template-hooks-json.js';
export { generateSettingsJson, getSettingsFilePath } from './template-settings-json.js';
