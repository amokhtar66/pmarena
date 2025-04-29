"use client";

import { CloseIcon } from "@/components/CloseIcon";
import { NoAgentNotification } from "@/components/NoAgentNotification";
import { AgentControlButtons } from "@/components/AgentControlButtons";
import { useAuth } from "@/lib/AuthContext";
import { useAgentControl } from "@/lib/useAgentControl";
import {
  AgentState,
  BarVisualizer,
  DisconnectButton,
  LiveKitRoom,
  RoomAudioRenderer,
  VoiceAssistantControlBar,
  useVoiceAssistant,
  VideoConference,
  useRoomContext,
} from "@livekit/components-react";
import { useKrispNoiseFilter } from "@livekit/components-react/krisp";
import { AnimatePresence, motion } from "framer-motion";
import { MediaDeviceFailure, Room, Track } from "livekit-client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ConnectionDetails } from "./api/connection-details/route";

// Component to automatically start recording when room is connected
function AutoRecordingTrigger() {
  const room = useRoomContext();
  const { user } = useAuth();
  const [hasStartedRecording, setHasStartedRecording] = useState(false);
  
  // Enhanced debug logging
  useEffect(() => {
    console.log('AutoRecordingTrigger component mounted');
    console.log('Room object:', room ? 'exists' : 'undefined');
    console.log('Room state:', room?.state);
    console.log('User object:', user ? 'exists' : 'undefined');
    console.log('User ID:', user?.id);
  }, [room, user]);
  
  useEffect(() => {
    if (room && room.state === 'connected' && user && !hasStartedRecording) {
      // Start recording when room is connected
      const startRecording = async () => {
        try {
          console.log('Triggering recording start...');
          console.log('Room name:', room.name);
          console.log('User ID being sent:', user.id);
          
          const response = await fetch('/api/start-recording', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              roomName: room.name,
              userId: user.id,
            }),
          });
          
          const responseData = await response.text();
          console.log('Recording API response status:', response.status);
          console.log('Recording API response:', responseData);
          
          if (!response.ok) {
            console.error('Failed to start recording:', responseData);
          } else {
            console.log('Recording started successfully');
            setHasStartedRecording(true);
          }
        } catch (error) {
          console.error('Error starting recording:', error);
        }
      };
      
      startRecording();
    }
  }, [room, room?.state, room?.name, user, hasStartedRecording]);

  return null;
}

