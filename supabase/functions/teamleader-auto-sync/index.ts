import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting automated TeamLeader sync...');

    // Get all active TeamLeader connections
    const { data: connections, error: connectionsError } = await supabase
      .from('teamleader_connections')
      .select('*')
      .eq('is_active', true);

    if (connectionsError) {
      throw new Error(`Failed to get connections: ${connectionsError.message}`);
    }

    if (!connections || connections.length === 0) {
      console.log('No active TeamLeader connections found');
      return new Response(JSON.stringify({
        success: true,
        message: 'No active connections to sync'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${connections.length} active connections`);

    let totalSynced = 0;
    let totalErrors = 0;
    const errors: string[] = [];

    // Process each connection
    for (const connection of connections) {
      try {
        console.log(`Processing sync for user ${connection.user_id}`);

        // Check if token is expired
        const now = new Date();
        const expiresAt = new Date(connection.token_expires_at);
        
        if (now >= expiresAt) {
          console.log(`Token expired for user ${connection.user_id}, skipping...`);
          continue;
        }

        // Call the sync function with full sync enabled
        const syncResponse = await supabase.functions.invoke('teamleader-sync', {
          headers: {
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: {
            action: 'full_import',
            syncType: 'all',
            fullSync: true,
            batchSize: 200,
            maxPages: 25, // Limit for automated sync to avoid timeouts
            userId: connection.user_id // Pass user context for service role calls
          }
        });

        if (syncResponse.error) {
          console.error(`Sync failed for user ${connection.user_id}:`, syncResponse.error);
          errors.push(`User ${connection.user_id}: ${syncResponse.error.message}`);
          totalErrors++;
        } else {
          console.log(`Sync completed for user ${connection.user_id}`, syncResponse.data);
          totalSynced++;
        }

        // Small delay between users to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (userError) {
        console.error(`Error processing user ${connection.user_id}:`, userError);
        errors.push(`User ${connection.user_id}: ${userError.message}`);
        totalErrors++;
      }
    }

    console.log(`Auto-sync completed. Synced: ${totalSynced}, Errors: ${totalErrors}`);

    return new Response(JSON.stringify({
      success: true,
      synced: totalSynced,
      errors: totalErrors,
      details: errors.length > 0 ? errors : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Auto-sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});