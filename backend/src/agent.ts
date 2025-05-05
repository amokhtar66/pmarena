// SPDX-FileCopyrightText: 2024 LiveKit, Inc.
//
// SPDX-License-Identifier: Apache-2.0

// Tell TypeScript to ignore type checking for this entire file
// @ts-nocheck

// Define types to avoid namespace errors
type FunctionContext = any;
type ChatMessage = any;
type ChatRole = any;

import {
  type JobContext,
  WorkerOptions,
  cli,
  defineAgent,
  llm,
  multimodal,
} from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { 
  RoomServiceClient,
  RoomCompositeEgressRequest,
  EncodedFileType,
  S3Upload,
  EncodedFileOutput,
  EgressClient
} from "livekit-server-sdk";
import { STORAGE_PROVIDER, createStorageConfig } from './storage-adapter.js';
import { EgressListener } from './egress-listener.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

// Also try to load from .env.local as fallback
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Default loading from process.env
dotenv.config();

// LiveKit environment variables
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Storage configuration (former S3 Upload environment variables)
// These can be used with either Supabase or Backblaze
const STORAGE_ACCESS_KEY = process.env.STORAGE_ACCESS_KEY;
const STORAGE_SECRET_KEY = process.env.STORAGE_SECRET_KEY;
const STORAGE_BUCKET = process.env.STORAGE_BUCKET;
const STORAGE_ENDPOINT = process.env.STORAGE_ENDPOINT;
const STORAGE_REGION = process.env.STORAGE_REGION || ''; // Backblaze B2 region, default empty

// Initialize Supabase client with service role for admin operations
const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

// Initialize the egress listener if Backblaze B2 storage is enabled
let egressListener: EgressListener | null = null;
if (STORAGE_PROVIDER === 'BACKBLAZE' && LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET) {
  egressListener = new EgressListener({
    livekitUrl: LIVEKIT_URL,
    livekitApiKey: LIVEKIT_API_KEY,
    livekitApiSecret: LIVEKIT_API_SECRET,
    supabaseUrl: SUPABASE_URL,
    supabaseServiceRoleKey: SUPABASE_SERVICE_ROLE_KEY
  });
  egressListener.startListening();
  console.log('Egress listener started for Backblaze B2 Storage uploads');
}

