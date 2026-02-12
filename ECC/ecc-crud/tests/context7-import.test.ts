/**
 * Context7 Import Tests
 *
 * Tests for importing skills from Context7/Agent Skills format into ECC.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import {
  parseC7SkillFile,
  transformC7ToEccSkill,
  importC7Skill,
  importC7Directory,
  importC7,
  type ParsedC7Skill,
} from '../src/import/context7-importer.js';
import { createCrudEngine } from '../src/core/crud-engine.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const VALID_C7_SKILL = `---
name: pdf-processing
description: Extract text and tables from PDF files, fill forms, merge documents.
license: MIT
metadata:
  author: context7
  version: "1.0.0"
allowed-tools: Bash Read Write
---

# PDF Processing Skill

This skill helps you work with PDF documents.

## Capabilities

- Extract text from PDFs
- Extract tables to CSV
- Fill PDF forms
- Merge multiple PDFs

## Usage

Use this skill when the user asks about PDF manipulation.
`;

const MINIMAL_C7_SKILL = `---
name: minimal-skill
description: A minimal skill for testing.
---

Basic instructions here.
`;

const INVALID_NO_FRONTMATTER = `# No Frontmatter

This file has no YAML frontmatter.
`;

const INVALID_NO_NAME = `---
description: Missing the name field
---

Content here.
`;

const INVALID_NO_DESCRIPTION = `---
name: no-desc
---

Content here.
`;

// ============================================================================
// Test Helpers
// ============================================================================

let testDir: string;
let projectRoot: string;

function setupTestDir() {
  testDir = join(tmpdir(), `c7-import-test-${randomUUID().slice(0, 8)}`);
  projectRoot = join(tmpdir(), `c7-project-${randomUUID().slice(0, 8)}`);
  mkdirSync(testDir, { recursive: true });
  mkdirSync(projectRoot, { recursive: true });
}

function cleanupTestDir() {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
  if (existsSync(projectRoot)) {
    rmSync(projectRoot, { recursive: true, force: true });
  }
}

function createSkillFile(name: string, content: string): string {
  const skillDir = join(testDir, name);
  mkdirSync(skillDir, { recursive: true });
  const skillPath = join(skillDir, 'SKILL.md');
  writeFileSync(skillPath, content);
  return skillPath;
}

// ============================================================================
// Parse Tests
// ============================================================================

describe('parseC7SkillFile', () => {
  it('parses valid skill with all fields', () => {
    const parsed = parseC7SkillFile(VALID_C7_SKILL, '/test/path/SKILL.md');

    expect(parsed.frontmatter.name).toBe('pdf-processing');
    expect(parsed.frontmatter.description).toBe('Extract text and tables from PDF files, fill forms, merge documents.');
    expect(parsed.frontmatter.license).toBe('MIT');
    expect(parsed.frontmatter.metadata?.author).toBe('context7');
    expect(parsed.frontmatter.metadata?.version).toBe('1.0.0');
    expect(parsed.frontmatter['allowed-tools']).toBe('Bash Read Write');
    expect(parsed.body).toContain('# PDF Processing Skill');
    expect(parsed.sourcePath).toBe('/test/path/SKILL.md');
  });

  it('parses minimal skill', () => {
    const parsed = parseC7SkillFile(MINIMAL_C7_SKILL, '/test/SKILL.md');

    expect(parsed.frontmatter.name).toBe('minimal-skill');
    expect(parsed.frontmatter.description).toBe('A minimal skill for testing.');
    expect(parsed.frontmatter.license).toBeUndefined();
    expect(parsed.frontmatter.metadata).toBeUndefined();
    expect(parsed.body).toBe('Basic instructions here.');
  });

  it('throws on missing frontmatter', () => {
    expect(() => parseC7SkillFile(INVALID_NO_FRONTMATTER, '/test/SKILL.md'))
      .toThrow('missing YAML frontmatter');
  });

  it('throws on missing name field', () => {
    expect(() => parseC7SkillFile(INVALID_NO_NAME, '/test/SKILL.md'))
      .toThrow('missing required "name" field');
  });

  it('throws on missing description field', () => {
    expect(() => parseC7SkillFile(INVALID_NO_DESCRIPTION, '/test/SKILL.md'))
      .toThrow('missing required "description" field');
  });
});

// ============================================================================
// Transform Tests
// ============================================================================

describe('transformC7ToEccSkill', () => {
  const parsed: ParsedC7Skill = {
    frontmatter: {
      name: 'test-skill',
      description: 'A test skill',
      license: 'Apache-2.0',
      'allowed-tools': 'Bash Read',
      metadata: { author: 'tester', version: '2.0' },
    },
    body: '# Test\n\nBody content here.',
    sourcePath: '/original/path/SKILL.md',
  };

  it('transforms with default options', () => {
    const skill = transformC7ToEccSkill(parsed);

    expect(skill.id).toBe('context7/test-skill');
    expect(skill.pluginId).toBe('context7-import');
    expect(skill.name).toBe('test-skill');
    expect(skill.category).toBe('context7');
    expect(skill.description).toBe('A test skill');
    expect(skill.allowedTools).toEqual(['Bash', 'Read']);
    expect(skill.content).toContain('Imported from Context7');
    expect(skill.content).toContain('**Author**: tester');
    expect(skill.content).toContain('**License**: Apache-2.0');
    expect(skill.content).toContain('Body content here.');
  });

  it('transforms with custom category', () => {
    const skill = transformC7ToEccSkill(parsed, { category: 'libraries' });

    expect(skill.id).toBe('libraries/test-skill');
    expect(skill.category).toBe('libraries');
  });

  it('transforms with custom pluginId', () => {
    const skill = transformC7ToEccSkill(parsed, { pluginId: 'my-importer' });

    expect(skill.pluginId).toBe('my-importer');
  });

  it('handles missing optional fields', () => {
    const minimal: ParsedC7Skill = {
      frontmatter: {
        name: 'minimal',
        description: 'Minimal desc',
      },
      body: 'Just body.',
      sourcePath: '/path/SKILL.md',
    };

    const skill = transformC7ToEccSkill(minimal);

    expect(skill.allowedTools).toBeUndefined();
    expect(skill.content).not.toContain('**License**');
    expect(skill.content).toContain('Just body.');
  });
});

// ============================================================================
// Import Tests (with CrudEngine)
// ============================================================================

describe('importC7Skill', () => {
  beforeEach(setupTestDir);
  afterEach(cleanupTestDir);

  it('imports a valid skill', async () => {
    const skillPath = createSkillFile('pdf-processing', VALID_C7_SKILL);
    const engine = createCrudEngine(projectRoot, 'test');

    const result = await importC7Skill(skillPath, engine);

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('pdf-processing');
    expect(result.data?.description).toBe('Extract text and tables from PDF files, fill forms, merge documents.');
  });

  it('returns error for invalid skill', async () => {
    const skillPath = createSkillFile('invalid', INVALID_NO_NAME);
    const engine = createCrudEngine(projectRoot, 'test');

    const result = await importC7Skill(skillPath, engine);

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('missing required "name" field');
  });

  it('supports dry run', async () => {
    const skillPath = createSkillFile('dry-run', MINIMAL_C7_SKILL);
    const engine = createCrudEngine(projectRoot, 'test');

    const result = await importC7Skill(skillPath, engine, { dryRun: true });

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('minimal-skill');

    // Verify not actually persisted
    const skillFile = join(projectRoot, '.claude/skills/context7/minimal-skill/SKILL.md');
    expect(existsSync(skillFile)).toBe(false);
  });

  it('uses custom category', async () => {
    const skillPath = createSkillFile('custom-cat', MINIMAL_C7_SKILL);
    const engine = createCrudEngine(projectRoot, 'test');

    const result = await importC7Skill(skillPath, engine, { category: 'utils' });

    expect(result.success).toBe(true);
    expect(result.data?.id).toBe('utils/minimal-skill');
    expect(result.data?.category).toBe('utils');
  });
});

describe('importC7Directory', () => {
  beforeEach(setupTestDir);
  afterEach(cleanupTestDir);

  it('imports multiple skills from directory', async () => {
    createSkillFile('skill-one', VALID_C7_SKILL);
    createSkillFile('skill-two', MINIMAL_C7_SKILL);

    const engine = createCrudEngine(projectRoot, 'test');
    const result = await importC7Directory(testDir, engine);

    expect(result.total).toBe(2);
    expect(result.imported.length).toBe(2);
    expect(result.errors.length).toBe(0);
  });

  it('reports errors for invalid skills', async () => {
    createSkillFile('good', MINIMAL_C7_SKILL);
    createSkillFile('bad', INVALID_NO_NAME);

    const engine = createCrudEngine(projectRoot, 'test');
    const result = await importC7Directory(testDir, engine);

    expect(result.total).toBe(2);
    expect(result.imported.length).toBe(1);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]?.error).toContain('missing required "name" field');
  });

  it('skips non-skill directories', async () => {
    createSkillFile('valid-skill', MINIMAL_C7_SKILL);
    // Create a directory without SKILL.md
    mkdirSync(join(testDir, 'not-a-skill'), { recursive: true });
    writeFileSync(join(testDir, 'not-a-skill', 'README.md'), '# Not a skill');

    const engine = createCrudEngine(projectRoot, 'test');
    const result = await importC7Directory(testDir, engine);

    expect(result.total).toBe(1);
    expect(result.imported.length).toBe(1);
  });
});

describe('importC7', () => {
  beforeEach(setupTestDir);
  afterEach(cleanupTestDir);

  it('handles file path', async () => {
    const skillPath = createSkillFile('file-test', MINIMAL_C7_SKILL);
    const engine = createCrudEngine(projectRoot, 'test');

    const result = await importC7(skillPath, engine);

    expect(result.total).toBe(1);
    expect(result.imported.length).toBe(1);
  });

  it('handles skill directory path', async () => {
    createSkillFile('dir-test', MINIMAL_C7_SKILL);
    const skillDir = join(testDir, 'dir-test');
    const engine = createCrudEngine(projectRoot, 'test');

    const result = await importC7(skillDir, engine);

    expect(result.total).toBe(1);
    expect(result.imported.length).toBe(1);
  });

  it('handles parent directory path', async () => {
    createSkillFile('child-one', MINIMAL_C7_SKILL);
    createSkillFile('child-two', VALID_C7_SKILL);
    const engine = createCrudEngine(projectRoot, 'test');

    const result = await importC7(testDir, engine);

    expect(result.total).toBe(2);
    expect(result.imported.length).toBe(2);
  });
});
