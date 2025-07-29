import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log("=== TEAMLEADER BATCH IMPORT START ===");
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Environment check
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error('Missing Supabase environment variables');
    }

    // Parse request
    const body = await req.json();
    const { importType, batchSize = 100 } = body;
    console.log(`Import request: ${importType}, batchSize: ${batchSize}`);

    // Get auth token  
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No Authorization header');
    }
    const token = authHeader.replace('Bearer ', '');

    // Authenticate user
    console.log("Authenticating user...");
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_KEY
      }
    });

    if (!userResponse.ok) {
      throw new Error('Authentication failed');
    }

    const user = await userResponse.json();
    console.log(`User authenticated: ${user.id}`);

    // Get TeamLeader connection
    console.log("Getting TeamLeader connection...");
    const connectionResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/teamleader_connections?user_id=eq.${user.id}&is_active=eq.true&select=access_token,refresh_token,token_expires_at`, 
      {
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'apikey': SUPABASE_KEY
        }
      }
    );

    if (!connectionResponse.ok) {
      throw new Error('Failed to get TeamLeader connection');
    }

    const connections = await connectionResponse.json();
    if (!connections || connections.length === 0) {
      throw new Error('No active TeamLeader connection found');
    }

    const connection = connections[0];
    let accessToken = connection.access_token;
    
    // Check if token is expired and refresh if needed
    const tokenExpiresAt = new Date(connection.token_expires_at);
    const now = new Date();
    
    if (tokenExpiresAt <= now) {
      console.log("Access token expired, refreshing...");
      
      const clientId = Deno.env.get('TEAMLEADER_CLIENT_ID');
      const clientSecret = Deno.env.get('TEAMLEADER_CLIENT_SECRET');
      
      if (!clientId || !clientSecret) {
        throw new Error('TeamLeader client credentials not configured');
      }
      
      console.log(`Refreshing token with client ID: ${clientId.substring(0, 8)}...`);
      
      // Refresh the token
      const refreshResponse = await fetch('https://api.teamleader.eu/oauth2/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: connection.refresh_token,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      
      console.log(`Token refresh response status: ${refreshResponse.status}`);
      
      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        console.error(`Token refresh failed: ${errorText}`);
        throw new Error(`Failed to refresh TeamLeader token: ${refreshResponse.status} - ${errorText}`);
      }
      
      const tokenData = await refreshResponse.json();
      accessToken = tokenData.access_token;
      
      console.log("Token refreshed successfully, updating database...");
      
      // Update the connection with new token
      const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/teamleader_connections?id=eq.${connection.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'apikey': SUPABASE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || connection.refresh_token,
          token_expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
          updated_at: new Date().toISOString()
        })
      });
      
      if (!updateResponse.ok) {
        console.warn('Failed to update token in database, but continuing with fresh token');
      } else {
        console.log("Database updated with new token");
      }
    } else {
      console.log("Token is still valid, no refresh needed");
    }
    
    console.log("TeamLeader connection ready");

    // Call TeamLeader API
    console.log(`Fetching ${importType} from TeamLeader...`);
    const endpoint = getTeamLeaderEndpoint(importType);
    const teamleaderUrl = `https://api.teamleader.eu/${endpoint}?page[size]=${Math.min(batchSize, 50)}&page[number]=1`;
    
    const teamleaderResponse = await fetch(teamleaderUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!teamleaderResponse.ok) {
      const errorText = await teamleaderResponse.text();
      console.error(`TeamLeader API error: ${teamleaderResponse.status} - ${errorText}`);
      throw new Error(`TeamLeader API error: ${teamleaderResponse.status}`);
    }

    const teamleaderData = await teamleaderResponse.json();
    console.log(`TeamLeader API response:`, JSON.stringify(teamleaderData, null, 2));
    
    const records = teamleaderData.data || [];
    const hasMore = teamleaderData.meta?.pagination?.has_more || false;
    
    console.log(`TeamLeader returned ${records.length} records, hasMore: ${hasMore}`);

    // Import records to Supabase
    let imported = 0;
    const errors = [];
    const table = getSupabaseTable(importType);
    
    console.log(`Importing to table: ${table}`);

    for (const record of records) {
      try {
        const mappedRecord = mapTeamLeaderRecord(record, importType);
        if (mappedRecord) {
          // Upsert to Supabase
          const upsertResponse = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'apikey': SUPABASE_KEY,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(mappedRecord)
          });

          if (upsertResponse.ok) {
            imported++;
            console.log(`Imported record: ${record.id}`);
          } else {
            const errorText = await upsertResponse.text();
            console.error(`Failed to import record ${record.id}: ${errorText}`);
            errors.push({ id: record.id, error: errorText });
          }
        }
      } catch (error) {
        console.error(`Error processing record ${record.id}:`, error);
        errors.push({ id: record.id, error: error.message });
      }
    }

    console.log(`Import completed: ${imported} records imported, ${errors.length} errors`);

    const response = {
      success: true,
      imported,
      errors,
      hasMore,
      message: `Imported ${imported} ${importType} records`,
      debug: {
        totalRecords: records.length,
        table,
        endpoint,
        timestamp: new Date().toISOString()
      }
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Error:", error.message);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function getTeamLeaderEndpoint(importType: string): string {
  const endpoints = {
    contacts: 'contacts.list',
    companies: 'companies.list',
    deals: 'deals.list',
    invoices: 'invoices.list',
    quotes: 'quotations.list',
    projects: 'projects.list'
  };
  return endpoints[importType] || 'contacts.list';
}

