import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== SIMPLE TEAMLEADER TEST ===');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user
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

    // Get TeamLeader connection
    const { data: connections, error: connError } = await supabase
      .from('teamleader_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1);

    if (connError || !connections || connections.length === 0) {
      throw new Error('No TeamLeader connection found. Please connect first.');
    }

    const connection = connections[0];
    console.log('Connection found, testing API...');

    // Simple test API call to see if connection works
    const testResponse = await fetch('https://api.focus.teamleader.eu/contacts.list', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page: { size: 5 }
      })
    });

    const responseText = await testResponse.text();
    console.log('API Response Status:', testResponse.status);
    console.log('API Response:', responseText);

    if (!testResponse.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: `TeamLeader API returned ${testResponse.status}`,
        details: responseText,
        message: 'Connection test failed. Please reconnect to TeamLeader.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = JSON.parse(responseText);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Connection test successful!',
      contactsFound: data.data?.length || 0,
      connectionDetails: {
        expires: connection.token_expires_at,
        isActive: connection.is_active
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Test error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});