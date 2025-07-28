import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { customerId } = await req.json();
    
    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get customer data
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      throw new Error('Customer not found');
    }

    // Get customer's email history with analytics
    const { data: emails, error: emailsError } = await supabase
      .from('email_history')
      .select(`
        *,
        email_analytics (*)
      `)
      .or(`from_address.eq.${customer.email},to_address.eq.${customer.email}`)
      .order('received_at', { ascending: false })
      .limit(50);

    if (emailsError) {
      console.error('Error fetching emails:', emailsError);
    }

    // Get customer's quotes
    const { data: quotes, error: quotesError } = await supabase
      .from('quotes')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (quotesError) {
      console.error('Error fetching quotes:', quotesError);
    }

    // Prepare data for Claude analysis
    const emailsData = emails?.map(email => ({
      subject: email.subject,
      sentiment: email.email_analytics?.[0]?.sentiment,
      intent: email.email_analytics?.[0]?.intent,
      urgency: email.email_analytics?.[0]?.urgency,
      entities: email.email_analytics?.[0]?.entities,
      direction: email.direction,
      received_at: email.received_at,
      body_preview: email.body?.substring(0, 200) + '...'
    })) || [];

    const quotesData = quotes?.map(quote => ({
      quote_number: quote.quote_number,
      total_price: quote.total_price,
      status: quote.status,
      created_at: quote.created_at,
      items: quote.items
    })) || [];

    // Call Claude API for intelligence analysis
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const analysisPrompt = `
Analyze this customer's data and generate comprehensive business intelligence. Provide insights in JSON format.

Customer Information:
Name: ${customer.name}
Company: ${customer.company || 'Individual'}
Email: ${customer.email}
Phone: ${customer.phone || 'Not provided'}
Brand: ${customer.brand || 'Not specified'}

Email History (${emailsData.length} emails):
${JSON.stringify(emailsData, null, 2)}

Quote History (${quotesData.length} quotes):
${JSON.stringify(quotesData, null, 2)}

Generate a detailed analysis in this exact JSON format:
{
  "ai_summary": "2-3 sentence customer summary highlighting key characteristics and relationship status",
  "communication_style": {
    "preferred_language": "en/de/fr/nl",
    "formality_level": "formal/casual",
    "response_speed_expectation": "immediate/fast/normal/patient",
    "communication_frequency": "high/medium/low"
  },
  "business_patterns": {
    "typical_order_value": 0,
    "seasonal_patterns": ["Q1", "Q2", "Q3", "Q4"],
    "preferred_routes": [],
    "container_preferences": [],
    "payment_behavior": "excellent/good/average/concerning"
  },
  "price_sensitivity": "low/medium/high",
  "decision_factors": [
    "price", "speed", "reliability", "service_quality", "relationships"
  ],
  "lifetime_value": 0,
  "risk_score": 0.0,
  "opportunity_score": 0.0,
  "next_best_action": "Specific recommendation for next engagement",
  "insights": [
    "Key insight 1",
    "Key insight 2",
    "Key insight 3"
  ]
}

Base your analysis on actual data patterns. If insufficient data, indicate this in the summary.
    `;

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: analysisPrompt
          }
        ]
      })
    });

    if (!claudeResponse.ok) {
      throw new Error(`Claude API error: ${claudeResponse.status}`);
    }

    const claudeData = await claudeResponse.json();
    const analysisText = claudeData.content[0].text;
    
    // Parse Claude's JSON response
    let intelligence;
    try {
      intelligence = JSON.parse(analysisText);
    } catch (e) {
      console.error('Failed to parse Claude response:', analysisText);
      throw new Error('Invalid response from Claude');
    }

    // Store intelligence in database
    const { data: intelligenceData, error: intelligenceError } = await supabase
      .from('customer_intelligence')
      .upsert({
        customer_id: customerId,
        ai_summary: intelligence.ai_summary,
        communication_style: intelligence.communication_style,
        business_patterns: intelligence.business_patterns,
        price_sensitivity: intelligence.price_sensitivity,
        decision_factors: intelligence.decision_factors,
        lifetime_value: intelligence.lifetime_value || 0,
        risk_score: intelligence.risk_score || 0,
        opportunity_score: intelligence.opportunity_score || 0,
        next_best_action: intelligence.next_best_action,
        last_analysis: new Date().toISOString()
      }, {
        onConflict: 'customer_id'
      })
      .select()
      .single();

    if (intelligenceError) {
      console.error('Database error:', intelligenceError);
      throw new Error('Failed to save intelligence');
    }

    // Log performance metric
    await supabase
      .from('ai_performance_metrics')
      .insert({
        metric_type: 'customer_intelligence_success',
        metric_value: 1,
        context: { 
          customer_id: customerId,
          emails_analyzed: emailsData.length,
          quotes_analyzed: quotesData.length
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        intelligence: {
          ...intelligenceData,
          insights: intelligence.insights || []
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in claude-customer-intelligence:', error);
    
    // Log error metric
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase
        .from('ai_performance_metrics')
        .insert({
          metric_type: 'customer_intelligence_error',
          metric_value: 1,
          context: { error: error.message }
        });
    } catch (logError) {
      console.error('Failed to log error metric:', logError);
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});