import { EgressClient } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Environment variables
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Don't cache API responses
export const dynamic = 'force-dynamic';

// Initialize Supabase client with service role for admin operations
const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

export async function POST(req: Request) {
  try {
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
      console.error('LiveKit credentials not properly configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { roomName, userId } = await req.json();
    
    if (!roomName) {
      return NextResponse.json({ error: 'Room name is required' }, { status: 400 });
    }
    
    console.log(`Starting recording for room: ${roomName}, user: ${userId || 'unknown'}`);
    
    // Initialize Egress client
    const egressClient = new EgressClient(
      LIVEKIT_URL,
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET
    );
    
    // Start recording using LiveKit Egress
    const result = await egressClient.startRoomCompositeEgress(roomName, {
      layout: 'speaker',  // Use speaker layout
      output: {
        mp4: {
          // Use the destinationUrl parameter for cloud storage URL
          // If no cloud storage configured, LiveKit will store temporarily
          destinationUrl: `recordings/${roomName}/${Date.now()}.mp4`,
        },
      },
      // Include the user ID in metadata so we can identify it in webhooks
      metadata: JSON.stringify({ userId }),
    });
    
    console.log(`Recording started with egressId: ${result.egressId}`);
    
    // If we have Supabase admin client and no webhook is set up, create a record now
    if (supabaseAdmin) {
      await supabaseAdmin
        .from('recordings')
        .insert({
          room_name: roomName,
          egress_id: result.egressId,
          status: 'processing',
          started_at: new Date().toISOString(),
          user_id: userId,
        });
    }
    
    return NextResponse.json({ 
      success: true, 
      egressId: result.egressId 
    });
  } catch (error) {
    console.error('Error starting recording:', error);
    return NextResponse.json({ 
      error: 'Failed to start recording' 
    }, { status: 500 });
  }
} 