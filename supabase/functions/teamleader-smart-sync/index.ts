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
    console.log('=== TEAMLEADER SMART SYNC START ===');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (authError || !user) {
      throw new Error('Invalid authentication token');
    }

    console.log('User authenticated:', user.id);

    // Get active TeamLeader connection
    const { data: connections, error: connectionError } = await supabase
      .from('teamleader_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (connectionError || !connections || connections.length === 0) {
      throw new Error('No active TeamLeader connection found');
    }

    const connection = connections[0];
    let accessToken = connection.access_token;

    // Check and refresh token if needed
    const tokenExpiresAt = new Date(connection.token_expires_at);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    
    if (tokenExpiresAt <= fiveMinutesFromNow) {
      console.log('Token expired, refreshing...');
      
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

      if (!refreshResponse.ok) {
        throw new Error('Token refresh failed - please reconnect to TeamLeader');
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;
      
      // Update token in database
      await supabase
        .from('teamleader_connections')
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token || connection.refresh_token,
          token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', connection.id);
    }

    // Smart sync logic - only sync new/updated records
    let totalUpdated = 0;
    const syncTypes = ['companies', 'deals', 'invoices', 'quotes'];

    for (const syncType of syncTypes) {
      console.log(`Smart syncing ${syncType}...`);
      
      // Get last sync time for this type
      const lastSyncTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
      
      // Fetch only recently updated records from TeamLeader
      const endpoint = getTeamLeaderEndpoint(syncType);
      const teamleaderUrl = `https://api.teamleader.eu/${endpoint}?filter[updated_since]=${lastSyncTime.toISOString()}&page[size]=100`;
      
      const teamleaderResponse = await fetch(teamleaderUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!teamleaderResponse.ok) {
        console.error(`Failed to fetch ${syncType}:`, teamleaderResponse.status);
        continue;
      }

      const teamleaderData = await teamleaderResponse.json();
      const records = teamleaderData.data || [];

      if (records.length > 0) {
        const mappedRecords = records.map((record: any) => 
          mapTeamLeaderRecord(record, syncType)
        );

        const table = getSupabaseTable(syncType);
        const { error: upsertError } = await supabase
          .from(table)
          .upsert(mappedRecords, { 
            onConflict: 'teamleader_id',
            ignoreDuplicates: false 
          });

        if (!upsertError) {
          totalUpdated += mappedRecords.length;
          console.log(`Updated ${mappedRecords.length} ${syncType}`);
        }
      }
    }

    // Update customer intelligence for recently active customers
    console.log('Updating customer intelligence...');
    const { data: recentCustomers } = await supabase
      .from('customers')
      .select('id')
      .not('teamleader_id', 'is', null)
      .limit(50);

    if (recentCustomers && recentCustomers.length > 0) {
      // Trigger intelligence updates in background
      for (const customer of recentCustomers.slice(0, 10)) {
        try {
          await supabase.functions.invoke('claude-customer-intelligence', {
            body: { customerId: customer.id }
          });
        } catch (error) {
          console.error(`Failed to update intelligence for customer ${customer.id}:`, error);
        }
      }
    }

    console.log(`Smart sync completed: ${totalUpdated} records updated`);

    return new Response(
      JSON.stringify({
        success: true,
        totalUpdated,
        message: `Smart sync completed - ${totalUpdated} records updated`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Smart sync error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function getTeamLeaderEndpoint(importType: string): string {
  switch (importType) {
    case 'companies': return 'companies.list';
    case 'deals': return 'deals.list';
    case 'invoices': return 'invoices.list';
    case 'quotes': return 'quotations.list';
    default: throw new Error(`Unknown import type: ${importType}`);
  }
}

function getSupabaseTable(importType: string): string {
  switch (importType) {
    case 'companies': return 'teamleader_companies';
    case 'deals': return 'teamleader_deals';
    case 'invoices': return 'teamleader_invoices';
    case 'quotes': return 'teamleader_quotes';
    default: throw new Error(`Unknown import type: ${importType}`);
  }
}

function mapTeamLeaderRecord(record: any, importType: string): any {
  switch (importType) {
    case 'companies':
      return {
        teamleader_id: record.id,
        name: record.name,
        email: record.emails?.[0]?.email || null,
        phone: record.telephones?.[0]?.number || null,
        vat_number: record.vat_number,
        website: record.web_url,
        address: record.primary_address?.line_1,
        city: record.primary_address?.city,
        postal_code: record.primary_address?.postal_code,
        country: record.primary_address?.country,
        business_type: record.business_type?.name,
        currency: 'EUR',
        updated_at: new Date(),
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
        updated_at: new Date(),
      };
    default:
      throw new Error(`Unknown import type: ${importType}`);
  }
}