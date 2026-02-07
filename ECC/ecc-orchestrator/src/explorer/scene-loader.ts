/**
 * Scene Loader - Load and parse scene YAML templates
 *
 * Loads scene definitions from YAML files in the eccx data directory,
 * validates structure, and resolves parameters.
 */

import { parse as parseYaml } from 'yaml';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import type {
  SceneTemplate,
  SceneMetadata,
  ScenePurpose,
  ScenePrerequisites,
  SceneAssets,
  SceneParameter,
  ExecutionStep,
  SceneVariation,
  ExportArtifact,
  ResolvedParameters,
} from './types.js';
import { ValidationError } from '../errors/error-types.js';

// ============================================================================
// Scene Loader
// ============================================================================

/**
 * Load a scene template from a YAML file.
 */
export function loadScene(filePath: string): SceneTemplate {
  if (!existsSync(filePath)) {
    throw new ValidationError(`Scene file not found: ${filePath}`, 'scene_file', filePath);
  }

  const content = readFileSync(filePath, 'utf-8');
  const parsed = parseYaml(content);

  return parseSceneTemplate(parsed, filePath);
}

/**
 * Load all scenes from a directory.
 */
export function loadScenesFromDirectory(dirPath: string): Map<string, SceneTemplate> {
  if (!existsSync(dirPath)) {
    throw new ValidationError(`Scene directory not found: ${dirPath}`, 'scene_directory', dirPath);
  }

  const scenes = new Map<string, SceneTemplate>();
  const files = readdirSync(dirPath);

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    if (ext === '.yaml' || ext === '.yml') {
      const filePath = join(dirPath, file);
      try {
        const scene = loadScene(filePath);
        scenes.set(scene.scene.id, scene);
      } catch (error) {
        // Log error but continue loading other scenes
        console.error(`Failed to load scene ${file}:`, error);
      }
    }
  }

  return scenes;
}

/**
 * Resolve parameters for a scene execution.
 * Merges defaults with provided overrides.
 */
export function resolveParameters(
  template: SceneTemplate,
  overrides: Record<string, unknown> = {}
): ResolvedParameters {
  const resolved: ResolvedParameters = {};

  for (const param of template.parameters) {
    if (param.name in overrides) {
      resolved[param.name] = validateParameterValue(param, overrides[param.name]);
    } else {
      resolved[param.name] = param.default;
    }
  }

  return resolved;
}

/**
 * Apply a variation to a scene template.
 */
export function applyVariation(
  template: SceneTemplate,
  variationId: string
): ResolvedParameters {
  const variation = template.variations.find((v) => v.id === variationId);
  if (!variation) {
    throw new ValidationError(
      `Variation not found: ${variationId}`,
      'variation',
      variationId
    );
  }

  return resolveParameters(template, variation.parameterOverrides);
}

/**
 * Get scenes organized by act.
 */
export function groupScenesByAct(
  scenes: Map<string, SceneTemplate>
): Map<number, SceneTemplate[]> {
  const byAct = new Map<number, SceneTemplate[]>();

  for (const scene of scenes.values()) {
    const actScenes = byAct.get(scene.scene.act) || [];
    actScenes.push(scene);
    byAct.set(scene.scene.act, actScenes);
  }

  // Sort scenes within each act by ID
  for (const [_act, actScenes] of byAct) {
    actScenes.sort((a, b) => a.scene.id.localeCompare(b.scene.id));
  }

  return byAct;
}

// ============================================================================
// Internal Parsing Functions
// ============================================================================

function parseSceneTemplate(data: unknown, source: string): SceneTemplate {
  if (typeof data !== 'object' || data === null) {
    throw new ValidationError(`Invalid scene structure in ${source}`, 'scene_structure', source);
  }

  const obj = data as Record<string, unknown>;

  return {
    scene: parseSceneMetadata(obj.scene, source),
    purpose: parseScenePurpose(obj.purpose),
    prerequisites: parsePrerequisites(obj.prerequisites),
    assets: parseAssets(obj.assets),
    parameters: parseParameters(obj.parameters),
    executionSteps: parseExecutionSteps(obj.execution_steps || obj.executionSteps),
    variations: parseVariations(obj.variations),
    relatedScenes: parseStringArray(obj.related_scenes || obj.relatedScenes),
    exportArtifacts: parseExportArtifacts(obj.export_artifacts || obj.exportArtifacts),
  };
}

function parseSceneMetadata(data: unknown, source: string): SceneMetadata {
  if (typeof data !== 'object' || data === null) {
    throw new ValidationError(`Missing scene metadata in ${source}`, 'scene_metadata', source);
  }

  const obj = data as Record<string, unknown>;
  const durationEstimate = obj.duration_estimate as string | undefined;

  const result: SceneMetadata = {
    id: String(obj.id || basename(source, extname(source))),
    act: Number(obj.act || 1),
    title: String(obj.title || 'Untitled Scene'),
  };

  if (durationEstimate !== undefined) {
    result.durationEstimate = durationEstimate;
  }

  return result;
}

function parseScenePurpose(data: unknown): ScenePurpose {
  if (typeof data !== 'object' || data === null) {
    return { oneLiner: '', learningOutcomes: [] };
  }

  const obj = data as Record<string, unknown>;

  return {
    oneLiner: String(obj.one_liner || obj.oneLiner || ''),
    learningOutcomes: parseStringArray(obj.learning_outcomes || obj.learningOutcomes),
  };
}

