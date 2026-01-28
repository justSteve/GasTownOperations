/**
 * Command Template Unit Tests (Layer 2)
 *
 * Tests the generateCommandFile template generator.
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateCommandFile, getCommandFilePath } from '../../../src/templates/template-command.ts';
import type { EccCommand } from '../../../src/ecc-types.ts';

describe('Command Template', () => {
  describe('generateCommandFile', () => {
    it('generates minimal command', () => {
      const command: EccCommand = {
        id: 'test-cmd',
        pluginId: 'test-plugin',
        name: 'minimal',
      };

      const output = generateCommandFile(command);

      assert.ok(output.includes('# /minimal'), 'Should have slash prefix in heading');
    });

    it('generates command with description', () => {
      const command: EccCommand = {
        id: 'test-cmd',
        pluginId: 'test-plugin',
        name: 'described',
        description: 'A helpful command description',
      };

      const output = generateCommandFile(command);

      assert.ok(output.includes('# /described'));
      assert.ok(output.includes('A helpful command description'));
    });

    it('generates command with allowed tools', () => {
      const command: EccCommand = {
        id: 'test-cmd',
        pluginId: 'test-plugin',
        name: 'tooled',
        allowedTools: ['Read', 'Write', 'Bash'],
      };

      const output = generateCommandFile(command);

      assert.ok(output.includes('## Allowed Tools'));
      assert.ok(output.includes('- Read'));
      assert.ok(output.includes('- Write'));
      assert.ok(output.includes('- Bash'));
    });

    it('generates command with agent reference', () => {
      const command: EccCommand = {
        id: 'test-cmd',
        pluginId: 'test-plugin',
        name: 'delegating',
        invokesAgentRef: 'my-agent',
      };

      const output = generateCommandFile(command);

      assert.ok(output.includes('## Delegates To'));
      assert.ok(output.includes('Agent: my-agent'));
    });

    it('generates command with confirmation flag', () => {
      const command: EccCommand = {
        id: 'test-cmd',
        pluginId: 'test-plugin',
        name: 'confirming',
        waitForConfirmation: true,
      };

      const output = generateCommandFile(command);

      assert.ok(output.includes('## Options'));
      assert.ok(output.includes('Wait for user confirmation'));
    });

    it('generates command with content', () => {
      const command: EccCommand = {
        id: 'test-cmd',
        pluginId: 'test-plugin',
        name: 'content-cmd',
        content: 'Execute the following steps:\n\n1. First step\n2. Second step',
      };

      const output = generateCommandFile(command);

      assert.ok(output.includes('## Content'));
      assert.ok(output.includes('Execute the following steps:'));
      assert.ok(output.includes('1. First step'));
    });

    it('generates command with phases in correct order', () => {
      const command: EccCommand = {
        id: 'test-cmd',
        pluginId: 'test-plugin',
        name: 'phased',
        phases: [
          {
            id: 'p3',
            commandId: 'test-cmd',
            number: 3,
            name: 'Cleanup',
            description: 'Clean up resources',
          },
          {
            id: 'p1',
            commandId: 'test-cmd',
            number: 1,
            name: 'Setup',
            description: 'Set up environment',
          },
          {
            id: 'p2',
            commandId: 'test-cmd',
            number: 2,
            name: 'Execute',
            description: 'Run main logic',
          },
        ],
      };

      const output = generateCommandFile(command);

      assert.ok(output.includes('## Phases'));
      assert.ok(output.includes('### Phase 1: Setup'));
      assert.ok(output.includes('### Phase 2: Execute'));
      assert.ok(output.includes('### Phase 3: Cleanup'));

      // Verify order
      const phase1Idx = output.indexOf('Phase 1');
      const phase2Idx = output.indexOf('Phase 2');
      const phase3Idx = output.indexOf('Phase 3');
      assert.ok(phase1Idx < phase2Idx, 'Phase 1 should come before Phase 2');
      assert.ok(phase2Idx < phase3Idx, 'Phase 2 should come before Phase 3');
    });

    it('generates phase with steps', () => {
      const command: EccCommand = {
        id: 'test-cmd',
        pluginId: 'test-plugin',
        name: 'stepped',
        phases: [
          {
            id: 'p1',
            commandId: 'test-cmd',
            number: 1,
            name: 'Work',
            steps: ['Step one', 'Step two', 'Step three'],
          },
        ],
      };

      const output = generateCommandFile(command);

      assert.ok(output.includes('**Steps:**'));
      assert.ok(output.includes('1. Step one'));
      assert.ok(output.includes('2. Step two'));
      assert.ok(output.includes('3. Step three'));
    });

    it('generates phase without name', () => {
      const command: EccCommand = {
        id: 'test-cmd',
        pluginId: 'test-plugin',
        name: 'unnamed-phase',
        phases: [
          {
            id: 'p1',
            commandId: 'test-cmd',
            number: 1,
            description: 'A phase without a name',
          },
        ],
      };

      const output = generateCommandFile(command);

      assert.ok(output.includes('### Phase 1\n'), 'Phase without name should not have colon');
      assert.ok(output.includes('A phase without a name'));
    });

    it('generates fully populated command', () => {
      const command: EccCommand = {
        id: 'full-cmd',
        pluginId: 'test-plugin',
        name: 'full-command',
        description: 'A complete command',
        content: 'Main content here',
        allowedTools: ['Read'],
        waitForConfirmation: true,
        invokesAgentRef: 'helper-agent',
        phases: [
          {
            id: 'p1',
            commandId: 'full-cmd',
            number: 1,
            name: 'Only Phase',
            description: 'The only phase',
            steps: ['Do it'],
          },
        ],
      };

      const output = generateCommandFile(command);

      assert.ok(output.includes('# /full-command'));
      assert.ok(output.includes('A complete command'));
      assert.ok(output.includes('## Allowed Tools'));
      assert.ok(output.includes('## Delegates To'));
      assert.ok(output.includes('## Options'));
      assert.ok(output.includes('## Content'));
      assert.ok(output.includes('## Phases'));
    });
  });

  describe('getCommandFilePath', () => {
    it('generates correct path for command', () => {
      const command: EccCommand = {
        id: 'test',
        pluginId: 'plugin',
        name: 'my-command',
      };

      const path = getCommandFilePath(command);

      assert.equal(path, 'commands/my-command.md');
    });
  });
});
