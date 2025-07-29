import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BatchImportRequest {
  importType: 'contacts' | 'companies' | 'deals' | 'invoices' | 'quotes' | 'projects';
  batchSize?: number;
}

serve(async (req) => {
  console.log(`[${new Date().toISOString()}] Request: ${req.method} ${req.url}`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting batch import function...');
    
    // Basic environment check
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing environment variables:', { 
        hasUrl: !!supabaseUrl, 
        hasKey: !!supabaseKey 
      });
      throw new Error('Missing required environment variables');
    }

    console.log('Environment variables validated');

    // Create simple Supabase client
    const supabaseClient = createSupabaseClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header found');
    }
    
    const token = authHeader.replace('Bearer ', '');
    console.log('Extracting user from token...');
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Authentication required');
    }

    console.log(`User authenticated: ${user.id}`);

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Request body parsed:', requestBody);
    } catch (e) {
      console.error('Failed to parse request body:', e);
      throw new Error('Invalid JSON in request body');
    }

    const { importType, batchSize = 100 }: BatchImportRequest = requestBody;
    console.log(`Import request: type=${importType}, batchSize=${batchSize}`);

    if (!importType) {
      throw new Error('importType is required');
    }

    // Get or create batch import progress record
    let progressRecord = await getOrCreateProgressRecord(supabaseClient, user.id, importType, batchSize);
    console.log(`Progress record: ${progressRecord.id}, status: ${progressRecord.status}`);

    if (progressRecord.status === 'completed') {
      return new Response(JSON.stringify({
        success: true,
        message: 'Import already completed',
        progress: progressRecord
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Get TeamLeader connection
    console.log('Getting TeamLeader connection...');
    const { data: connection, error: connError } = await supabaseClient
      .from('teamleader_connections')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (connError || !connection) {
      console.error('Connection error:', connError);
      throw new Error('TeamLeader connection not found');
    }

    console.log('TeamLeader connection found');

    // Calculate starting point for this batch
    const startPage = progressRecord.last_imported_page + 1;
    console.log(`Starting import from page ${startPage}`);

    // Import the batch
    const result = await importBatch(
      connection.access_token,
      importType,
      startPage,
      batchSize,
      supabaseClient
    );

    console.log(`Import completed: imported=${result.imported}, errors=${result.errors.length}`);

    // Update progress record
    const newTotalImported = progressRecord.total_imported + result.imported;
    const isCompleted = result.hasMore === false || result.imported < batchSize;

    await supabaseClient
      .from('teamleader_batch_import_progress')
      .update({
        total_imported: newTotalImported,
        last_imported_page: result.hasMore ? startPage : progressRecord.last_imported_page,
        last_imported_id: result.lastId || progressRecord.last_imported_id,
        status: isCompleted ? 'completed' : 'active',
        completed_at: isCompleted ? new Date().toISOString() : null,
        last_updated_at: new Date().toISOString(),
        error_details: result.errors.length > 0 ? result.errors : null
      })
      .eq('id', progressRecord.id);

    // Get updated progress
    const { data: updatedProgress } = await supabaseClient
      .from('teamleader_batch_import_progress')
      .select('*')
      .eq('id', progressRecord.id)
      .single();

    return new Response(JSON.stringify({
      success: true,
      imported: result.imported,
      errors: result.errors,
      hasMore: result.hasMore && !isCompleted,
      progress: updatedProgress,
      message: `Imported ${result.imported} ${importType} records`
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Batch import error:', error);
    console.error('Error stack:', error.stack);
    
    const errorResponse = {
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(errorResponse), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});

function createSupabaseClient(supabaseUrl: string, supabaseKey: string) {
  return {
    auth: {
      getUser: async (token: string) => {
        const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': supabaseKey
          }
        });
        if (!response.ok) {
          return { data: { user: null }, error: { message: 'Auth failed' } };
        }
        const user = await response.json();
        return { data: { user }, error: null };
      }
    },
    from: (table: string) => ({
      select: (columns = '*') => ({
        eq: (column: string, value: any) => ({
          single: async () => {
            const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=${columns}&${column}=eq.${value}`, {
              headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'apikey': supabaseKey,
                'Content-Type': 'application/json'
              }
            });
            if (!response.ok) {
              const errorText = await response.text();
              return { data: null, error: { message: errorText } };
            }
            const data = await response.json();
            return { data: data[0] || null, error: null };
          },
          maybeSingle: async () => {
            const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=${columns}&${column}=eq.${value}`, {
              headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'apikey': supabaseKey,
                'Content-Type': 'application/json'
              }
            });
            if (!response.ok) {
              return { data: null, error: { message: 'Query failed' } };
            }
            const data = await response.json();
            return { data: data[0] || null, error: null };
          }
        }),
        eq: (column: string, value: any) => ({
          eq: (column2: string, value2: any) => ({
            single: async () => {
              const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=${columns}&${column}=eq.${value}&${column2}=eq.${value2}`, {
                headers: {
                  'Authorization': `Bearer ${supabaseKey}`,
                  'apikey': supabaseKey,
                  'Content-Type': 'application/json'
                }
              });
              if (!response.ok) {
                return { data: null, error: { message: 'Query failed' } };
              }
              const data = await response.json();
              return { data: data[0] || null, error: null };
            }
          })
        })
      }),
      insert: (values: any) => ({
        select: () => ({
          single: async () => {
            const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'apikey': supabaseKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(values)
            });
            if (!response.ok) {
              const error = await response.text();
              return { data: null, error: { message: error } };
            }
            const data = await response.json();
            return { data: data[0] || null, error: null };
          }
        })
      }),
      update: (values: any) => ({
        eq: (column: string, value: any) => ({
          execute: async () => {
            const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${column}=eq.${value}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'apikey': supabaseKey,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(values)
            });
            return { error: response.ok ? null : { message: 'Update failed' } };
          }
        })
      }),
      upsert: async (values: any, options: any) => {
        const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(values)
        });
        return { error: response.ok ? null : { message: 'Upsert failed' } };
      }
    })
  };
}

async function getOrCreateProgressRecord(supabaseClient: any, userId: string, importType: string, batchSize: number) {
  console.log(`Getting progress record for user ${userId}, type ${importType}`);
  
  // Try to get existing progress record
  const { data: existing } = await supabaseClient
    .from('teamleader_batch_import_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('import_type', importType)
    .eq('status', 'active')
    .maybeSingle();

  if (existing) {
    console.log('Found existing progress record');
    return existing;
  }

  console.log('Creating new progress record');
  // Create new progress record
  const { data: newRecord, error } = await supabaseClient
    .from('teamleader_batch_import_progress')
    .insert({
      user_id: userId,
      import_type: importType,
      batch_size: batchSize,
      status: 'active'
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating progress record:', error);
    throw new Error(`Failed to create progress record: ${error.message}`);
  }

  return newRecord;
}

async function importBatch(accessToken: string, importType: string, startPage: number, batchSize: number, supabaseClient: any) {
  const endpoint = getTeamLeaderEndpoint(importType);
  const url = `https://api.teamleader.eu/${endpoint}?page[size]=${batchSize}&page[number]=${startPage}`;

  console.log(`Fetching from TeamLeader: ${url}`);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    console.error(`TeamLeader API error: ${response.status} ${response.statusText}`);
    const errorText = await response.text();
    console.error(`Error response: ${errorText}`);
    throw new Error(`TeamLeader API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const records = data.data || [];
  const hasMore = data.meta?.pagination?.has_more || false;

  console.log(`Received ${records.length} records from TeamLeader, hasMore: ${hasMore}`);

  const errors = [];
  let imported = 0;
  let lastId = null;

  // Process and insert records
  for (const record of records) {
    try {
      const mappedRecord = mapTeamLeaderRecord(record, importType);
      if (mappedRecord) {
        await upsertRecord(supabaseClient, getSupabaseTable(importType), mappedRecord);
        imported++;
        lastId = record.id;
      }
    } catch (error) {
      console.error(`Error processing record ${record.id}:`, error);
      errors.push({ id: record.id, error: error.message });
    }
  }

  return {
    imported,
    errors,
    hasMore,
    lastId
  };
}

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

async function upsertRecord(supabaseClient: any, table: string, record: any) {
  const { error } = await supabaseClient
    .from(table)
    .upsert(record, { 
      onConflict: 'teamleader_id',
      ignoreDuplicates: false 
    });

  if (error) {
    throw new Error(`Failed to upsert to ${table}: ${error.message}`);
  }
}