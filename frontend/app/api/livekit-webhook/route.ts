import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Don't cache webhook responses
export const dynamic = 'force-dynamic';

// Initialize Supabase client with service role for admin operations
const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

export async function POST(req: Request) {
  try {
    const event = await req.json();
    console.log('Received LiveKit webhook event:', event.type);
    
    if (!supabaseAdmin) {
      console.error('Supabase admin client not initialized');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // When recording starts
    if (event.type === 'egress_started') {
      console.log('Recording started:', event.egressInfo.egressId);
      
      // Get user ID from metadata if available
      let userId = null;
      try {
        if (event.egressInfo.metadata) {
          const metadata = JSON.parse(event.egressInfo.metadata);
          userId = metadata.userId;
        }
      } catch (error) {
        console.error('Error parsing metadata:', error);
      }
      
      // Create recording record in database
      await supabaseAdmin
        .from('recordings')
        .insert({
          room_name: event.egressInfo.roomName,
          egress_id: event.egressInfo.egressId,
          status: 'processing',
          started_at: new Date().toISOString(),
          user_id: userId,
        });
      
      return NextResponse.json({ success: true });
    }
    
    // When recording completes
    if (event.type === 'egress_finished' && event.egressInfo.status === 'EGRESS_COMPLETE') {
      console.log('Recording completed:', event.egressInfo.egressId);
      
      let fileUrl = null;
      
      // Get the file URL from the result
      if (event.egressInfo.fileResults && event.egressInfo.fileResults.length > 0) {
        fileUrl = event.egressInfo.fileResults[0].location;
      }
      
      // Update recording status in database
      await supabaseAdmin
        .from('recordings')
        .update({
          status: 'completed',
          file_url: fileUrl,
          ended_at: new Date().toISOString()
        })
        .eq('egress_id', event.egressInfo.egressId);
      
      return NextResponse.json({ success: true });
    }
    
    // Handle other event types if needed
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing LiveKit webhook:', error);
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
  }
} 