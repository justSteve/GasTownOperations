-- ============================================================================
-- dbECC: Entity-Centric Communication Schema
-- Database: ClaudeConfig
-- Generated: 2026-01-27
-- ============================================================================
--
-- FOUNDING PROMPT:
-- ----------------
-- "Next step is to replicate the same set of actions against other repos. We
-- will be applying this or a very similar pattern across each new and all the
-- couple dozen that already exist. And given the number, it makes sense to
-- manage the process with code instead of ad hoc prompting. So let's look at
-- coding a framework with greater detail than we otherwise might. I prefer to
-- overbuild a system like this at the beginning. If we look at the .md of
-- everything-cc as a collection of entities instead of just string of prompts -
-- how can we define them using Entity Relation patterns and conventions. So
-- let's start there - express the repo as a .NET Entity Relation model."
--
-- PURPOSE:
-- --------
-- This schema models Claude Code configuration (.claude/ folder contents) as
-- interconnected entities, enabling:
--   1. Centralized management of configurations across multiple repositories
--   2. Reusable components (skills, rules, hooks) shared between projects
--   3. Code-driven configuration instead of ad-hoc prompting
--   4. Entity-Relationship patterns for Claude Code's conceptual model
--
-- ENTITIES:
-- ---------
-- Plugins, Agents, Commands, Skills, Rules, Hooks, Contexts, McpServers, Tools

USE ClaudeConfig;
GO

-- ============================================================================
-- CORE ENTITIES (no dependencies)
-- ============================================================================

-- Plugins: Root entity - all other entities belong to a plugin
CREATE TABLE dbo.Plugins (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    Version NVARCHAR(40) NULL,
    Author NVARCHAR(200) NULL,
    AuthorUrl NVARCHAR(1000) NULL,
    License NVARCHAR(100) NULL,
    Homepage NVARCHAR(1000) NULL,
    RepositoryUrl NVARCHAR(1000) NULL,
    RepositoryPath NVARCHAR(1000) NOT NULL,  -- Local path to plugin files
    Keywords NVARCHAR(MAX) NULL,              -- JSON array of keywords
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE()
);
GO

-- ============================================================================
-- PRIMARY ENTITIES (depend only on Plugins)
-- ============================================================================

-- Agents: AI agent configurations
CREATE TABLE dbo.Agents (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PluginId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    Model NVARCHAR(40) NULL,                  -- e.g., 'sonnet', 'opus', 'haiku'
    Instructions NVARCHAR(MAX) NULL,          -- System prompt / instructions
    RoleDescription NVARCHAR(MAX) NULL,       -- Role/persona description
    Tools NVARCHAR(MAX) NULL,                 -- JSON array of allowed tools
    CONSTRAINT FK_Agents_Plugin FOREIGN KEY (PluginId) REFERENCES dbo.Plugins(Id)
);
GO

-- Skills: Reusable capabilities/knowledge
CREATE TABLE dbo.Skills (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PluginId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Title NVARCHAR(400) NULL,
    Description NVARCHAR(MAX) NULL,
    Content NVARCHAR(MAX) NULL,               -- Skill prompt content
    Category NVARCHAR(100) NULL,
    CONSTRAINT FK_Skills_Plugin FOREIGN KEY (PluginId) REFERENCES dbo.Plugins(Id)
);
GO

-- Rules: Behavioral guidelines
CREATE TABLE dbo.Rules (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PluginId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Title NVARCHAR(400) NULL,
    Content NVARCHAR(MAX) NULL,               -- Rule text (markdown)
    Severity NVARCHAR(40) NULL,               -- e.g., 'required', 'recommended'
    Category NVARCHAR(100) NULL,
    Applicability NVARCHAR(MAX) NULL,         -- When this rule applies
    CONSTRAINT FK_Rules_Plugin FOREIGN KEY (PluginId) REFERENCES dbo.Plugins(Id)
);
GO

-- Hooks: Event handlers
CREATE TABLE dbo.Hooks (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PluginId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    EventType NVARCHAR(40) NOT NULL,          -- e.g., 'PreToolUse', 'PostToolUse', 'Notification'
    Matcher NVARCHAR(1000) NULL,              -- Pattern to match (tool name, etc.)
    Enabled BIT DEFAULT 1,
    Priority INT DEFAULT 0,
    CONSTRAINT FK_Hooks_Plugin FOREIGN KEY (PluginId) REFERENCES dbo.Plugins(Id)
);
GO

-- McpServers: MCP server configurations
CREATE TABLE dbo.McpServers (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PluginId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    Command NVARCHAR(1000) NULL,              -- e.g., 'npx', 'node'
    Args NVARCHAR(MAX) NULL,                  -- JSON array of arguments
    Env NVARCHAR(MAX) NULL,                   -- JSON object of env vars
    ServerType NVARCHAR(40) NULL,             -- 'stdio', 'sse', etc.
    Url NVARCHAR(1000) NULL,                  -- For SSE servers
    Enabled BIT DEFAULT 1,
    Category NVARCHAR(100) NULL,
    CONSTRAINT FK_McpServers_Plugin FOREIGN KEY (PluginId) REFERENCES dbo.Plugins(Id)
);
GO

