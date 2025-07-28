import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TeamLeaderAuthRequest {
  action: 'authorize' | 'token' | 'refresh';
  code?: string;
  refreshToken?: string;
}

interface TeamLeaderTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

const TEAMLEADER_BASE_URL = 'https://app.teamleader.eu';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication token');
    }

    const { action, code, refreshToken }: TeamLeaderAuthRequest = await req.json();

    const clientId = Deno.env.get('TEAMLEADER_CLIENT_ID');
    const clientSecret = Deno.env.get('TEAMLEADER_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('TeamLeader credentials not configured');
    }

    let response;

    switch (action) {
      case 'authorize':
        // Return the authorization URL
        const authUrl = `${TEAMLEADER_BASE_URL}/oauth2/authorize?` +
          `client_id=${clientId}&` +
          `response_type=code&` +
          `redirect_uri=${encodeURIComponent('https://eea0dc2e-67b5-433a-93d5-671e25c26865.lovableproject.com/crm')}&` +
          `scope=contacts:read contacts:write companies:read companies:write`;
        
        response = { authUrl };
        break;

      case 'token':
        if (!code) {
          throw new Error('Authorization code is required');
        }

        // Exchange authorization code for access token
        const tokenResponse = await fetch(`${TEAMLEADER_BASE_URL}/oauth2/access_token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: 'https://eea0dc2e-67b5-433a-93d5-671e25c26865.lovableproject.com/crm'
          })
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error('TeamLeader token error:', errorText);
          throw new Error(`Failed to get access token: ${errorText}`);
        }

        const tokenData: TeamLeaderTokenResponse = await tokenResponse.json();

        // Store tokens in database
        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
        
        const { error: dbError } = await supabase
          .from('teamleader_connections')
          .upsert({
            user_id: user.id,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_expires_at: expiresAt.toISOString(),
            is_active: true
          });

        if (dbError) {
          console.error('Database error:', dbError);
          throw new Error('Failed to store tokens');
        }

        response = { success: true, expiresAt };
        break;

      case 'refresh':
        if (!refreshToken) {
          throw new Error('Refresh token is required');
        }

        // Refresh access token
        const refreshResponse = await fetch(`${TEAMLEADER_BASE_URL}/oauth2/access_token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
          })
        });

        if (!refreshResponse.ok) {
          const errorText = await refreshResponse.text();
          console.error('TeamLeader refresh error:', errorText);
          throw new Error(`Failed to refresh token: ${errorText}`);
        }

        const refreshData: TeamLeaderTokenResponse = await refreshResponse.json();

        // Update tokens in database
        const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000);
        
        const { error: updateError } = await supabase
          .from('teamleader_connections')
          .update({
            access_token: refreshData.access_token,
            refresh_token: refreshData.refresh_token,
            token_expires_at: newExpiresAt.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);

        if (updateError) {
          console.error('Database update error:', updateError);
          throw new Error('Failed to update tokens');
        }

        response = { success: true, expiresAt: newExpiresAt };
        break;

      default:
        throw new Error('Invalid action');
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('TeamLeader auth error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});