function parsePrerequisites(data: unknown): ScenePrerequisites {
  if (typeof data !== 'object' || data === null) {
    return { scenes: [], concepts: [] };
  }

  const obj = data as Record<string, unknown>;

  return {
    scenes: parseStringArray(obj.scenes),
    concepts: parseStringArray(obj.concepts),
  };
}

function parseAssets(data: unknown): SceneAssets {
  if (typeof data !== 'object' || data === null) {
    return { files: [], mockData: [] };
  }

  const obj = data as Record<string, unknown>;

  return {
    files: parseAssetFiles(obj.files),
    mockData: parseMockData(obj.mock_data || obj.mockData),
  };
}

function parseAssetFiles(data: unknown): SceneAssets['files'] {
  if (!Array.isArray(data)) return [];

  return data.map((item) => {
    if (typeof item !== 'object' || item === null) {
      return { path: '', role: '' };
    }
    const obj = item as Record<string, unknown>;
    const content = obj.content as string | undefined;

    const result: SceneAssets['files'][0] = {
      path: String(obj.path || ''),
      role: String(obj.role || ''),
    };

    if (content !== undefined) {
      result.content = content;
    }

    return result;
  });
}

function parseMockData(data: unknown): SceneAssets['mockData'] {
  if (!Array.isArray(data)) return [];

  return data.map((item) => {
    if (typeof item !== 'object' || item === null) {
      return { description: '' };
    }
    const obj = item as Record<string, unknown>;
    return {
      description: String(obj.description || ''),
      data: obj.data,
    };
  });
}

function parseParameters(data: unknown): SceneParameter[] {
  if (!Array.isArray(data)) return [];

  return data.map((item) => {
    if (typeof item !== 'object' || item === null) {
      return { name: '', type: 'string' as const, default: '', description: '' };
    }
    const obj = item as Record<string, unknown>;
    const values = Array.isArray(obj.values) ? obj.values : undefined;

    const result: SceneParameter = {
      name: String(obj.name || ''),
      type: (obj.type as SceneParameter['type']) || 'string',
      default: obj.default,
      description: String(obj.description || ''),
    };

    if (values !== undefined) {
      result.values = values;
    }

    return result;
  });
}

function parseExecutionSteps(data: unknown): ExecutionStep[] {
  if (!Array.isArray(data)) return [];

  return data.map((item, index) => {
    if (typeof item !== 'object' || item === null) {
      return { step: index + 1, action: '' };
    }
    const obj = item as Record<string, unknown>;
    const commentary = obj.commentary as Record<string, unknown> | undefined;
    const input = obj.input as string | undefined;
    const expectedOutput = obj.expected_output as string | undefined;

    const result: ExecutionStep = {
      step: Number(obj.step || index + 1),
      action: String(obj.action || ''),
    };

    if (input !== undefined) {
      result.input = input;
    }

    if (expectedOutput !== undefined) {
      result.expectedOutput = expectedOutput;
    }

    if (commentary) {
      const commentaryObj: { l1?: string; l2?: string; l3?: string } = {};
      if (typeof commentary.commentary_l1 === 'string') {
        commentaryObj.l1 = commentary.commentary_l1;
      }
      if (typeof commentary.commentary_l2 === 'string') {
        commentaryObj.l2 = commentary.commentary_l2;
      }
      if (typeof commentary.commentary_l3 === 'string') {
        commentaryObj.l3 = commentary.commentary_l3;
      }
      result.commentary = commentaryObj;
    }

    return result;
  });
}

function parseVariations(data: unknown): SceneVariation[] {
  if (!Array.isArray(data)) return [];

  return data.map((item) => {
    if (typeof item !== 'object' || item === null) {
      return { id: '', description: '', parameterOverrides: {} };
    }
    const obj = item as Record<string, unknown>;
    return {
      id: String(obj.id || ''),
      description: String(obj.description || ''),
      parameterOverrides: (obj.parameter_overrides || obj.parameterOverrides || {}) as Record<
        string,
        unknown
      >,
    };
  });
}

function parseExportArtifacts(data: unknown): ExportArtifact[] {
  if (!Array.isArray(data)) return [];

  return data.map((item) => {
    if (typeof item !== 'object' || item === null) {
      return { type: '', description: '' };
    }
    const obj = item as Record<string, unknown>;
    const path = obj.path as string | undefined;

    const result: ExportArtifact = {
      type: String(obj.type || ''),
      description: String(obj.description || ''),
    };

    if (path !== undefined) {
      result.path = path;
    }

    return result;
  });
}

function parseStringArray(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  return data.filter((item) => typeof item === 'string') as string[];
}

function validateParameterValue(param: SceneParameter, value: unknown): unknown {
  switch (param.type) {
    case 'string':
      return String(value);
    case 'number':
      return Number(value);
    case 'boolean':
      return Boolean(value);
    case 'enum':
      if (param.values && !param.values.includes(value)) {
        throw new ValidationError(
          `Invalid value for parameter ${param.name}: ${value}`,
          'parameter_value',
          param.name
        );
      }
      return value;
    default:
      return value;
  }
}
