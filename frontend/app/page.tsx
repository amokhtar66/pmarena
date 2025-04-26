"use client";

import { CloseIcon } from "@/components/CloseIcon";
import { NoAgentNotification } from "@/components/NoAgentNotification";
import { useAuth } from "@/lib/AuthContext";
import {
  AgentState,
  BarVisualizer,
  DisconnectButton,
  LiveKitRoom,
  RoomAudioRenderer,
  VoiceAssistantControlBar,
  useVoiceAssistant,
  VideoConference,
  useRoom,
} from "@livekit/components-react";
import { useKrispNoiseFilter } from "@livekit/components-react/krisp";
import { AnimatePresence, motion } from "framer-motion";
import { MediaDeviceFailure, Track } from "livekit-client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ConnectionDetails } from "./api/connection-details/route";

// Component to automatically start recording when room is connected
function AutoRecordingTrigger() {
  const room = useRoom();
  const { user } = useAuth();
  const [hasStartedRecording, setHasStartedRecording] = useState(false);
  
  useEffect(() => {
    if (room && room.state === 'connected' && user && !hasStartedRecording) {
      // Start recording when room is connected
      const startRecording = async () => {
        try {
          console.log('Triggering recording start...');
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
          
          if (!response.ok) {
            console.error('Failed to start recording:', await response.text());
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
        {/* Hidden but kept for state tracking */}
        <div className="hidden">
          <SimpleVoiceAssistant onStateChange={setAgentState} />
          <AutoRecordingTrigger />
        </div>
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

// This is no longer needed but kept for reference
function ControlBar(props: { onConnectButtonClicked: () => void; agentState: AgentState }) {
  const krisp = useKrispNoiseFilter();
  useEffect(() => {
    krisp.setNoiseFilterEnabled(true);
  }, []);

  return (
    <div className="hidden">
      {/* Content hidden but kept for reference */}
    </div>
  );
}

function onDeviceFailure(error?: MediaDeviceFailure) {
  console.error(error);
  alert(
    "Error acquiring camera or microphone permissions. Please make sure you grant the necessary permissions in your browser and reload the tab"
  );
}
