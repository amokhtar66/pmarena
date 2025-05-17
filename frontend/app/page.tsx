"use client";

import { CloseIcon } from "@/components/CloseIcon";
import { NoAgentNotification } from "@/components/NoAgentNotification";
import { AgentControlButtons } from "@/components/AgentControlButtons";
import { useAuth } from "@/lib/AuthContext";
import { useAgentControl } from "@/lib/useAgentControl";
import {
  AgentState,
  DisconnectButton,
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  VideoConference,
  useRoomContext,
} from "@livekit/components-react";
import { AnimatePresence, motion } from "framer-motion";
import { MediaDeviceFailure, Room, Track } from "livekit-client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ConnectionDetails } from "./api/connection-details/route";

// Recording functionality removed as it will be handled by the backend

const XPAY_VARIABLE_AMOUNT_ID = process.env.NEXT_PUBLIC_XPAY_VARIABLE_AMOUNT_ID || "749"; // Replace with your actual ID or use env var
const CREDITS_PRICE_CENTS = 2000; // $20.00
const CREDITS_TO_AWARD = 3;
const PRODUCT_DESCRIPTION = `${CREDITS_TO_AWARD} Interview Credits`;

export default function Page() {
  const { user, profile, signOut, loading: authLoading, refreshUserProfile } = useAuth();
  const router = useRouter();
  const [connectionDetails, updateConnectionDetails] = useState<ConnectionDetails | undefined>(
    undefined
  );
  const [agentState, setAgentState] = useState<AgentState>("disconnected");
  const [interviewCredits, setInterviewCredits] = useState<number | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isProcessingCreditUse, setIsProcessingCreditUse] = useState(false);

  useEffect(() => {
    if (profile) {
      setInterviewCredits(profile.interview_credits || 0);
    }
  }, [profile]);

  // Check for URL parameter to clear after navigation (existing effect)
  useEffect(() => {
    if (window.location.href.includes('noRedirect=true')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('noRedirect');
      window.history.replaceState({}, '', url);
      console.log("Cleared noRedirect flag from URL");
    }
  }, []);

  const fetchConnectionDetails = useCallback(async () => {
    const url = new URL(
      process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? "/api/connection-details",
      window.location.origin
    );
    const response = await fetch(url.toString());
    const connectionDetailsData = await response.json();
    updateConnectionDetails(connectionDetailsData);
  }, []);

  const handleBuyCredits = async () => {
    console.log("handleBuyCredits: Function called"); 
    if (!user) {
      console.log("handleBuyCredits: No user in context, setting payment error."); 
      setPaymentError("Please sign in to buy credits.");
      return;
    }
    setIsProcessingPayment(true);
    setPaymentError(null);
    console.log("handleBuyCredits: Attempting to fetch /api/payments/create"); 
    try {
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_in_cents: CREDITS_PRICE_CENTS,
          product_description: PRODUCT_DESCRIPTION,
          variable_amount_id: XPAY_VARIABLE_AMOUNT_ID,
        }),
        credentials: 'include',
      });

      console.log("handleBuyCredits: Response status from /api/payments/create:", response.status);

      if (!response.ok) {
        let errorPayload = { error: `Failed to create payment order. Status: ${response.status}`, details: '' };
        try {
          // Try to read the body ONCE. If it's JSON, parse it. Otherwise, use text.
          const responseText = await response.text(); // Read as text first
          console.log("handleBuyCredits: Raw error response text from /api/payments/create:", responseText); 
          try {
            const jsonData = JSON.parse(responseText); // Try to parse the text as JSON
            console.log("handleBuyCredits: Parsed error response JSON from /api/payments/create:", jsonData);
            errorPayload = { 
              error: jsonData?.error || `Server error: ${response.status}`,
              details: jsonData?.details || responseText 
            };
          } catch (jsonError) {
            console.log("handleBuyCredits: Error response was not valid JSON.");
            errorPayload.details = responseText; // Use the raw text as details
          }
        } catch (textReadError) {
          console.log("handleBuyCredits: Could not read error response text.", textReadError);
          // errorPayload already has a default status-based message
        }
        setPaymentError(errorPayload.error);
        setIsProcessingPayment(false);
        return;
      }

      // If response.ok, then expect JSON
      const data = await response.json(); 
      console.log("handleBuyCredits: Success response JSON from /api/payments/create:", data); 

      if (data.payment_url) {
        console.log("handleBuyCredits: Redirecting to XPay URL:", data.payment_url); 
        window.location.href = data.payment_url; 
      } else {
        console.log("handleBuyCredits: No payment_url in success response from /api/payments/create:", data); 
        setPaymentError(data.error || "Failed to create payment order. Please try again.");
      }
    } catch (error) {
      console.error("handleBuyCredits: CATCH block error:", error); 
      if (error instanceof SyntaxError) {
          setPaymentError("Error processing server response. Please try again.");
      } else if (error instanceof Error) {
          setPaymentError(error.message);
      } else {
          setPaymentError("An unexpected client-side error occurred. Please try again.");
      }
    }
    setIsProcessingPayment(false);
  };

  const handleStartConversationClick = async () => {
    if (!user) {
      alert("User not found. Please re-login.");
      return;
    }
    if (interviewCredits === null || interviewCredits <= 0) {
      alert("You don't have enough interview credits. Please buy more.");
      return;
    }

    setIsProcessingCreditUse(true);
    try {
      const response = await fetch('/api/interviews/use-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      if (response.ok) {
        if (refreshUserProfile) {
           await refreshUserProfile(); // Refresh to get updated credits before connecting
        } else {
            // Fallback: Optimistically update credits locally if refresh is not available
            setInterviewCredits(prev => (prev !== null ? prev - 1 : 0));
        }
        // Proceed to fetch connection details for LiveKit
        await fetchConnectionDetails();
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Failed to use interview credit. Please try again.");
      }
    } catch (error) {
      console.error("Use credit error:", error);
      alert("An error occurred while trying to use an interview credit.");
    }
    setIsProcessingCreditUse(false);
  };

  // Show loading state while checking auth
  if (authLoading) {
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
    // router.push('/signin'); // Or your login page
    return null; // Middleware should handle redirect
  }

  // Main view before connecting to a room
  if (!connectionDetails) {
    return (
      <main data-lk-theme="default" className="h-full flex flex-col items-center justify-center bg-[var(--lk-bg)]">
        <div className="mb-8 text-center p-6 bg-white/10 rounded-lg shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold">Welcome, {profile?.display_name || user?.email}</h1>
            <button 
              onClick={signOut}
              className="text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              Sign Out
            </button>
          </div>
          
          <div className="my-6">
            <p className="text-lg">
              {interviewCredits === null 
                ? "Loading credits..." 
                : `You have ${interviewCredits} interview credit${interviewCredits === 1 ? '' : 's'}.`}
            </p>
            {paymentError && <p className="text-red-400 mt-2">Error: {paymentError}</p>}
          </div>

          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.09, 1.04, 0.245, 1.055] }}
            className="w-full uppercase px-5 py-3 mb-3 bg-blue-500 text-white text-lg font-medium rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50"
            onClick={handleBuyCredits}
            disabled={isProcessingPayment}
          >
            {isProcessingPayment ? "Processing..." : `Buy ${CREDITS_TO_AWARD} Credits ($${CREDITS_PRICE_CENTS / 100})`}
          </motion.button>

          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.09, 1.04, 0.245, 1.055], delay: 0.1 }}
            className="w-full uppercase px-5 py-3 bg-green-500 text-white text-lg font-medium rounded-md hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleStartConversationClick}
            disabled={interviewCredits === null || interviewCredits <= 0 || isProcessingCreditUse || isProcessingPayment}
          >
            {isProcessingCreditUse ? "Starting..." : "Start a conversation"}
          </motion.button>
        </div>
      </main>
    );
  }

  // Room view (when connected)
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
          // Optionally refresh credits here too, in case a conversation ended prematurely
          // if (refreshUserProfile) refreshUserProfile(); 
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
        </div>
        
        <div className="fixed top-0 left-0 right-0 flex justify-between items-center bg-black/75 p-2 rounded-b-md">
          <div className="flex items-center">
            <div className="ml-2 text-white font-medium max-w-xs truncate">
              {profile?.display_name || user?.email}
            </div>
          </div>
          <div className="flex items-center">
            <DisconnectButton 
              className="ml-4" 
              onClick={() => {
                updateConnectionDetails(undefined);
                 // if (refreshUserProfile) refreshUserProfile(); // Also consider refreshing credits on manual disconnect
              }}
            >
              <CloseIcon />
            </DisconnectButton>
          </div>
        </div>
        
        <div className="relative flex gap-2 mx-auto mb-4">
          {/* Pass interviewCredits and refreshUserProfile to AgentControlInterface if needed there */}
          {/* Or manage credit display/actions primarily on this Page component */}
          <AgentControlInterface userId={user.id} agentState={agentState} />
        </div>
      </LiveKitRoom>
    </main>
  );
}

