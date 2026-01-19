#!/usr/bin/env python3
"""
Example usage of TmuxController for shared executable space.
"""

from tmux_controller import TmuxController, CommandResult


def demo_basic_usage():
    """Demonstrate basic TMux control operations."""

    # List available sessions
    print("=== Available Sessions ===")
    sessions = TmuxController.list_sessions()
    if not sessions:
        print("No sessions found. Create one with: tmux new-session -d -s mysession")
        return

    for s in sessions:
        print(f"  - {s}")

    # Connect to first session
    session = sessions[0]
    print(f"\n=== Connecting to '{session}' ===")

    ctrl = TmuxController(session)

    # Check session exists
    if not ctrl.session_exists():
        print(f"Session '{session}' not found!")
        return

    # Get pane info
    print("\n=== Pane Info ===")
    info = ctrl.get_pane_info()
    for k, v in info.items():
        print(f"  {k}: {v}")

    # Execute a command and capture output
    print("\n=== Execute 'pwd' ===")
    result = ctrl.execute_and_capture("pwd", wait_time=0.3)
    print(f"Output: {result.output}")

    # Execute another command
    print("\n=== Execute 'ls -la' ===")
    result = ctrl.execute_and_capture("ls -la", wait_time=0.5)
    print(f"Output:\n{result.output}")

    # Capture current pane state
    print("\n=== Current Pane Content (last 10 lines) ===")
    content = ctrl.capture_pane(start_line=-10)
    print(content)


def demo_interactive_control():
    """Show interactive control pattern."""
    sessions = TmuxController.list_sessions()
    if not sessions:
        print("No sessions available")
        return

    ctrl = TmuxController(sessions[0])

    # Send a series of commands
    commands = [
        "echo 'Starting task...'",
        "date",
        "hostname",
        "echo 'Task complete!'"
    ]

    for cmd in commands:
        print(f"Sending: {cmd}")
        ctrl.send_command(cmd)
        import time
        time.sleep(0.2)


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "--interactive":
        demo_interactive_control()
    else:
        demo_basic_usage()
