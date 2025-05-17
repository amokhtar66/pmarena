# XPay Integration README

This document outlines the steps taken to integrate the XPay payment gateway into the pmarena application using Supabase Edge Functions for key backend logic.

## Goal

Integrate XPay to allow users to purchase interview credits ($20 for 3 interviews). The "Start Conversation" button should only be enabled if the user has sufficient credits. Each time a user starts a conversation, it consumes one credit, regardless of duration.

## Implementation Steps

1.  **Database Schema Update (Supabase):**
    *   Added `interview_credits` (INTEGER, default 0) and `last_payment_date` (TIMESTAMP WITH TIME ZONE, default NULL) columns to the `profiles` table.
    *   Created helper SQL functions (`increment_credits`, `decrement_credits`) in Supabase for atomic updates.

2.  **Supabase Edge Functions for XPay Integration:**
    *   Created a Supabase Edge Function (e.g., `xpay-create-order`):
        *   Handles the logic to interact with XPay's `/direct-order` API endpoint.
        *   Requires `XPAY_API_KEY` and `XPAY_COMMUNITY_ID` as secure environment variables within Supabase.
        *   Accepts user details (ID, email, name) and amount.
        *   Returns the XPay `payment_url` and `payment_token`.
        *   **Deployed Code (`supabase/functions/xpay-create-order/index.ts`):**
          ```typescript
          // supabase/functions/xpay-create-order/index.ts

          import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

          // Inlined CORS Headers
          const corsHeaders = {
            'Access-Control-Allow-Origin': '*', // Restrict this to your frontend domain in production
            'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          }

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
          ```
    *   Created a Supabase Edge Function (e.g., `xpay-verify-payment`):
        *   Handles the logic to interact with XPay's `/payment/{paymentToken}` API endpoint to confirm payment success.
        *   Requires `XPAY_API_KEY` as a secure environment variable.
        *   Accepts `paymentToken` and `userId`.
        *   If XPay confirms successful payment, this function will then call the `increment_credits` SQL function to update the user's `interview_credits` and `last_payment_date` in the Supabase `profiles` table.
        *   Returns a success/failure status.
        *   **Deployed Code (`supabase/functions/xpay-verify-payment/index.ts`):**
          ```typescript
          // supabase/functions/xpay-verify-payment/index.ts

          import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
          import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

          // Inlined CORS Headers
          const corsHeaders = {
            'Access-Control-Allow-Origin': '*', // Restrict this to your frontend domain in production
            'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          }

          // XPay Configuration (Set these in your Supabase Edge Function Environment Variables)
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
                throw new Error('XPay API Key not configured in environment variables.')
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
              console.log('XPay Verification Response:', JSON.stringify(xpayVerifyData, null, 2))

              // Check XPay's success criteria. This might vary based on XPay's API.
              // Common check is for 'paid': true or a specific status code/message.
              // Adjust this condition based on actual XPay response structure for success.
              const isPaymentSuccessful = xpayVerifyData.status === true && xpayVerifyData.data?.paid === true

              if (!isPaymentSuccessful) {
                const errorMessage = xpayVerifyData.msg || xpayVerifyData.message || 'Payment not successful or verification failed with XPay.'
                console.warn('XPay payment verification failed:', errorMessage, 'Full response:', xpayVerifyData)
                return new Response(JSON.stringify({ error: errorMessage, verified: false, details: xpayVerifyData }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                  status: 400, // Or appropriate status based on verification failure
                })
              }
              
              // Security Check (Highly Recommended):
              // Verify custom fields if XPay returns them within xpayVerifyData.data.custom_fields
              // This helps prevent someone from replaying a valid paymentToken for a different user/order.
              // Example:
              // if (xpayVerifyData.data?.custom_fields?.user_id !== userId) {
              //   console.error('Security Alert: Mismatch in user ID during payment verification.');
              //   return new Response(JSON.stringify({ error: 'User ID mismatch during verification.', verified: false }), {
              //     headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              //     status: 403, // Forbidden
              //   });
              // }
              // if (xpayVerifyData.data?.custom_fields?.product !== "3 Interview Credits") { // Or whatever your product description is
              //   console.error('Security Alert: Mismatch in product description during payment verification.');
              //    return new Response(JSON.stringify({ error: 'Product mismatch during verification.', verified: false }), {
              //     headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              //     status: 403, // Forbidden
              //   });
              // }


              // 2. If payment is successful, update user credits in Supabase
              // Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in Edge Function env vars
              // or that the Supabase client can infer them from the execution context.
              const supabaseClient = createClient(
                Deno.env.get('SUPABASE_URL') ?? '', // Fallback to empty string if not set
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Fallback for service role
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
                    error: 'Payment successful with XPay, but failed to update credits in database.',
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
              return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
              })
            }
          })
          ```
    *   **Deployed `use-interview-credit` Edge Function:**
        *   Handles decrementing a user's interview credit.
        *   Calls the `decrement_credits` SQL function.
        *   **Deployed Code (`supabase/functions/use-interview-credit/index.ts`):**
          ```typescript
          // supabase/functions/use-interview-credit/index.ts
          import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
          import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

          // Inlined CORS Headers
          const corsHeaders = {
            'Access-Control-Allow-Origin': '*', // Restrict this to your frontend domain in production
            'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          }

          serve(async (req) => {
            if (req.method === 'OPTIONS') {
              return new Response('ok', { headers: corsHeaders })
            }

            try {
              const { userId } = await req.json()

              if (!userId) {
                return new Response(JSON.stringify({ error: 'Missing userId in request body.' }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                  status: 400,
                })
              }

              // Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in Edge Function env vars
              // or that the Supabase client can infer them from the execution context.
              const supabaseClient = createClient(
                Deno.env.get('SUPABASE_URL') ?? '', // Fallback to empty string if not set
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Fallback for service role
              )

              // Call the 'decrement_credits' SQL function you created in Step 1
              const { error } = await supabaseClient.rpc('decrement_credits', {
                user_id_input: userId,
                decrement_by: 1,
              })

              if (error) {
                console.error('Supabase error decrementing credits:', error)
                return new Response(JSON.stringify({ error: 'Failed to decrement credits in database.', details: error.message }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                  status: 500,
                })
              }

              return new Response(JSON.stringify({ success: true, message: 'Interview credit successfully used.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
              })

            } catch (error) {
              console.error('Error in use-interview-credit function:', error)
              return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
              })
            }
          })
          ```

