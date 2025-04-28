// AgentManager.ts
// This service handles the lifecycle of voice assistant agents for multiple users

import { AgentState } from '@livekit/components-react';
import { Room } from 'livekit-client';

// Define interfaces for the agent instance
interface AgentInstance {
  state: AgentState;
  roomName: string;
  active: boolean;
}

/**
 * AgentManager is a singleton service that manages the lifecycle of 
 * voice assistant agents for multiple users across different rooms
 */
class AgentManager {
  private activeAgents: Map<string, AgentInstance>;
  private static instance: AgentManager;

  private constructor() {
    this.activeAgents = new Map<string, AgentInstance>();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): AgentManager {
    if (!AgentManager.instance) {
      AgentManager.instance = new AgentManager();
    }
    return AgentManager.instance;
  }

  /**
   * Start an agent for a specific user in a room
   * @param userId - The unique identifier for the user
   * @param room - The LiveKit room instance
   * @returns The agent instance
   */
  public startAgent(userId: string, room: Room): AgentInstance {
    // Clean up any existing agent for this user
    this.stopAgent(userId);
    
    // Create new agent instance
    const agentInstance: AgentInstance = {
      state: 'connecting',
      roomName: room.name,
      active: true
    };
    
    // Store the agent reference
    this.activeAgents.set(userId, agentInstance);
    
    console.log(`Agent started for user: ${userId} in room: ${room.name}`);
    return agentInstance;
  }

  /**
   * Stop an agent for a specific user
   * @param userId - The unique identifier for the user
   * @returns true if an agent was stopped, false otherwise
   */
  public stopAgent(userId: string): boolean {
    const agent = this.activeAgents.get(userId);
    
    if (agent) {
      // Mark the agent as inactive
      agent.active = false;
      
      // Remove from active agents
      this.activeAgents.delete(userId);
      
      console.log(`Agent stopped for user: ${userId}`);
      return true;
    }
    
    return false;
  }

  /**
   * Get the agent instance for a specific user
   * @param userId - The unique identifier for the user
   * @returns The agent instance or undefined if not found
   */
  public getAgent(userId: string): AgentInstance | undefined {
    return this.activeAgents.get(userId);
  }

  /**
   * Update the state of an agent
   * @param userId - The unique identifier for the user
   * @param state - The new state of the agent
   */
  public updateAgentState(userId: string, state: AgentState): void {
    const agent = this.activeAgents.get(userId);
    
    if (agent) {
      agent.state = state;
    }
  }

  /**
   * Check if an agent is active for a specific user
   * @param userId - The unique identifier for the user
   * @returns true if an agent is active, false otherwise
   */
  public isAgentActive(userId: string): boolean {
    const agent = this.activeAgents.get(userId);
    return !!agent && agent.active;
  }
}

// Export singleton instance
export const agentManager = AgentManager.getInstance(); 