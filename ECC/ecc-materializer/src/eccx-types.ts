/**
 * ECCX Type Definitions
 *
 * TypeScript interfaces for the ECCX (Extension) namespace.
 * The eccx namespace is our extension layer for orchestration tooling,
 * separate from Anthropic's native ecc entities.
 */

// ============================================================================
// ECCX Core Entities
// ============================================================================

/**
 * EccxEmergentPattern - Patterns that emerge from agent interactions
 *
 * Captures workflow patterns, decision trees, and delegation strategies
 * that emerge from Claude Code usage and can be formalized for reuse.
 */
export interface EccxEmergentPattern {
  id: string;
  name: string;
  description?: string;
  patternType?: 'workflow' | 'decision' | 'delegation' | string;
  implementation?: string;
  // Relationship references (by name or id)
  subAgentRefs?: string[];
  hookRefs?: string[];
}

/**
 * EccxAct - Explorer feature categories (high-level groupings)
 *
 * Acts represent major feature areas or capability domains in the
 * Claude Code Explorer. Each Act contains multiple Scenes.
 */
export interface EccxAct {
  id: string;
  name: string;
  description?: string;
  category?: string;
  // Embedded child data
  scenes?: EccxScene[];
}

/**
 * EccxScene - Steps within an Act
 *
 * Scenes are individual steps or capabilities within an Act.
 * They can have prerequisites (other scenes that must be completed first)
 * and relationships to other scenes.
 */
export interface EccxScene {
  id: string;
  actId: string;
  name: string;
  description?: string;
  prerequisites?: string[];      // JSON array of prerequisite scene names
  relatedSceneRefs?: string[];   // References to related scenes
}

// ============================================================================
// Data File Structures
// ============================================================================

export interface EccxEmergentPatternsFile {
  $schema?: string;
  description?: string;
  emergentPatterns: EccxEmergentPattern[];
}

export interface EccxActsFile {
  $schema?: string;
  description?: string;
  acts: EccxAct[];
}

export interface EccxScenesFile {
  $schema?: string;
  description?: string;
  scenes: EccxScene[];
}

// ============================================================================
// Aggregate Data Structure
// ============================================================================

/**
 * EccxData - All ECCX data loaded and ready for use
 *
 * This interface aggregates all ECCX entities for easy access
 * during materialization or other operations.
 */
export interface EccxData {
  emergentPatterns: EccxEmergentPattern[];
  acts: EccxAct[];
  scenes: EccxScene[];
}
