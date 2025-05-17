// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Restrict this to your frontend domain in production
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
} 