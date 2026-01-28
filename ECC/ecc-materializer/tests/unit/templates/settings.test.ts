/**
 * Settings Template Unit Tests (Layer 2)
 *
 * Tests the generateSettingsJson template generator.
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateSettingsJson, getSettingsFilePath } from '../../../src/templates/template-settings-json.ts';
import type { EccMcpServer, EccPluginSettings } from '../../../src/ecc-types.ts';

describe('Settings Template', () => {
  describe('generateSettingsJson', () => {
    it('generates empty settings', () => {
      const mcpServers: EccMcpServer[] = [];

      const output = generateSettingsJson(mcpServers);
      const parsed = JSON.parse(output);

      assert.deepEqual(parsed, {});
    });

    it('generates settings with single MCP server', () => {
      const mcpServers: EccMcpServer[] = [
        {
          id: 'server1',
          pluginId: 'test-plugin',
          name: 'test-server',
          command: 'node',
          args: ['server.js'],
        },
      ];

      const output = generateSettingsJson(mcpServers);
      const parsed = JSON.parse(output);

      assert.ok('mcpServers' in parsed);
      assert.ok('test-server' in parsed.mcpServers);
      assert.equal(parsed.mcpServers['test-server'].command, 'node');
      assert.deepEqual(parsed.mcpServers['test-server'].args, ['server.js']);
    });

    it('generates MCP server with environment variables', () => {
      const mcpServers: EccMcpServer[] = [
        {
          id: 'server1',
          pluginId: 'test-plugin',
          name: 'env-server',
          command: 'node',
          env: { NODE_ENV: 'test', DEBUG: 'true' },
        },
      ];

      const output = generateSettingsJson(mcpServers);
      const parsed = JSON.parse(output);

      assert.deepEqual(parsed.mcpServers['env-server'].env, {
        NODE_ENV: 'test',
        DEBUG: 'true',
      });
    });

    it('generates MCP server with type', () => {
      const mcpServers: EccMcpServer[] = [
        {
          id: 'server1',
          pluginId: 'test-plugin',
          name: 'typed-server',
          serverType: 'stdio',
        },
      ];

      const output = generateSettingsJson(mcpServers);
      const parsed = JSON.parse(output);

      assert.equal(parsed.mcpServers['typed-server'].type, 'stdio');
    });

    it('generates SSE MCP server with URL', () => {
      const mcpServers: EccMcpServer[] = [
        {
          id: 'server1',
          pluginId: 'test-plugin',
          name: 'sse-server',
          serverType: 'sse',
          url: 'http://localhost:8080/sse',
        },
      ];

      const output = generateSettingsJson(mcpServers);
      const parsed = JSON.parse(output);

      assert.equal(parsed.mcpServers['sse-server'].type, 'sse');
      assert.equal(parsed.mcpServers['sse-server'].url, 'http://localhost:8080/sse');
    });

    it('generates disabled MCP server', () => {
      const mcpServers: EccMcpServer[] = [
        {
          id: 'server1',
          pluginId: 'test-plugin',
          name: 'disabled-server',
          enabled: false,
        },
      ];

      const output = generateSettingsJson(mcpServers);
      const parsed = JSON.parse(output);

      assert.equal(parsed.mcpServers['disabled-server'].enabled, false);
    });

    it('does not include enabled when true', () => {
      const mcpServers: EccMcpServer[] = [
        {
          id: 'server1',
          pluginId: 'test-plugin',
          name: 'enabled-server',
          enabled: true,
        },
      ];

      const output = generateSettingsJson(mcpServers);
      const parsed = JSON.parse(output);

      assert.ok(!('enabled' in parsed.mcpServers['enabled-server']));
    });

    it('generates multiple MCP servers', () => {
      const mcpServers: EccMcpServer[] = [
        { id: 's1', pluginId: 'test-plugin', name: 'server-one', command: 'one' },
        { id: 's2', pluginId: 'test-plugin', name: 'server-two', command: 'two' },
        { id: 's3', pluginId: 'test-plugin', name: 'server-three', command: 'three' },
      ];

      const output = generateSettingsJson(mcpServers);
      const parsed = JSON.parse(output);

      assert.equal(Object.keys(parsed.mcpServers).length, 3);
      assert.ok('server-one' in parsed.mcpServers);
      assert.ok('server-two' in parsed.mcpServers);
      assert.ok('server-three' in parsed.mcpServers);
    });

    it('generates settings with allow permissions', () => {
      const mcpServers: EccMcpServer[] = [];
      const settings: EccPluginSettings = {
        id: 'settings1',
        pluginId: 'test-plugin',
        allowedPermissions: ['read:files', 'write:files'],
      };

      const output = generateSettingsJson(mcpServers, settings);
      const parsed = JSON.parse(output);

      assert.ok('permissions' in parsed);
      assert.deepEqual(parsed.permissions.allow, ['read:files', 'write:files']);
    });

    it('generates settings with deny permissions', () => {
      const mcpServers: EccMcpServer[] = [];
      const settings: EccPluginSettings = {
        id: 'settings1',
        pluginId: 'test-plugin',
        deniedPermissions: ['execute:dangerous'],
      };

      const output = generateSettingsJson(mcpServers, settings);
      const parsed = JSON.parse(output);

      assert.ok('permissions' in parsed);
      assert.deepEqual(parsed.permissions.deny, ['execute:dangerous']);
    });

    it('generates settings with both allow and deny permissions', () => {
      const mcpServers: EccMcpServer[] = [];
      const settings: EccPluginSettings = {
        id: 'settings1',
        pluginId: 'test-plugin',
        allowedPermissions: ['read:files'],
        deniedPermissions: ['execute:dangerous'],
      };

      const output = generateSettingsJson(mcpServers, settings);
      const parsed = JSON.parse(output);

      assert.deepEqual(parsed.permissions.allow, ['read:files']);
      assert.deepEqual(parsed.permissions.deny, ['execute:dangerous']);
    });

    it('generates combined MCP servers and permissions', () => {
      const mcpServers: EccMcpServer[] = [
        { id: 's1', pluginId: 'test-plugin', name: 'test-server', command: 'node' },
      ];
      const settings: EccPluginSettings = {
        id: 'settings1',
        pluginId: 'test-plugin',
        allowedPermissions: ['read:files'],
      };

      const output = generateSettingsJson(mcpServers, settings);
      const parsed = JSON.parse(output);

      assert.ok('mcpServers' in parsed);
      assert.ok('permissions' in parsed);
      assert.ok('test-server' in parsed.mcpServers);
      assert.deepEqual(parsed.permissions.allow, ['read:files']);
    });

    it('does not include empty env object', () => {
      const mcpServers: EccMcpServer[] = [
        { id: 's1', pluginId: 'test-plugin', name: 'no-env', command: 'node', env: {} },
      ];

      const output = generateSettingsJson(mcpServers);
      const parsed = JSON.parse(output);

      assert.ok(!('env' in parsed.mcpServers['no-env']));
    });

    it('does not include empty args array', () => {
      const mcpServers: EccMcpServer[] = [
        { id: 's1', pluginId: 'test-plugin', name: 'no-args', command: 'node', args: [] },
      ];

      const output = generateSettingsJson(mcpServers);
      const parsed = JSON.parse(output);

      assert.ok(!('args' in parsed.mcpServers['no-args']));
    });

    it('generates valid JSON', () => {
      const mcpServers: EccMcpServer[] = [
        {
          id: 'full',
          pluginId: 'test-plugin',
          name: 'full-server',
          command: 'node',
          args: ['--flag'],
          env: { KEY: 'value' },
          serverType: 'stdio',
          enabled: false,
        },
      ];
      const settings: EccPluginSettings = {
        id: 's1',
        pluginId: 'test-plugin',
        allowedPermissions: ['perm'],
        deniedPermissions: ['deny'],
      };

      const output = generateSettingsJson(mcpServers, settings);

      // Should not throw
      const parsed = JSON.parse(output);
      assert.ok(typeof parsed === 'object');
    });

    it('outputs formatted JSON', () => {
      const mcpServers: EccMcpServer[] = [
        { id: 's1', pluginId: 'test-plugin', name: 'test', command: 'cmd' },
      ];

      const output = generateSettingsJson(mcpServers);

      // Should be pretty-printed with indentation
      assert.ok(output.includes('\n'));
      assert.ok(output.includes('  '));
    });
  });

  describe('getSettingsFilePath', () => {
    it('returns correct path', () => {
      const path = getSettingsFilePath();
      assert.equal(path, 'settings.json');
    });
  });
});