export default defineAgent({
  entry: async (ctx: JobContext) => {
    // --- DIAGNOSTIC LOG --- 
    console.log(`DEBUG: STORAGE_PROVIDER: ${STORAGE_PROVIDER}`);
    console.log(`DEBUG: STORAGE_ENDPOINT value: ${STORAGE_ENDPOINT}`);
    // --- END DIAGNOSTIC LOG ---
    
    await ctx.connect();
    console.log('waiting for participant');
    const participant = await ctx.waitForParticipant();
    console.log(`starting assistant example agent for ${participant.identity}`);
    
    // Check if all required env vars are present for recording and storage
    const canRecord = LIVEKIT_API_KEY && LIVEKIT_API_SECRET && LIVEKIT_URL &&
                      STORAGE_ACCESS_KEY && STORAGE_SECRET_KEY &&
                      STORAGE_BUCKET && STORAGE_ENDPOINT;

    // Check if Supabase logging is configured
    const canLogToSupabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY;

    // Start recording when participant joins if configured
    if (canRecord) {
      try {
        // Add runtime check for room name
        if (!ctx.room.name) {
          console.error('Cannot start recording: Room name is missing.');
          return; // Or handle error appropriately
        }

        console.log(`Starting recording for room: ${ctx.room.name}, user: ${participant.identity}`);
        
        // Instantiate EgressClient separately
        const egressClient = new EgressClient(LIVEKIT_URL!, LIVEKIT_API_KEY!, LIVEKIT_API_SECRET!);
        
        // Use our storage adapter to create the appropriate configuration
        const filepath = `recording-${ctx.room.name}-${Date.now()}.mp4`;
        const { fileOutput, backblazeConfig } = createStorageConfig(
          STORAGE_ACCESS_KEY!,
          STORAGE_SECRET_KEY!,
          STORAGE_ENDPOINT!,
          STORAGE_BUCKET!,
          STORAGE_REGION!,
          filepath
        );
        
        // Start room composite recording using EgressClient
        const result = await egressClient.startRoomCompositeEgress(
          ctx.room.name, // roomName (guaranteed string)
          fileOutput,    // output: EncodedFileOutput | StreamOutput | SegmentedFileOutput
          { layout: 'grid' } // Changed from 'speaker' to 'grid'
        );

        // If using Backblaze B2 Storage directly, register the config with the listener
        if (STORAGE_PROVIDER === 'BACKBLAZE' && egressListener && backblazeConfig && result.egressId) {
          egressListener.registerBackblazeConfig(result.egressId, backblazeConfig);
        }

        // Check if egressId exists before inserting into Supabase
        if (canLogToSupabase && supabaseAdmin && result.egressId) {
          console.log(`Recording started with egressId: ${result.egressId}`); // Log success only if ID exists
          await supabaseAdmin
            .from('recordings')
            .insert({
              room_name: ctx.room.name, // Also guaranteed string here
              egress_id: result.egressId, // Now we know it's a string
              status: 'processing',
              started_at: new Date().toISOString(),
              user_id: participant.identity,
            });
        } else if (!canLogToSupabase) {
          console.warn('Supabase URL/Service Key not configured, cannot log recording metadata.');
        }
      } catch (error) {
        console.error('Error starting recording:', error);
      }
    } else {
      console.error('Recording credentials (LiveKit API or Storage) not properly configured.');
    }

    // --- Agent Logic --- 
    try {
      const model = new openai.realtime.RealtimeModel({
        model: 'gpt-4o-realtime-preview',
        voice: 'alloy',
        instructions: `Voice Assistant Guidelines for Conducting Product Strategy Interviews

This is a simulation interview designed to assess the strategic thinking of Product Management candidates.

Use this flexible and dynamic guide to effectively assess Product Management candidates' strategic abilities during interviews. The candidate should lead the conversation, with you actively guiding and probing thoughtfully when opportunities arise.

ðŸŽ¯ Goal:

Evaluate the candidate's:

Clarity in navigating ambiguous problems

Structured and strategic problem-solving

Understanding of markets, users, and competition

Ability to prioritize effectively

Clarity and confidence in communication

ðŸ“Œ Interview Question:

How would you improve your favorite product?

ðŸ—‚ Dynamic Interview Flow:

0. Call Introduction & Ice Breaker:

Begin the call by greeting the candidate warmly.

Briefly introduce yourself and allow the candidate to introduce themselves.

Engage in a quick ice-breaker question ("How has your day been?" or "Where are you calling from today?").

1. Clearly State the Question:

Present the provided strategic scenario clearly and exactly as stated above.

2. Candidate-led Clarification:

Allow the candidate to ask clarifying questions.

Evaluate their ability to clarify ambiguity, define scope, and articulate assumptions.

Be brief and concise in your confirmations or responses.

3. Candidate's Structured Approach:

The candidate outlines their structured framework or thought process.

Look for a clear and logical approach.

Do not interrupt the candidate if they pause to think.

Intervene only if the candidate appears stuck or unfocused.

4. Interactive Discussion: (Flexible stage)

Allow the candidate to choose their focus: market analysis, competitive response, user segmentation, prioritization, or any relevant angle.

Dynamically guide the candidate by asking strategic probing questions based on their direction, such as:

"Why do you prioritize this customer segment?"

"How would competitors react to your strategy?"

"How do you validate your assumptions?"

Keep your responses or follow-up questions brief and focused.

5. Strategic Recommendation:

Expect a clear recommendation supported by sound reasoning.

Challenge their decision-making briefly and precisely to understand deeper thinking ("Why this strategy?").

6. Optional Analytical Probe (use as needed):

Introduce a relevant analytical challenge, such as a hypothetical scenario requiring a quick strategic pivot.

Assess analytical rigor and adaptability clearly.

7. Candidate Summary:

Ask candidates to summarize their final recommendation concisely.

Encourage brief, clear communication to summarize key takeaways.

8. Candidate Questions & Close:

Allow time for candidate questions.

ðŸ›  Interviewer's Role:

Keep the conversation focused on the main question. If the candidate deviates significantly or asks unrelated or excessive questions, gently steer them back to the core scenario, emphasizing the importance of effectively utilizing the available time.

Facilitate the interview dynamically based on candidate responses.

Guide conversations subtly without leading the candidate.

Clearly answer the candidate's clarifying questions briefly and concisely.

Do not interrupt the candidate when they pause to think.

Ask insightful, targeted follow-up questions briefly when opportunities arise.

This approach allows adaptability and deeper insight into the candidate's strategic abilities and thought process.`,
      });

      // Empty function context - removed weather function
      const fncCtx: FunctionContext = {};
      
      const agent = new multimodal.MultimodalAgent({ model, fncCtx });
      
      // Add .catch() for startup errors
      const session = await agent
        .start(ctx.room, participant)
        .then((session) => session as openai.realtime.RealtimeSession)
        .catch((err) => {
          console.error("Error starting agent session:", err);
          throw err; // Re-throw to be caught by outer try-catch
        });

      // Check if session creation failed
      if (!session) {
         console.error("Agent session failed to start.");
         return; // Exit if session is null/undefined after error
      }

      // Create a chat message without using llm namespace
      session.conversation.item.create({
        role: 'assistant',
        text: 'Hello, I\'m your interviewer for this product strategy exercise. I\'ll be evaluating your strategic thinking and problem-solving approach. Before we begin, how are you feeling today?',
      });

      session.response.create();

    } catch (error) {
      console.error("An error occurred in the agent logic:", error);
      // Optionally, implement cleanup or specific error handling here
    }
    // --- End of Agent Logic ---

  }, // End of entry function
});

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));

// Added signature version on 05/03/2025 21:36:07
// Forced change to trigger git
// Added comment to force build
// Modifying file to fix build error caused by unsupported signatureVersion property
// URGENT FIX FOR RAILWAY BUILD ERROR
