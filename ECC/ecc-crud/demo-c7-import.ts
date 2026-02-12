#!/usr/bin/env bun
/**
 * Context7 Skills Import Demo
 *
 * Demonstrates importing skills from Context7/Agent Skills format into ECC.
 *
 * Usage:
 *   bun run demo-c7-import.ts                    # Use sample skills
 *   bun run demo-c7-import.ts ./path/to/skills   # Import from path
 */

import { join } from 'node:path';
import { mkdirSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import {
  createCrudEngine,
  importC7,
  parseC7SkillFile,
  transformC7ToEccSkill,
} from './src/index.js';

// ============================================================================
// Sample Skills (mimicking Context7 format)
// ============================================================================

const SAMPLE_SKILLS = {
  'react-hooks': `---
name: react-hooks
description: Best practices for React hooks including useState, useEffect, useCallback, useMemo. Use when writing React functional components.
license: MIT
metadata:
  author: context7
  version: "19.0"
allowed-tools: Read Write
---

# React Hooks Guide

## useState

\`\`\`tsx
const [state, setState] = useState<Type>(initialValue);
\`\`\`

## useEffect

\`\`\`tsx
useEffect(() => {
  // Effect logic
  return () => {
    // Cleanup
  };
}, [dependencies]);
\`\`\`

## Best Practices

1. Keep hooks at the top level
2. Only call hooks from React functions
3. Use custom hooks for reusable logic
`,

  'typescript-patterns': `---
name: typescript-patterns
description: Common TypeScript patterns for type-safe development. Generics, utility types, and advanced patterns.
metadata:
  author: context7
  version: "5.4"
---

# TypeScript Patterns

## Utility Types

- \`Partial<T>\` - Make all properties optional
- \`Required<T>\` - Make all properties required
- \`Pick<T, K>\` - Pick specific properties
- \`Omit<T, K>\` - Omit specific properties

## Generic Constraints

\`\`\`typescript
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
\`\`\`
`,

  'git-workflow': `---
name: git-workflow
description: Git commands and workflows for version control. Branching, merging, rebasing, and collaboration patterns.
allowed-tools: Bash
---

# Git Workflow

## Feature Branch Workflow

\`\`\`bash
git checkout -b feature/my-feature
# ... make changes ...
git add .
git commit -m "feat: add feature"
git push -u origin feature/my-feature
\`\`\`

## Rebasing

\`\`\`bash
git fetch origin
git rebase origin/main
\`\`\`
`,
};

// ============================================================================
// Demo
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  Context7 Skills Import Demo');
  console.log('='.repeat(60) + '\n');

  const args = process.argv.slice(2);
  const customPath = args[0];

  // Setup
  const demoId = randomUUID().slice(0, 8);
  const projectRoot = join(tmpdir(), `c7-demo-project-${demoId}`);
  mkdirSync(projectRoot, { recursive: true });

  console.log(`📁 Project root: ${projectRoot}\n`);

  // Create CrudEngine in development mode
  console.log('🔧 Creating CrudEngine (development mode)...');
  const engine = createCrudEngine(projectRoot, 'development');
  console.log('   ✓ Engine created\n');

  if (customPath) {
    // Import from custom path
    console.log(`📥 Importing skills from: ${customPath}\n`);
    console.log('─'.repeat(60));

    const result = await importC7(customPath, engine, { category: 'imported' });

    console.log('─'.repeat(60) + '\n');

    console.log('📊 Import Results:\n');
    console.log(`   Total processed: ${result.total}`);
    console.log(`   Imported: ${result.imported.length}`);
    console.log(`   Errors: ${result.errors.length}`);

    if (result.imported.length > 0) {
      console.log('\n   Imported skills:');
      for (const skill of result.imported) {
        console.log(`   ✅ ${skill.id} - ${skill.description?.slice(0, 50)}...`);
      }
    }

    if (result.errors.length > 0) {
      console.log('\n   Errors:');
      for (const err of result.errors) {
        console.log(`   ❌ ${err.path}: ${err.error}`);
      }
    }
  } else {
    // Use sample skills
    console.log('📥 Creating sample skills (mimicking Context7 format)...\n');

    // Create temp directory with sample skills
    const samplesDir = join(tmpdir(), `c7-samples-${demoId}`);
    mkdirSync(samplesDir, { recursive: true });

    for (const [name, content] of Object.entries(SAMPLE_SKILLS)) {
      const skillDir = join(samplesDir, name);
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, 'SKILL.md'), content);
      console.log(`   Created: ${name}/SKILL.md`);
    }

    console.log(`\n📂 Samples directory: ${samplesDir}\n`);

    // Demo 1: Parse and transform (without persisting)
    console.log('─'.repeat(60));
    console.log('Demo 1: Parse & Transform (no persistence)');
    console.log('─'.repeat(60) + '\n');

    const sampleContent = SAMPLE_SKILLS['react-hooks']!;
    const parsed = parseC7SkillFile(sampleContent, 'react-hooks/SKILL.md');
    const eccSkill = transformC7ToEccSkill(parsed, { category: 'frontend' });

    console.log('Parsed frontmatter:');
    console.log(`   name: ${parsed.frontmatter.name}`);
    console.log(`   description: ${parsed.frontmatter.description.slice(0, 60)}...`);
    console.log(`   allowed-tools: ${parsed.frontmatter['allowed-tools']}`);

    console.log('\nTransformed to EccSkill:');
    console.log(`   id: ${eccSkill.id}`);
    console.log(`   category: ${eccSkill.category}`);
    console.log(`   allowedTools: ${JSON.stringify(eccSkill.allowedTools)}`);

    // Demo 2: Full import with traffic logging
    console.log('\n' + '─'.repeat(60));
    console.log('Demo 2: Full Import with Traffic Logging');
    console.log('─'.repeat(60) + '\n');

    const result = await importC7(samplesDir, engine, { category: 'libraries' });

    console.log('─'.repeat(60) + '\n');

    console.log('📊 Import Results:\n');
    console.log(`   Total processed: ${result.total}`);
    console.log(`   Successfully imported: ${result.imported.length}`);
    console.log(`   Errors: ${result.errors.length}`);

    // Show imported skills
    console.log('\n📜 Imported Skills:\n');
    for (const skill of result.imported) {
      console.log(`   📝 ${skill.name}`);
      console.log(`      ID: ${skill.id}`);
      console.log(`      Category: ${skill.category}`);
      console.log(`      Description: ${skill.description?.slice(0, 50)}...`);
      if (skill.allowedTools) {
        console.log(`      Allowed Tools: ${skill.allowedTools.join(', ')}`);
      }
      console.log('');
    }

    // Show operation history
    console.log('📜 CrudEngine Operation History:\n');
    const history = engine.getRecentOperations(10);
    for (const entry of history) {
      console.log(`   ${entry.timestamp}`);
      console.log(`   └─ CREATE skill: ${entry.result.data?.name || 'unknown'}`);
      console.log(`      Duration: ${entry.result.durationMs}ms`);
      console.log('');
    }

    // Show created files
    console.log('📂 Created Files:\n');
    const skillsDir = join(projectRoot, '.claude', 'skills', 'libraries');
    if (existsSync(skillsDir)) {
      const listDir = (dir: string, indent: string = '   ') => {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            console.log(`${indent}📁 ${entry.name}/`);
            listDir(fullPath, indent + '   ');
          } else {
            console.log(`${indent}📄 ${entry.name}`);
          }
        }
      };
      console.log('   .claude/skills/libraries/');
      listDir(skillsDir, '      ');
    }

    // Cleanup samples
    rmSync(samplesDir, { recursive: true, force: true });
  }

  // Cleanup project
  console.log('\n🧹 Cleaning up...');
  rmSync(projectRoot, { recursive: true, force: true });
  console.log('   ✓ Done\n');

  console.log('='.repeat(60));
  console.log('  Demo Complete!');
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error);
