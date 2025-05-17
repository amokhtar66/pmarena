// supabase/functions/xpay-verify-payment/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// XPay Configuration
const XPAY_API_KEY = Deno.env.get('XPAY_API_KEY')
const XPAY_BASE_URL = Deno.env.get('XPAY_BASE_URL') || 'https://community.xpay.app/api/v1'

interface VerifyPayload {
  paymentToken: string
  userId: string // The user ID from your system
  creditsToAward: number // e.g., 3
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!XPAY_API_KEY) {
      throw new Error('XPay API Key not configured.')
    }
    
    const { paymentToken, userId, creditsToAward }: VerifyPayload = await req.json()

    if (!paymentToken || !userId || !creditsToAward) {
      return new Response(JSON.stringify({ error: 'Missing required fields: paymentToken, userId, or creditsToAward.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 1. Verify payment with XPay
    const xpayVerifyResponse = await fetch(`${XPAY_BASE_URL}/payment/${paymentToken}`, {
      method: 'GET',
      headers: {
        'x-api-key': XPAY_API_KEY,
        Accept: 'application/json',
      },
    })

    const xpayVerifyData = await xpayVerifyResponse.json()
    console.log('XPay Verification Response:', xpayVerifyData)

    // Check XPay's success criteria. This might vary based on XPay's API.
    // Common check is for 'paid': true or a specific status code/message.
    const isPaymentSuccessful = xpayVerifyData.status === true && xpayVerifyData.data?.paid === true

    if (!isPaymentSuccessful) {
      const errorMessage = xpayVerifyData.msg || xpayVerifyData.message || 'Payment not successful or verification failed.'
      console.warn('XPay payment verification failed:', errorMessage, 'Full response:', xpayVerifyData)
      return new Response(JSON.stringify({ error: errorMessage, verified: false, details: xpayVerifyData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400, // Or appropriate status based on verification failure
      })
    }
    
    // Security Check (Highly Recommended):
    // Optionally, verify that the custom_fields in xpayVerifyData.data.custom_fields
    // match what you expect for this payment (e.g., user_id, product)
    // This helps prevent someone from replaying a valid paymentToken for a different user/order.
    // For example:
    // if (xpayVerifyData.data?.custom_fields?.user_id !== userId) {
    //   console.error('Security Alert: Mismatch in user ID during payment verification.');
    //   return new Response(JSON.stringify({ error: 'User ID mismatch during verification.', verified: false }), {
    //     headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    //     status: 403, // Forbidden
    //   });
    // }


    // 2. If payment is successful, update user credits in Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Use Service Role Key for admin operations
    )

    // Call the 'increment_credits' SQL function you created in Step 1
    const { error: dbError } = await supabaseClient.rpc('increment_credits', {
      user_id_input: userId,
      increment_by: creditsToAward,
    })

    if (dbError) {
      console.error('Supabase error updating credits:', dbError)
      // Note: Payment was successful with XPay, but DB update failed.
      // Implement retry logic or manual reconciliation process here if critical.
      return new Response(
        JSON.stringify({
          error: 'Payment successful but failed to update credits.',
          details: dbError.message,
          verified: true, // XPay payment was verified
          credits_updated: false,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500, // Internal server error (DB issue)
        }
      )
    }

    console.log(`Successfully awarded ${creditsToAward} credits to user ${userId}.`)
    return new Response(JSON.stringify({ success: true, verified: true, credits_updated: true, message: 'Payment verified and credits awarded.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in xpay-verify-payment function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
}) 