// supabase/functions/xpay-create-order/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

// XPay Configuration (Set these in your Supabase Edge Function Environment Variables)
const XPAY_API_KEY = Deno.env.get('XPAY_API_KEY')
const XPAY_COMMUNITY_ID = Deno.env.get('XPAY_COMMUNITY_ID')
const XPAY_BASE_URL = Deno.env.get('XPAY_BASE_URL') || 'https://community.xpay.app/api/v1' // Or staging URL if needed

interface XPayOrderPayload {
  user_id: string
  user_email: string
  user_name: string
  amount_in_cents: number // Expect amount in cents for precision
  product_description: string
  variable_amount_id: number // As per XPay docs, often a pre-configured ID
}

serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!XPAY_API_KEY || !XPAY_COMMUNITY_ID) {
      throw new Error('XPay API Key or Community ID not configured.')
    }

    const {
      user_id,
      user_email,
      user_name,
      amount_in_cents, // e.g., 2000 for $20.00
      product_description,
      variable_amount_id,
    }: XPayOrderPayload = await req.json()

    if (!user_id || !user_email || !amount_in_cents || !product_description || !variable_amount_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields in request body.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const xpayPayload = {
      community_id: XPAY_COMMUNITY_ID,
      amount: amount_in_cents / 100, // XPay expects amount in base currency unit (e.g., EGP, USD)
      currency: 'EGP', // Or your desired currency, e.g., 'USD'
      variable_amount_id: variable_amount_id, // Make this configurable or use a default
      custom_fields: {
        user_id: user_id,
        user_email: user_email,
        user_name: user_name,
        product: product_description,
        // Add a unique identifier for reconciliation if needed
        // payment_reference: `PMARENA-${user_id}-${Date.now()}` 
      },
      // Important: Provide callback URLs for XPay to redirect to after payment
      // These should point to your frontend, which then calls the verify function.
      // Example: https://your-frontend-app.com/payment-callback
      // The actual URL structure depends on your frontend routing.
      // XPay will append query parameters like `payment_token` and `status`.
      callback_url: `${Deno.env.get('YOUR_FRONTEND_URL')}/payment-callback`, // Replace with your actual frontend callback URL
    }

    console.log('Sending payload to XPay:', JSON.stringify(xpayPayload, null, 2))

    const response = await fetch(`${XPAY_BASE_URL}/direct-order`, {
      method: 'POST',
      headers: {
        'x-api-key': XPAY_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(xpayPayload),
    })

    const responseData = await response.json()
    console.log('XPay Response Data:', responseData)

    if (response.ok && responseData.status === true && responseData.data?.payment_url) {
      return new Response(
        JSON.stringify({
          payment_url: responseData.data.payment_url,
          payment_token: responseData.data.payment_token, // If XPay provides this here
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    } else {
      const errorMessage = responseData.msg || responseData.message || 'Failed to create XPay order.'
      console.error('XPay order creation failed:', errorMessage, 'Full response:', responseData)
      return new Response(JSON.stringify({ error: errorMessage, details: responseData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: responseData.status_code || response.status || 500,
      })
    }
  } catch (error) {
    console.error('Error in xpay-create-order function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
}) 