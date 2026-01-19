#!/usr/bin/env python3
"""
TMux Session Controller

Provides programmatic control over existing TMux sessions.
Supports sending commands, capturing output, and monitoring session state.
"""

import subprocess
import time
import shlex
from typing import Optional
from dataclasses import dataclass


@dataclass
class CommandResult:
    """Result of a command execution in TMux."""
    success: bool
    output: str
    error: Optional[str] = None


class TmuxController:
    """Controller for interacting with TMux sessions."""

    def __init__(self, session_name: str):
        """
        Initialize controller for a specific TMux session.

        Args:
            session_name: Name of the TMux session to control
        """
        self.session_name = session_name
        self.target_pane = f"{session_name}:0.0"  # Default to first window, first pane

    @staticmethod
    def list_sessions() -> list[str]:
        """List all available TMux sessions."""
        try:
            result = subprocess.run(
                ["tmux", "list-sessions", "-F", "#{session_name}"],
                capture_output=True,
                text=True
            )
            if result.returncode == 0:
                return [s.strip() for s in result.stdout.strip().split("\n") if s.strip()]
            return []
        except FileNotFoundError:
            return []

    def session_exists(self) -> bool:
        """Check if the target session exists."""
        result = subprocess.run(
            ["tmux", "has-session", "-t", self.session_name],
            capture_output=True
        )
        return result.returncode == 0

    def set_target_pane(self, window: int = 0, pane: int = 0):
        """
        Set the target pane for command execution.

        Args:
            window: Window index (0-based)
            pane: Pane index within window (0-based)
        """
        self.target_pane = f"{self.session_name}:{window}.{pane}"

    def send_keys(self, keys: str, press_enter: bool = True) -> bool:
        """
        Send keystrokes to the TMux session.

        Args:
            keys: The keystrokes/text to send
            press_enter: Whether to press Enter after sending keys

        Returns:
            True if successful, False otherwise
        """
        cmd = ["tmux", "send-keys", "-t", self.target_pane, keys]
        if press_enter:
            cmd.append("Enter")

        result = subprocess.run(cmd, capture_output=True)
        return result.returncode == 0

    def send_command(self, command: str) -> bool:
        """
        Send a command to execute in the TMux session.

        Args:
            command: Shell command to execute

        Returns:
            True if command was sent successfully
        """
        return self.send_keys(command, press_enter=True)

    def capture_pane(self, start_line: int = 0, end_line: int = -1) -> str:
        """
        Capture the current content of the pane.

        Args:
            start_line: Starting line (0 = top of visible area, negative = history)
            end_line: Ending line (-1 = bottom of visible area)

        Returns:
            Captured text content
        """
        cmd = [
            "tmux", "capture-pane",
            "-t", self.target_pane,
            "-p",  # Print to stdout
            "-S", str(start_line),
            "-E", str(end_line)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.stdout if result.returncode == 0 else ""

    def capture_history(self, lines: int = 1000) -> str:
        """
        Capture scrollback history from the pane.

        Args:
            lines: Number of history lines to capture

        Returns:
            Captured history content
        """
        return self.capture_pane(start_line=-lines, end_line=-1)

    def execute_and_capture(
        self,
        command: str,
        wait_time: float = 0.5,
        marker: Optional[str] = None
    ) -> CommandResult:
        """
        Execute a command and attempt to capture its output.

        This uses a marker-based approach to identify command output.

        Args:
            command: Command to execute
            wait_time: Time to wait for command completion (seconds)
            marker: Optional unique marker to identify output boundaries

        Returns:
            CommandResult with captured output
        """
        if marker is None:
            marker = f"__TMUX_CMD_{int(time.time() * 1000)}__"

        # Capture current state
        before = self.capture_pane(start_line=-500)
        before_lines = len(before.strip().split("\n"))

        # Send start marker, command, and end marker
        self.send_keys(f"echo '{marker}_START'", press_enter=True)
        time.sleep(0.1)
        self.send_keys(command, press_enter=True)
        time.sleep(wait_time)
        self.send_keys(f"echo '{marker}_END'", press_enter=True)
        time.sleep(0.1)

        # Capture output
        after = self.capture_pane(start_line=-500)

        # Extract output between markers
        lines = after.split("\n")
        output_lines = []
        capturing = False

        for line in lines:
            if f"{marker}_START" in line:
                capturing = True
                continue
            if f"{marker}_END" in line:
                capturing = False
                break
            if capturing:
                # Skip the echoed command itself
                if line.strip() == command:
                    continue
                output_lines.append(line)

        output = "\n".join(output_lines).strip()
        return CommandResult(success=True, output=output)

    def run_script(self, script_path: str) -> bool:
        """
        Execute a script file in the TMux session.

        Args:
            script_path: Path to the script to execute

        Returns:
            True if command was sent successfully
        """
        return self.send_command(f"bash {shlex.quote(script_path)}")

    def send_ctrl_c(self) -> bool:
        """Send Ctrl+C to interrupt current process."""
        result = subprocess.run(
            ["tmux", "send-keys", "-t", self.target_pane, "C-c"],
            capture_output=True
        )
        return result.returncode == 0

    def send_ctrl_d(self) -> bool:
        """Send Ctrl+D (EOF)."""
        result = subprocess.run(
            ["tmux", "send-keys", "-t", self.target_pane, "C-d"],
            capture_output=True
        )
        return result.returncode == 0

    def clear_pane(self) -> bool:
        """Clear the pane and history."""
        return self.send_command("clear")

    def get_pane_info(self) -> dict:
        """Get information about the current pane."""
        format_str = "#{pane_pid}|#{pane_current_command}|#{pane_width}|#{pane_height}"
        result = subprocess.run(
            ["tmux", "display-message", "-t", self.target_pane, "-p", format_str],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            parts = result.stdout.strip().split("|")
            if len(parts) == 4:
                return {
                    "pid": parts[0],
                    "current_command": parts[1],
                    "width": int(parts[2]),
                    "height": int(parts[3])
                }
        return {}


def main():
    """CLI interface for TMux controller."""
    import argparse

    parser = argparse.ArgumentParser(description="Control TMux sessions programmatically")
    parser.add_argument("--list", "-l", action="store_true", help="List available sessions")
    parser.add_argument("--session", "-s", type=str, help="Target session name")
    parser.add_argument("--window", "-w", type=int, default=0, help="Target window index")
    parser.add_argument("--pane", "-p", type=int, default=0, help="Target pane index")
    parser.add_argument("--command", "-c", type=str, help="Command to execute")
    parser.add_argument("--capture", action="store_true", help="Capture pane output")
    parser.add_argument("--history", type=int, help="Capture N lines of history")
    parser.add_argument("--info", action="store_true", help="Get pane info")
    parser.add_argument("--interrupt", action="store_true", help="Send Ctrl+C")

    args = parser.parse_args()

    if args.list:
        sessions = TmuxController.list_sessions()
        if sessions:
            print("Available TMux sessions:")
            for s in sessions:
                print(f"  - {s}")
        else:
            pxrint("No TMux sessions found")
        return

    if not args.session:
        parser.error("--session is required for most operations")

    controller = TmuxController(args.session)

    if not controller.session_exists():
        print(f"Error: Session '{args.session}' does not exist")
        return

    controller.set_target_pane(args.window, args.pane)

    if args.info:
        info = controller.get_pane_info()
        for k, v in info.items():
            print(f"{k}: {v}")

    if args.capture:
        print(controller.capture_pane())

    if args.history:
        print(controller.capture_history(args.history))

    if args.interrupt:
        controller.send_ctrl_c()
        print("Sent Ctrl+C")

    if args.command:
        result = controller.execute_and_capture(args.command)
        print(f"Output:\n{result.output}")


if __name__ == "__main__":
    main()
