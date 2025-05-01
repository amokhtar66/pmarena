// SPDX-FileCopyrightText: 2024 LiveKit, Inc.
//
// SPDX-License-Identifier: Apache-2.0
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
  S3Upload 
} from "livekit-server-sdk";

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

// S3 Upload environment variables (Expected to be set in Railway)
const SUPABASE_S3_ACCESS_KEY = process.env.SUPABASE_S3_ACCESS_KEY;
const SUPABASE_S3_SECRET_KEY = process.env.SUPABASE_S3_SECRET_KEY;
const SUPABASE_S3_BUCKET = process.env.SUPABASE_S3_BUCKET;
const SUPABASE_S3_REGION = process.env.SUPABASE_S3_REGION; // e.g., 'us-east-2'
const SUPABASE_S3_ENDPOINT = process.env.SUPABASE_S3_ENDPOINT; // e.g., 'https://<project_ref>.supabase.co/storage/v1/s3'

// Initialize Supabase client with service role for admin operations
const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

export default defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();
    console.log('waiting for participant');
    const participant = await ctx.waitForParticipant();
    console.log(`starting assistant example agent for ${participant.identity}`);
    
    // Check if all required env vars are present for recording and S3 upload
    const canRecord = LIVEKIT_API_KEY && LIVEKIT_API_SECRET && LIVEKIT_URL &&
                      SUPABASE_S3_ACCESS_KEY && SUPABASE_S3_SECRET_KEY &&
                      SUPABASE_S3_BUCKET && SUPABASE_S3_REGION && SUPABASE_S3_ENDPOINT;

    // Check if Supabase logging is configured
    const canLogToSupabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY;

    // Start recording when participant joins if configured
    if (canRecord) {
      try {
        console.log(`Starting recording for room: ${ctx.room.name}, user: ${participant.identity}`);
        
        // Use RoomServiceClient instead of LiveKitAPI
        const roomServiceClient = new RoomServiceClient(LIVEKIT_URL!, LIVEKIT_API_KEY!, LIVEKIT_API_SECRET!);
        
        // Start room composite recording with S3 output, removing the incorrect 'api.' prefix
        const req = new RoomCompositeEgressRequest({
          roomName: ctx.room.name,
          layout: 'speaker', 
          output: {
            fileType: EncodedFileType.MP4, // Use imported type directly
            s3: new S3Upload({             // Use imported type directly
              accessKey: SUPABASE_S3_ACCESS_KEY!,
              secret: SUPABASE_S3_SECRET_KEY!,
              region: SUPABASE_S3_REGION!,
              endpoint: SUPABASE_S3_ENDPOINT!,
              bucket: SUPABASE_S3_BUCKET!,
              filenamePrefix: `recordings/${ctx.room.name}`, 
              metadata: {                           
                 userId: participant.identity,
                 roomName: ctx.room.name,
              },
            }),
          }
        });
        
        // Call Egress method directly on RoomServiceClient
        const result = await roomServiceClient.startRoomCompositeEgress(req);
        console.log(`Recording started with egressId: ${result.egressId}`);
        
        // If we have Supabase admin client for logging metadata, create a record
        if (canLogToSupabase && supabaseAdmin) {
          await supabaseAdmin
            .from('recordings')
            .insert({
              room_name: ctx.room.name,
              egress_id: result.egressId,
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
      console.error('Recording credentials (LiveKit API or Supabase S3) not properly configured.');
    }

    const model = new openai.realtime.RealtimeModel({
      model: 'gpt-4o-realtime-preview',
      voice: 'alloy',
      instructions: `Voice Assistant Guidelines for Conducting Product Strategy Interviews

This is a simulation interview designed to assess the strategic thinking of Product Management candidates.

Use this flexible and dynamic guide to effectively assess Product Management candidates' strategic abilities during interviews. The candidate should lead the conversation, with you actively guiding and probing thoughtfully when opportunities arise.

🎯 Goal:

Evaluate the candidate's:

Clarity in navigating ambiguous problems

Structured and strategic problem-solving

Understanding of markets, users, and competition

Ability to prioritize effectively

Clarity and confidence in communication

📌 Interview Question:

How would you improve your favorite product?

🗂 Dynamic Interview Flow:

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

🛠 Interviewer's Role:

Keep the conversation focused on the main question. If the candidate deviates significantly or asks unrelated or excessive questions, gently steer them back to the core scenario, emphasizing the importance of effectively utilizing the available time.

Facilitate the interview dynamically based on candidate responses.

Guide conversations subtly without leading the candidate.

Clearly answer the candidate's clarifying questions briefly and concisely.

Do not interrupt the candidate when they pause to think.

Ask insightful, targeted follow-up questions briefly when opportunities arise.

This approach allows adaptability and deeper insight into the candidate's strategic abilities and thought process.`,
    });

    // Empty function context - removed weather function
    const fncCtx: llm.FunctionContext = {};
    
    const agent = new multimodal.MultimodalAgent({ model, fncCtx });
    const session = await agent
      .start(ctx.room, participant)
      .then((session) => session as openai.realtime.RealtimeSession);

    session.conversation.item.create(llm.ChatMessage.create({
      role: llm.ChatRole.ASSISTANT,
      text: 'Hello, I\'m your interviewer for this product strategy exercise. I\'ll be evaluating your strategic thinking and problem-solving approach. Before we begin, how are you feeling today?',
    }));

    session.response.create();
  },
});

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
