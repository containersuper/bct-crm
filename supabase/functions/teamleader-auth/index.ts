import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TeamLeaderAuthRequest {
  action: 'authorize' | 'token';
  code?: string;
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
    console.log('=== TEAMLEADER AUTH START ===');
    
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

    console.log('User authenticated:', user.id);

    const { action, code }: TeamLeaderAuthRequest = await req.json();
    console.log('Action requested:', action);

    const clientId = Deno.env.get('TEAMLEADER_CLIENT_ID');
    const clientSecret = Deno.env.get('TEAMLEADER_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('TeamLeader credentials not configured');
    }

    console.log('Using Client ID:', clientId.substring(0, 8) + '...');

    let response;

    switch (action) {
      case 'authorize':
        const redirectUri = 'https://eea0dc2e-67b5-433a-93d5-671e25c26865.lovableproject.com/auth/callback/teamleader';
        const authUrl = `${TEAMLEADER_BASE_URL}/oauth2/authorize?` +
          `client_id=${clientId}&` +
          `response_type=code&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}`;
        
        console.log('Generated auth URL:', authUrl);
        
        response = { authUrl };
        break;

      case 'token':
        if (!code) {
          throw new Error('Authorization code is required');
        }

        console.log('Exchanging code for token...');

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
            redirect_uri: 'https://eea0dc2e-67b5-433a-93d5-671e25c26865.lovableproject.com/auth/callback/teamleader'
          })
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error('TeamLeader token error:', errorText);
          throw new Error(`Failed to get access token: ${errorText}`);
        }

        const tokenData: TeamLeaderTokenResponse = await tokenResponse.json();
        console.log('Token received successfully');

        // Store tokens in database - first delete any existing connections for this user
        const { error: deleteError } = await supabase
          .from('teamleader_connections')
          .delete()
          .eq('user_id', user.id);

        if (deleteError) {
          console.error('Error deleting old connections:', deleteError);
        }

        // Store new connection
        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
        
        const { error: dbError } = await supabase
          .from('teamleader_connections')
          .insert({
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

        console.log('Tokens stored successfully');
        response = { success: true, expiresAt };
        break;

      default:
        throw new Error('Invalid action');
    }

    console.log('=== TEAMLEADER AUTH SUCCESS ===');
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