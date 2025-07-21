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
    const { to, subject, body, attachments = [], replyTo, userId, templateId } = await req.json();

    console.log('Sending email for user:', userId, 'to:', to);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Email Account holen
    const { data: account, error: accountError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'gmail')
      .eq('is_active', true)
      .single();

    if (accountError || !account) {
      throw new Error('No email account connected');
    }

    // Check if token needs refresh
    if (account.token_expires_at && new Date(account.token_expires_at) <= new Date()) {
      console.log('Token expired, refreshing...');
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

    // Email formatieren
    const email = {
      to,
      subject,
      body,
      from: account.email,
    };

    // Gmail API Send
    const message = createMessage(email);
    
    console.log('Sending message via Gmail API...');

    const requestBody: any = {
      raw: message,
    };

    // If replying to a thread, include threadId
    if (replyTo?.threadId) {
      requestBody.threadId = replyTo.threadId;
    }

    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${account.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gmail send error:', response.status, errorText);
      throw new Error(`Failed to send email: ${response.status}`);
    }

    const result = await response.json();
    console.log('Email sent successfully:', result.id);

    // Email in History speichern
    const { error: historyError } = await supabase
      .from('email_history')
      .insert({
        subject,
        body,
        from_address: account.email,
        to_address: to,
        direction: 'outgoing',
        attachments: attachments.length > 0 ? attachments : null,
        external_id: result.id,
        thread_id: result.threadId,
        processed: true,
      });

    if (historyError) {
      console.warn('Failed to save email to history:', historyError);
    }

    // Track template performance if templateId is provided
    if (templateId) {
      try {
        const today = new Date().toISOString().split('T')[0];
        
        await supabase
          .from('email_template_performance')
          .upsert({
            template_id: templateId,
            date: today,
            emails_sent: 1,
          }, {
            onConflict: 'template_id,date',
            ignoreDuplicates: false
          });

        // If upsert doesn't work as expected, try increment
        await supabase.rpc('increment_template_performance', {
          template_id: templateId,
          metric: 'emails_sent',
          increment_value: 1
        });
      } catch (performanceError) {
        console.warn('Failed to track template performance:', performanceError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: result.id,
        threadId: result.threadId,
        labelIds: result.labelIds 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Send email error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

function createMessage(email: any): string {
  const messageParts = [
    `To: ${email.to}`,
    `From: ${email.from}`,
    `Subject: ${email.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    email.body,
  ];
  
  const message = messageParts.join('\n');
  
  // Convert to base64url encoding as required by Gmail API
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const base64 = btoa(String.fromCharCode(...data));
  
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}