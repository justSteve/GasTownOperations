/**
 * Rule Template Unit Tests (Layer 2)
 *
 * Tests the generateRuleFile template generator.
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateRuleFile, getRuleFilePath } from '../../../src/templates/template-rule.ts';
import type { EccRule } from '../../../src/ecc-types.ts';

describe('Rule Template', () => {
  describe('generateRuleFile', () => {
    it('generates minimal rule', () => {
      const rule: EccRule = {
        id: 'test-rule',
        pluginId: 'test-plugin',
        name: 'minimal-rule',
      };

      const output = generateRuleFile(rule);

      assert.ok(output.includes('# minimal-rule'));
    });

    it('uses title when provided', () => {
      const rule: EccRule = {
        id: 'test-rule',
        pluginId: 'test-plugin',
        name: 'rule-name',
        title: 'Rule Display Title',
      };

      const output = generateRuleFile(rule);

      assert.ok(output.includes('# Rule Display Title'));
      assert.ok(!output.includes('# rule-name'));
    });

    it('generates rule with content', () => {
      const rule: EccRule = {
        id: 'test-rule',
        pluginId: 'test-plugin',
        name: 'content-rule',
        content: 'This rule requires:\n\n1. First requirement\n2. Second requirement',
      };

      const output = generateRuleFile(rule);

      assert.ok(output.includes('This rule requires:'));
      assert.ok(output.includes('1. First requirement'));
    });

    it('generates rule with severity required', () => {
      const rule: EccRule = {
        id: 'test-rule',
        pluginId: 'test-plugin',
        name: 'required-rule',
        severity: 'required',
      };

      const output = generateRuleFile(rule);

      assert.ok(output.includes('**Severity:** required'));
    });

    it('generates rule with severity recommended', () => {
      const rule: EccRule = {
        id: 'test-rule',
        pluginId: 'test-plugin',
        name: 'recommended-rule',
        severity: 'recommended',
      };

      const output = generateRuleFile(rule);

      assert.ok(output.includes('**Severity:** recommended'));
    });

    it('generates rule with severity optional', () => {
      const rule: EccRule = {
        id: 'test-rule',
        pluginId: 'test-plugin',
        name: 'optional-rule',
        severity: 'optional',
      };

      const output = generateRuleFile(rule);

      assert.ok(output.includes('**Severity:** optional'));
    });

    it('generates rule with category', () => {
      const rule: EccRule = {
        id: 'test-rule',
        pluginId: 'test-plugin',
        name: 'categorized-rule',
        category: 'security',
      };

      const output = generateRuleFile(rule);

      assert.ok(output.includes('**Category:** security'));
    });

    it('generates rule with applicability', () => {
      const rule: EccRule = {
        id: 'test-rule',
        pluginId: 'test-plugin',
        name: 'applicable-rule',
        applicability: 'All TypeScript files',
      };

      const output = generateRuleFile(rule);

      assert.ok(output.includes('**Applies when:** All TypeScript files'));
    });

    it('generates rule with all metadata', () => {
      const rule: EccRule = {
        id: 'test-rule',
        pluginId: 'test-plugin',
        name: 'full-meta-rule',
        severity: 'required',
        category: 'performance',
        applicability: 'Database queries',
      };

      const output = generateRuleFile(rule);

      assert.ok(output.includes('**Severity:** required'));
      assert.ok(output.includes('**Category:** performance'));
      assert.ok(output.includes('**Applies when:** Database queries'));
    });

    it('generates fully populated rule', () => {
      const rule: EccRule = {
        id: 'full-rule',
        pluginId: 'test-plugin',
        name: 'full-rule',
        title: 'Complete Rule',
        content: 'The full rule content.',
        severity: 'required',
        category: 'quality',
        applicability: 'All changes',
      };

      const output = generateRuleFile(rule);

      assert.ok(output.includes('# Complete Rule'));
      assert.ok(output.includes('**Severity:** required'));
      assert.ok(output.includes('**Category:** quality'));
      assert.ok(output.includes('**Applies when:** All changes'));
      assert.ok(output.includes('The full rule content.'));
    });

    it('metadata appears before content', () => {
      const rule: EccRule = {
        id: 'test-rule',
        pluginId: 'test-plugin',
        name: 'order-test',
        severity: 'required',
        content: 'Main content here',
      };

      const output = generateRuleFile(rule);

      const severityIdx = output.indexOf('**Severity:**');
      const contentIdx = output.indexOf('Main content here');

      assert.ok(severityIdx < contentIdx, 'Severity should appear before content');
    });
  });

  describe('getRuleFilePath', () => {
    it('generates correct path for rule', () => {
      const rule: EccRule = {
        id: 'test',
        pluginId: 'plugin',
        name: 'my-rule',
      };

      const path = getRuleFilePath(rule);

      assert.equal(path, 'rules/my-rule.md');
    });
  });
});
