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

    const { brand, provider = 'gmail', userId, maxResults = 50, sinceDate, accountId } = await req.json();

    console.log('Fetching emails for user:', userId, 'brand:', brand, 'provider:', provider, 'sinceDate:', sinceDate);

    // Get email account credentials
    const { data: account, error: accountError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('is_active', true)
      .maybeSingle();

    if (accountError) {
      console.error('Error fetching email account:', accountError);
      throw new Error('Error fetching email account');
    }
    
    if (!account) {
      throw new Error('No email account connected');
    }

    let emails = [];
    let quotaUsed = 0;

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

      // Build Gmail API query for incremental sync
      let query = `in:inbox`
      
      // Add date filter for incremental sync
      if (sinceDate) {
        const since = new Date(sinceDate)
        const formattedDate = since.toISOString().split('T')[0].replace(/-/g, '/')
        query += ` after:${formattedDate}`
        console.log(`Incremental sync since: ${formattedDate}`)
      }
      
      if (brand && brand !== 'General') {
        // Add brand-specific filtering
        query += ` (to:${brand.toLowerCase()}@* OR to:support@${brand.toLowerCase()}.* OR to:info@${brand.toLowerCase()}.*)`
      }

      console.log('Gmail query:', query);

      // Call Gmail API with error handling
      const messagesUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(query)}`;
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

      const { messages } = await response.json();
      console.log(`Found ${messages?.length || 0} messages to process`)

      // Process email details
      for (const message of messages || []) {
        try {
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

    console.log(`Processed ${emails.length} emails with ${quotaUsed} quota units used`);

    // Save emails to database with duplicate checking
    for (const email of emails) {
      try {
        const emailDate = email.date ? new Date(email.date) : new Date();
        
        // Check if email already exists
        const { data: existingEmail } = await supabase
          .from('email_history')
          .select('id')
          .eq('external_id', email.id)
          .maybeSingle();

        if (!existingEmail) {
          // Insert new email
          const { error: insertError } = await supabase
            .from('email_history')
            .insert({
              external_id: email.id,
              subject: email.subject,
              from_address: email.from,
              to_address: email.to,
              body: email.snippet,
              brand: email.brand,
              received_at: emailDate.toISOString(),
              direction: 'incoming',
              processed: false,
              thread_id: email.threadId,
              attachments: null,
            });

          if (insertError) {
            console.error('Error inserting email:', email.id, insertError);
          } else {
            console.log('Successfully inserted email:', email.id);
          }
        } else {
          console.log('Email already exists:', email.id);
        }
      } catch (error) {
        console.error('Error saving email to database:', email.id, error);
      }
    }

    // Update quota usage if accountId provided (for cron sync)
    if (accountId && quotaUsed > 0) {
      await supabase
        .from('email_accounts')
        .update({ 
          quota_usage: supabase.raw(`quota_usage + ${quotaUsed}`)
        })
        .eq('id', accountId);
    }

    return new Response(JSON.stringify({
      success: true,
      emails,
      count: emails.length,
      quotaUsed,
      account: {
        email: account.email,
        provider: account.provider
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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