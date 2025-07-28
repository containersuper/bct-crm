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

    // Parse request body once and reuse
    const requestBody = await req.json();
    const { action } = requestBody;

    if (action === 'auth-url') {
      const redirectUri = `https://eea0dc2e-67b5-433a-93d5-671e25c26865.lovableproject.com/auth/callback/gmail`;
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${Deno.env.get('GMAIL_CLIENT_ID')}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email')}&` +
        `access_type=offline&` +
        `prompt=consent`;

      console.log('Generated auth URL with redirect:', redirectUri);

      return new Response(
        JSON.stringify({ authUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'callback') {
      const { code, userId } = requestBody;
      
      const redirectUri = `https://eea0dc2e-67b5-433a-93d5-671e25c26865.lovableproject.com/auth/callback/gmail`;
      
      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: Deno.env.get('GMAIL_CLIENT_ID') ?? '',
          client_secret: Deno.env.get('GMAIL_CLIENT_SECRET') ?? '',
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      console.log('Token response status:', tokenResponse.status);
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token exchange failed:', errorText);
        throw new Error(`Token exchange failed: ${errorText}`);
      }

      const tokens = await tokenResponse.json();
      console.log('Tokens received successfully');

      if (!tokens.access_token) {
        console.error('No access token in response:', tokens);
        throw new Error(tokens.error_description || 'Failed to obtain access token');
      }

      // Get user email from Google API
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
        },
      });

      if (!userInfoResponse.ok) {
        console.error('Failed to get user info:', userInfoResponse.status);
        throw new Error('Failed to get user information from Google');
      }

      const userInfo = await userInfoResponse.json();
      console.log('User info retrieved:', userInfo.email);

      // Token expiry time
      const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

      // Store token in Supabase
      const { error } = await supabase
        .from('email_accounts')
        .upsert({
          provider: 'gmail',
          email: userInfo.email,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          user_id: userId,
          is_active: true,
        });

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      console.log('Successfully stored Gmail account');

      return new Response(
        JSON.stringify({ success: true, email: userInfo.email }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'refresh-token') {
      const { userId, accountId } = requestBody;

      // Get specific account if accountId provided, otherwise get first active account
      let query = supabase
        .from('email_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'gmail')
        .eq('is_active', true);

      if (accountId) {
        query = query.eq('id', accountId);
      }

      const { data: accounts, error: selectError } = await query;

      if (selectError || !accounts || accounts.length === 0) {
        throw new Error('No active Gmail account found');
      }

      const account = accounts[0];

      if (!account?.refresh_token) {
        throw new Error('No refresh token found');
      }

      // Refresh the access token
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: account.refresh_token,
          client_id: Deno.env.get('GMAIL_CLIENT_ID') ?? '',
          client_secret: Deno.env.get('GMAIL_CLIENT_SECRET') ?? '',
          grant_type: 'refresh_token',
        }),
      });

      const tokens = await refreshResponse.json();

      if (!tokens.access_token) {
        throw new Error('Failed to refresh access token');
      }

      const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

      // Update token in database
      const { error: updateError } = await supabase
        .from('email_accounts')
        .update({
          access_token: tokens.access_token,
          token_expires_at: expiresAt.toISOString(),
        })
        .eq('id', account.id);

      if (updateError) {
        throw updateError;
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    console.error('Gmail auth error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});