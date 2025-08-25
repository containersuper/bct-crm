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
      urgency, 
      competitorPrice, 
      targetMargin 
    } = await req.json();
    
    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get customer data with TeamLeader intelligence
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

    // Get customer's historical TeamLeader invoices for pricing intelligence
    const { data: historicalInvoices } = await supabase
      .from('teamleader_invoices')
      .select('*')
      .eq('customer_id', customerId)
      .order('invoice_date', { ascending: false })
      .limit(20);

    // Get customer's TeamLeader quotes for pricing patterns
    const { data: historicalQuotes } = await supabase
      .from('teamleader_quotes')
      .select('*')
      .eq('customer_id', customerId)
      .order('quote_date', { ascending: false })
      .limit(10);

    // Get similar routes and pricing from recent market data
    const { data: marketData } = await supabase
      .from('teamleader_invoices')
      .select('*')
      .ilike('title', `%${route}%`)
      .order('invoice_date', { ascending: false })
      .limit(50);

    // Get customer's deal history for win/loss analysis
    const { data: dealHistory } = await supabase
      .from('teamleader_deals')
      .select('*')
      .eq('customer_id', customerId)
      .order('actual_closing_date', { ascending: false })
      .limit(10);

    // Prepare comprehensive data for Claude analysis
    const customerIntelligence = customer.customer_intelligence?.[0];
    
    const pricingContext = {
      customer: {
        name: customer.name,
        company: customer.company,
        intelligence: customerIntelligence,
      },
      historicalPricing: {
        invoices: historicalInvoices?.map(inv => ({
          total: inv.total_price,
          date: inv.invoice_date,
          title: inv.title,
          status: inv.status
        })) || [],
        quotes: historicalQuotes?.map(quote => ({
          total: quote.total_price,
          date: quote.quote_date,
          title: quote.title,
          status: quote.status
        })) || [],
      },
      marketData: marketData?.map(inv => ({
        total: inv.total_price,
        date: inv.invoice_date,
        title: inv.title
      })) || [],
      dealHistory: dealHistory?.map(deal => ({
        value: deal.value,
        probability: deal.probability,
        phase: deal.phase,
        status: deal.actual_closing_date ? 'won' : 'pending'
      })) || [],
      currentQuote: {
        items: quoteItems,
        route,
        urgency,
        competitorPrice,
        targetMargin
      }
    };

    // Call Claude API for smart pricing analysis
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const pricingPrompt = `
You are BCT's AI pricing expert with complete knowledge of this customer's history from TeamLeader.

CUSTOMER PROFILE:
${JSON.stringify(pricingContext.customer, null, 2)}

HISTORICAL TEAMLEADER DATA:
Previous Invoices (what they actually paid): ${JSON.stringify(pricingContext.historicalPricing.invoices, null, 2)}
Previous Quotes: ${JSON.stringify(pricingContext.historicalPricing.quotes, null, 2)}
Deal Success History: ${JSON.stringify(pricingContext.dealHistory, null, 2)}

MARKET INTELLIGENCE:
Similar route pricing from other customers: ${JSON.stringify(pricingContext.marketData, null, 2)}

CURRENT QUOTE REQUEST:
Route: ${route}
Items: ${JSON.stringify(quoteItems)}
Urgency: ${urgency}
Competitor Price: ${competitorPrice || 'Not provided'}
Target Margin: ${targetMargin || 'Not specified'}%

Based on this complete TeamLeader history and customer intelligence, provide smart pricing recommendations in JSON format:

{
  "recommendedPrice": 0,
  "winProbability": 0.0,
  "margin": 0.0,
  "confidence": 0.0,
  "pricingStrategy": "value_based/competitive/premium/penetration",
  "reasoning": {
    "customerHistory": "Analysis of their payment patterns from TeamLeader invoices",
    "marketPosition": "How this price compares to market rates for similar routes",
    "riskFactors": ["Any risks based on their deal history"],
    "opportunities": ["Upselling opportunities based on past orders"]
  },
  "alternatives": [
    {
      "price": 0,
      "strategy": "Strategy name",
      "winProbability": 0.0,
      "reasoning": "Why this alternative might work"
    }
  ],
  "negotiationInsights": {
    "priceFlexibility": "high/medium/low based on their history",
    "keyDecisionFactors": ["What matters most to this customer"],
    "bestApproach": "How to present this pricing based on their communication style"
  }
}

Consider:
1. Their actual payment history from TeamLeader invoices
2. Success rate of previous deals at different price points
3. Seasonal patterns in their ordering
4. Price sensitivity from customer intelligence
5. Market rates for similar routes
6. Their negotiation patterns from deal history
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
        max_tokens: 3000,
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

    // Log successful pricing analysis
    await supabase
      .from('ai_performance_metrics')
      .insert({
        metric_type: 'smart_pricing_success',
        metric_value: 1,
        context: { 
          customer_id: customerId,
          route,
          recommended_price: pricingAnalysis.recommendedPrice,
          confidence: pricingAnalysis.confidence
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        pricing: pricingAnalysis,
        dataUsed: {
          historicalInvoices: pricingContext.historicalPricing.invoices.length,
          historicalQuotes: pricingContext.historicalPricing.quotes.length,
          marketComparisons: pricingContext.marketData.length,
          dealHistory: pricingContext.dealHistory.length
        }
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