3.  **Frontend API Routes (Next.js) & Logic:**
    *   Created `pmarena/frontend/lib/supabase/server.ts` to provide a Supabase client for server-side Next.js contexts (API Routes, Server Components). This client handles cookie-based session management.
        *   **Code (`pmarena/frontend/lib/supabase/server.ts`):**
          ```typescript
          // pmarena/frontend/lib/supabase/server.ts
          import { createServerClient, type CookieOptions } from '@supabase/ssr'
          import { cookies } from 'next/headers'

          export function createClient() {
            const cookieStore = cookies()

            return createServerClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              {
                cookies: {
                  get(name: string) {
                    return cookieStore.get(name)?.value
                  },
                  set(name: string, value: string, options: CookieOptions) {
                    try {
                      cookieStore.set({ name, value, ...options })
                    } catch (error) {
                      // The `set` method was called from a Server Component.
                      // This can be ignored if you have middleware refreshing
                      // user sessions.
                    }
                  },
                  remove(name: string, options: CookieOptions) {
                    try {
                      cookieStore.set({ name, value: '', ...options })
                    } catch (error) {
                      // The `delete` method was called from a Server Component.
                      // This can be ignored if you have middleware refreshing
                      // user sessions.
                    }
                  },
                },
              }
            )
          }
          ```
    *   Modified/Created `pmarena/frontend/app/api/payments/create/route.ts`:
        *   Authenticates the user.
        *   Receives payment details (`amount_in_cents`, `product_description`, `variable_amount_id`) from the client.
        *   Invokes the `xpay-create-order` Supabase Edge Function, passing necessary user and payment details.
        *   Returns the XPay payment URL and token (received from the Edge Function) to the client.
    *   Modified/Created `pmarena/frontend/app/api/payments/verify/route.ts`:
        *   Authenticates the user.
        *   Receives `paymentToken`, `userId`, and `creditsToAward` from the client (after redirect back from XPay).
        *   Invokes the `xpay-verify-payment` Supabase Edge Function.
        *   Returns success/failure to the client based on the Edge Function's response.
    *   Created `pmarena/frontend/app/api/interviews/use-credit/route.ts`:
        *   Authenticates the user.
        *   Receives the `userId`.
        *   Invokes the `use-interview-credit` Supabase Edge Function (which calls the `decrement_credits` SQL function).
        *   Returns success/failure.

