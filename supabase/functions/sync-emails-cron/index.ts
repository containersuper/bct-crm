import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting scheduled email sync...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active email accounts that need syncing
    const { data: accounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('is_active', true)
      .eq('sync_status', 'active')
      .lt('sync_error_count', 5); // Skip accounts with too many errors

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      throw accountsError;
    }

    if (!accounts || accounts.length === 0) {
      console.log('No active accounts to sync');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No active accounts to sync',
        syncedAccounts: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${accounts.length} accounts to sync`);
    
    const syncResults = [];
    
    // Process accounts sequentially to avoid rate limits
    for (const account of accounts) {
      try {
        console.log(`Syncing account: ${account.email}`);
        
        // Check quota limits (Gmail allows 250 quota units per user per 100 seconds)
        const quotaResetTime = new Date(account.last_quota_reset || account.created_at);
        const now = new Date();
        const timeSinceReset = now.getTime() - quotaResetTime.getTime();
        
        // Reset quota if more than 100 seconds have passed
        if (timeSinceReset > 100000) {
          await supabase
            .from('email_accounts')
            .update({ 
              quota_usage: 0,
              last_quota_reset: now.toISOString()
            })
            .eq('id', account.id);
          account.quota_usage = 0;
        }
        
        // Skip if quota exceeded
        if (account.quota_usage >= 200) { // Leave some buffer
          console.log(`Skipping account ${account.email} - quota limit reached`);
          syncResults.push({
            email: account.email,
            status: 'skipped',
            reason: 'quota_limit'
          });
          continue;
        }

        // Call the fetch-emails function for this account
        const fetchResponse = await supabase.functions.invoke('fetch-emails', {
          body: {
            userId: account.user_id,
            provider: account.provider,
            brand: null, // Sync all emails
            maxResults: 50 // Smaller batches for cron jobs
          }
        });

        if (fetchResponse.error) {
          throw fetchResponse.error;
        }

        const result = fetchResponse.data;
        syncResults.push({
          email: account.email,
          status: 'success',
          emailsSynced: result.count || 0
        });

        console.log(`Successfully synced ${result.count || 0} emails for ${account.email}`);
        
        // Add delay between accounts to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`Error syncing account ${account.email}:`, error);
        
        // Update error count
        await supabase
          .from('email_accounts')
          .update({ 
            sync_error_count: (account.sync_error_count || 0) + 1,
            last_sync_error: error.message || 'Unknown error'
          })
          .eq('id', account.id);
        
        syncResults.push({
          email: account.email,
          status: 'error',
          error: error.message
        });
      }
    }

    const successCount = syncResults.filter(r => r.status === 'success').length;
    const errorCount = syncResults.filter(r => r.status === 'error').length;
    const skippedCount = syncResults.filter(r => r.status === 'skipped').length;

    console.log(`Sync completed - Success: ${successCount}, Errors: ${errorCount}, Skipped: ${skippedCount}`);

    return new Response(JSON.stringify({
      success: true,
      syncedAccounts: successCount,
      errors: errorCount,
      skipped: skippedCount,
      results: syncResults
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in sync-emails-cron function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});