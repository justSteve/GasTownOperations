#!/usr/bin/env python3
"""
VSCode Command Bridge Client

Sends commands to VSCode via file-based IPC.
Requires the vscode-command-bridge extension to be installed and active.
"""

import json
import time
from pathlib import Path
from typing import Optional, Any


class VSCodeBridge:
    """Client for sending commands to VSCode via the command bridge extension."""

    def __init__(self, command_file: str = "/tmp/vscode-bridge-commands"):
        self.command_file = Path(command_file)

    def _send(self, command: str, args: Optional[dict] = None):
        """Send a command to VSCode."""
        if args:
            line = f"{command} {json.dumps(args)}\n"
        else:
            line = f"{command}\n"

        # Append to command file (extension clears after reading)
        with open(self.command_file, "a") as f:
            f.write(line)

    def open_tmux_terminal(self, session: str = "vscode-tmux", attach: bool = True):
        """Open a terminal with a TMux session."""
        self._send("TMUX", {"session": session, "attach": attach})

    def open_terminal(
        self,
        name: str = "Terminal",
        command: Optional[str] = None,
        cwd: Optional[str] = None,
        shell: Optional[str] = None
    ):
        """Open a new terminal."""
        args = {"name": name}
        if command:
            args["command"] = command
        if cwd:
            args["cwd"] = cwd
        if shell:
            args["shell"] = shell
        self._send("TERMINAL", args)

    def toggle_panel(self, panel: str = "terminal"):
        """Toggle a panel (terminal, output, problems, debug)."""
        self._send("PANEL", {"panel": panel})

    def focus(self, target: str = "editor"):
        """Focus an element (editor, terminal, sidebar, explorer)."""
        self._send("FOCUS", {"target": target})

    def open_file(
        self,
        file_path: str,
        line: Optional[int] = None,
        column: Optional[int] = None,
        preview: bool = True
    ):
        """Open a file in the editor."""
        args = {"file": file_path, "preview": preview}
        if line:
            args["line"] = line
        if column:
            args["column"] = column
        self._send("EDITOR", args)

    def execute_command(self, command: str, *args: Any):
        """Execute any VSCode command by ID."""
        self._send("VSCODE", {"command": command, "args": list(args)})

    # Convenience methods for common actions
    def show_command_palette(self):
        """Open the command palette."""
        self.execute_command("workbench.action.showCommands")

    def toggle_sidebar(self):
        """Toggle the sidebar."""
        self.execute_command("workbench.action.toggleSidebarVisibility")

    def new_file(self):
        """Create a new untitled file."""
        self.execute_command("workbench.action.files.newUntitledFile")

    def save_file(self):
        """Save the current file."""
        self.execute_command("workbench.action.files.save")

    def save_all(self):
        """Save all files."""
        self.execute_command("workbench.action.files.saveAll")

    def close_editor(self):
        """Close the current editor."""
        self.execute_command("workbench.action.closeActiveEditor")

    def split_editor(self):
        """Split the editor."""
        self.execute_command("workbench.action.splitEditor")

    def run_task(self, task_name: str):
        """Run a named task."""
        self.execute_command("workbench.action.tasks.runTask", task_name)

    def start_debugging(self):
        """Start debugging (F5)."""
        self.execute_command("workbench.action.debug.start")

    def stop_debugging(self):
        """Stop debugging."""
        self.execute_command("workbench.action.debug.stop")

    def open_settings(self):
        """Open settings."""
        self.execute_command("workbench.action.openSettings")

    def reload_window(self):
        """Reload the VSCode window."""
        self.execute_command("workbench.action.reloadWindow")


def main():
    """CLI interface."""
    import argparse

    parser = argparse.ArgumentParser(description="Send commands to VSCode")
    parser.add_argument("--file", "-f", default="/tmp/vscode-bridge-commands",
                        help="Command file path")

    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # tmux
    tmux_parser = subparsers.add_parser("tmux", help="Open TMux terminal")
    tmux_parser.add_argument("--session", "-s", default="vscode-tmux")

    # terminal
    term_parser = subparsers.add_parser("terminal", help="Open terminal")
    term_parser.add_argument("--name", "-n", default="Terminal")
    term_parser.add_argument("--cmd", "-c", help="Command to run")
    term_parser.add_argument("--cwd", help="Working directory")

    # panel
    panel_parser = subparsers.add_parser("panel", help="Toggle panel")
    panel_parser.add_argument("name", choices=["terminal", "output", "problems", "debug"])

    # focus
    focus_parser = subparsers.add_parser("focus", help="Focus element")
    focus_parser.add_argument("target", choices=["editor", "terminal", "sidebar", "explorer"])

    # open
    open_parser = subparsers.add_parser("open", help="Open file")
    open_parser.add_argument("path", help="File path")
    open_parser.add_argument("--line", "-l", type=int, help="Line number")

    # vscode command
    vsc_parser = subparsers.add_parser("vscode", help="Execute VSCode command")
    vsc_parser.add_argument("vscode_command", help="VSCode command ID")

    args = parser.parse_args()
    bridge = VSCodeBridge(args.file)

    if args.command == "tmux":
        bridge.open_tmux_terminal(args.session)
        print(f"Sent: Open TMux session '{args.session}'")

    elif args.command == "terminal":
        bridge.open_terminal(args.name, args.cmd, args.cwd)
        print(f"Sent: Open terminal '{args.name}'")

    elif args.command == "panel":
        bridge.toggle_panel(args.name)
        print(f"Sent: Toggle {args.name} panel")

    elif args.command == "focus":
        bridge.focus(args.target)
        print(f"Sent: Focus {args.target}")

    elif args.command == "open":
        bridge.open_file(args.path, args.line)
        print(f"Sent: Open {args.path}")

    elif args.command == "vscode":
        bridge.execute_command(args.vscode_command)
        print(f"Sent: VSCode command '{args.vscode_command}'")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
