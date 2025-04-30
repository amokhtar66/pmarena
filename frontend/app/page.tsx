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

// Recording functionality removed as it will be handled by the backend

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
        
        {/* Recording buttons removed - will be handled by backend */}
        
        {/* Hidden but kept for state tracking */}
        <div className="hidden">
          <SimpleVoiceAssistant onStateChange={setAgentState} />
        </div>
        
        <div className="fixed top-0 left-0 right-0 flex justify-between items-center bg-black/75 p-2 rounded-b-md">
          <div className="flex items-center">
            <div className="ml-2 text-white font-medium max-w-xs truncate">
              {profile?.display_name || user?.email}
            </div>
          </div>
          <div className="flex items-center">
            <DisconnectButton className="ml-4" onClick={() => updateConnectionDetails(undefined)}>
              <CloseIcon />
            </DisconnectButton>
          </div>
        </div>
        
        <div className="relative flex gap-2 mx-auto mb-4">
          <AgentControlInterface userId={user.id} agentState={agentState} />
        </div>
      </LiveKitRoom>
    </main>
  );
}

function AgentControlInterface({ userId, agentState }: { 
  userId: string;
  agentState: AgentState;
}) {
  const room = useRoomContext();
  const { isAgentActive, startConversation, leaveCall } = useAgentControl(room, userId);
  
  return (
    <AnimatePresence mode="wait">
      {!isAgentActive && agentState === "disconnected" && (
        <motion.div
          key="noAgentNotification"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="absolute bottom-16 left-1/2 transform -translate-x-1/2"
        >
          <NoAgentNotification state={agentState} />
        </motion.div>
      )}
      
      <motion.div
        key="agentControlButtons"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <AgentControlButtons
          agentState={agentState}
          isAgentActive={isAgentActive}
          onStartConversation={startConversation}
          onLeaveCall={leaveCall}
        />
      </motion.div>
    </AnimatePresence>
  );
}

function SimpleVoiceAssistant(props: { onStateChange: (state: AgentState) => void }) {
  const { state } = useVoiceAssistant({
    serviceUrl: process.env.NEXT_PUBLIC_AGENT_SERVICE_URL,
  });
  
  useEffect(() => {
    props.onStateChange(state);
  }, [props, state]);
  
  return null;
}

function onDeviceFailure(error?: MediaDeviceFailure) {
  console.error("Device error:", error);
  
  let message = "Could not access media devices.";
  if (error?.kind === "NotAllowedError") {
    message = "You must allow camera and microphone permissions to join the call.";
  } else if (error?.kind === "NotFoundError") {
    message = "No camera or microphone found. Please connect at least one device.";
  }
  
  alert(message);
}