// New component for manual testing of recording API
function RecordingTestButton() {
  const room = useRoomContext();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  
  const startRecordingManually = async (endpoint: string) => {
    if (!room || !user) {
      setResult('Error: Room or user not available');
      return;
    }
    
    setIsLoading(true);
    setResult(null);
    
    try {
      console.log(`Manual test: Calling ${endpoint}`);
      const response = await fetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName: room.name,
          userId: user.id,
        }),
      });
      
      const data = await response.text();
      console.log('Manual test response status:', response.status);
      console.log('Manual test response:', data);
      
      setResult(`Endpoint: ${endpoint}\nStatus: ${response.status}\nResponse: ${data}`);
    } catch (error) {
      console.error('Manual test error:', error);
      setResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!room || room.state !== 'connected') {
    return null;
  }
  
  return (
    <div className="absolute top-5 right-5 z-20 flex flex-col gap-2">
      <button 
        onClick={() => startRecordingManually('start-recording')}
        disabled={isLoading}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        {isLoading ? 'Testing...' : 'Test Recording API'}
      </button>
      <button 
        onClick={() => startRecordingManually('recording-test')}
        disabled={isLoading}
        className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
      >
        {isLoading ? 'Testing...' : 'Test Simple Endpoint'}
      </button>
      {result && (
        <div className="mt-2 p-2 bg-white text-xs border rounded shadow max-w-xs overflow-auto whitespace-pre-wrap">
          {result}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  const { user, profile, signOut, loading } = useAuth();
  const router = useRouter();
  const [connectionDetails, updateConnectionDetails] = useState<ConnectionDetails | undefined>(
    undefined
  );
  const [agentState, setAgentState] = useState<AgentState>("disconnected");

  // Check for URL parameter to clear after navigation
  useEffect(() => {
    // Clear noRedirect flag from URL if present to prevent future issues
    if (window.location.href.includes('noRedirect=true')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('noRedirect');
      window.history.replaceState({}, '', url);
      console.log("Cleared noRedirect flag from URL");
    }
  }, []);

  const onConnectButtonClicked = useCallback(async () => {
    const url = new URL(
      process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? "/api/connection-details",
      window.location.origin
    );
    const response = await fetch(url.toString());
    const connectionDetailsData = await response.json();
    updateConnectionDetails(connectionDetailsData);
  }, []);

  // Show loading state while checking auth
  if (loading) {
    return (
      <main data-lk-theme="default" className="h-full flex items-center justify-center bg-[var(--lk-bg)]">
        <div className="text-center">
          <p>Loading...</p>
        </div>
      </main>
    );
  }
  
  // Redirect if not authenticated (this is a fallback; middleware should handle this)
  if (!user) {
    return null;
  }

  // Only show the start button initially
  if (!connectionDetails) {
    return (
      <main data-lk-theme="default" className="h-full flex flex-col items-center justify-center bg-[var(--lk-bg)]">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-bold mb-2">Welcome, {profile?.display_name || user?.email}</h1>
          <button 
            onClick={signOut}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Sign Out
          </button>
        </div>
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.09, 1.04, 0.245, 1.055] }}
          className="uppercase px-5 py-3 bg-white text-black text-lg font-medium rounded-md hover:bg-gray-100 transition-colors"
          onClick={onConnectButtonClicked}
        >
          Start a conversation
        </motion.button>
      </main>
    );
  }

  return (
    <main data-lk-theme="default" className="h-full w-full overflow-hidden bg-[var(--lk-bg)]">
      <LiveKitRoom
        token={connectionDetails?.participantToken}
        serverUrl={connectionDetails?.serverUrl}
        connect={true}
        audio={true}
        video={true}
        onMediaDeviceFailure={onDeviceFailure}
        onDisconnected={() => {
          updateConnectionDetails(undefined);
        }}
        className="h-full w-full flex flex-col"
      >
        <div className="flex-1 w-full h-full">
          <VideoConference />
        </div>
        <RoomAudioRenderer />
        
        {/* Test Button - Visible */}
        <RecordingTestButton />
        
        {/* Hidden but kept for state tracking */}
        <div className="hidden">
          <SimpleVoiceAssistant onStateChange={setAgentState} />
        </div>
        
        {/* Agent Control Interface */}
        <AgentControlInterface 
          userId={user.id} 
          agentState={agentState} 
        />
        
        <div className="absolute bottom-5 right-5 z-10">
          <DisconnectButton
            onClick={() => updateConnectionDetails(undefined)}
            className="bg-red-600 hover:bg-red-700 text-white rounded-full p-2 shadow-lg"
          >
            <CloseIcon />
          </DisconnectButton>
        </div>
      </LiveKitRoom>
    </main>
  );
}

// Agent Control Interface component
function AgentControlInterface({ userId, agentState }: { 
  userId: string;
  agentState: AgentState;
}) {
  // Get room directly using useRoomContext hook
  const room = useRoomContext();
  
  const { 
    agentState: controlledAgentState, 
    startConversation, 
    leaveCall, 
    isAgentActive 
  } = useAgentControl(room, userId);

  return (
    <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 z-10">
      <AgentControlButtons
        agentState={controlledAgentState || agentState}
        isAgentActive={isAgentActive}
        onStartConversation={startConversation}
        onLeaveCall={leaveCall}
      />
    </div>
  );
}

// Keep these components for state tracking, but they won't be visible
function SimpleVoiceAssistant(props: { onStateChange: (state: AgentState) => void }) {
  const { state, audioTrack } = useVoiceAssistant();
  useEffect(() => {
    props.onStateChange(state);
  }, [props, state]);
  return (
    <div className="hidden">
      <BarVisualizer
        state={state}
        barCount={5}
        trackRef={audioTrack}
        className="agent-visualizer"
        options={{ minHeight: 24 }}
      />
    </div>
  );
}

function onDeviceFailure(error?: MediaDeviceFailure) {
  console.error(error);
  alert(
    "Error acquiring camera or microphone permissions. Please make sure you grant the necessary permissions in your browser and reload the tab"
  );
}
