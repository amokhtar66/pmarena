import { NextResponse } from 'next/server';

// Don't cache API responses
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    console.log('Recording test endpoint called');
    
    // Extract the request body
    const body = await req.json();
    console.log('Request body:', body);
    
    // Return a simple success response
    return NextResponse.json({
      success: true,
      message: 'Test endpoint working',
      receivedData: body
    });
  } catch (error) {
    console.error('Error in test endpoint:', error);
    return NextResponse.json({ 
      error: 'Test endpoint error', 
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// Also add a GET handler for easy testing in browser
export async function GET() {
  console.log('Recording test endpoint called with GET');
  return NextResponse.json({
    success: true,
    message: 'Recording test endpoint is working (GET)'
  });
} 