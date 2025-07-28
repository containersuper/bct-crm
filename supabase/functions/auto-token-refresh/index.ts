import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find accounts with tokens expiring in the next 30 minutes
    const thirtyMinutesFromNow = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    
    const { data: expiringAccounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('provider', 'gmail')
      .eq('is_active', true)
      .lt('token_expires_at', thirtyMinutesFromNow)
      .not('refresh_token', 'is', null);

    if (accountsError) {
      throw new Error(`Failed to fetch expiring accounts: ${accountsError.message}`);
    }

    console.log(`Found ${expiringAccounts?.length || 0} accounts with expiring tokens`);

    const results = [];
    
    for (const account of expiringAccounts || []) {
      try {
        console.log(`Refreshing token for account ${account.email}`);
        
        // Call Gmail API to refresh token
        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: Deno.env.get('GMAIL_CLIENT_ID')!,
            client_secret: Deno.env.get('GMAIL_CLIENT_SECRET')!,
            refresh_token: account.refresh_token,
            grant_type: 'refresh_token'
          })
        });

        if (!refreshResponse.ok) {
          const errorData = await refreshResponse.text();
          throw new Error(`Token refresh failed: ${errorData}`);
        }

        const tokenData = await refreshResponse.json();
        
        // Calculate new expiry time (tokens usually expire in 1 hour)
        const expiresIn = tokenData.expires_in || 3600;
        const newExpiryTime = new Date(Date.now() + expiresIn * 1000).toISOString();

        // Update account with new token
        const { error: updateError } = await supabase
          .from('email_accounts')
          .update({
            access_token: tokenData.access_token,
            token_expires_at: newExpiryTime,
            updated_at: new Date().toISOString()
          })
          .eq('id', account.id);

        if (updateError) {
          throw new Error(`Failed to update account: ${updateError.message}`);
        }

        results.push({
          account_id: account.id,
          email: account.email,
          status: 'success',
          new_expiry: newExpiryTime
        });

        console.log(`Successfully refreshed token for ${account.email}`);

      } catch (error) {
        console.error(`Failed to refresh token for ${account.email}:`, error);
        
        // Mark account as inactive if refresh fails
        await supabase
          .from('email_accounts')
          .update({
            is_active: false,
            last_sync_error: `Token refresh failed: ${error.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', account.id);

        results.push({
          account_id: account.id,
          email: account.email,
          status: 'error',
          error: error.message
        });
      }
    }

    // Log metrics
    const successCount = results.filter(r => r.status === 'success').length;
    const failureCount = results.filter(r => r.status === 'error').length;

    await supabase
      .from('ai_performance_metrics')
      .insert({
        metric_type: 'token_refresh_completed',
        metric_value: successCount,
        context: { 
          total_accounts: results.length,
          success_count: successCount,
          failure_count: failureCount,
          results: results
        }
      });

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      success_count: successCount,
      failure_count: failureCount,
      results: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in auto-token-refresh:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});