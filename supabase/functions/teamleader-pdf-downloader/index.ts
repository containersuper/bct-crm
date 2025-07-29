import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PDFDownloadRequest {
  type: 'invoices' | 'quotes'
  limit?: number
  batch_size?: number
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Authenticate user
    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      console.error('Authentication error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      )
    }

    // Get TeamLeader connection
    const { data: connection, error: connectionError } = await supabase
      .from('teamleader_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (connectionError || !connection) {
      console.error('No active TeamLeader connection found:', connectionError)
      return new Response(
        JSON.stringify({ error: 'No active TeamLeader connection found' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Check if token needs refresh
    let accessToken = connection.access_token
    if (connection.token_expires_at && new Date(connection.token_expires_at) <= new Date()) {
      console.log('Token expired, refreshing...')
      
      const refreshResponse = await fetch('https://api.teamleader.eu/oauth2/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          'client_id': Deno.env.get('TEAMLEADER_CLIENT_ID')!,
          'client_secret': Deno.env.get('TEAMLEADER_CLIENT_SECRET')!,
          'refresh_token': connection.refresh_token!,
          'grant_type': 'refresh_token'
        })
      })

      if (refreshResponse.ok) {
        const tokenData = await refreshResponse.json()
        accessToken = tokenData.access_token
        
        await supabase
          .from('teamleader_connections')
          .update({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', connection.id)
      }
    }

    const request: PDFDownloadRequest = await req.json()
    const { type, limit = 100, batch_size = 10 } = request

    console.log(`Starting PDF download for ${type}, limit: ${limit}, batch_size: ${batch_size}`)

    // Get records that need PDF download
    const tableName = type === 'invoices' ? 'teamleader_invoices' : 'teamleader_quotes'
    const { data: records, error: recordsError } = await supabase
      .from(tableName)
      .select('id, teamleader_id, invoice_number, quote_number, title')
      .is('pdf_url', null)
      .eq('pdf_download_status', 'pending')
      .limit(limit)

    if (recordsError) {
      console.error('Error fetching records:', recordsError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch records' }),
        { status: 500, headers: corsHeaders }
      )
    }

    console.log(`Found ${records.length} records to download PDFs for`)

    let totalDownloaded = 0
    let totalErrors = 0
    const errors: any[] = []

    // Process in batches
    for (let i = 0; i < records.length; i += batch_size) {
      const batch = records.slice(i, i + batch_size)
      console.log(`Processing batch ${Math.floor(i / batch_size) + 1}/${Math.ceil(records.length / batch_size)}`)

      const batchPromises = batch.map(async (record) => {
        try {
          // Download PDF from TeamLeader
          const endpoint = type === 'invoices' ? 'invoices.download' : 'quotations.download'
          const apiUrl = type === 'invoices' 
            ? 'https://api.teamleader.eu/invoices.download'
            : 'https://api.teamleader.eu/quotations.download'
            
          const downloadResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              id: record.teamleader_id,
              format: 'pdf'
            })
          })

          if (!downloadResponse.ok) {
            throw new Error(`TeamLeader API error: ${downloadResponse.status} ${downloadResponse.statusText}`)
          }

          const pdfBuffer = await downloadResponse.arrayBuffer()
          const fileName = type === 'invoices' 
            ? `invoice_${record.invoice_number || record.teamleader_id}.pdf`
            : `quote_${record.quote_number || record.teamleader_id}.pdf`
          
          const filePath = `${type}/${fileName}`

          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('teamleader-pdfs')
            .upload(filePath, pdfBuffer, {
              contentType: 'application/pdf',
              upsert: true
            })

          if (uploadError) {
            throw new Error(`Upload error: ${uploadError.message}`)
          }

          // Update record with PDF URL and status
          const { error: updateError } = await supabase
            .from(tableName)
            .update({
              pdf_url: filePath,
              pdf_download_status: 'completed',
              pdf_downloaded_at: new Date().toISOString()
            })
            .eq('id', record.id)

          if (updateError) {
            throw new Error(`Update error: ${updateError.message}`)
          }

          console.log(`Successfully downloaded and stored PDF for ${type} ${record.teamleader_id}`)
          return { success: true, id: record.id }

        } catch (error) {
          console.error(`Error processing ${type} ${record.teamleader_id}:`, error)
          
          // Update status to failed
          await supabase
            .from(tableName)
            .update({
              pdf_download_status: 'failed'
            })
            .eq('id', record.id)

          return { success: false, id: record.id, error: error.message }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      
      batchResults.forEach(result => {
        if (result.success) {
          totalDownloaded++
        } else {
          totalErrors++
          errors.push(result)
        }
      })

      // Small delay between batches to avoid overwhelming the API
      if (i + batch_size < records.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    console.log(`PDF download completed. Downloaded: ${totalDownloaded}, Errors: ${totalErrors}`)

    return new Response(
      JSON.stringify({
        success: true,
        total_processed: records.length,
        total_downloaded: totalDownloaded,
        total_errors: totalErrors,
        errors: errors.slice(0, 10) // Limit error details to prevent huge responses
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})