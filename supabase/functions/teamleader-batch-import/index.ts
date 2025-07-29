import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log(`[BATCH-IMPORT] ${req.method} ${req.url}`);
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error('Missing Supabase environment variables');
    }

    console.log('[BATCH-IMPORT] Environment variables found');

    // Parse request
    const body = await req.json();
    const { importType, batchSize = 100 } = body;
    
    console.log(`[BATCH-IMPORT] Request: ${importType}, batchSize: ${batchSize}`);

    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No Authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('[BATCH-IMPORT] Token extracted');

    // Verify user (simple fetch)
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_KEY
      }
    });

    if (!userResponse.ok) {
      throw new Error('Authentication failed');
    }

    const user = await userResponse.json();
    console.log(`[BATCH-IMPORT] User authenticated: ${user.id}`);

    // Check TeamLeader connection (simple fetch)
    const connectionResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/teamleader_connections?user_id=eq.${user.id}&is_active=eq.true&select=access_token`, 
      {
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'apikey': SUPABASE_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!connectionResponse.ok) {
      throw new Error('Failed to get TeamLeader connection');
    }

    const connections = await connectionResponse.json();
    
    if (!connections || connections.length === 0) {
      throw new Error('No active TeamLeader connection found');
    }

    const accessToken = connections[0].access_token;
    console.log('[BATCH-IMPORT] TeamLeader connection found');

    // Get TeamLeader data (simple test)
    const teamleaderUrl = `https://api.teamleader.eu/contacts.list?page[size]=5&page[number]=1`;
    
    const teamleaderResponse = await fetch(teamleaderUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!teamleaderResponse.ok) {
      throw new Error(`TeamLeader API error: ${teamleaderResponse.status}`);
    }

    const teamleaderData = await teamleaderResponse.json();
    const records = teamleaderData.data || [];
    
    console.log(`[BATCH-IMPORT] TeamLeader returned ${records.length} records`);

    // For now, just return the count without storing
    const response = {
      success: true,
      imported: records.length,
      errors: [],
      hasMore: false,
      message: `Successfully connected to TeamLeader and found ${records.length} ${importType}`,
      debug: {
        userId: user.id,
        importType,
        recordCount: records.length,
        timestamp: new Date().toISOString()
      }
    };

    console.log(`[BATCH-IMPORT] Returning success response`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`[BATCH-IMPORT] Error:`, error.message);
    console.error(`[BATCH-IMPORT] Stack:`, error.stack);

    const errorResponse = {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});