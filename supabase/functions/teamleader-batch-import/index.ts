import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log("=== TEAMLEADER BATCH IMPORT START ===");
  console.log(`Method: ${req.method}`);
  console.log(`URL: ${req.url}`);
  console.log(`Headers:`, Object.fromEntries(req.headers.entries()));
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Step 1: Checking environment variables");
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log(`SUPABASE_URL exists: ${!!SUPABASE_URL}`);
    console.log(`SUPABASE_KEY exists: ${!!SUPABASE_KEY}`);

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error("Missing environment variables");
      throw new Error('Missing Supabase environment variables');
    }

    console.log("Step 2: Parsing request body");
    let body;
    try {
      body = await req.json();
      console.log("Request body:", body);
    } catch (e) {
      console.error("Failed to parse JSON:", e);
      throw new Error('Invalid JSON body');
    }

    console.log("Step 3: Extracting auth header");
    const authHeader = req.headers.get('Authorization');
    console.log(`Auth header exists: ${!!authHeader}`);
    
    if (!authHeader) {
      console.error("No authorization header");
      throw new Error('No Authorization header');
    }

    console.log("Step 4: SUCCESS - Returning test response");
    
    const response = {
      success: true,
      imported: 0,
      errors: [],
      hasMore: false,
      message: "Edge function is working correctly",
      debug: {
        method: req.method,
        hasAuth: !!authHeader,
        hasBody: !!body,
        timestamp: new Date().toISOString(),
        env: {
          hasSupabaseUrl: !!SUPABASE_URL,
          hasSupabaseKey: !!SUPABASE_KEY
        }
      }
    };

    console.log("Sending response:", response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("=== ERROR CAUGHT ===");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("Error name:", error.name);

    const errorResponse = {
      success: false,
      error: error.message,
      stack: error.stack,
      name: error.name,
      timestamp: new Date().toISOString()
    };

    console.log("Sending error response:", errorResponse);

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } finally {
    console.log("=== TEAMLEADER BATCH IMPORT END ===");
  }
});