4.  **Frontend UI Modifications & Context Updates:**

    *   **`pmarena/frontend/lib/supabase.ts`:**
        *   Updated the `UserProfile` type to include an optional `interview_credits?: number;` field.
          ```typescript
          // pmarena/frontend/lib/supabase.ts excerpt
          export type UserProfile = {
            id: string;
            display_name: string;
            email: string;
            interview_credits?: number; // Added
          };
          ```

    *   **`pmarena/frontend/lib/AuthContext.tsx`:**
        *   Added `refreshUserProfile?: () => Promise<void>;` to `AuthContextProps`.
        *   Implemented the `refreshUserProfile` function within the `AuthProvider`. This function calls `getProfile(user.id)` to re-fetch the user's profile from Supabase, ensuring `interview_credits` are updated in the context.
        *   The `getProfile` function was slightly enhanced to log fetched credits and handle errors more explicitly by clearing the profile state.
        *   The `refreshUserProfile` function is now provided in the context value.

    *   **`pmarena/frontend/app/payment/callback/page.tsx` (New File):**
        *   Created a new client component to handle the redirect from XPay after a payment attempt.
        *   Uses `useSearchParams` to read `payment_token` and `status` from the URL.
        *   On successful payment status from XPay, it calls the `/api/payments/verify` frontend API route.
        *   If verification is successful, it calls `refreshUserProfile()` from `useAuth()` to update the user's credit balance in the UI.
        *   Displays appropriate messages to the user regarding payment status and redirects to the main page.
        *   Wrapped in `<Suspense>` due to `useSearchParams`.
        *   **Key Logic Snippet:**
          ```typescript
          // pmarena/frontend/app/payment/callback/page.tsx excerpt
          // ...
          if (paymentStatus === "success" && paymentToken) {
            // ... call /api/payments/verify ...
            if (response.ok && result.success) {
              setMessage("Credits successfully added! Redirecting...");
              if (refreshUserProfile) {
                await refreshUserProfile(); 
              }
            } 
          // ...
          }
          // ...
          ```

    *   **`pmarena/frontend/app/page.tsx` (Main Page UI):**
        *   Added state variables: `interviewCredits`, `isProcessingPayment`, `paymentError`, `isProcessingCreditUse`.
        *   Defined constants: `XPAY_VARIABLE_AMOUNT_ID` (set to `749` or environment variable), `CREDITS_PRICE_CENTS`, `CREDITS_TO_AWARD`, `PRODUCT_DESCRIPTION`.
        *   `useEffect` hook populates `interviewCredits` state from `profile.interview_credits` (via `useAuth`).
        *   **"Buy Credits" Functionality:**
            *   `handleBuyCredits` async function:
                *   Calls `/api/payments/create` with `{ amount_in_cents, product_description, variable_amount_id }`.
                *   Redirects to `payment_url` from XPay upon success.
                *   Displays a "Buy X Credits ($Y)" button, with loading/error states.
        *   **"Start Conversation" Logic:**
            *   `handleStartConversationClick` async function:
                *   Checks if `interviewCredits > 0`.
                *   Calls `/api/interviews/use-credit` with `userId`.
                *   On success, calls `refreshUserProfile()` to update credits, then calls `fetchConnectionDetails()` to initiate the LiveKit call.
                *   Button is disabled if credits are zero or an operation is in progress.
        *   **UI Display:**
            *   Shows "You have X interview credits" or "Loading credits...".
            *   Displays payment errors if any.

5.  **Frontend Component Modification (`pmarena/frontend/components/AgentControlButtons.tsx`):**
    *   The primary responsibility of this component regarding credits is simply calling the `onStartConversation` prop (which triggers the logic in `page.tsx`).

## Environment Variables Needed

*   **For Supabase Edge Functions:**
    *   `XPAY_API_KEY`: Your XPay API Key.
    *   `XPAY_COMMUNITY_ID`: Your XPay Community ID.
*   **For Next.js Frontend (as before):**
    *   `NEXT_PUBLIC_CONN_DETAILS_ENDPOINT`: (Existing) Endpoint for LiveKit connection details.
    *   `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL.
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous public key.
    *   (Optional) `NEXT_PUBLIC_XPAY_CREATE_ORDER_FUNCTION_URL`: URL of your `xpay-create-order` Edge Function if called directly from client.
    *   (Optional) `NEXT_PUBLIC_XPAY_VERIFY_PAYMENT_FUNCTION_URL`: URL of your `xpay-verify-payment` Edge Function if called directly from client.

## Notes

*   This implementation uses XPay's Direct Order API via Supabase Edge Functions.
*   Error handling is included but can be further enhanced within Edge Functions and frontend.
*   Supabase SQL functions (`increment_credits`, `decrement_credits`) are used for atomic database updates.
*   Credit consumption happens immediately when "Start a conversation" is clicked. 