import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  action: 'sync' | 'import' | 'export' | 'full_import';
  syncType?: 'contacts' | 'companies' | 'all';
  fullSync?: boolean;
  batchSize?: number;
  maxPages?: number;
}

interface TeamLeaderContact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  telephone?: string;
  company?: {
    id: string;
    name: string;
  };
}

interface TeamLeaderCompany {
  id: string;
  name: string;
  email?: string;
  telephone?: string;
}

const TEAMLEADER_API_URL = 'https://api.teamleader.eu';

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

    const { action, syncType = 'all', fullSync = false, batchSize = 250, maxPages = 50 }: SyncRequest = await req.json();

    // Get TeamLeader connection for user
    const { data: connection, error: connectionError } = await supabase
      .from('teamleader_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      throw new Error('TeamLeader connection not found. Please authorize first.');
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(connection.token_expires_at);
    
    if (now >= expiresAt) {
      throw new Error('Token expired. Please re-authorize.');
    }

    // Create sync history entry
    const { data: syncHistory, error: historyError } = await supabase
      .from('teamleader_sync_history')
      .insert({
        user_id: user.id,
        sync_type: action,
        status: 'running'
      })
      .select()
      .single();

    if (historyError) {
      throw new Error('Failed to create sync history');
    }

    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalFailed = 0;
    const errors: string[] = [];

    try {
      // Get field mappings
      const { data: fieldMappings, error: mappingError } = await supabase
        .from('teamleader_field_mappings')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (mappingError) {
        throw new Error('Failed to get field mappings');
      }

      if (action === 'import' || action === 'sync' || action === 'full_import') {
        // Import contacts from TeamLeader
        if (syncType === 'contacts' || syncType === 'all') {
          const contactsResult = await importContacts(connection.access_token, supabase, user.id, fieldMappings, fullSync || action === 'full_import', batchSize, maxPages);
          totalProcessed += contactsResult.processed;
          totalSuccess += contactsResult.success;
          totalFailed += contactsResult.failed;
          errors.push(...contactsResult.errors);
        }

        // Import companies from TeamLeader
        if (syncType === 'companies' || syncType === 'all') {
          const companiesResult = await importCompanies(connection.access_token, supabase, user.id, fieldMappings, fullSync || action === 'full_import', batchSize, maxPages);
          totalProcessed += companiesResult.processed;
          totalSuccess += companiesResult.success;
          totalFailed += companiesResult.failed;
          errors.push(...companiesResult.errors);
        }
      }

      if (action === 'export' || action === 'sync') {
        // Export our data to TeamLeader
        const exportResult = await exportToTeamLeader(connection.access_token, supabase, user.id, fieldMappings);
        totalProcessed += exportResult.processed;
        totalSuccess += exportResult.success;
        totalFailed += exportResult.failed;
        errors.push(...exportResult.errors);
      }

      // Update sync history
      await supabase
        .from('teamleader_sync_history')
        .update({
          status: 'completed',
          records_processed: totalProcessed,
          records_success: totalSuccess,
          records_failed: totalFailed,
          error_details: errors.length > 0 ? { errors } : null,
          completed_at: new Date().toISOString()
        })
        .eq('id', syncHistory.id);

      return new Response(JSON.stringify({
        success: true,
        processed: totalProcessed,
        success: totalSuccess,
        failed: totalFailed,
        errors: errors
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (syncError) {
      // Update sync history with error
      await supabase
        .from('teamleader_sync_history')
        .update({
          status: 'failed',
          records_processed: totalProcessed,
          records_success: totalSuccess,
          records_failed: totalFailed,
          error_details: { error: syncError.message, errors },
          completed_at: new Date().toISOString()
        })
        .eq('id', syncHistory.id);

      throw syncError;
    }

  } catch (error) {
    console.error('TeamLeader sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function importContacts(accessToken: string, supabase: any, userId: string, fieldMappings: any[], fullSync = false, batchSize = 250, maxPages = 50) {
  let processed = 0;
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    let page = 1;
    let hasMoreData = true;
    let totalPages = 0;

    console.log(`Starting contact import - Full sync: ${fullSync}, Batch size: ${batchSize}, Max pages: ${maxPages}`);

    while (hasMoreData && totalPages < maxPages) {
      console.log(`Fetching contacts page ${page}...`);
      
      // Fetch contacts from TeamLeader with pagination
      const requestBody = {
        filter: {},
        page: { 
          size: fullSync ? batchSize : 100
        }
      };

      // Only add page number for subsequent pages (TeamLeader starts from page 1)
      if (page > 1) {
        requestBody.page.number = page;
      }

      const response = await fetch(`${TEAMLEADER_API_URL}/contacts.list`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`TeamLeader API error: ${response.status}`);
      }

      const data = await response.json();
      const contacts: TeamLeaderContact[] = data.data || [];
      
      console.log(`Received ${contacts.length} contacts on page ${page}`);
      if (contacts.length > 0) {
        console.log('Sample contact:', JSON.stringify(contacts[0], null, 2));
      }

      if (contacts.length === 0) {
        hasMoreData = false;
        break;
      }

      // Process contacts in batches for better performance
      const contactsToInsert: any[] = [];

      for (const contact of contacts) {
        processed++;
        
        try {
          // Map TeamLeader fields to our fields
          const mappedContact: any = {};
          
          for (const mapping of fieldMappings.filter(m => m.field_type === 'contact')) {
            switch (mapping.teamleader_field) {
              case 'first_name':
                mappedContact[mapping.our_field] = contact.first_name;
                break;
              case 'last_name':
                mappedContact[mapping.our_field] = contact.last_name;
                break;
              case 'email':
                mappedContact[mapping.our_field] = contact.email;
                break;
              case 'telephone':
                mappedContact[mapping.our_field] = contact.telephone;
                break;
              case 'company_name':
                mappedContact[mapping.our_field] = contact.company?.name;
                break;
            }
          }

          // Create full name if we have first and last name
          if (contact.first_name && contact.last_name) {
            mappedContact.name = `${contact.first_name} ${contact.last_name}`;
          } else if (contact.first_name) {
            mappedContact.name = contact.first_name;
          } else if (contact.last_name) {
            mappedContact.name = contact.last_name;
          } else if (contact.email) {
            mappedContact.name = contact.email; // Use email as fallback name
          } else {
            mappedContact.name = `Contact ${contact.id}`; // Use ID as ultimate fallback
          }

          mappedContact.email = contact.email || null; // Allow null emails
          mappedContact.teamleader_id = contact.id;

          contactsToInsert.push(mappedContact);

        } catch (contactError) {
          errors.push(`Error processing contact ${contact.id}: ${contactError.message}`);
          failed++;
        }
      }

      // Bulk insert contacts
      if (contactsToInsert.length > 0) {
        try {
          console.log('Processing bulk insert with data sample:', JSON.stringify(contactsToInsert.slice(0, 2), null, 2));
          
          const { error: insertError } = await supabase
            .from('customers')
            .upsert(contactsToInsert, { onConflict: 'teamleader_id' });

          if (insertError) {
            console.error('Bulk insert error:', insertError);
            errors.push(`Failed to bulk import ${contactsToInsert.length} contacts: ${insertError.message}`);
            failed += contactsToInsert.length;
          } else {
            success += contactsToInsert.length;
            console.log(`Successfully imported ${contactsToInsert.length} contacts from page ${page}`);
          }
        } catch (bulkError) {
          console.error('Bulk insert exception:', bulkError);
          errors.push(`Bulk insert exception: ${bulkError.message}`);
          failed += contactsToInsert.length;
        }
      }

      totalPages++;
      page++;

      // For full sync, continue until no more data
      // For regular sync, stop after first page if not explicitly requesting full sync
      if (!fullSync && totalPages >= 1) {
        hasMoreData = false;
      }

      // Rate limiting - small delay between requests
      if (hasMoreData) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Contact import completed. Pages processed: ${totalPages}, Total processed: ${processed}, Success: ${success}, Failed: ${failed}`);

  } catch (apiError) {
    console.error('API error importing contacts:', apiError);
    errors.push(`API error importing contacts: ${apiError.message}`);
    failed = processed;
  }

  return { processed, success, failed, errors };
}

async function importCompanies(accessToken: string, supabase: any, userId: string, fieldMappings: any[], fullSync = false, batchSize = 250, maxPages = 50) {
  let processed = 0;
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    let page = 1;
    let hasMoreData = true;
    let totalPages = 0;

    console.log(`Starting company import - Full sync: ${fullSync}, Batch size: ${batchSize}, Max pages: ${maxPages}`);

    while (hasMoreData && totalPages < maxPages) {
      console.log(`Fetching companies page ${page}...`);
      
      // Fetch companies from TeamLeader with pagination
      const requestBody = {
        filter: {},
        page: { 
          size: fullSync ? batchSize : 100
        }
      };

      // Only add page number for subsequent pages (TeamLeader starts from page 1)
      if (page > 1) {
        requestBody.page.number = page;
      }

      const response = await fetch(`${TEAMLEADER_API_URL}/companies.list`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`TeamLeader API error: ${response.status}`);
      }

      const data = await response.json();
      const companies: TeamLeaderCompany[] = data.data || [];
      
      console.log(`Received ${companies.length} companies on page ${page}`);
      if (companies.length > 0) {
        console.log('Sample company:', JSON.stringify(companies[0], null, 2));
      }

      if (companies.length === 0) {
        hasMoreData = false;
        break;
      }

      // Process companies in batches for better performance
      const companiesToInsert: any[] = [];

      for (const company of companies) {
        processed++;
        
        try {
          // Map TeamLeader fields to our fields
          const mappedCompany: any = {
            name: company.name,
            email: company.email,
            phone: company.telephone,
            teamleader_id: company.id,
            company: company.name
          };

          companiesToInsert.push(mappedCompany);

        } catch (companyError) {
          errors.push(`Error processing company ${company.id}: ${companyError.message}`);
          failed++;
        }
      }

      // Bulk insert companies
      if (companiesToInsert.length > 0) {
        try {
          const { error: insertError } = await supabase
            .from('customers')
            .upsert(companiesToInsert, { onConflict: 'teamleader_id' });

          if (insertError) {
            console.error('Bulk insert error:', insertError);
            errors.push(`Failed to bulk import ${companiesToInsert.length} companies: ${insertError.message}`);
            failed += companiesToInsert.length;
          } else {
            success += companiesToInsert.length;
            console.log(`Successfully imported ${companiesToInsert.length} companies from page ${page}`);
          }
        } catch (bulkError) {
          console.error('Bulk insert exception:', bulkError);
          errors.push(`Bulk insert exception: ${bulkError.message}`);
          failed += companiesToInsert.length;
        }
      }

      totalPages++;
      page++;

      // For full sync, continue until no more data
      // For regular sync, stop after first page if not explicitly requesting full sync
      if (!fullSync && totalPages >= 1) {
        hasMoreData = false;
      }

      // Rate limiting - small delay between requests
      if (hasMoreData) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Company import completed. Pages processed: ${totalPages}, Total processed: ${processed}, Success: ${success}, Failed: ${failed}`);

  } catch (apiError) {
    console.error('API error importing companies:', apiError);
    errors.push(`API error importing companies: ${apiError.message}`);
    failed = processed;
  }

  return { processed, success, failed, errors };
}

async function exportToTeamLeader(accessToken: string, supabase: any, userId: string, fieldMappings: any[]) {
  let processed = 0;
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    // Get our customers that don't have a TeamLeader ID yet
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('*')
      .is('teamleader_id', null);

    if (customersError) {
      throw new Error('Failed to fetch customers for export');
    }

    for (const customer of customers) {
      processed++;
      
      try {
        // Create contact in TeamLeader
        const contactData = {
          first_name: customer.name?.split(' ')[0] || '',
          last_name: customer.name?.split(' ').slice(1).join(' ') || '',
          email: customer.email,
          telephone: customer.phone
        };

        const response = await fetch(`${TEAMLEADER_API_URL}/contacts.add`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(contactData)
        });

        if (!response.ok) {
          const errorData = await response.json();
          errors.push(`Failed to export customer ${customer.id}: ${errorData.message || response.status}`);
          failed++;
          continue;
        }

        const result = await response.json();

        // Update our customer with the TeamLeader ID
        await supabase
          .from('customers')
          .update({ teamleader_id: result.data.id })
          .eq('id', customer.id);

        success++;

      } catch (exportError) {
        errors.push(`Error exporting customer ${customer.id}: ${exportError.message}`);
        failed++;
      }
    }

  } catch (apiError) {
    errors.push(`API error exporting customers: ${apiError.message}`);
    failed = processed;
  }

  return { processed, success, failed, errors };
}