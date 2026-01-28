/**
 * Test Assertions Library
 *
 * Reusable verification functions adapted from obra/superpowers testing patterns.
 */

import { readFile, stat } from 'node:fs/promises';
import { strict as assert } from 'node:assert';

/**
 * Assert that a file exists at the given path
 */
export async function assertFileExists(path: string): Promise<void> {
  try {
    await stat(path);
  } catch (error) {
    throw new Error(`Expected file to exist: ${path}`);
  }
}

/**
 * Assert that a file does NOT exist at the given path
 */
export async function assertFileNotExists(path: string): Promise<void> {
  try {
    await stat(path);
    throw new Error(`Expected file NOT to exist: ${path}`);
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Assert that a file contains valid JSON
 */
export async function assertJsonValid(path: string): Promise<unknown> {
  const content = await readFile(path, 'utf-8');
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON in file: ${path}`);
  }
}

/**
 * Assert that a markdown file contains expected section headings
 */
export async function assertMarkdownSections(
  path: string,
  headings: string[]
): Promise<void> {
  const content = await readFile(path, 'utf-8');
  for (const heading of headings) {
    const pattern = new RegExp(`^#+\\s+${escapeRegex(heading)}`, 'm');
    if (!pattern.test(content)) {
      throw new Error(`Missing markdown heading "${heading}" in: ${path}`);
    }
  }
}

/**
 * Assert that a file contains no unsubstituted variable placeholders
 */
export async function assertNoUnsubstitutedVars(path: string): Promise<void> {
  const content = await readFile(path, 'utf-8');
  // Match {{VAR}} or ${VAR} patterns
  const patterns = [
    /\{\{[A-Z_][A-Z0-9_]*\}\}/g,
    /\$\{[A-Z_][A-Z0-9_]*\}/g,
  ];
  for (const pattern of patterns) {
    const matches = content.match(pattern);
    if (matches) {
      throw new Error(
        `Unsubstituted variables found in ${path}: ${matches.join(', ')}`
      );
    }
  }
}

/**
 * Assert that a foreign key reference is valid
 */
export function assertForeignKeyValid(
  entity: { id?: string; name?: string },
  fkField: string,
  fkValue: string,
  validIds: Set<string>
): void {
  if (!validIds.has(fkValue)) {
    const entityId = entity.id ?? entity.name ?? 'unknown';
    throw new Error(
      `Invalid foreign key: ${fkField}="${fkValue}" in entity "${entityId}"`
    );
  }
}

/**
 * Assert that file content matches a golden file
 */
export async function assertMatchesGolden(
  actualPath: string,
  goldenPath: string
): Promise<void> {
  const actual = await readFile(actualPath, 'utf-8');
  const golden = await readFile(goldenPath, 'utf-8');
  if (actual !== golden) {
    throw new Error(
      `Content mismatch with golden file:\n  Actual: ${actualPath}\n  Golden: ${goldenPath}`
    );
  }
}

/**
 * Assert that a file contains a specific string
 */
export async function assertContains(
  path: string,
  expected: string,
  message?: string
): Promise<void> {
  const content = await readFile(path, 'utf-8');
  if (!content.includes(expected)) {
    throw new Error(
      message ?? `Expected file ${path} to contain: "${expected}"`
    );
  }
}

/**
 * Assert that a file does NOT contain a specific string
 */
export async function assertNotContains(
  path: string,
  unexpected: string,
  message?: string
): Promise<void> {
  const content = await readFile(path, 'utf-8');
  if (content.includes(unexpected)) {
    throw new Error(
      message ?? `Expected file ${path} NOT to contain: "${unexpected}"`
    );
  }
}

/**
 * Assert that a pattern occurs a specific number of times in a file
 */
export async function assertCount(
  path: string,
  pattern: string | RegExp,
  expectedCount: number
): Promise<void> {
  const content = await readFile(path, 'utf-8');
  const regex = typeof pattern === 'string' ? new RegExp(escapeRegex(pattern), 'g') : pattern;
  const matches = content.match(regex) ?? [];
  if (matches.length !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} occurrences of "${pattern}" in ${path}, found ${matches.length}`
    );
  }
}

/**
 * Assert that items appear in a specific order in a file
 */
export async function assertOrder(
  path: string,
  items: string[]
): Promise<void> {
  const content = await readFile(path, 'utf-8');
  let lastIndex = -1;
  for (const item of items) {
    const index = content.indexOf(item);
    if (index === -1) {
      throw new Error(`Item "${item}" not found in ${path}`);
    }
    if (index <= lastIndex) {
      throw new Error(`Items out of order in ${path}: "${item}" should come after previous items`);
    }
    lastIndex = index;
  }
}

/**
 * Helper to escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create a temporary directory for test output
 */
export async function createTempDir(prefix: string): Promise<string> {
  const { mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  return mkdtemp(join(tmpdir(), prefix));
}

/**
 * Clean up a temporary directory
 */
export async function cleanupTempDir(dir: string): Promise<void> {
  const { rm } = await import('node:fs/promises');
  await rm(dir, { recursive: true, force: true });
}