-- Contexts: Situational configurations
CREATE TABLE dbo.Contexts (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PluginId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    SystemPromptOverride NVARCHAR(MAX) NULL,  -- Override system prompt
    ApplicableWhen NVARCHAR(MAX) NULL,        -- Conditions for activation
    Priority INT DEFAULT 0,
    ToolRestrictions NVARCHAR(MAX) NULL,      -- JSON: allowed/denied tools
    CONSTRAINT FK_Contexts_Plugin FOREIGN KEY (PluginId) REFERENCES dbo.Plugins(Id)
);
GO

-- Commands: User-invocable slash commands
CREATE TABLE dbo.Commands (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PluginId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(200) NOT NULL,              -- e.g., 'commit', 'review-pr'
    Description NVARCHAR(MAX) NULL,
    Content NVARCHAR(MAX) NULL,               -- Command prompt template
    AllowedTools NVARCHAR(MAX) NULL,          -- JSON array
    WaitForConfirmation BIT DEFAULT 0,
    InvokesAgentId UNIQUEIDENTIFIER NULL,     -- Optional: delegates to agent
    CONSTRAINT FK_Commands_Plugin FOREIGN KEY (PluginId) REFERENCES dbo.Plugins(Id),
    CONSTRAINT FK_Commands_Agent FOREIGN KEY (InvokesAgentId) REFERENCES dbo.Agents(Id)
);
GO

-- ============================================================================
-- SECONDARY ENTITIES (depend on primary entities)
-- ============================================================================

-- Tools: Individual tools provided by MCP servers
CREATE TABLE dbo.Tools (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    McpServerId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    Category NVARCHAR(100) NULL,
    RiskLevel NVARCHAR(40) NULL,              -- e.g., 'safe', 'caution', 'dangerous'
    CONSTRAINT FK_Tools_McpServer FOREIGN KEY (McpServerId) REFERENCES dbo.McpServers(Id)
);
GO

-- HookActions: Actions triggered by hooks
CREATE TABLE dbo.HookActions (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    HookId UNIQUEIDENTIFIER NOT NULL,
    ActionType NVARCHAR(40) NOT NULL,         -- 'command', 'block', 'modify', etc.
    Command NVARCHAR(1000) NULL,              -- Shell command to execute
    Arguments NVARCHAR(MAX) NULL,             -- JSON: additional parameters
    ActionOrder INT DEFAULT 0,
    CONSTRAINT FK_HookActions_Hook FOREIGN KEY (HookId) REFERENCES dbo.Hooks(Id)
);
GO

-- Phases: Multi-step command phases
CREATE TABLE dbo.Phases (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    CommandId UNIQUEIDENTIFIER NOT NULL,
    Number INT NOT NULL,
    Name NVARCHAR(200) NULL,
    Description NVARCHAR(MAX) NULL,
    Steps NVARCHAR(MAX) NULL,                 -- JSON array of step instructions
    CONSTRAINT FK_Phases_Command FOREIGN KEY (CommandId) REFERENCES dbo.Commands(Id)
);
GO

-- Patterns: Skill usage patterns
CREATE TABLE dbo.Patterns (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    SkillId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    Applicability NVARCHAR(MAX) NULL,         -- When to use this pattern
    Implementation NVARCHAR(MAX) NULL,        -- How to implement
    CONSTRAINT FK_Patterns_Skill FOREIGN KEY (SkillId) REFERENCES dbo.Skills(Id)
);
GO

-- Workflows: Step-by-step skill workflows
CREATE TABLE dbo.Workflows (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    SkillId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Steps NVARCHAR(MAX) NULL,                 -- JSON array of workflow steps
    ExpectedOutcome NVARCHAR(MAX) NULL,
    CONSTRAINT FK_Workflows_Skill FOREIGN KEY (SkillId) REFERENCES dbo.Skills(Id)
);
GO

-- ChecklistItems: Agent checklists
CREATE TABLE dbo.ChecklistItems (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    AgentId UNIQUEIDENTIFIER NOT NULL,
    Item NVARCHAR(MAX) NOT NULL,
    Priority NVARCHAR(40) NULL,               -- 'required', 'recommended', 'optional'
    ItemOrder INT DEFAULT 0,
    CONSTRAINT FK_ChecklistItems_Agent FOREIGN KEY (AgentId) REFERENCES dbo.Agents(Id)
);
GO

-- PluginSettings: Plugin-level permission settings
CREATE TABLE dbo.PluginSettings (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PluginId UNIQUEIDENTIFIER NOT NULL,
    AllowedPermissions NVARCHAR(MAX) NULL,    -- JSON array
    DeniedPermissions NVARCHAR(MAX) NULL,     -- JSON array
    CONSTRAINT FK_PluginSettings_Plugin FOREIGN KEY (PluginId) REFERENCES dbo.Plugins(Id)
);
GO

