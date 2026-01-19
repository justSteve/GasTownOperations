const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

let fileWatcher = null;
let outputChannel = null;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    outputChannel = vscode.window.createOutputChannel('Command Bridge');
    outputChannel.appendLine('Command Bridge activated');

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('commandBridge.openTmuxTerminal', openTmuxTerminal),
        vscode.commands.registerCommand('commandBridge.executeFromFile', executeFromFile)
    );

    // Start file watcher if enabled
    const config = vscode.workspace.getConfiguration('commandBridge');
    if (config.get('enabled')) {
        startFileWatcher(context);
    }

    // Watch for config changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('commandBridge')) {
                const newConfig = vscode.workspace.getConfiguration('commandBridge');
                if (newConfig.get('enabled')) {
                    startFileWatcher(context);
                } else {
                    stopFileWatcher();
                }
            }
        })
    );
}

function startFileWatcher(context) {
    const config = vscode.workspace.getConfiguration('commandBridge');
    const commandFile = config.get('commandFile');

    // Ensure command file exists
    if (!fs.existsSync(commandFile)) {
        fs.writeFileSync(commandFile, '');
    }

    outputChannel.appendLine(`Watching command file: ${commandFile}`);

    // Watch for changes
    fileWatcher = fs.watch(commandFile, (eventType) => {
        if (eventType === 'change') {
            processCommandFile(commandFile);
        }
    });

    context.subscriptions.push({
        dispose: () => stopFileWatcher()
    });
}

function stopFileWatcher() {
    if (fileWatcher) {
        fileWatcher.close();
        fileWatcher = null;
        outputChannel.appendLine('File watcher stopped');
    }
}

async function processCommandFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8').trim();
        if (!content) return;

        // Clear the file after reading
        fs.writeFileSync(filePath, '');

        // Process each line as a command
        const lines = content.split('\n');
        for (const line of lines) {
            if (line.trim()) {
                await executeCommand(line.trim());
            }
        }
    } catch (err) {
        outputChannel.appendLine(`Error processing command file: ${err.message}`);
    }
}

async function executeCommand(commandLine) {
    outputChannel.appendLine(`Executing: ${commandLine}`);

    try {
        // Parse command format: COMMAND_NAME [JSON_ARGS]
        const match = commandLine.match(/^(\S+)\s*(.*)?$/);
        if (!match) {
            outputChannel.appendLine('Invalid command format');
            return;
        }

        const [, command, argsJson] = match;
        const args = argsJson ? JSON.parse(argsJson) : undefined;

        switch (command.toUpperCase()) {
            case 'TMUX':
                await openTmuxTerminal(args);
                break;
            case 'TERMINAL':
                await openTerminal(args);
                break;
            case 'PANEL':
                await togglePanel(args);
                break;
            case 'VSCODE':
                // Execute any VSCode command
                if (args && args.command) {
                    await vscode.commands.executeCommand(args.command, ...(args.args || []));
                }
                break;
            case 'FOCUS':
                await focusElement(args);
                break;
            case 'EDITOR':
                await openEditor(args);
                break;
            default:
                // Try to execute as a raw VSCode command
                await vscode.commands.executeCommand(command, args);
        }

        outputChannel.appendLine(`Command completed: ${command}`);
    } catch (err) {
        outputChannel.appendLine(`Command error: ${err.message}`);
    }
}

async function openTmuxTerminal(options = {}) {
    const sessionName = options.session || 'vscode-tmux';
    const attach = options.attach !== false;

    // Build tmux command
    let shellArgs;
    if (attach) {
        // Attach to existing or create new session
        shellArgs = ['-c', `tmux new-session -A -s ${sessionName}`];
    } else {
        // Just create a new session
        shellArgs = ['-c', `tmux new-session -d -s ${sessionName} && tmux attach -t ${sessionName}`];
    }

    const terminal = vscode.window.createTerminal({
        name: `TMux: ${sessionName}`,
        shellPath: '/bin/bash',
        shellArgs: shellArgs
    });

    terminal.show();
    return terminal;
}

async function openTerminal(options = {}) {
    const terminal = vscode.window.createTerminal({
        name: options.name || 'Terminal',
        shellPath: options.shell || undefined,
        cwd: options.cwd || undefined
    });

    terminal.show();

    if (options.command) {
        terminal.sendText(options.command);
    }

    return terminal;
}

async function togglePanel(options = {}) {
    const panel = options.panel || 'terminal';

    switch (panel) {
        case 'terminal':
            await vscode.commands.executeCommand('workbench.action.terminal.toggleTerminal');
            break;
        case 'output':
            await vscode.commands.executeCommand('workbench.panel.output.focus');
            break;
        case 'problems':
            await vscode.commands.executeCommand('workbench.panel.markers.view.focus');
            break;
        case 'debug':
            await vscode.commands.executeCommand('workbench.debug.action.toggleRepl');
            break;
        default:
            await vscode.commands.executeCommand('workbench.action.togglePanel');
    }
}

async function focusElement(options = {}) {
    const target = options.target || 'editor';

    switch (target) {
        case 'editor':
            await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
            break;
        case 'terminal':
            await vscode.commands.executeCommand('workbench.action.terminal.focus');
            break;
        case 'sidebar':
            await vscode.commands.executeCommand('workbench.action.focusSideBar');
            break;
        case 'explorer':
            await vscode.commands.executeCommand('workbench.view.explorer');
            break;
    }
}

async function openEditor(options = {}) {
    if (options.file) {
        const uri = vscode.Uri.file(options.file);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, {
            viewColumn: options.column || vscode.ViewColumn.Active,
            preview: options.preview !== false
        });

        if (options.line) {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const line = Math.max(0, options.line - 1);
                const position = new vscode.Position(line, options.column || 0);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(new vscode.Range(position, position));
            }
        }
    }
}

async function executeFromFile() {
    const config = vscode.workspace.getConfiguration('commandBridge');
    const commandFile = config.get('commandFile');
    await processCommandFile(commandFile);
}

function deactivate() {
    stopFileWatcher();
}

module.exports = {
    activate,
    deactivate
};
