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
      brand, 
      provider = 'gmail', 
      userId, 
      maxResults = 50, 
      sinceDate, 
      accountId,
      mode = 'incremental', // 'incremental' or 'backfill'
      backfillStartDate,
      backfillEndDate,
      pageToken 
    } = await req.json();

    console.log('Fetching emails for user:', userId, 'mode:', mode, 'provider:', provider);

    // Get email account credentials - if multiple accounts, use the first active one
    let query = supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('is_active', true);

    // If accountId is specified, filter by it
    if (accountId) {
      query = query.eq('id', accountId);
    }

    const { data: accounts, error: accountError } = await query;

    if (accountError) {
      console.error('Error fetching email account:', accountError);
      throw new Error('Error fetching email account');
    }
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No email account connected');
    }

    // Use the first account or the specified account
    const account = accounts[0];

    let emails = [];
    let quotaUsed = 0;
    let nextPageToken = null;

    if (provider === 'gmail') {
      // Refresh access token if expired
      if (account.token_expires_at && new Date(account.token_expires_at) <= new Date()) {
        console.log('Token expired, refreshing...')
        
        const { data: refreshResult, error: refreshError } = await supabase.functions.invoke('gmail-auth', {
          body: { 
            action: 'refresh',
            refresh_token: account.refresh_token,
            user_id: userId 
          }
        })

        if (refreshError || !refreshResult) {
          console.error('Token refresh failed:', refreshError)
          return new Response(JSON.stringify({ error: 'Token refresh failed' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Update the access token in database
        await supabase
          .from('email_accounts')
          .update({
            access_token: refreshResult.access_token,
            token_expires_at: refreshResult.expires_at
          })
          .eq('id', account.id)

        // Update local object
        account.access_token = refreshResult.access_token
        if (refreshResult.expires_at) {
          account.token_expires_at = refreshResult.expires_at
        }
      }

      // Build Gmail query based on mode
      let query = '';
      
      if (mode === 'backfill' && backfillStartDate && backfillEndDate) {
        // Backfill mode: use specific date range
        const startUnix = Math.floor(new Date(backfillStartDate).getTime() / 1000);
        const endUnix = Math.floor(new Date(backfillEndDate).getTime() / 1000);
        query = `after:${startUnix} before:${endUnix}`;
        
        console.log('Backfill mode:', backfillStartDate, 'to', backfillEndDate);
      } else {
        // Incremental mode: use last sync timestamp
        const lastSync = account.last_sync_timestamp ? new Date(account.last_sync_timestamp) : null;
        const sinceDateStr = lastSync ? Math.floor(lastSync.getTime() / 1000) : Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
        query = `after:${sinceDateStr}`;
        
        console.log('Incremental mode since:', new Date(sinceDateStr * 1000));
      }
      
      if (brand && brand !== 'General') {
        query += ` ${brand}`;
      }
      query += ' label:inbox';

      console.log('Gmail query:', query);

      // Build API URL with pagination support
      let messagesUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(query)}`;
      if (pageToken) {
        messagesUrl += `&pageToken=${pageToken}`;
      }
      
      quotaUsed += 1; // List messages costs 1 quota unit
      
      const response = await fetch(messagesUrl, {
        headers: {
          'Authorization': `Bearer ${account.access_token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gmail API error:', response.status, errorText);
        
        if (response.status === 401) {
          throw new Error('Gmail access token expired. Please reconnect your account.');
        } else if (response.status === 403) {
          throw new Error('Gmail API access denied. Please check your permissions.');
        } else {
          throw new Error(`Gmail API error (${response.status}): ${errorText}`);
        }
      }

      const responseData = await response.json();
      const { messages, nextPageToken: newNextPageToken } = responseData;
      nextPageToken = newNextPageToken;
      
      console.log(`Found ${messages?.length || 0} messages to process`)

      // Check for existing emails in batch to optimize performance
      const messageIds = (messages || []).map((m: any) => m.id);
      const { data: existingEmails } = await supabase
        .from('email_history')
        .select('external_id')
        .in('external_id', messageIds);
      
      const existingIds = new Set(existingEmails?.map(e => e.external_id) || []);

      // Process email details for new emails only
      for (const message of messages || []) {
        try {
          // Skip if email already exists
          if (existingIds.has(message.id)) {
            console.log('Email already exists, skipping:', message.id);
            continue;
          }

          const detailResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
            {
              headers: {
                'Authorization': `Bearer ${account.access_token}`,
              },
            }
          );

          if (!detailResponse.ok) {
            console.warn(`Failed to fetch email ${message.id}:`, detailResponse.status)
            continue;
          }

          const messageData = await detailResponse.json();
          quotaUsed += 5; // Estimate 5 quota units per email fetch

          const headers = messageData.payload?.headers || [];
          const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';
          const toHeader = headers.find((h: any) => h.name.toLowerCase() === 'to')?.value || '';
          const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '';
          const dateHeader = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || '';

          // Extract email body with better handling
          let emailBody = messageData.snippet || '';
          if (messageData.payload?.body?.data) {
            try {
              emailBody = atob(messageData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            } catch (e) {
              console.warn('Failed to decode email body for message:', messageData.id);
            }
          }

          emails.push({
            id: messageData.id,
            subject: subjectHeader,
            from: fromHeader,
            to: toHeader,
            date: dateHeader,
            snippet: emailBody,
            brand: detectBrand(toHeader),
            threadId: messageData.threadId,
            labelIds: messageData.labelIds || [],
            isUnread: messageData.labelIds?.includes('UNREAD') || false,
          });
        } catch (error) {
          console.warn('Error processing message:', message.id, error);
        }
      }
    }

    console.log(`Processed ${emails.length} new emails with ${quotaUsed} quota units used`);

    // Batch insert emails to database for better performance
    if (emails.length > 0) {
      const emailsToInsert = emails.map(email => ({
        external_id: email.id,
        subject: email.subject,
        from_address: email.from,
        to_address: email.to,
        body: email.snippet,
        brand: email.brand,
        received_at: email.date ? new Date(email.date).toISOString() : new Date().toISOString(),
        direction: 'incoming',
        processed: false,
        thread_id: email.threadId,
        attachments: null,
      }));

      const { error: insertError } = await supabase
        .from('email_history')
        .insert(emailsToInsert);

      if (insertError) {
        console.error('Error batch inserting emails:', insertError);
        throw new Error('Failed to save emails to database');
      }

      console.log(`Successfully batch inserted ${emails.length} emails`);
    }

    // Update account sync status and timestamps
    const updateData: any = {
      quota_usage: (account.quota_usage || 0) + quotaUsed,
      sync_error_count: 0,
      last_sync_error: null
    };

    if (mode === 'incremental') {
      updateData.last_sync_timestamp = new Date().toISOString();
    } else if (mode === 'backfill') {
      updateData.last_backfill_timestamp = new Date().toISOString();
    }

    await supabase
      .from('email_accounts')
      .update(updateData)
      .eq('id', account.id);

    console.log(`Fetched ${emails.length} emails for user ${userId}`);
    return new Response(JSON.stringify({
      success: true,
      emails,
      count: emails.length,
      quotaUsed,
      nextPageToken,
      hasMore: !!nextPageToken,
      account: { 
        provider: account.provider, 
        email: account.email 
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Fetch emails error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Email fetch failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function detectBrand(toAddress: string): string {
  const address = toAddress.toLowerCase();
  
  // Common email patterns for brand detection
  if (address.includes('support@') || address.includes('info@') || address.includes('hello@')) {
    const domain = address.split('@')[1]?.split('.')[0];
    if (domain) {
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    }
  }
  
  // Fallback brand detection
  if (address.includes('brand1') || address.includes('brand-1')) return 'Brand 1';
  if (address.includes('brand2') || address.includes('brand-2')) return 'Brand 2';
  if (address.includes('brand3') || address.includes('brand-3')) return 'Brand 3';
  if (address.includes('brand4') || address.includes('brand-4')) return 'Brand 4';
  
  return 'General';
}