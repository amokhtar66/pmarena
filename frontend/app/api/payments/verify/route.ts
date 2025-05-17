import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server' // Adjust if your server-side client path is different

export async function POST(req: Request) {
  try {
    const supabase = createClient()

    // It's good practice to ensure a user is logged in, though the core verification
    // logic relies on the paymentToken and the userId passed in the body which
    // the Edge Function will use.
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('User not authenticated for verifying payment:', userError)
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    const body = await req.json()
    const { 
      paymentToken, 
      userId, // This should be the ID of the user for whom the payment was made
      creditsToAward // e.g., 3
    } = body

    if (!paymentToken || !userId || creditsToAward === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: paymentToken, userId, or creditsToAward' },
        { status: 400 }
      )
    }

    // Security check: Ensure the logged-in user matches the userId for whom the payment is being verified.
    // This prevents a user from trying to verify a payment for another user's session.
    if (user.id !== userId) {
        console.error(`Security Alert: Authenticated user ${user.id} attempting to verify payment for user ${userId}.`)
        return NextResponse.json({ error: 'User mismatch in payment verification.' }, { status: 403 })
    }

    const edgeFunctionPayload = {
      paymentToken,
      userId,
      creditsToAward,
    }

    // Invoke the Supabase Edge Function
    const { data: edgeData, error: edgeError } = await supabase.functions.invoke(
      'xpay-verify-payment', // Deployed Edge Function name
      { body: edgeFunctionPayload }
    )

    if (edgeError) {
      console.error('Error invoking xpay-verify-payment Edge Function:', edgeError)
      return NextResponse.json(
        { error: 'Failed to verify payment.', details: edgeError.message },
        { status: 500 }
      )
    }

    // The xpay-verify-payment Edge Function returns a clear success/error structure.
    if (edgeData?.success === true && edgeData?.verified === true && edgeData?.credits_updated === true) {
      return NextResponse.json({ success: true, message: edgeData.message || 'Payment verified and credits awarded.' }, { status: 200 })
    } else {
      const errorMessage = edgeData?.error || 'Payment verification failed or credits not updated.'
      console.error('Payment verification function returned an error or incomplete success:', edgeData)
      return NextResponse.json(
        { error: errorMessage, details: edgeData },
        { status: edgeData?.status || 500 } // Use status from Edge Function if available
      )
    }
  } catch (error) {
    console.error('Unexpected error in /api/payments/verify:', error)
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.', details: message },
      { status: 500 }
    )
  }
} 