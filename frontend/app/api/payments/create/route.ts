import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server' // Adjust if your server-side client path is different

export async function POST(req: Request) {
  try {
    const supabase = createClient()

    // Optionally, get current authenticated user to ensure only logged-in users can create orders
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('User not authenticated for creating payment order:', userError)
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    const body = await req.json()
    const {
      amount_in_cents, // e.g., 2000 for $20.00 (3 interviews)
      product_description, // e.g., "3 Interview Credits"
      variable_amount_id,  // The ID from your XPay dashboard
    } = body

    if (!amount_in_cents || !product_description || !variable_amount_id) {
      return NextResponse.json(
        { error: 'Missing required fields: amount_in_cents, product_description, or variable_amount_id' },
        { status: 400 }
      )
    }
    
    // Get user details from the authenticated user session
    // Ensure your 'profiles' table or user metadata has display_name
    // For this example, assuming email is directly on user object and display_name might be in raw_user_meta_data or profile
    // You might need to fetch the profile separately if display_name is not readily available.
    
    // A simple way to get display_name if it's in raw_user_meta_data.
    // const displayName = user.raw_user_meta_data?.display_name || user.email;

    // A more robust way is to fetch the profile
    let displayName = user.email; // Fallback
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()

    if (profileError && !profileData) {
        console.warn('Could not fetch profile display_name for payment, using email as fallback.', profileError)
    } else if (profileData) {
        displayName = profileData.display_name || user.email;
    }


    const edgeFunctionPayload = {
      user_id: user.id,
      user_email: user.email, // Make sure user.email is available
      user_name: displayName,
      amount_in_cents,
      product_description,
      variable_amount_id,
    }

    // Invoke the Supabase Edge Function
    // Ensure the function name 'xpay-create-order' matches your deployed Edge Function name
    const { data: edgeData, error: edgeError } = await supabase.functions.invoke(
      'xpay-create-order', // Deployed Edge Function name
      { body: edgeFunctionPayload }
    )

    if (edgeError) {
      console.error('Error invoking xpay-create-order Edge Function:', edgeError)
      return NextResponse.json(
        { error: 'Failed to create payment order.', details: edgeError.message },
        { status: 500 }
      )
    }

    if (edgeData && edgeData.payment_url) {
      return NextResponse.json(
        { payment_url: edgeData.payment_url, payment_token: edgeData.payment_token },
        { status: 200 }
      )
    } else {
      // Handle cases where the Edge Function might return an error structure in its data
      const errorMessage = edgeData?.error || 'Unknown error from payment creation function.'
      console.error('Payment creation function returned an error:', edgeData)
      return NextResponse.json(
        { error: errorMessage, details: edgeData },
        { status: edgeData?.status || 500 }
      )
    }
  } catch (error) {
    console.error('Unexpected error in /api/payments/create:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred.', details: error.message },
      { status: 500 }
    )
  }
} 