-- ============================================================================
-- JUNCTION TABLES (many-to-many relationships)
-- ============================================================================

-- AgentRules: Which rules apply to which agents
CREATE TABLE dbo.AgentRules (
    AgentId UNIQUEIDENTIFIER NOT NULL,
    RuleId UNIQUEIDENTIFIER NOT NULL,
    PRIMARY KEY (AgentId, RuleId),
    CONSTRAINT FK_AgentRules_Agent FOREIGN KEY (AgentId) REFERENCES dbo.Agents(Id),
    CONSTRAINT FK_AgentRules_Rule FOREIGN KEY (RuleId) REFERENCES dbo.Rules(Id)
);
GO

-- AgentSkills: Which skills agents have
CREATE TABLE dbo.AgentSkills (
    AgentId UNIQUEIDENTIFIER NOT NULL,
    SkillId UNIQUEIDENTIFIER NOT NULL,
    PRIMARY KEY (AgentId, SkillId),
    CONSTRAINT FK_AgentSkills_Agent FOREIGN KEY (AgentId) REFERENCES dbo.Agents(Id),
    CONSTRAINT FK_AgentSkills_Skill FOREIGN KEY (SkillId) REFERENCES dbo.Skills(Id)
);
GO

-- CommandSkills: Which skills commands use
CREATE TABLE dbo.CommandSkills (
    CommandId UNIQUEIDENTIFIER NOT NULL,
    SkillId UNIQUEIDENTIFIER NOT NULL,
    PRIMARY KEY (CommandId, SkillId),
    CONSTRAINT FK_CommandSkills_Command FOREIGN KEY (CommandId) REFERENCES dbo.Commands(Id),
    CONSTRAINT FK_CommandSkills_Skill FOREIGN KEY (SkillId) REFERENCES dbo.Skills(Id)
);
GO

-- CommandHooks: Which hooks fire for which commands
CREATE TABLE dbo.CommandHooks (
    CommandId UNIQUEIDENTIFIER NOT NULL,
    HookId UNIQUEIDENTIFIER NOT NULL,
    PRIMARY KEY (CommandId, HookId),
    CONSTRAINT FK_CommandHooks_Command FOREIGN KEY (CommandId) REFERENCES dbo.Commands(Id),
    CONSTRAINT FK_CommandHooks_Hook FOREIGN KEY (HookId) REFERENCES dbo.Hooks(Id)
);
GO

-- ContextHooks: Which hooks fire in which contexts
CREATE TABLE dbo.ContextHooks (
    ContextId UNIQUEIDENTIFIER NOT NULL,
    HookId UNIQUEIDENTIFIER NOT NULL,
    PRIMARY KEY (ContextId, HookId),
    CONSTRAINT FK_ContextHooks_Context FOREIGN KEY (ContextId) REFERENCES dbo.Contexts(Id),
    CONSTRAINT FK_ContextHooks_Hook FOREIGN KEY (HookId) REFERENCES dbo.Hooks(Id)
);
GO

-- HookRules: Which rules hooks enforce
CREATE TABLE dbo.HookRules (
    HookId UNIQUEIDENTIFIER NOT NULL,
    RuleId UNIQUEIDENTIFIER NOT NULL,
    PRIMARY KEY (HookId, RuleId),
    CONSTRAINT FK_HookRules_Hook FOREIGN KEY (HookId) REFERENCES dbo.Hooks(Id),
    CONSTRAINT FK_HookRules_Rule FOREIGN KEY (RuleId) REFERENCES dbo.Rules(Id)
);
GO

-- ============================================================================
-- INDEXES for common queries
-- ============================================================================

CREATE INDEX IX_Agents_PluginId ON dbo.Agents(PluginId);
CREATE INDEX IX_Skills_PluginId ON dbo.Skills(PluginId);
CREATE INDEX IX_Rules_PluginId ON dbo.Rules(PluginId);
CREATE INDEX IX_Hooks_PluginId ON dbo.Hooks(PluginId);
CREATE INDEX IX_McpServers_PluginId ON dbo.McpServers(PluginId);
CREATE INDEX IX_Contexts_PluginId ON dbo.Contexts(PluginId);
CREATE INDEX IX_Commands_PluginId ON dbo.Commands(PluginId);
CREATE INDEX IX_Tools_McpServerId ON dbo.Tools(McpServerId);
CREATE INDEX IX_HookActions_HookId ON dbo.HookActions(HookId);
CREATE INDEX IX_Phases_CommandId ON dbo.Phases(CommandId);
CREATE INDEX IX_Patterns_SkillId ON dbo.Patterns(SkillId);
CREATE INDEX IX_Workflows_SkillId ON dbo.Workflows(SkillId);
CREATE INDEX IX_ChecklistItems_AgentId ON dbo.ChecklistItems(AgentId);
GO