function getSupabaseTable(importType: string): string {
  const tables = {
    contacts: 'customers',
    companies: 'customers',
    deals: 'teamleader_deals',
    invoices: 'teamleader_invoices',
    quotes: 'teamleader_quotes', 
    projects: 'teamleader_projects'
  };
  return tables[importType] || 'customers';
}

function mapTeamLeaderRecord(record: any, importType: string): any {
  switch (importType) {
    case 'contacts':
      return {
        teamleader_id: record.id,
        name: `${record.first_name || ''} ${record.last_name || ''}`.trim(),
        email: record.email,
        phone: record.telephone,
        company: record.company?.name || null
      };
    
    case 'companies':
      return {
        teamleader_id: record.id,
        name: record.name,
        email: record.email,
        phone: record.telephone,
        company: record.name
      };
    
    case 'deals':
      return {
        teamleader_id: record.id,
        title: record.title,
        description: record.description,
        value: record.estimated_value?.amount || 0,
        currency: record.estimated_value?.currency || 'EUR',
        phase: record.phase?.name,
        probability: record.estimated_probability,
        expected_closing_date: record.estimated_closing_date,
        actual_closing_date: record.closed_at ? new Date(record.closed_at).toISOString().split('T')[0] : null,
        contact_id: record.contact?.id,
        company_id: record.company?.id,
        responsible_user_id: record.responsible_user?.id,
        lead_source: record.lead_source?.name
      };
    
    case 'invoices':
      return {
        teamleader_id: record.id,
        invoice_number: record.invoice_number,
        title: record.title,
        description: record.description,
        total_price: record.total?.amount || 0,
        currency: record.total?.currency || 'EUR',
        status: record.status,
        invoice_date: record.invoice_date,
        due_date: record.due_date,
        payment_date: record.paid_at ? new Date(record.paid_at).toISOString().split('T')[0] : null,
        contact_id: record.contact?.id,
        company_id: record.company?.id
      };
    
    case 'quotes':
      return {
        teamleader_id: record.id,
        quote_number: record.quotation_number,
        title: record.title,
        description: record.description,
        total_price: record.total?.amount || 0,
        currency: record.total?.currency || 'EUR',
        status: record.status,
        quote_date: record.sent_at ? new Date(record.sent_at).toISOString().split('T')[0] : null,
        valid_until: record.expires_on,
        contact_id: record.contact?.id,
        company_id: record.company?.id
      };
    
    case 'projects':
      return {
        teamleader_id: record.id,
        title: record.title,
        description: record.description,
        status: record.status,
        start_date: record.starts_on,
        end_date: record.ends_on,
        budget: record.budget?.amount || 0,
        currency: record.budget?.currency || 'EUR',
        company_id: record.company?.id,
        responsible_user_id: record.responsible_user?.id
      };
    
    default:
      return null;
  }
}