// AgentControlButtons.tsx
// Component for start conversation and leave call buttons

import { AgentState } from '@livekit/components-react';
import { useCallback } from 'react';

interface AgentControlButtonsProps {
  agentState: AgentState;
  isAgentActive: boolean;
  onStartConversation: () => void;
  onLeaveCall: () => void;
}

export function AgentControlButtons({
  agentState,
  isAgentActive,
  onStartConversation,
  onLeaveCall
}: AgentControlButtonsProps) {
  const handleStartConversation = useCallback(() => {
    onStartConversation();
  }, [onStartConversation]);

  const handleLeaveCall = useCallback(() => {
    onLeaveCall();
  }, [onLeaveCall]);

  return (
    <div className="flex gap-4 mt-4 justify-center">
      <button
        onClick={handleStartConversation}
        disabled={isAgentActive}
        className={`px-4 py-2 rounded-lg font-medium ${
          isAgentActive
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
      >
        Start Conversation
      </button>
      
      <button
        onClick={handleLeaveCall}
        disabled={!isAgentActive}
        className={`px-4 py-2 rounded-lg font-medium ${
          !isAgentActive
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-red-500 hover:bg-red-600 text-white'
        }`}
      >
        Leave Call
      </button>
      
      {isAgentActive && (
        <div className="flex items-center">
          <span className="ml-2 text-sm text-gray-600">
            Status: {agentState.charAt(0).toUpperCase() + agentState.slice(1)}
          </span>
        </div>
      )}
    </div>
  );
} 