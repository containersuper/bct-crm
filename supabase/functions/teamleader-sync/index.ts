import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  action: 'sync' | 'import' | 'export' | 'full_import';
  syncType?: 'contacts' | 'companies' | 'deals' | 'invoices' | 'quotes' | 'projects' | 'all';
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

interface TeamLeaderDeal {
  id: string;
  title: string;
  description?: string;
  value?: {
    amount: number;
    currency: string;
  };
  phase?: {
    name: string;
  };
  probability?: number;
  expected_closing_date?: string;
  closing_date?: string;
  lead_source?: {
    name: string;
  };
  responsible_user?: {
    id: string;
  };
  customer?: {
    id: string;
  };
  company?: {
    id: string;
  };
  contact?: {
    id: string;
  };
}

interface TeamLeaderInvoice {
  id: string;
  invoice_number: string;
  title?: string;
  description?: string;
  total_price?: {
    amount: number;
    currency: string;
  };
  invoice_date?: string;
  due_date?: string;
  payment_date?: string;
  status?: string;
  customer?: {
    id: string;
  };
  company?: {
    id: string;
  };
  contact?: {
    id: string;
  };
  deal?: {
    id: string;
  };
}

interface TeamLeaderQuote {
  id: string;
  quotation_number: string;
  title?: string;
  description?: string;
  total_price?: {
    amount: number;
    currency: string;
  };
  quotation_date?: string;
  valid_until?: string;
  status?: string;
  customer?: {
    id: string;
  };
  company?: {
    id: string;
  };
  contact?: {
    id: string;
  };
  deal?: {
    id: string;
  };
}

interface TeamLeaderProject {
  id: string;
  title: string;
  description?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  budget?: {
    amount: number;
    currency: string;
  };
  customer?: {
    id: string;
  };
  company?: {
    id: string;
  };
  responsible_user?: {
    id: string;
  };
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

    const { action, syncType = 'all', fullSync = false, batchSize = 200, maxPages = 15 }: SyncRequest = await req.json();

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

        // Import deals from TeamLeader
        if (syncType === 'deals' || syncType === 'all') {
          const dealsResult = await importDeals(connection.access_token, supabase, user.id, fullSync || action === 'full_import', batchSize, maxPages);
          totalProcessed += dealsResult.processed;
          totalSuccess += dealsResult.success;
          totalFailed += dealsResult.failed;
          errors.push(...dealsResult.errors);
        }

        // Import invoices from TeamLeader
        if (syncType === 'invoices' || syncType === 'all') {
          const invoicesResult = await importInvoices(connection.access_token, supabase, user.id, fullSync || action === 'full_import', batchSize, maxPages);
          totalProcessed += invoicesResult.processed;
          totalSuccess += invoicesResult.success;
          totalFailed += invoicesResult.failed;
          errors.push(...invoicesResult.errors);
        }

        // Import quotes from TeamLeader
        if (syncType === 'quotes' || syncType === 'all') {
          const quotesResult = await importQuotes(connection.access_token, supabase, user.id, fullSync || action === 'full_import', batchSize, maxPages);
          totalProcessed += quotesResult.processed;
          totalSuccess += quotesResult.success;
          totalFailed += quotesResult.failed;
          errors.push(...quotesResult.errors);
        }

