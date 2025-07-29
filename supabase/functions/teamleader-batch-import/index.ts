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

    // Create Supabase client using fetch directly (more reliable)
    const supabaseClient = {
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
                return { data: null, error: { message: 'Query failed' } };
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

    console.log('Supabase client created');

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

    // Simple success response for now (to test if the function works)
    const response = {
      success: true,
      imported: 0,
      errors: [],
      hasMore: false,
      message: `Batch import function is working for ${importType}`,
      debug: {
        userId: user.id,
        importType,
        batchSize,
        timestamp: new Date().toISOString()
      }
    };

    console.log('Sending success response:', response);

    return new Response(JSON.stringify(response), { 
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