function AgentControlInterface({ userId, agentState }: { 
  userId: string;
  agentState: AgentState;
  // Potentially pass down interviewCredits or handlers if AgentControlButtons directly influence credits
}) {
  const room = useRoomContext();
  const { isAgentActive, startConversation, leaveCall } = useAgentControl(room, userId);
  // The actual "start agent" logic is now within handleStartConversationClick in Page
  // So, AgentControlButtons' onStartConversation should perhaps be simplified or adapted
  // For now, we assume handleStartConversationClick in Page handles credit check and then calls LiveKit setup.
  // The `startConversation` from `useAgentControl` likely just focuses on LiveKit agent interactions.
  
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
          {/* Consider passing interviewCredits > 0 to NoAgentNotification if its message should change */}
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
          // onStartConversation should ideally not be called directly anymore if credits are handled outside.
          // The main "Start a conversation" button on the initial screen triggers the credit check and then connection.
          // If AgentControlButtons is for *re-starting* an agent mid-call, its logic might differ.
          // For now, assuming the main button on `Page` is the entry point.
          onStartConversation={startConversation} // This might need review based on flow.
          onLeaveCall={leaveCall}
          // Add a prop like `isStartDisabled` if the button here also needs to check credits.
          // isStartDisabled={interviewCredits <= 0} // Example if this button also starts conversations
        />
      </motion.div>
    </AnimatePresence>
  );
}

function SimpleVoiceAssistant(props: { onStateChange: (state: AgentState) => void }) {
  const { state } = useVoiceAssistant();
  
  useEffect(() => {
    props.onStateChange(state);
  }, [props, state]);
  
  return null;
}

function onDeviceFailure(failureReason?: MediaDeviceFailure) { 
  console.error("Device failure reason:", failureReason);
  let message = "Could not access media devices.";
  if (failureReason === MediaDeviceFailure.PermissionDenied) {
    message = "You must allow camera and microphone permissions to join the call.";
  } else if (failureReason === MediaDeviceFailure.NotFound) {
    message = "No camera or microphone found. Please connect at least one device.";
  } else if (failureReason === MediaDeviceFailure.DeviceInUse) {
      message = "Camera or microphone is already in use by another application.";
  }
  alert(message);
}