        // Import projects from TeamLeader
        if (syncType === 'projects' || syncType === 'all') {
          const projectsResult = await importProjects(connection.access_token, supabase, user.id, fullSync || action === 'full_import', batchSize, maxPages);
          totalProcessed += projectsResult.processed;
          totalSuccess += projectsResult.success;
          totalFailed += projectsResult.failed;
          errors.push(...projectsResult.errors);
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
          size: Math.min(fullSync ? batchSize : 100, 250) // TeamLeader has max 250 per page
        }
      };

      // For full sync, only use page numbers after first page, and limit to reasonable numbers
      if (fullSync && page > 1 && page <= 20) { // Limit to 20 pages max for stability
        requestBody.page.number = page;
      } else if (!fullSync && page > 1) {
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
          size: Math.min(fullSync ? batchSize : 100, 250) // TeamLeader has max 250 per page
        }
      };

      // For full sync, limit pagination to avoid API errors
      if (fullSync && page > 1 && page <= 20) {
        requestBody.page.number = page;
      } else if (!fullSync && page > 1) {
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

async function importDeals(accessToken: string, supabase: any, userId: string, fullSync = false, batchSize = 250, maxPages = 50) {
  let processed = 0;
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    let page = 1;
    let hasMoreData = true;
    let totalPages = 0;

    console.log(`Starting deals import - Full sync: ${fullSync}, Batch size: ${batchSize}, Max pages: ${maxPages}`);

    while (hasMoreData && totalPages < maxPages) {
      console.log(`Fetching deals page ${page}...`);
      
      const requestBody = {
        filter: {},
        page: { 
          size: fullSync ? batchSize : 100
        }
      };

      if (page > 1) {
        requestBody.page.number = page;
      }

      const response = await fetch(`${TEAMLEADER_API_URL}/deals.list`, {
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
      const deals: TeamLeaderDeal[] = data.data || [];
      
      console.log(`Received ${deals.length} deals on page ${page}`);

      if (deals.length === 0) {
        hasMoreData = false;
        break;
      }

      const dealsToInsert: any[] = [];

      for (const deal of deals) {
        processed++;
        
        try {
          // Find matching customer by TeamLeader ID
          let customer_id = null;
          if (deal.customer?.id || deal.company?.id) {
            const { data: customer } = await supabase
              .from('customers')
              .select('id')
              .eq('teamleader_id', deal.customer?.id || deal.company?.id)
              .single();
            
            customer_id = customer?.id || null;
          }

          const mappedDeal: any = {
            teamleader_id: deal.id,
            title: deal.title,
            description: deal.description,
            value: deal.value?.amount,
            currency: deal.value?.currency || 'EUR',
            phase: deal.phase?.name,
            probability: deal.probability,
            expected_closing_date: deal.expected_closing_date ? new Date(deal.expected_closing_date).toISOString().split('T')[0] : null,
            actual_closing_date: deal.closing_date ? new Date(deal.closing_date).toISOString().split('T')[0] : null,
            lead_source: deal.lead_source?.name,
            responsible_user_id: deal.responsible_user?.id,
            customer_id: customer_id,
            company_id: deal.company?.id,
            contact_id: deal.contact?.id
          };

          dealsToInsert.push(mappedDeal);

        } catch (dealError) {
          errors.push(`Error processing deal ${deal.id}: ${dealError.message}`);
          failed++;
        }
      }

      // Bulk insert deals
      if (dealsToInsert.length > 0) {
        try {
          const { error: insertError } = await supabase
            .from('teamleader_deals')
            .upsert(dealsToInsert, { onConflict: 'teamleader_id' });

          if (insertError) {
            console.error('Bulk insert error:', insertError);
            errors.push(`Failed to bulk import ${dealsToInsert.length} deals: ${insertError.message}`);
            failed += dealsToInsert.length;
          } else {
            success += dealsToInsert.length;
            console.log(`Successfully imported ${dealsToInsert.length} deals from page ${page}`);
          }
        } catch (bulkError) {
          console.error('Bulk insert exception:', bulkError);
          errors.push(`Bulk insert exception: ${bulkError.message}`);
          failed += dealsToInsert.length;
        }
      }

      totalPages++;
      page++;

      if (!fullSync && totalPages >= 1) {
        hasMoreData = false;
      }

      if (hasMoreData) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Deals import completed. Pages processed: ${totalPages}, Total processed: ${processed}, Success: ${success}, Failed: ${failed}`);

  } catch (apiError) {
    console.error('API error importing deals:', apiError);
    errors.push(`API error importing deals: ${apiError.message}`);
    failed = processed;
  }

  return { processed, success, failed, errors };
}

async function importInvoices(accessToken: string, supabase: any, userId: string, fullSync = false, batchSize = 250, maxPages = 50) {
  let processed = 0;
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    let page = 1;
    let hasMoreData = true;
    let totalPages = 0;

    console.log(`Starting invoices import - Full sync: ${fullSync}, Batch size: ${batchSize}, Max pages: ${maxPages}`);

    while (hasMoreData && totalPages < maxPages) {
      console.log(`Fetching invoices page ${page}...`);
      
      const requestBody = {
        filter: {},
        page: { 
          size: fullSync ? batchSize : 100
        }
      };

      if (page > 1) {
        requestBody.page.number = page;
      }

      const response = await fetch(`${TEAMLEADER_API_URL}/invoices.list`, {
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
      const invoices: TeamLeaderInvoice[] = data.data || [];
      
      console.log(`Received ${invoices.length} invoices on page ${page}`);

      if (invoices.length === 0) {
        hasMoreData = false;
        break;
      }

      const invoicesToInsert: any[] = [];

      for (const invoice of invoices) {
        processed++;
        
        try {
          // Find matching customer
          let customer_id = null;
          if (invoice.customer?.id || invoice.company?.id) {
            const { data: customer } = await supabase
              .from('customers')
              .select('id')
              .eq('teamleader_id', invoice.customer?.id || invoice.company?.id)
              .single();
            
            customer_id = customer?.id || null;
          }

          // Find matching deal
          let deal_id = null;
          if (invoice.deal?.id) {
            const { data: deal } = await supabase
              .from('teamleader_deals')
              .select('id')
              .eq('teamleader_id', invoice.deal.id)
              .single();
            
            deal_id = deal?.id || null;
          }

          const mappedInvoice: any = {
            teamleader_id: invoice.id,
            invoice_number: invoice.invoice_number,
            title: invoice.title,
            description: invoice.description,
            total_price: invoice.total_price?.amount,
            currency: invoice.total_price?.currency || 'EUR',
            invoice_date: invoice.invoice_date ? new Date(invoice.invoice_date).toISOString().split('T')[0] : null,
            due_date: invoice.due_date ? new Date(invoice.due_date).toISOString().split('T')[0] : null,
            payment_date: invoice.payment_date ? new Date(invoice.payment_date).toISOString().split('T')[0] : null,
            status: invoice.status,
            customer_id: customer_id,
            company_id: invoice.company?.id,
            contact_id: invoice.contact?.id,
            deal_id: deal_id
          };

          invoicesToInsert.push(mappedInvoice);

        } catch (invoiceError) {
          errors.push(`Error processing invoice ${invoice.id}: ${invoiceError.message}`);
          failed++;
        }
      }

      // Bulk insert invoices
      if (invoicesToInsert.length > 0) {
        try {
          const { error: insertError } = await supabase
            .from('teamleader_invoices')
            .upsert(invoicesToInsert, { onConflict: 'teamleader_id' });

          if (insertError) {
            console.error('Bulk insert error:', insertError);
            errors.push(`Failed to bulk import ${invoicesToInsert.length} invoices: ${insertError.message}`);
            failed += invoicesToInsert.length;
          } else {
            success += invoicesToInsert.length;
            console.log(`Successfully imported ${invoicesToInsert.length} invoices from page ${page}`);
          }
        } catch (bulkError) {
          console.error('Bulk insert exception:', bulkError);
          errors.push(`Bulk insert exception: ${bulkError.message}`);
          failed += invoicesToInsert.length;
        }
      }

      totalPages++;
      page++;

      if (!fullSync && totalPages >= 1) {
        hasMoreData = false;
      }

      if (hasMoreData) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Invoices import completed. Pages processed: ${totalPages}, Total processed: ${processed}, Success: ${success}, Failed: ${failed}`);

  } catch (apiError) {
    console.error('API error importing invoices:', apiError);
    errors.push(`API error importing invoices: ${apiError.message}`);
    failed = processed;
  }

  return { processed, success, failed, errors };
}

async function importQuotes(accessToken: string, supabase: any, userId: string, fullSync = false, batchSize = 250, maxPages = 50) {
  let processed = 0;
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    let page = 1;
    let hasMoreData = true;
    let totalPages = 0;

    console.log(`Starting quotes import - Full sync: ${fullSync}, Batch size: ${batchSize}, Max pages: ${maxPages}`);

    while (hasMoreData && totalPages < maxPages) {
      console.log(`Fetching quotes page ${page}...`);
      
      const requestBody = {
        filter: {},
        page: { 
          size: fullSync ? batchSize : 100
        }
      };

      if (page > 1) {
        requestBody.page.number = page;
      }

      const response = await fetch(`${TEAMLEADER_API_URL}/quotations.list`, {
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
      const quotes: TeamLeaderQuote[] = data.data || [];
      
      console.log(`Received ${quotes.length} quotes on page ${page}`);

      if (quotes.length === 0) {
        hasMoreData = false;
        break;
      }

      const quotesToInsert: any[] = [];

      for (const quote of quotes) {
        processed++;
        
        try {
          // Find matching customer
          let customer_id = null;
          if (quote.customer?.id || quote.company?.id) {
            const { data: customer } = await supabase
              .from('customers')
              .select('id')
              .eq('teamleader_id', quote.customer?.id || quote.company?.id)
              .single();
            
            customer_id = customer?.id || null;
          }

          // Find matching deal
          let deal_id = null;
          if (quote.deal?.id) {
            const { data: deal } = await supabase
              .from('teamleader_deals')
              .select('id')
              .eq('teamleader_id', quote.deal.id)
              .single();
            
            deal_id = deal?.id || null;
          }

          const mappedQuote: any = {
            teamleader_id: quote.id,
            quote_number: quote.quotation_number,
            title: quote.title,
            description: quote.description,
            total_price: quote.total_price?.amount,
            currency: quote.total_price?.currency || 'EUR',
            quote_date: quote.quotation_date ? new Date(quote.quotation_date).toISOString().split('T')[0] : null,
            valid_until: quote.valid_until ? new Date(quote.valid_until).toISOString().split('T')[0] : null,
            status: quote.status,
            customer_id: customer_id,
            company_id: quote.company?.id,
            contact_id: quote.contact?.id,
            deal_id: deal_id
          };

          quotesToInsert.push(mappedQuote);

        } catch (quoteError) {
          errors.push(`Error processing quote ${quote.id}: ${quoteError.message}`);
          failed++;
        }
      }

      // Bulk insert quotes
      if (quotesToInsert.length > 0) {
        try {
          const { error: insertError } = await supabase
            .from('teamleader_quotes')
            .upsert(quotesToInsert, { onConflict: 'teamleader_id' });

          if (insertError) {
            console.error('Bulk insert error:', insertError);
            errors.push(`Failed to bulk import ${quotesToInsert.length} quotes: ${insertError.message}`);
            failed += quotesToInsert.length;
          } else {
            success += quotesToInsert.length;
            console.log(`Successfully imported ${quotesToInsert.length} quotes from page ${page}`);
          }
        } catch (bulkError) {
          console.error('Bulk insert exception:', bulkError);
          errors.push(`Bulk insert exception: ${bulkError.message}`);
          failed += quotesToInsert.length;
        }
      }

      totalPages++;
      page++;

      if (!fullSync && totalPages >= 1) {
        hasMoreData = false;
      }

      if (hasMoreData) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Quotes import completed. Pages processed: ${totalPages}, Total processed: ${processed}, Success: ${success}, Failed: ${failed}`);

  } catch (apiError) {
    console.error('API error importing quotes:', apiError);
    errors.push(`API error importing quotes: ${apiError.message}`);
    failed = processed;
  }

  return { processed, success, failed, errors };
}

async function importProjects(accessToken: string, supabase: any, userId: string, fullSync = false, batchSize = 250, maxPages = 50) {
  let processed = 0;
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    let page = 1;
    let hasMoreData = true;
    let totalPages = 0;

    console.log(`Starting projects import - Full sync: ${fullSync}, Batch size: ${batchSize}, Max pages: ${maxPages}`);

    while (hasMoreData && totalPages < maxPages) {
      console.log(`Fetching projects page ${page}...`);
      
      const requestBody = {
        filter: {},
        page: { 
          size: fullSync ? batchSize : 100
        }
      };

      if (page > 1) {
        requestBody.page.number = page;
      }

      const response = await fetch(`${TEAMLEADER_API_URL}/projects.list`, {
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
      const projects: TeamLeaderProject[] = data.data || [];
      
      console.log(`Received ${projects.length} projects on page ${page}`);

      if (projects.length === 0) {
        hasMoreData = false;
        break;
      }

      const projectsToInsert: any[] = [];

      for (const project of projects) {
        processed++;
        
        try {
          // Find matching customer
          let customer_id = null;
          if (project.customer?.id || project.company?.id) {
            const { data: customer } = await supabase
              .from('customers')
              .select('id')
              .eq('teamleader_id', project.customer?.id || project.company?.id)
              .single();
            
            customer_id = customer?.id || null;
          }

          const mappedProject: any = {
            teamleader_id: project.id,
            title: project.title,
            description: project.description,
            status: project.status,
            start_date: project.start_date ? new Date(project.start_date).toISOString().split('T')[0] : null,
            end_date: project.end_date ? new Date(project.end_date).toISOString().split('T')[0] : null,
            budget: project.budget?.amount,
            currency: project.budget?.currency || 'EUR',
            customer_id: customer_id,
            company_id: project.company?.id,
            responsible_user_id: project.responsible_user?.id
          };

          projectsToInsert.push(mappedProject);

        } catch (projectError) {
          errors.push(`Error processing project ${project.id}: ${projectError.message}`);
          failed++;
        }
      }

      // Bulk insert projects
      if (projectsToInsert.length > 0) {
        try {
          const { error: insertError } = await supabase
            .from('teamleader_projects')
            .upsert(projectsToInsert, { onConflict: 'teamleader_id' });

          if (insertError) {
            console.error('Bulk insert error:', insertError);
            errors.push(`Failed to bulk import ${projectsToInsert.length} projects: ${insertError.message}`);
            failed += projectsToInsert.length;
          } else {
            success += projectsToInsert.length;
            console.log(`Successfully imported ${projectsToInsert.length} projects from page ${page}`);
          }
        } catch (bulkError) {
          console.error('Bulk insert exception:', bulkError);
          errors.push(`Bulk insert exception: ${bulkError.message}`);
          failed += projectsToInsert.length;
        }
      }

      totalPages++;
      page++;

      if (!fullSync && totalPages >= 1) {
        hasMoreData = false;
      }

      if (hasMoreData) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Projects import completed. Pages processed: ${totalPages}, Total processed: ${processed}, Success: ${success}, Failed: ${failed}`);

  } catch (apiError) {
    console.error('API error importing projects:', apiError);
    errors.push(`API error importing projects: ${apiError.message}`);
    failed = processed;
  }

  return { processed, success, failed, errors };
}