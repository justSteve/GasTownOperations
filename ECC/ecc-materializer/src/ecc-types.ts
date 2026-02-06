/**
 * ECC Type Definitions
 *
 * TypeScript interfaces mirroring the ECC SQL schema.
 * These types define the structure of data in the ecc-*.json files.
 */

// ============================================================================
// Core Entities
// ============================================================================

export interface EccPlugin {
  id: string;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  authorUrl?: string;
  license?: string;
  homepage?: string;
  repositoryUrl?: string;
  repositoryPath: string;
  keywords?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// Primary Entities
// ============================================================================

export interface EccAgent {
  id: string;
  pluginId: string;
  name: string;
  description?: string;
  model?: 'sonnet' | 'opus' | 'haiku' | string;
  instructions?: string;
  roleDescription?: string;
  tools?: string[];
  // Embedded child data
  checklistItems?: EccChecklistItem[];
  // Relationship references (by name)
  skillRefs?: string[];
  ruleRefs?: string[];
}

/**
 * SubAgent: Claude Code 2.1 sub-agents (policy islands for delegation)
 *
 * Sub-agents are specialized agents that can be spawned during a session with
 * restricted contexts and tool access. They support 'fork' (new context) or
 * 'inline' (shared context) modes.
 */
export interface EccSubAgent {
  id: string;
  pluginId: string;
  name: string;
  description?: string;
  contextMode: 'fork' | 'inline';
  instructions?: string;
  allowedTools?: string[];
  frontmatterConfig?: Record<string, unknown>;
  // Relationship references (by name)
  skillRefs?: string[];
  hookRefs?: string[];
}

export interface EccSkill {
  id: string;
  pluginId: string;
  name: string;
  title?: string;
  description?: string;
  content?: string;
  category?: string;
  // Claude Code 2.1 capability fields
  hotReload?: boolean;                          // Whether skill supports hot reload
  allowedTools?: string[];                      // JSON array of allowed tools
  contextMode?: 'inject' | 'reference' | 'lazy' | string;  // Context loading mode
  // Embedded child data
  patterns?: EccPattern[];
  workflows?: EccWorkflow[];
}

export interface EccRule {
  id: string;
  pluginId: string;
  name: string;
  title?: string;
  content?: string;
  severity?: 'required' | 'recommended' | 'optional' | string;
  category?: string;
  applicability?: string;
}

export interface EccHook {
  id: string;
  pluginId: string;
  name: string;
  description?: string;
  eventType: 'PreToolUse' | 'PostToolUse' | 'UserPromptSubmit' | 'Stop' | 'Notification' | 'SessionStart' | 'SessionEnd' | 'PreCompact' | string;
  matcher?: string;
  enabled?: boolean;
  priority?: number;
  scopeId?: string;  // Reference to HookScope for scope hierarchy
  // Claude Code 2.1 protocol fields
  exitCodeProtocol?: number;                    // Exit code behavior (0=success, etc.)
  stdinSchema?: Record<string, unknown>;        // JSON schema for stdin input
  stdoutSchema?: Record<string, unknown>;       // JSON schema for stdout output
  timeout?: number;                             // Timeout in milliseconds
  scopeLevel?: 'global' | 'project' | 'command' | string;  // Scope level for hook execution
  // Embedded child data
  actions?: EccHookAction[];
  matchers?: EccHookMatcher[];  // Structured matchers (Claude Code 2.1)
}

export interface EccMcpServer {
  id: string;
  pluginId: string;
  name: string;
  description?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  serverType?: 'stdio' | 'sse' | string;
  url?: string;
  enabled?: boolean;
  category?: string;
  // Embedded child data (metadata only, not written to files)
  tools?: EccTool[];
}

export interface EccContext {
  id: string;
  pluginId: string;
  name: string;
  description?: string;
  systemPromptOverride?: string;
  applicableWhen?: string;
  priority?: number;
  toolRestrictions?: {
    allow?: string[];
    deny?: string[];
  };
}

export interface EccCommand {
  id: string;
  pluginId: string;
  name: string;
  description?: string;
  content?: string;
  allowedTools?: string[];
  waitForConfirmation?: boolean;
  invokesAgentRef?: string; // Reference by name
  // Embedded child data
  phases?: EccPhase[];
}

// ============================================================================
// Secondary Entities (embedded in parent)
// ============================================================================

export interface EccTool {
  id: string;
  mcpServerId: string;
  name: string;
  description?: string;
  category?: string;
  riskLevel?: 'safe' | 'caution' | 'dangerous' | string;
}

export interface EccHookAction {
  id: string;
  hookId: string;
  actionType: 'command' | 'block' | 'modify' | string;
  command?: string;
  arguments?: Record<string, unknown>;
  actionOrder?: number;
}

export interface EccHookMatcher {
  id: string;
  hookId: string;
  matcherType: 'tool' | 'skill' | 'pattern';
  pattern: string;
  description?: string;
}

export interface EccHookScope {
  id: string;
  name: string;
  level: 'Global' | 'Project' | 'Skill' | 'SubAgent';
  priority?: number;
  description?: string;
}

export interface EccPhase {
  id: string;
  commandId: string;
  number: number;
  name?: string;
  description?: string;
  steps?: string[];
}

export interface EccPattern {
  id: string;
  skillId: string;
  name: string;
  description?: string;
  applicability?: string;
  implementation?: string;
}

export interface EccWorkflow {
  id: string;
  skillId: string;
  name: string;
  steps?: string[];
  expectedOutcome?: string;
}

export interface EccChecklistItem {
  id: string;
  agentId: string;
  item: string;
  priority?: 'required' | 'recommended' | 'optional' | string;
  itemOrder?: number;
}

export interface EccPluginSettings {
  id: string;
  pluginId: string;
  allowedPermissions?: string[];
  deniedPermissions?: string[];
}

// ============================================================================
// Context Profile (Translation Layer)
// ============================================================================

/**
 * Enrichment - content to inject into specific entities during translation
 */
export interface EccEnrichment {
  sections?: Array<{ heading: string; content: string }>;
  prepend?: string;   // Add before existing content
  append?: string;    // Add after existing content
}

/**
 * Context Profile - defines how to customize output for a specific target rig
 *
 * Enables the factory pattern: one plugin + multiple profiles = multiple customized outputs
 */
export interface EccContextProfile {
  id: string;
  name: string;
  description?: string;
  variables: Record<string, string>;           // {{VAR}} → value substitution
  enrichments?: Record<string, EccEnrichment>; // "entityType:name" → extra content
  terminology?: Record<string, string>;        // generic term → domain-specific term
}

// ============================================================================
// Materialization Entity
// ============================================================================

export interface EccZgent {
  id: string;
  pluginId: string;
  name: string;
  description?: string;
  targetPath: string;
  status: 'pending' | 'materialized' | 'deployed' | 'archived';
  materializedAt?: string;
  deployedAt?: string;
  version?: string;
  configOverrides?: EccConfigOverrides;
  contextProfileId?: string;  // Reference to context profile for translation
  createdAt?: string;
  updatedAt?: string;
}

export interface EccConfigOverrides {
  variables?: Record<string, string>;
  exclude?: string[];
  includeExtra?: string[];
}

// ============================================================================
// Data File Structures
// ============================================================================

export interface EccPluginsFile {
  $schema?: string;
  description?: string;
  plugins: EccPlugin[];
}

export interface EccAgentsFile {
  $schema?: string;
  description?: string;
  agents: EccAgent[];
}

export interface EccSubAgentsFile {
  $schema?: string;
  description?: string;
  subAgents: EccSubAgent[];
}

export interface EccSkillsFile {
  $schema?: string;
  description?: string;
  skills: EccSkill[];
}

export interface EccRulesFile {
  $schema?: string;
  description?: string;
  rules: EccRule[];
}

export interface EccHooksFile {
  $schema?: string;
  description?: string;
  hooks: EccHook[];
  scopes?: EccHookScope[];  // Optional hook scopes for scope hierarchy
}

export interface EccHookScopesFile {
  $schema?: string;
  description?: string;
  scopes: EccHookScope[];
}

export interface EccMcpServersFile {
  $schema?: string;
  description?: string;
  mcpServers: EccMcpServer[];
}

export interface EccContextsFile {
  $schema?: string;
  description?: string;
  contexts: EccContext[];
}

export interface EccCommandsFile {
  $schema?: string;
  description?: string;
  commands: EccCommand[];
}

export interface EccZgentsFile {
  $schema?: string;
  description?: string;
  zgents: EccZgent[];
}

export interface EccContextProfilesFile {
  $schema?: string;
  description?: string;
  profiles: EccContextProfile[];
}

// ============================================================================
// Resolved Plugin (all entities loaded and ready for materialization)
// ============================================================================

export interface ResolvedPlugin {
  plugin: EccPlugin;
  agents: EccAgent[];
  subAgents: EccSubAgent[];  // Claude Code 2.1 sub-agents (policy islands)
  skills: EccSkill[];
  rules: EccRule[];
  hooks: EccHook[];
  hookScopes?: EccHookScope[];  // Hook scope hierarchy (Claude Code 2.1)
  mcpServers: EccMcpServer[];
  contexts: EccContext[];
  commands: EccCommand[];
  settings?: EccPluginSettings;
}
