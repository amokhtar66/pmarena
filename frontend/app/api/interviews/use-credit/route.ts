import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server' // Adjust if your server-side client path is different

export async function POST(req: Request) {
  try {
    const supabase = createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('User not authenticated for using credit:', userError)
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    const body = await req.json()
    const { userId } = body // Expects userId to be passed in the body

    // Security check: Ensure the logged-in user is the one trying to use their own credit
    if (user.id !== userId) {
      console.error(`Security Alert: Authenticated user ${user.id} attempting to use credit for user ${userId}.`)
      return NextResponse.json({ error: 'User mismatch when attempting to use credit.' }, { status: 403 })
    }

    const edgeFunctionPayload = {
      userId,
    }

    // Invoke the Supabase Edge Function
    const { data: edgeData, error: edgeError } = await supabase.functions.invoke(
      'use-interview-credit', // Deployed Edge Function name
      { body: edgeFunctionPayload }
    )

    if (edgeError) {
      console.error('Error invoking use-interview-credit Edge Function:', edgeError)
      return NextResponse.json(
        { error: 'Failed to use interview credit.', details: edgeError.message },
        { status: 500 }
      )
    }

    if (edgeData?.success === true) {
      return NextResponse.json({ success: true, message: edgeData.message || 'Interview credit used.' }, { status: 200 })
    } else {
      const errorMessage = edgeData?.error || 'Failed to use interview credit.'
      console.error('Use interview credit function returned an error:', edgeData)
      return NextResponse.json(
        { error: errorMessage, details: edgeData },
        { status: edgeData?.status || 500 }
      )
    }
  } catch (error) {
    console.error('Unexpected error in /api/interviews/use-credit:', error)
    let errorMessage = 'An unexpected error occurred during credit use.'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    return NextResponse.json(
      { error: 'Failed to use interview credit due to an unexpected server error.', details: errorMessage },
      { status: 500 }
    )
  }
} 