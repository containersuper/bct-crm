import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      userId, 
      accountId,
      startDate, // YYYY-MM-DD format
      endDate,   // YYYY-MM-DD format
      action = 'start' // 'start', 'continue', 'status'
    } = await req.json();

    console.log('Email backfill request:', { userId, accountId, startDate, endDate, action });

    // Get email account
    const { data: account, error: accountError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (accountError || !account) {
      throw new Error('Email account not found or inactive');
    }

    if (action === 'status') {
      // Return backfill status for the account
      const { data: progress } = await supabase
        .from('email_backfill_progress')
        .select('*')
        .eq('email_account_id', accountId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      return new Response(JSON.stringify({
        success: true,
        progress: progress || []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check quota limit (don't start if already at 80% of daily quota)
    const quotaPercentage = (account.quota_usage || 0) / 1000000000; // 1B daily limit
    if (quotaPercentage > 0.8) {
      throw new Error('Daily quota limit reached. Please try again tomorrow.');
    }

    // Create date ranges for backfill (1 month chunks)
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dateRanges = [];
    
    let currentStart = new Date(start);
    while (currentStart < end) {
      const currentEnd = new Date(currentStart);
      currentEnd.setMonth(currentEnd.getMonth() + 1);
      if (currentEnd > end) {
        currentEnd.setTime(end.getTime());
      }
      
      dateRanges.push({
        start: currentStart.toISOString().split('T')[0],
        end: currentEnd.toISOString().split('T')[0]
      });
      
      currentStart = new Date(currentEnd);
      currentStart.setDate(currentStart.getDate() + 1);
    }

    console.log(`Created ${dateRanges.length} date ranges for backfill`);

    let totalProcessed = 0;
    let totalQuotaUsed = 0;

    for (const dateRange of dateRanges) {
      try {
        // Check if this date range is already processed
        const { data: existingProgress } = await supabase
          .from('email_backfill_progress')
          .select('*')
          .eq('email_account_id', accountId)
          .eq('start_date', dateRange.start)
          .eq('end_date', dateRange.end)
          .eq('status', 'completed')
          .maybeSingle();

        if (existingProgress) {
          console.log(`Date range ${dateRange.start} to ${dateRange.end} already completed, skipping`);
          continue;
        }

        // Create or update progress record
        const { data: progressRecord, error: progressError } = await supabase
          .from('email_backfill_progress')
          .upsert({
            user_id: userId,
            email_account_id: accountId,
            start_date: dateRange.start,
            end_date: dateRange.end,
            status: 'in_progress',
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,email_account_id,start_date,end_date'
          })
          .select()
          .single();

        if (progressError) {
          console.error('Error creating progress record:', progressError);
          continue;
        }

        // Call fetch-emails in backfill mode
        const { data: fetchResult, error: fetchError } = await supabase.functions.invoke('fetch-emails', {
          body: {
            userId,
            accountId,
            mode: 'backfill',
            backfillStartDate: dateRange.start,
            backfillEndDate: dateRange.end,
            maxResults: 100 // Smaller batches for backfill
          }
        });

        if (fetchError) {
          console.error('Fetch error for date range:', dateRange, fetchError);
          
          // Update progress record with error
          await supabase
            .from('email_backfill_progress')
            .update({
              status: 'failed',
              error_message: fetchError.message,
              updated_at: new Date().toISOString()
            })
            .eq('id', progressRecord.id);
          
          continue;
        }

        // Update progress record with success
        await supabase
          .from('email_backfill_progress')
          .update({
            status: 'completed',
            emails_processed: fetchResult.count || 0,
            quota_used: fetchResult.quotaUsed || 0,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', progressRecord.id);

        totalProcessed += fetchResult.count || 0;
        totalQuotaUsed += fetchResult.quotaUsed || 0;

        console.log(`Completed date range ${dateRange.start} to ${dateRange.end}: ${fetchResult.count} emails`);

        // Check quota after each range
        const updatedQuotaUsage = (account.quota_usage || 0) + totalQuotaUsed;
        const updatedQuotaPercentage = updatedQuotaUsage / 1000000000;
        
        if (updatedQuotaPercentage > 0.9) {
          console.log('Quota limit reached, stopping backfill');
          break;
        }

        // Add small delay between ranges to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error('Error processing date range:', dateRange, error);
        continue;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Backfill completed',
      totalProcessed,
      totalQuotaUsed,
      dateRangesProcessed: dateRanges.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Email backfill error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Email backfill failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});