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
    const { 
      customerId, 
      quoteItems, 
      route, 
      urgency = 'normal',
      competitorPrice,
      targetMargin = 15
    } = await req.json();
    
    if (!customerId || !quoteItems) {
      throw new Error('Customer ID and quote items are required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get customer intelligence
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select(`
        *,
        customer_intelligence (*)
      `)
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      throw new Error('Customer not found');
    }

    // Get historical quotes for this customer
    const { data: historicalQuotes, error: quotesError } = await supabase
      .from('quotes')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (quotesError) {
      console.error('Error fetching quotes:', quotesError);
    }

    // Get market data (similar quotes for pricing context)
    const { data: marketQuotes, error: marketError } = await supabase
      .from('quotes')
      .select('total_price, items, status, created_at')
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()) // Last 90 days
      .limit(50);

    if (marketError) {
      console.error('Error fetching market data:', marketError);
    }

    // Prepare data for Claude analysis
    const customerIntelligence = customer.customer_intelligence?.[0];
    const customerData = {
      name: customer.name,
      company: customer.company,
      price_sensitivity: customerIntelligence?.price_sensitivity || 'medium',
      lifetime_value: customerIntelligence?.lifetime_value || 0,
      risk_score: customerIntelligence?.risk_score || 0.5,
      opportunity_score: customerIntelligence?.opportunity_score || 0.5,
      business_patterns: customerIntelligence?.business_patterns || {}
    };

    const historicalData = historicalQuotes?.map(quote => ({
      quote_number: quote.quote_number,
      total_price: quote.total_price,
      status: quote.status,
      items: quote.items,
      created_at: quote.created_at
    })) || [];

    // Call Claude API for pricing analysis
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const pricingPrompt = `
You are a pricing expert for a logistics company. Generate optimal pricing recommendations based on customer intelligence and market data.

Customer Profile:
${JSON.stringify(customerData, null, 2)}

Quote Requirements:
Items: ${JSON.stringify(quoteItems, null, 2)}
Route: ${route || 'Not specified'}
Urgency: ${urgency}
Target Margin: ${targetMargin}%
Competitor Price: ${competitorPrice || 'Not provided'}

Historical Customer Quotes:
${JSON.stringify(historicalData, null, 2)}

Market Context (Recent similar quotes):
${JSON.stringify(marketQuotes?.slice(0, 10), null, 2)}

Generate pricing recommendations in this exact JSON format:
{
  "recommended_price": 0,
  "price_range": {
    "minimum": 0,
    "maximum": 0,
    "optimal": 0
  },
  "win_probability": 0.0,
  "margin_analysis": {
    "target_margin": 0,
    "actual_margin": 0,
    "margin_vs_target": 0
  },
  "pricing_factors": [
    {
      "factor": "Customer loyalty",
      "impact": "positive/negative/neutral",
      "weight": 0.0,
      "description": "Explanation"
    }
  ],
  "competitive_position": "above/at/below market",
  "pricing_strategy": "premium/competitive/aggressive",
  "volume_discounts": [
    {
      "threshold": 0,
      "discount_percentage": 0,
      "new_price": 0
    }
  ],
  "recommendations": [
    "Specific pricing recommendation 1",
    "Specific pricing recommendation 2"
  ],
  "risk_assessment": {
    "price_rejection_risk": "low/medium/high",
    "margin_erosion_risk": "low/medium/high",
    "customer_retention_impact": "positive/neutral/negative"
  },
  "explanation": "Detailed explanation of the pricing logic and key factors"
}

Consider:
1. Customer's price sensitivity and historical behavior
2. Market positioning and competitor pricing
3. Urgency and service level requirements
4. Customer lifetime value and relationship strength
5. Seasonal patterns and market conditions
6. Risk factors and margin protection
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
        max_tokens: 2500,
        messages: [
          {
            role: 'user',
            content: pricingPrompt
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
    let pricingAnalysis;
    try {
      pricingAnalysis = JSON.parse(analysisText);
    } catch (e) {
      console.error('Failed to parse Claude response:', analysisText);
      throw new Error('Invalid response from Claude');
    }

    // Log performance metric
    await supabase
      .from('ai_performance_metrics')
      .insert({
        metric_type: 'smart_pricing_success',
        metric_value: 1,
        context: { 
          customer_id: customerId,
          recommended_price: pricingAnalysis.recommended_price,
          win_probability: pricingAnalysis.win_probability,
          strategy: pricingAnalysis.pricing_strategy
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        pricing: pricingAnalysis
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in claude-smart-pricing:', error);
    
    // Log error metric
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase
        .from('ai_performance_metrics')
        .insert({
          metric_type: 'smart_pricing_error',
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