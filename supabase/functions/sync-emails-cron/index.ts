import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DatabaseEmailAccount {
  id: string;
  user_id: string;
  provider: string;
  email: string;
  is_active: boolean;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  last_sync_timestamp: string | null;
  sync_status: string | null;
  quota_usage: number;
  last_quota_reset: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting automated email sync...')

    // Get all active email accounts
    const { data: accounts, error: accountsError } = await supabaseClient
      .from('email_accounts')
      .select('*')
      .eq('is_active', true)

    if (accountsError) {
      console.error('Error fetching email accounts:', accountsError)
      return new Response(JSON.stringify({ error: 'Failed to fetch email accounts' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!accounts || accounts.length === 0) {
      console.log('No active email accounts found')
      return new Response(JSON.stringify({ message: 'No active accounts to sync' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`Found ${accounts.length} active email accounts`)

    const syncResults = []

    // Process each account
    for (const account of accounts as DatabaseEmailAccount[]) {
      try {
        console.log(`Starting sync for account: ${account.email}`)
        
        // Update sync status to 'syncing'
        await supabaseClient
          .from('email_accounts')
          .update({ 
            sync_status: 'syncing',
            sync_error_count: 0,
            last_sync_error: null
          })
          .eq('id', account.id)

        // Check quota limits (Gmail allows 250 quota units per user per second, 1 billion per day)
        const quotaResetNeeded = account.last_quota_reset ? 
          new Date(account.last_quota_reset).getTime() < new Date().getTime() - (24 * 60 * 60 * 1000) : 
          true

        if (quotaResetNeeded) {
          await supabaseClient
            .from('email_accounts')
            .update({ 
              quota_usage: 0,
              last_quota_reset: new Date().toISOString()
            })
            .eq('id', account.id)
          account.quota_usage = 0
        }

        // Skip if quota is too high (conservative limit: 80% of daily quota)
        if (account.quota_usage > 800000000) { // 800M out of 1B daily limit
          console.log(`Skipping ${account.email} - quota limit reached`)
          await supabaseClient
            .from('email_accounts')
            .update({ sync_status: 'quota_limited' })
            .eq('id', account.id)
          continue
        }

        // Determine sync parameters
        const maxResults = 50 // Conservative batch size
        const brand = 'General' // Default brand for cron sync

        // Calculate incremental sync date
        let sinceDate = null
        if (account.last_sync_timestamp) {
          const lastSync = new Date(account.last_sync_timestamp)
          // Subtract 1 hour for overlap to ensure no emails are missed
          sinceDate = new Date(lastSync.getTime() - (60 * 60 * 1000))
        }

        // Call the fetch-emails function
        const { data: syncResult, error: syncError } = await supabaseClient.functions.invoke('fetch-emails', {
          body: { 
            provider: account.provider,
            userId: account.user_id,
            brand: brand,
            maxResults: maxResults,
            sinceDate: sinceDate?.toISOString(),
            accountId: account.id
          }
        })

        if (syncError) {
          console.error(`Sync error for ${account.email}:`, syncError)
          
          // Increment error count and update status
          const newErrorCount = (account.sync_error_count || 0) + 1
          await supabaseClient
            .from('email_accounts')
            .update({ 
              sync_status: newErrorCount >= 5 ? 'error' : 'idle',
              sync_error_count: newErrorCount,
              last_sync_error: syncError.message || 'Unknown error'
            })
            .eq('id', account.id)

          syncResults.push({
            email: account.email,
            status: 'error',
            error: syncError.message
          })
          continue
        }

        // Update successful sync
        const emailCount = syncResult?.emails?.length || 0
        const quotaUsed = emailCount * 5 // Estimate 5 quota units per email
        
        await supabaseClient
          .from('email_accounts')
          .update({ 
            sync_status: 'idle',
            last_sync_timestamp: new Date().toISOString(),
            quota_usage: account.quota_usage + quotaUsed,
            sync_error_count: 0,
            last_sync_error: null
          })
          .eq('id', account.id)

        console.log(`Successfully synced ${emailCount} emails for ${account.email}`)
        
        syncResults.push({
          email: account.email,
          status: 'success',
          emailCount: emailCount,
          quotaUsed: quotaUsed
        })

        // Add delay between accounts to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 2000))

      } catch (error) {
        console.error(`Error syncing account ${account.email}:`, error)
        
        await supabaseClient
          .from('email_accounts')
          .update({ 
            sync_status: 'error',
            sync_error_count: (account.sync_error_count || 0) + 1,
            last_sync_error: error.message || 'Unknown error'
          })
          .eq('id', account.id)

        syncResults.push({
          email: account.email,
          status: 'error',
          error: error.message
        })
      }
    }

    const successCount = syncResults.filter(r => r.status === 'success').length
    const totalEmails = syncResults.reduce((sum, r) => sum + (r.emailCount || 0), 0)

    console.log(`Sync completed: ${successCount}/${accounts.length} accounts successful, ${totalEmails} emails processed`)

    return new Response(JSON.stringify({
      success: true,
      message: 'Automated sync completed',
      accountsProcessed: accounts.length,
      successfulSyncs: successCount,
      totalEmailsProcessed: totalEmails,
      results: syncResults
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in sync-emails-cron:', error)
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Automated email sync failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})