import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Get TeamLeader connection (most recent active one)
    const { data: connections, error: connectionError } = await supabase
      .from('teamleader_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
    
    const connection = connections?.[0]

    if (connectionError || !connection) {
      console.error('No active TeamLeader connection found:', connectionError)
      return new Response(
        JSON.stringify({ error: 'No active TeamLeader connection found' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Check if token needs refresh and refresh if needed
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
        
        const { error: updateError } = await supabase
          .from('teamleader_connections')
          .update({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', connection.id)
          
        if (updateError) {
          console.error('Failed to update token:', updateError)
        } else {
          console.log('Token refreshed successfully')
        }
      } else {
        const errorText = await refreshResponse.text()
        console.error('Token refresh failed:', refreshResponse.status, errorText)
        return new Response(
          JSON.stringify({ error: 'Failed to refresh TeamLeader token' }),
          { status: 401, headers: corsHeaders }
        )
      }
    }

    // Test API call to get a single invoice
    const testResponse = await fetch('https://api.teamleader.eu/invoices.list', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        'page[size]': 1,
        'page[number]': 1
      })
    })

    if (!testResponse.ok) {
      console.error('TeamLeader API test failed:', testResponse.status, testResponse.statusText)
      return new Response(
        JSON.stringify({ 
          error: 'TeamLeader API test failed',
          status: testResponse.status,
          statusText: testResponse.statusText
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    const testData = await testResponse.json()
    console.log('TeamLeader API test successful, sample invoice:', JSON.stringify(testData.data[0], null, 2))

    // Now test PDF download
    if (testData.data && testData.data.length > 0) {
      const sampleInvoice = testData.data[0]
      
      const pdfResponse = await fetch('https://api.teamleader.eu/invoices.download', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: sampleInvoice.id,
          format: 'pdf'
        })
      })

      console.log('PDF download test response status:', pdfResponse.status)
      console.log('PDF download test response headers:', JSON.stringify(Object.fromEntries(pdfResponse.headers.entries())))

      if (pdfResponse.ok) {
        const contentType = pdfResponse.headers.get('content-type')
        console.log('PDF download successful, content-type:', contentType)
        
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'PDF download test successful',
            invoice_id: sampleInvoice.id,
            content_type: contentType
          }),
          { status: 200, headers: corsHeaders }
        )
      } else {
        const errorText = await pdfResponse.text()
        console.error('PDF download failed:', errorText)
        
        return new Response(
          JSON.stringify({ 
            error: 'PDF download test failed',
            status: pdfResponse.status,
            response: errorText
          }),
          { status: 500, headers: corsHeaders }
        )
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'TeamLeader API connection test successful, but no invoices found to test PDF download'
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