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
    console.log('Starting AI analysis cron job...');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Refresh expiring tokens
    console.log('Step 1: Refreshing expiring tokens...');
    const tokenRefreshResponse = await supabase.functions.invoke('auto-token-refresh');
    const tokenRefreshResult = await tokenRefreshResponse.data;
    console.log('Token refresh result:', tokenRefreshResult);

    // Step 2: Sync new emails
    console.log('Step 2: Syncing emails...');
    const emailSyncResponse = await supabase.functions.invoke('sync-emails-cron');
    const emailSyncResult = await emailSyncResponse.data;
    console.log('Email sync result:', emailSyncResult);

    // Step 3: Analyze new emails
    console.log('Step 3: Analyzing emails...');
    const analysisResponse = await supabase.functions.invoke('claude-batch-analyzer', {
      body: { 
        batchSize: 50,
        forceReanalysis: false 
      }
    });
    const analysisResult = await analysisResponse.data;
    console.log('Analysis result:', analysisResult);

    // Step 4: Update customer intelligence
    console.log('Step 4: Updating customer intelligence...');
    
    // Get customers with recent email activity that need intelligence updates
    const { data: recentEmails, error: emailError } = await supabase
      .from('email_history')
      .select('customer_id')
      .gte('received_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .not('customer_id', 'is', null);

    if (!emailError && recentEmails && recentEmails.length > 0) {
      const uniqueCustomerIds = [...new Set(recentEmails.map(e => e.customer_id))];
      
      for (const customerId of uniqueCustomerIds) {
        try {
          await supabase.functions.invoke('claude-customer-intelligence', {
            body: { customerId }
          });
        } catch (error) {
          console.error(`Failed to update intelligence for customer ${customerId}:`, error);
        }
      }
    }

    // Log overall cron job metrics
    await supabase
      .from('ai_performance_metrics')
      .insert({
        metric_type: 'cron_job_completed',
        metric_value: 1,
        context: { 
          token_refresh: tokenRefreshResult,
          email_sync: emailSyncResult,
          analysis: analysisResult,
          timestamp: new Date().toISOString()
        }
      });

    return new Response(JSON.stringify({
      success: true,
      message: 'AI analysis cron job completed successfully',
      token_refresh: tokenRefreshResult,
      email_sync: emailSyncResult,
      analysis: analysisResult
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-analysis-cron:', error);
    
    // Log error metric
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase
        .from('ai_performance_metrics')
        .insert({
          metric_type: 'cron_job_error',
          metric_value: 1,
          context: { error: error.message, timestamp: new Date().toISOString() }
        });
    } catch (logError) {
      console.error('Failed to log error metric:', logError);
    }

    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});