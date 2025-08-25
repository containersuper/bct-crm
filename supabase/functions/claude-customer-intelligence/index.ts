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

    // Get comprehensive customer data including TeamLeader history
    const [emails, quotes, teamleaderInvoices, teamleaderQuotes, teamleaderDeals, teamleaderActivities] = await Promise.all([
      // Email history with analytics
      supabase
        .from('email_history')
        .select(`
          *,
          email_analytics (*)
        `)
        .or(`from_address.eq.${customer.email},to_address.eq.${customer.email}`)
        .order('received_at', { ascending: false })
        .limit(50),
      
      // BCT quotes
      supabase
        .from('quotes')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false }),
        
      // TeamLeader invoice history (actual payments and behavior)
      supabase
        .from('teamleader_invoices')
        .select('*')
        .eq('customer_id', customerId)
        .order('invoice_date', { ascending: false })
        .limit(30),
        
      // TeamLeader quote history (pricing patterns)
      supabase
        .from('teamleader_quotes')
        .select('*')
        .eq('customer_id', customerId)
        .order('quote_date', { ascending: false })
        .limit(20),
        
      // TeamLeader deal history (sales patterns)
      supabase
        .from('teamleader_deals')
        .select('*')
        .eq('customer_id', customerId)
        .order('expected_closing_date', { ascending: false })
        .limit(15),
        
      // TeamLeader activity history (interaction patterns)
      supabase
        .from('teamleader_activities')
        .select('*')
        .eq('customer_id', customerId)
        .order('starts_at', { ascending: false })
        .limit(50)
    ]);

    if (emails.error) {
      console.error('Error fetching emails:', emails.error);
    }
    if (quotes.error) {
      console.error('Error fetching quotes:', quotes.error);
    }

    // Prepare comprehensive data for Claude analysis with TeamLeader intelligence
    const emailsData = emails.data?.map(email => ({
      subject: email.subject,
      sentiment: email.email_analytics?.[0]?.sentiment,
      intent: email.email_analytics?.[0]?.intent,
      urgency: email.email_analytics?.[0]?.urgency,
      entities: email.email_analytics?.[0]?.entities,
      direction: email.direction,
      received_at: email.received_at,
      body_preview: email.body?.substring(0, 200) + '...'
    })) || [];

    const quotesData = quotes.data?.map(quote => ({
      quote_number: quote.quote_number,
      total_price: quote.total_price,
      status: quote.status,
      created_at: quote.created_at,
      items: quote.items
    })) || [];

    // TeamLeader data for comprehensive analysis
    const teamleaderData = {
      invoices: teamleaderInvoices.data?.map(inv => ({
        invoice_number: inv.invoice_number,
        total_price: inv.total_price,
        invoice_date: inv.invoice_date,
        payment_date: inv.payment_date,
        status: inv.status,
        title: inv.title
      })) || [],
      quotes: teamleaderQuotes.data?.map(quote => ({
        quote_number: quote.quote_number,
        total_price: quote.total_price,
        quote_date: quote.quote_date,
        status: quote.status,
        title: quote.title
      })) || [],
      deals: teamleaderDeals.data?.map(deal => ({
        title: deal.title,
        value: deal.value,
        probability: deal.probability,
        phase: deal.phase,
        expected_closing_date: deal.expected_closing_date,
        actual_closing_date: deal.actual_closing_date
      })) || [],
      activities: teamleaderActivities.data?.map(activity => ({
        type: activity.activity_type,
        subject: activity.subject,
        starts_at: activity.starts_at,
        status: activity.status
      })) || []
    };

    // Call Claude API for intelligence analysis
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const analysisPrompt = `
You are BCT's AI intelligence expert with complete access to this customer's TeamLeader CRM history. Analyze ALL available data for comprehensive business intelligence.

CUSTOMER PROFILE:
Name: ${customer.name}
Company: ${customer.company || 'Individual'}
Email: ${customer.email}
Phone: ${customer.phone || 'Not provided'}
Brand: ${customer.brand || 'Not specified'}
TeamLeader ID: ${customer.teamleader_id || 'Not linked'}

EMAIL COMMUNICATION HISTORY (${emailsData.length} emails):
${JSON.stringify(emailsData, null, 2)}

BCT QUOTE HISTORY (${quotesData.length} quotes):
${JSON.stringify(quotesData, null, 2)}

COMPLETE TEAMLEADER CRM HISTORY:
=================================

INVOICE HISTORY (${teamleaderData.invoices.length} invoices - ACTUAL PAYMENT BEHAVIOR):
${JSON.stringify(teamleaderData.invoices, null, 2)}

TEAMLEADER QUOTE HISTORY (${teamleaderData.quotes.length} quotes - PRICING PATTERNS):
${JSON.stringify(teamleaderData.quotes, null, 2)}

DEAL PIPELINE HISTORY (${teamleaderData.deals.length} deals - SALES PATTERNS):
${JSON.stringify(teamleaderData.deals, null, 2)}

ACTIVITY & INTERACTION HISTORY (${teamleaderData.activities.length} activities - RELATIONSHIP PATTERNS):
${JSON.stringify(teamleaderData.activities, null, 2)}

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

Base your analysis on actual TeamLeader data patterns:
1. Payment behavior from invoice history (when they pay, how much, payment delays)
2. Pricing acceptance from quote conversion rates
3. Sales cycle patterns from deal progression
4. Relationship quality from activity frequency and types
5. Seasonal patterns from historical order timing
6. Growth trends from value progression over time
7. Risk indicators from payment and communication patterns

This customer has ${teamleaderData.invoices.length + teamleaderData.quotes.length + teamleaderData.deals.length + teamleaderData.activities.length} TeamLeader data points for analysis. Use this comprehensive history to provide accurate, data-driven intelligence.
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