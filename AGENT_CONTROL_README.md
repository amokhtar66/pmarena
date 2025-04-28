# PM Arena Agent Control System

This implementation ensures agents start only when a user clicks "Start Conversation" and properly stop when the user leaves the call.

## Problem Addressed

Previously, the agent would run continuously, even when not in use, leading to Railway automatically shutting it down after 10 minutes of inactivity. This implementation addresses that issue by:

1. Only starting the agent when explicitly requested by the user
2. Properly terminating the agent when the user leaves the call
3. Managing multiple users with isolated agent instances

## Implementation Details

The system consists of three key components:

1. **AgentManager** (`lib/AgentManager.ts`)
   - Singleton service that manages agent lifecycle
   - Tracks all active agents across multiple users
   - Provides methods for starting and stopping agents

2. **useAgentControl** (`lib/useAgentControl.ts`)
   - Custom React hook integrating with AgentManager
   - Provides agent start/stop functionality
   - Handles room events for proper cleanup

3. **AgentControlButtons** (`components/AgentControlButtons.tsx`)
   - UI component for agent control
   - Displays "Start Conversation" and "Leave Call" buttons
   - Shows current agent state

## Usage

The application now provides two dedicated buttons at the bottom of the interface:

- **Start Conversation**: Activates the agent (only available when no agent is active)
- **Leave Call**: Properly terminates the agent (only available when agent is active)

The agent's current state is displayed next to the buttons.

## Running Locally

To test the changes locally, run:

```powershell
cd pmarena/frontend
npm install
npm run dev
```

Make sure to run these commands separately in PowerShell (not using `&&`).

## Technical Solution

The implementation follows these key architectural principles:

1. **Singleton Pattern**: Uses a singleton AgentManager to track all active agents
2. **Event-based Architecture**: Responds to both explicit user actions and implicit events
3. **Clean Separation of Concerns**: Separates agent management from UI and room handling
4. **Resource Management**: Properly cleans up resources when agents are no longer needed

This solution ensures Railway doesn't shut down the agent unexpectedly while still being efficient with resources. 