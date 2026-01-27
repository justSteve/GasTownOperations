-- Run in SSMS as sa/admin

-- 1. Create database
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'ClaudeConfig')
    CREATE DATABASE ClaudeConfig;
GO

USE ClaudeConfig;
GO

-- 2. Create login and user
IF NOT EXISTS (SELECT * FROM sys.server_principals WHERE name = 'claude_mcp')
    CREATE LOGIN claude_mcp WITH PASSWORD = 'YourSecurePassword123!';
GO

IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = 'claude_mcp')
    CREATE USER claude_mcp FOR LOGIN claude_mcp;
GO

-- 3. Grant permissions
ALTER ROLE db_datareader ADD MEMBER claude_mcp;
ALTER ROLE db_datawriter ADD MEMBER claude_mcp;
GO

-- 4. Test table
CREATE TABLE dbo.ConnectionTest (
    Id INT IDENTITY PRIMARY KEY,
    Message NVARCHAR(100),
    Created DATETIME DEFAULT GETDATE()
);
GO

INSERT INTO dbo.ConnectionTest (Message) VALUES ('MCP connection working');
GO

SELECT * FROM dbo.ConnectionTest;
GO
