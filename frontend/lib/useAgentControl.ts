// useAgentControl.ts
// Custom hook to integrate with AgentManager and provide agent control functionality

import { AgentState, useVoiceAssistant } from '@livekit/components-react';
import { Room, RoomEvent } from 'livekit-client';
import { useCallback, useEffect, useState } from 'react';
import { agentManager } from './AgentManager';

/**
 * Custom hook to control agent lifecycle
 * @param room - The LiveKit room instance from useRoomContext
 * @param userId - The unique identifier for the user
 * @returns Agent control functions and state
 */
export function useAgentControl(room: Room | null, userId: string) {
  const [agentState, setAgentState] = useState<AgentState>('disconnected');
  const { state: voiceAssistantState } = useVoiceAssistant();

  // Update local state when voice assistant state changes
  useEffect(() => {
    if (room && userId && voiceAssistantState) {
      setAgentState(voiceAssistantState);
      agentManager.updateAgentState(userId, voiceAssistantState);
    }
  }, [room, userId, voiceAssistantState]);

  // Start conversation function
  const startConversation = useCallback(() => {
    if (room && userId) {
      console.log('Starting conversation for user:', userId);
      
      // Start agent in manager
      agentManager.startAgent(userId, room);
      
      // Set initial state
      setAgentState('connecting');
    } else {
      console.error('Cannot start conversation: room or userId is undefined');
    }
  }, [room, userId]);

  // Leave call function
  const leaveCall = useCallback(() => {
    if (userId) {
      console.log('Stopping agent for user:', userId);
      agentManager.stopAgent(userId);
      setAgentState('disconnected');
    }
  }, [userId]);

  // Setup room event listeners
  useEffect(() => {
    if (!room || !userId) return;

    // Handle user disconnection
    const handleParticipantDisconnected = () => {
      // Only handle if it's the local participant
      if (room.localParticipant.identity === userId) {
        leaveCall();
      }
    };

    // Handle room disconnection
    const handleRoomDisconnected = () => {
      leaveCall();
    };

    // Add event listeners
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    room.on(RoomEvent.Disconnected, handleRoomDisconnected);

    // Cleanup
    return () => {
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      room.off(RoomEvent.Disconnected, handleRoomDisconnected);
    };
  }, [room, userId, leaveCall]);

  return {
    agentState,
    startConversation,
    leaveCall,
    isAgentActive: userId ? agentManager.isAgentActive(userId) : false
  };
} 