/**
 * Artifact Type Re-exports
 *
 * This module re-exports the core ECC entity types from ecc-materializer,
 * providing a convenient import path for CRUD operations.
 *
 * These types represent the artifacts that can be created, read, updated,
 * and deleted through the CRUD engine.
 *
 * @module artifact-types
 */

// Re-export primary artifact types from ecc-materializer
export type {
  // Core artifact entities
  EccSkill,
  EccHook,
  EccSubAgent,
  EccRule,
  EccAgent,
  EccCommand,
  EccMcpServer,
  EccContext,
  EccPlugin,
  EccZgent,

  // Embedded/child types (used within artifacts)
  EccPattern,
  EccWorkflow,
  EccHookAction,
  EccHookMatcher,
  EccHookScope,
  EccPhase,
  EccChecklistItem,
  EccTool,
  EccPluginSettings,

  // Context profile types
  EccContextProfile,
  EccEnrichment,
  EccConfigOverrides,

  // File structure types
  EccPluginsFile,
  EccAgentsFile,
  EccSubAgentsFile,
  EccSkillsFile,
  EccRulesFile,
  EccHooksFile,
  EccHookScopesFile,
  EccMcpServersFile,
  EccContextsFile,
  EccCommandsFile,
  EccZgentsFile,
  EccContextProfilesFile,

  // Resolved structures
  ResolvedPlugin,
} from 'ecc-materializer/dist/ecc-types.js';

// Import types for use in union type definition
import type {
  EccSkill,
  EccHook,
  EccSubAgent,
  EccRule,
  EccAgent,
  EccCommand,
  EccMcpServer,
  EccContext,
  EccPlugin,
  EccZgent,
} from 'ecc-materializer/dist/ecc-types.js';

/**
 * Union type representing any primary ECC artifact.
 *
 * This type is useful for operations that need to work with
 * any artifact type generically, such as logging, validation,
 * or serialization functions.
 */
export type AnyArtifact =
  | EccSkill
  | EccHook
  | EccSubAgent
  | EccRule
  | EccAgent
  | EccCommand
  | EccMcpServer
  | EccContext
  | EccPlugin
  | EccZgent;

/**
 * Maps artifact type names to their TypeScript types.
 *
 * Useful for type-safe operations where the artifact type
 * is known at compile time.
 */
export interface ArtifactTypeMap {
  skill: EccSkill;
  hook: EccHook;
  subagent: EccSubAgent;
  rule: EccRule;
  agent: EccAgent;
  command: EccCommand;
  mcpServer: EccMcpServer;
  context: EccContext;
  plugin: EccPlugin;
  zgent: EccZgent;
}

/**
 * String literal union of all artifact type names.
 */
export type ArtifactTypeName = keyof ArtifactTypeMap;
