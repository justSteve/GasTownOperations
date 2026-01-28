/**
 * Foreign Key Validation Tests (Layer 1)
 *
 * Validates that all entity references (foreign keys) point to valid entities.
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const FIXTURES_DIR = join(import.meta.dirname, '../fixtures/data');
const FIXTURE_SETS = ['minimal-plugin', 'complete-plugin', 'edge-cases'];

interface Plugin {
  id: string;
  name: string;
}

interface Agent {
  id: string;
  pluginId: string;
  name: string;
  skillRefs?: string[];
  ruleRefs?: string[];
}

interface Skill {
  id: string;
  pluginId: string;
  name: string;
}

interface Rule {
  id: string;
  pluginId: string;
  name: string;
}

interface Hook {
  id: string;
  pluginId: string;
  name: string;
}

interface McpServer {
  id: string;
  pluginId: string;
  name: string;
}

interface Context {
  id: string;
  pluginId: string;
  name: string;
}

interface Command {
  id: string;
  pluginId: string;
  name: string;
  invokesAgentRef?: string;
}

interface Zgent {
  id: string;
  pluginId: string;
}

interface FixtureData {
  plugins: Plugin[];
  agents: Agent[];
  skills: Skill[];
  rules: Rule[];
  hooks: Hook[];
  mcpServers: McpServer[];
  contexts: Context[];
  commands: Command[];
  zgents: Zgent[];
}

async function loadFixture(fixtureSet: string): Promise<FixtureData> {
  const dir = join(FIXTURES_DIR, fixtureSet);

  const loadJson = async <T>(filename: string): Promise<T> => {
    const content = await readFile(join(dir, filename), 'utf-8');
    return JSON.parse(content);
  };

  const [
    pluginsFile,
    agentsFile,
    skillsFile,
    rulesFile,
    hooksFile,
    mcpServersFile,
    contextsFile,
    commandsFile,
    zgentsFile,
  ] = await Promise.all([
    loadJson<{ plugins: Plugin[] }>('ecc-plugins.json'),
    loadJson<{ agents: Agent[] }>('ecc-agents.json'),
    loadJson<{ skills: Skill[] }>('ecc-skills.json'),
    loadJson<{ rules: Rule[] }>('ecc-rules.json'),
    loadJson<{ hooks: Hook[] }>('ecc-hooks.json'),
    loadJson<{ mcpServers: McpServer[] }>('ecc-mcp-servers.json'),
    loadJson<{ contexts: Context[] }>('ecc-contexts.json'),
    loadJson<{ commands: Command[] }>('ecc-commands.json'),
    loadJson<{ zgents: Zgent[] }>('ecc-zgent-instances.json'),
  ]);

  return {
    plugins: pluginsFile.plugins,
    agents: agentsFile.agents,
    skills: skillsFile.skills,
    rules: rulesFile.rules,
    hooks: hooksFile.hooks,
    mcpServers: mcpServersFile.mcpServers,
    contexts: contextsFile.contexts,
    commands: commandsFile.commands,
    zgents: zgentsFile.zgents,
  };
}

describe('Foreign Key Validation', () => {
  for (const fixtureSet of FIXTURE_SETS) {
    describe(`Fixture: ${fixtureSet}`, () => {
      let data: FixtureData;
      let pluginIds: Set<string>;
      let agentNames: Set<string>;
      let skillNames: Set<string>;
      let ruleNames: Set<string>;

      it('loads fixture data', async () => {
        data = await loadFixture(fixtureSet);
        pluginIds = new Set(data.plugins.map((p) => p.id));
        agentNames = new Set(data.agents.map((a) => a.name));
        skillNames = new Set(data.skills.map((s) => s.name));
        ruleNames = new Set(data.rules.map((r) => r.name));
      });

      it('all agents reference valid plugins', async () => {
        if (!data) data = await loadFixture(fixtureSet);
        if (!pluginIds) pluginIds = new Set(data.plugins.map((p) => p.id));

        for (const agent of data.agents) {
          assert.ok(
            pluginIds.has(agent.pluginId),
            `Agent '${agent.name}' references invalid plugin: ${agent.pluginId}`
          );
        }
      });

      it('all skills reference valid plugins', async () => {
        if (!data) data = await loadFixture(fixtureSet);
        if (!pluginIds) pluginIds = new Set(data.plugins.map((p) => p.id));

        for (const skill of data.skills) {
          assert.ok(
            pluginIds.has(skill.pluginId),
            `Skill '${skill.name}' references invalid plugin: ${skill.pluginId}`
          );
        }
      });

      it('all rules reference valid plugins', async () => {
        if (!data) data = await loadFixture(fixtureSet);
        if (!pluginIds) pluginIds = new Set(data.plugins.map((p) => p.id));

        for (const rule of data.rules) {
          assert.ok(
            pluginIds.has(rule.pluginId),
            `Rule '${rule.name}' references invalid plugin: ${rule.pluginId}`
          );
        }
      });

      it('all hooks reference valid plugins', async () => {
        if (!data) data = await loadFixture(fixtureSet);
        if (!pluginIds) pluginIds = new Set(data.plugins.map((p) => p.id));

        for (const hook of data.hooks) {
          assert.ok(
            pluginIds.has(hook.pluginId),
            `Hook '${hook.name}' references invalid plugin: ${hook.pluginId}`
          );
        }
      });

      it('all MCP servers reference valid plugins', async () => {
        if (!data) data = await loadFixture(fixtureSet);
        if (!pluginIds) pluginIds = new Set(data.plugins.map((p) => p.id));

        for (const server of data.mcpServers) {
          assert.ok(
            pluginIds.has(server.pluginId),
            `MCP server '${server.name}' references invalid plugin: ${server.pluginId}`
          );
        }
      });

      it('all contexts reference valid plugins', async () => {
        if (!data) data = await loadFixture(fixtureSet);
        if (!pluginIds) pluginIds = new Set(data.plugins.map((p) => p.id));

        for (const context of data.contexts) {
          assert.ok(
            pluginIds.has(context.pluginId),
            `Context '${context.name}' references invalid plugin: ${context.pluginId}`
          );
        }
      });

      it('all commands reference valid plugins', async () => {
        if (!data) data = await loadFixture(fixtureSet);
        if (!pluginIds) pluginIds = new Set(data.plugins.map((p) => p.id));

        for (const command of data.commands) {
          assert.ok(
            pluginIds.has(command.pluginId),
            `Command '${command.name}' references invalid plugin: ${command.pluginId}`
          );
        }
      });

      it('all zgents reference valid plugins', async () => {
        if (!data) data = await loadFixture(fixtureSet);
        if (!pluginIds) pluginIds = new Set(data.plugins.map((p) => p.id));

        for (const zgent of data.zgents) {
          assert.ok(
            pluginIds.has(zgent.pluginId),
            `Zgent '${zgent.id}' references invalid plugin: ${zgent.pluginId}`
          );
        }
      });

      it('agent skill references are valid', async () => {
        if (!data) data = await loadFixture(fixtureSet);
        if (!skillNames) skillNames = new Set(data.skills.map((s) => s.name));

        for (const agent of data.agents) {
          if (agent.skillRefs) {
            for (const skillRef of agent.skillRefs) {
              assert.ok(
                skillNames.has(skillRef),
                `Agent '${agent.name}' references unknown skill: ${skillRef}`
              );
            }
          }
        }
      });

      it('agent rule references are valid', async () => {
        if (!data) data = await loadFixture(fixtureSet);
        if (!ruleNames) ruleNames = new Set(data.rules.map((r) => r.name));

        for (const agent of data.agents) {
          if (agent.ruleRefs) {
            for (const ruleRef of agent.ruleRefs) {
              assert.ok(
                ruleNames.has(ruleRef),
                `Agent '${agent.name}' references unknown rule: ${ruleRef}`
              );
            }
          }
        }
      });

      it('command agent references are valid', async () => {
        if (!data) data = await loadFixture(fixtureSet);
        if (!agentNames) agentNames = new Set(data.agents.map((a) => a.name));

        for (const command of data.commands) {
          if (command.invokesAgentRef) {
            assert.ok(
              agentNames.has(command.invokesAgentRef),
              `Command '${command.name}' references unknown agent: ${command.invokesAgentRef}`
            );
          }
        }
      });
    });
  }

  describe('No orphan entities', () => {
    it('every plugin has at least one zgent', async () => {
      for (const fixtureSet of FIXTURE_SETS) {
        const data = await loadFixture(fixtureSet);
        const pluginIdsWithZgents = new Set(data.zgents.map((z) => z.pluginId));

        for (const plugin of data.plugins) {
          assert.ok(
            pluginIdsWithZgents.has(plugin.id),
            `Plugin '${plugin.id}' in ${fixtureSet} has no zgent instances`
          );
        }
      }
    });
  });
});
