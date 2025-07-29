import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BatchImportRequest {
  type: 'contacts' | 'companies' | 'deals' | 'invoices' | 'quotes' | 'projects';
  batchSize?: number;
}

const TEAMLEADER_API_URL = 'https://api.focus.teamleader.eu';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== TEAMLEADER BATCH IMPORT START ===');

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

    const { type, batchSize = 100 }: BatchImportRequest = await req.json();
    console.log(`Import request: ${type}, batchSize: ${batchSize}`);

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

    let connection = connections[0];
    console.log('Getting TeamLeader connection...');

    // Check if token is expired and refresh if needed
    const now = new Date();
    const expiresAt = new Date(connection.token_expires_at);
    
    if (now >= expiresAt) {
      console.log('Access token expired, refreshing...');
      
      const refreshResponse = await fetch('https://app.teamleader.eu/oauth2/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: Deno.env.get('TEAMLEADER_CLIENT_ID'),
          client_secret: Deno.env.get('TEAMLEADER_CLIENT_SECRET'),
          refresh_token: connection.refresh_token,
          grant_type: 'refresh_token'
        })
      });

      if (!refreshResponse.ok) {
        throw new Error('Failed to refresh TeamLeader token: ' + refreshResponse.status + ' - ' + await refreshResponse.text());
      }

      const refreshData = await refreshResponse.json();
      const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000);

      await supabase
        .from('teamleader_connections')
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token,
          token_expires_at: newExpiresAt.toISOString(),
        })
        .eq('id', connection.id);

      connection.access_token = refreshData.access_token;
    }

    // Determine endpoint and table
    let endpoint = '';
    let tableName = '';
    
    switch (type) {
      case 'contacts':
        endpoint = '/contacts.list';
        tableName = 'customers';
        break;
      case 'companies':
        endpoint = '/companies.list';
        tableName = 'customers';
        break;
      case 'deals':
        endpoint = '/deals.list';
        tableName = 'teamleader_deals';
        break;
      case 'invoices':
        endpoint = '/invoices.list';
        tableName = 'teamleader_invoices';
        break;
      case 'quotes':
        endpoint = '/quotations.list';
        tableName = 'teamleader_quotes';
        break;
      case 'projects':
        endpoint = '/projects.list';
        tableName = 'teamleader_projects';
        break;
      default:
        throw new Error('Invalid import type');
    }

    // Batch import process
    let totalImported = 0;
    let currentPage = 1;
    let hasMoreData = true;

    console.log(`Starting batch import of ${type}...`);

    while (hasMoreData) {
      console.log(`Importing batch ${currentPage} (${batchSize} records)...`);

      const response = await fetch(`${TEAMLEADER_API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${connection.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page: {
            size: batchSize,
            number: currentPage
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('TeamLeader API error:', response.status, errorText);
        throw new Error(`API error importing ${type}: TeamLeader API error: ${response.status}`);
      }

      const data = await response.json();
      const batchData = data.data || [];
      
      console.log(`Retrieved ${batchData.length} ${type} from TeamLeader (page ${currentPage})`);

      if (batchData.length === 0) {
        hasMoreData = false;
        break;
      }

      // Process this batch
      let batchImported = 0;
      for (const item of batchData) {
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
          } else if (type === 'deals') {
            await supabase.from('teamleader_deals').upsert({
              teamleader_id: item.id,
              title: item.title,
              description: item.description,
              value: item.estimated_value?.amount || null,
              currency: item.estimated_value?.currency || 'EUR',
              phase: item.phase?.name,
              probability: item.estimated_probability,
              expected_closing_date: item.estimated_closing_date,
              contact_id: item.contact?.id,
              company_id: item.company?.id,
            }, { onConflict: 'teamleader_id' });
          } else if (type === 'invoices') {
            await supabase.from('teamleader_invoices').upsert({
              teamleader_id: item.id,
              invoice_number: item.invoice_number,
              title: item.title,
              description: item.description,
              total_price: item.total?.amount || null,
              currency: item.total?.currency || 'EUR',
              status: item.status,
              invoice_date: item.invoice_date,
              due_date: item.due_date,
              contact_id: item.contact?.id,
              company_id: item.company?.id,
            }, { onConflict: 'teamleader_id' });
          } else if (type === 'quotes') {
            await supabase.from('teamleader_quotes').upsert({
              teamleader_id: item.id,
              quote_number: item.quotation_number,
              title: item.title,
              description: item.description,
              total_price: item.total?.amount || null,
              currency: item.total?.currency || 'EUR',
              status: item.status,
              quote_date: item.quotation_date,
              valid_until: item.valid_until,
              contact_id: item.contact?.id,
              company_id: item.company?.id,
            }, { onConflict: 'teamleader_id' });
          } else if (type === 'projects') {
            await supabase.from('teamleader_projects').upsert({
              teamleader_id: item.id,
              title: item.title,
              description: item.description,
              status: item.status,
              start_date: item.starts_on,
              end_date: item.ends_on,
              budget: item.budget?.amount || null,
              currency: item.budget?.currency || 'EUR',
              company_id: item.company?.id,
            }, { onConflict: 'teamleader_id' });
          }
          batchImported++;
        } catch (error) {
          console.error(`Error importing ${type} item:`, error);
        }
      }

      totalImported += batchImported;
      console.log(`Batch ${currentPage} completed: ${batchImported} imported (Total: ${totalImported})`);

      // Check if we got fewer records than requested (means we're at the end)
      if (batchData.length < batchSize) {
        hasMoreData = false;
      } else {
        currentPage++;
      }
    }

    console.log(`=== BATCH IMPORT COMPLETE ===`);
    console.log(`Total ${type} imported: ${totalImported}`);

    return new Response(JSON.stringify({
      success: true,
      imported: totalImported,
      type,
      batches: currentPage,
      message: `Successfully imported ${totalImported} ${type} in ${currentPage} batches`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Batch import error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});