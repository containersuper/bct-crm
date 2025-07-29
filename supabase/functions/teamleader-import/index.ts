import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportRequest {
  type: 'contacts' | 'companies' | 'deals';
  limit?: number;
}

const TEAMLEADER_API_URL = 'https://api.focus.teamleader.eu';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== TEAMLEADER IMPORT START ===');

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
      throw new Error('No active TeamLeader connection found');
    }

    const connection = connections[0];
    console.log('Found TeamLeader connection');

    const { type, limit = 50 }: ImportRequest = await req.json();
    console.log(`Importing ${type} (limit: ${limit})`);

    // Make API call to TeamLeader
    let endpoint = '';
    switch (type) {
      case 'contacts':
        endpoint = '/contacts.list';
        break;
      case 'companies':
        endpoint = '/companies.list';
        break;
      case 'deals':
        endpoint = '/deals.list';
        break;
      default:
        throw new Error('Invalid import type');
    }

    const response = await fetch(`${TEAMLEADER_API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page: {
          size: limit
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TeamLeader API error:', response.status, errorText);
      throw new Error(`TeamLeader API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`Retrieved ${data.data?.length || 0} ${type} from TeamLeader`);

    // Process and store the data
    let imported = 0;
    if (data.data && data.data.length > 0) {
      for (const item of data.data) {
        try {
          if (type === 'contacts') {
            await supabase.from('customers').upsert({
              teamleader_id: item.id,
              name: `${item.first_name || ''} ${item.last_name || ''}`.trim(),
              email: item.email,
              phone: item.telephone,
              company: item.company?.name || null,
            }, { onConflict: 'teamleader_id' });
          } else if (type === 'companies') {
            await supabase.from('customers').upsert({
              teamleader_id: item.id,
              name: item.name,
              email: item.email,
              phone: item.telephone,
              company: item.name,
            }, { onConflict: 'teamleader_id' });
          }
          imported++;
        } catch (error) {
          console.error(`Error importing ${type} item:`, error);
        }
      }
    }

    console.log(`Successfully imported ${imported} ${type}`);

    return new Response(JSON.stringify({
      success: true,
      imported,
      total: data.data?.length || 0,
      type
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Import error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});