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

    const { brand, provider = 'gmail', userId, maxResults = 50 } = await req.json();

    console.log('Fetching emails for user:', userId, 'brand:', brand, 'provider:', provider);

    // Email Account Credentials holen
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

    if (provider === 'gmail') {
      // Check if token needs refresh
      if (account.token_expires_at && new Date(account.token_expires_at) <= new Date()) {
        console.log('Token expired, refreshing...');
        // Call refresh token function
        await supabase.functions.invoke('gmail-auth', {
          body: { action: 'refresh-token', userId }
        });
        
        // Get updated account
        const { data: updatedAccount } = await supabase
          .from('email_accounts')
          .select('*')
          .eq('id', account.id)
          .single();
        
        if (updatedAccount) {
          account.access_token = updatedAccount.access_token;
        }
      }

      // Build Gmail search query with improved brand detection
      let query = 'in:inbox';
      if (brand && brand !== 'all') {
        const brandQuery = `to:${brand.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        query += ` ${brandQuery}`;
      }

      console.log('Gmail query:', query);

      // Gmail API aufrufen with better error handling
      const messagesUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(query)}`;
      
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
      console.log('Found messages:', messages?.length || 0);

      // Email Details abrufen
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
            console.warn('Failed to fetch message details for:', message.id);
            continue;
          }

          const detail = await detailResponse.json();
          const headers = detail.payload?.headers || [];

          const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';
          const toHeader = headers.find((h: any) => h.name.toLowerCase() === 'to')?.value || '';
          const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '';
          const dateHeader = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || '';

          // Extract email body
          let emailBody = detail.snippet || '';
          if (detail.payload?.body?.data) {
            try {
              emailBody = atob(detail.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            } catch (e) {
              console.warn('Failed to decode email body for message:', detail.id);
            }
          }

          emails.push({
            id: detail.id,
            subject: subjectHeader,
            from: fromHeader,
            to: toHeader,
            date: dateHeader,
            snippet: emailBody,
            brand: detectBrand(toHeader),
            threadId: detail.threadId,
            labelIds: detail.labelIds || [],
            isUnread: detail.labelIds?.includes('UNREAD') || false,
          });
        } catch (error) {
          console.warn('Error processing message:', message.id, error);
        }
      }
    }

    console.log('Processed emails:', emails.length);

    // Emails in Supabase speichern/aktualisieren
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

    return new Response(
      JSON.stringify({ 
        emails, 
        count: emails.length,
        account: {
          email: account.email,
          provider: account.provider
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Fetch emails error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
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