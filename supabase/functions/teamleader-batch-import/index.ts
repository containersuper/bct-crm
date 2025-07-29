import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BatchImportRequest {
  importType: 'contacts' | 'companies' | 'deals' | 'invoices' | 'quotes' | 'projects';
  batchSize?: number;
}

Deno.serve(async (req) => {
  console.log('=== TEAMLEADER BATCH IMPORT START ===');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Creating Supabase client...');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    console.log('Getting auth header...');
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    console.log('Authenticating user...');
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Authentication failed');
    }

    console.log('User authenticated:', user.id);

    console.log('Parsing request body...');
    const { importType, batchSize = 100 }: BatchImportRequest = await req.json();
    console.log(`Starting batch import of ${importType} with batch size ${batchSize}`);

    // Get active TeamLeader connection
    console.log('Getting TeamLeader connection...');
    const { data: connections, error: connectionError } = await supabase
      .from('teamleader_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (connectionError) {
      console.error('Connection error:', connectionError);
      throw new Error(`Database error: ${connectionError.message}`);
    }

    if (!connections || connections.length === 0) {
      console.error('No connections found for user:', user.id);
      throw new Error('No active TeamLeader connection found');
    }

    const connection = connections[0];

    console.log('Found TeamLeader connection');

    // Check if token needs refresh (refresh if expiring within 5 minutes)
    let accessToken = connection.access_token;
    const tokenExpiresAt = new Date(connection.token_expires_at);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    
    console.log(`Token expires at: ${tokenExpiresAt.toISOString()}`);
    console.log(`Current time: ${now.toISOString()}`);
    console.log(`Will refresh if expires before: ${fiveMinutesFromNow.toISOString()}`);
    
    if (tokenExpiresAt <= fiveMinutesFromNow) {
      console.log('Token expired or expiring soon, refreshing...');
      
      const refreshResponse = await fetch('https://app.teamleader.eu/oauth2/access_token', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: connection.refresh_token,
          client_id: Deno.env.get('TEAMLEADER_CLIENT_ID')!,
          client_secret: Deno.env.get('TEAMLEADER_CLIENT_SECRET')!,
        }),
      });

      console.log(`Token refresh response status: ${refreshResponse.status}`);
      
      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        console.error('Token refresh failed:', errorText);
        throw new Error(`Token refresh failed: ${refreshResponse.status} - Please reconnect to TeamLeader`);
      }

      const refreshData = await refreshResponse.json();
      console.log('Token refreshed successfully');
      
      accessToken = refreshData.access_token;
      
      // Update the token in the database
      const { error: updateError } = await supabase
        .from('teamleader_connections')
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token || connection.refresh_token,
          token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', connection.id);
        
      if (updateError) {
        console.error('Failed to update token in database:', updateError);
      } else {
        console.log('Token updated in database successfully');
      }
    } else {
      console.log('Token is still valid, no refresh needed');
    }

    // Get TeamLeader endpoint and Supabase table
    console.log('Getting endpoint and table...');
    const endpoint = getTeamLeaderEndpoint(importType);
    const table = getSupabaseTable(importType);
    console.log(`Endpoint: ${endpoint}, Table: ${table}`);

    let totalImported = 0;
    let page = 1;
    let hasMore = true;
    const errors: any[] = [];

    console.log(`Starting batch import of all ${importType}...`);

    while (hasMore) {
      console.log(`Importing page ${page} of ${importType}...`);

      // Fetch data from TeamLeader
      const teamleaderUrl = `https://api.teamleader.eu/${endpoint}?page[size]=${batchSize}&page[number]=${page}`;
      console.log(`Fetching from: ${teamleaderUrl}`);
      
      const teamleaderResponse = await fetch(teamleaderUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!teamleaderResponse.ok) {
        const errorText = await teamleaderResponse.text();
        console.error(`TeamLeader API error: ${teamleaderResponse.status} - ${errorText}`);
        throw new Error(`TeamLeader API error: ${teamleaderResponse.status} - ${errorText}`);
      }

      const teamleaderData = await teamleaderResponse.json();
      const records = teamleaderData.data || [];

      console.log(`Retrieved ${records.length} ${importType} from page ${page}`);
      console.log(`Sample record:`, records[0] ? JSON.stringify(records[0], null, 2) : 'No records');

      if (records.length === 0) {
        hasMore = false;
        break;
      }

      // Map and upsert records
      const mappedRecords = records.map((record: any) => {
        try {
          return mapTeamLeaderRecord(record, importType);
        } catch (error) {
          console.error(`Error mapping record ${record.id}:`, error);
          errors.push({ page, recordId: record.id, error: error.message });
          return null;
        }
      }).filter(Boolean);

      console.log(`Mapped ${mappedRecords.length} records for page ${page}`);

      if (mappedRecords.length > 0) {
        const { error: upsertError } = await supabase
          .from(table)
          .upsert(mappedRecords, { 
            onConflict: 'teamleader_id',
            ignoreDuplicates: false 
          });

        if (upsertError) {
          console.error(`Error upserting ${importType}:`, upsertError);
          errors.push({ page, error: upsertError.message });
        } else {
          totalImported += mappedRecords.length;
          console.log(`Successfully imported ${mappedRecords.length} ${importType} from page ${page}`);
        }
      }

      // Check if there are more pages
      const meta = teamleaderData.meta;
      if (meta && meta.page && meta.page.count < batchSize) {
        hasMore = false;
      } else if (records.length < batchSize) {
        hasMore = false;
      } else {
        page++;
      }
    }

    console.log(`Batch import completed. Total imported: ${totalImported} ${importType}, Total pages: ${page - 1}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        imported: totalImported,
        pages: page - 1,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('=== BATCH IMPORT ERROR ===');
    console.error('Error details:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        details: error.stack
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

function getTeamLeaderEndpoint(importType: string): string {
  switch (importType) {
    case 'contacts': return 'contacts.list';
    case 'companies': return 'companies.list';
    case 'deals': return 'deals.list';
    case 'invoices': return 'invoices.list';
    case 'quotes': return 'quotations.list';
    case 'projects': return 'projects.list';
    default: throw new Error(`Unknown import type: ${importType}`);
  }
}

function getSupabaseTable(importType: string): string {
  switch (importType) {
    case 'contacts': return 'customers';
    case 'companies': return 'customers';
    case 'deals': return 'teamleader_deals';
    case 'invoices': return 'teamleader_invoices';
    case 'quotes': return 'teamleader_quotes';
    case 'projects': return 'teamleader_projects';
    default: throw new Error(`Unknown import type: ${importType}`);
  }
}

function mapTeamLeaderRecord(record: any, importType: string): any {
  switch (importType) {
    case 'contacts':
      return {
        teamleader_id: record.id,
        name: `${record.first_name || ''} ${record.last_name || ''}`.trim(),
        email: record.emails?.[0]?.email || null,
        phone: record.telephones?.[0]?.number || null,
        company: record.companies?.[0]?.name || null,
        brand: 'TeamLeader',
        created_at: new Date(),
      };
    case 'companies':
      return {
        teamleader_id: record.id,
        name: record.name,
        email: record.emails?.[0]?.email || null,
        phone: record.telephones?.[0]?.number || null,
        company: record.name,
        brand: 'TeamLeader',
        created_at: new Date(),
      };
    case 'deals':
      return {
        teamleader_id: record.id,
        title: record.title,
        description: record.summary,
        value: record.estimated_value?.amount ? parseFloat(record.estimated_value.amount) : null,
        currency: record.estimated_value?.currency || 'EUR',
        phase: record.phase?.name,
        probability: record.estimated_probability ? parseFloat(record.estimated_probability) : null,
        expected_closing_date: record.estimated_closing_date,
        actual_closing_date: record.closed_at,
        contact_id: record.contact?.id,
        company_id: record.company?.id,
        responsible_user_id: record.responsible_user?.id,
        lead_source: record.lead?.source?.name,
        created_at: new Date(),
        updated_at: new Date(),
      };
    case 'invoices':
      return {
        teamleader_id: record.id,
        invoice_number: record.invoice_number,
        title: record.subject,
        description: record.note,
        total_price: record.total?.amount ? parseFloat(record.total.amount) : null,
        currency: record.total?.currency || 'EUR',
        status: record.status,
        invoice_date: record.invoice_date,
        due_date: record.due_on,
        payment_date: record.paid_at,
        contact_id: record.contact?.id,
        company_id: record.company?.id,
        deal_id: record.deal?.id,
        created_at: new Date(),
        updated_at: new Date(),
      };
    case 'quotes':
      return {
        teamleader_id: record.id,
        quote_number: record.quotation_number,
        title: record.subject,
        description: record.note,
        total_price: record.total?.amount ? parseFloat(record.total.amount) : null,
        currency: record.total?.currency || 'EUR',
        status: record.status,
        quote_date: record.sent_at,
        valid_until: record.expires_on,
        contact_id: record.contact?.id,
        company_id: record.company?.id,
        deal_id: record.deal?.id,
        created_at: new Date(),
        updated_at: new Date(),
      };
    case 'projects':
      return {
        teamleader_id: record.id,
        title: record.title,
        description: record.description,
        status: record.status,
        start_date: record.starts_on,
        end_date: record.due_on,
        budget: record.budget?.amount ? parseFloat(record.budget.amount) : null,
        currency: record.budget?.currency || 'EUR',
        company_id: record.company?.id,
        responsible_user_id: record.responsible_user?.id,
        created_at: new Date(),
        updated_at: new Date(),
      };
    default:
      throw new Error(`Unknown import type: ${importType}`);
  }
}