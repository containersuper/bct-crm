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
    const { customerId, analysisType = 'next_order_prediction' } = await req.json();
    
    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get customer with intelligence
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

    // Get comprehensive TeamLeader historical data
    const [invoiceHistory, quoteHistory, dealHistory, activityHistory] = await Promise.all([
      // Invoice pattern analysis (actual orders)
      supabase
        .from('teamleader_invoices')
        .select('*')
        .eq('customer_id', customerId)
        .order('invoice_date', { ascending: false })
        .limit(50),
      
      // Quote conversion patterns
      supabase
        .from('teamleader_quotes')
        .select('*')
        .eq('customer_id', customerId)
        .order('quote_date', { ascending: false })
        .limit(30),
      
      // Deal pipeline patterns
      supabase
        .from('teamleader_deals')
        .select('*')
        .eq('customer_id', customerId)
        .order('expected_closing_date', { ascending: false })
        .limit(20),
        
      // Communication and activity patterns
      supabase
        .from('teamleader_activities')
        .select('*')
        .eq('customer_id', customerId)
        .order('starts_at', { ascending: false })
        .limit(100)
    ]);

    // Get email communication patterns
    const { data: emailHistory } = await supabase
      .from('email_history')
      .select(`
        *,
        email_analytics (*)
      `)
      .or(`from_address.eq.${customer.email},to_address.eq.${customer.email}`)
      .order('received_at', { ascending: false })
      .limit(100);

    // Prepare comprehensive analysis data
    const analysisData = {
      customer: {
        name: customer.name,
        company: customer.company,
        intelligence: customer.customer_intelligence?.[0],
      },
      orderHistory: {
        invoices: invoiceHistory.data?.map(inv => ({
          date: inv.invoice_date,
          amount: inv.total_price,
          title: inv.title,
          status: inv.status,
          daysSinceOrder: inv.invoice_date ? 
            Math.floor((new Date().getTime() - new Date(inv.invoice_date).getTime()) / (1000 * 3600 * 24)) : null
        })) || [],
        quotes: quoteHistory.data?.map(quote => ({
          date: quote.quote_date,
          amount: quote.total_price,
          title: quote.title,
          status: quote.status,
          converted: quote.status === 'accepted'
        })) || [],
      },
      salesPipeline: {
        deals: dealHistory.data?.map(deal => ({
          title: deal.title,
          value: deal.value,
          probability: deal.probability,
          phase: deal.phase,
          expectedClose: deal.expected_closing_date,
          actualClose: deal.actual_closing_date,
          status: deal.actual_closing_date ? 'won' : 'open'
        })) || [],
      },
      communicationPatterns: {
        activities: activityHistory.data?.map(activity => ({
          type: activity.activity_type,
          date: activity.starts_at,
          subject: activity.subject,
          status: activity.status
        })) || [],
        emails: emailHistory?.map(email => ({
          date: email.received_at,
          direction: email.direction,
          sentiment: email.email_analytics?.[0]?.sentiment,
          intent: email.email_analytics?.[0]?.intent,
          urgency: email.email_analytics?.[0]?.urgency
        })) || [],
      }
    };

    // Call Claude API for predictive analysis
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const predictionPrompt = `
You are BCT's AI sales forecasting expert analyzing complete TeamLeader customer data for predictive insights.

CUSTOMER PROFILE:
${JSON.stringify(analysisData.customer, null, 2)}

COMPLETE ORDER HISTORY FROM TEAMLEADER:
${JSON.stringify(analysisData.orderHistory, null, 2)}

SALES PIPELINE & DEALS:
${JSON.stringify(analysisData.salesPipeline, null, 2)}

COMMUNICATION PATTERNS:
${JSON.stringify(analysisData.communicationPatterns, null, 2)}

Based on this complete TeamLeader history, provide predictive sales analysis in JSON format:

{
  "nextOrderPrediction": {
    "probabilityScore": 0.0,
    "predictedDate": "YYYY-MM-DD",
    "predictedValue": 0,
    "confidence": 0.0,
    "reasoning": "Detailed explanation based on historical patterns"
  },
  "buyingPatterns": {
    "averageOrderValue": 0,
    "orderFrequency": "monthly/quarterly/yearly/irregular",
    "seasonalTrends": ["Q1", "Q2", "Q3", "Q4"],
    "preferredRoutes": [],
    "growthTrend": "increasing/stable/decreasing"
  },
  "riskAssessment": {
    "churnRisk": 0.0,
    "paymentRisk": 0.0,
    "competitorThreat": 0.0,
    "riskFactors": ["List of specific risks based on data"],
    "mitigationActions": ["Recommended actions to reduce risks"]
  },
  "opportunities": {
    "upsellPotential": 0.0,
    "crossSellOpportunities": [],
    "volumeIncreasePotential": 0.0,
    "newRoutePotential": [],
    "recommendedActions": ["Specific actions to capture opportunities"]
  },
  "dealPipelineInsights": {
    "averageDealsToClose": 0,
    "typicalSalesCycle": 0,
    "winRate": 0.0,
    "averageDealSize": 0,
    "bestApproachTiming": "When to engage for highest success"
  },
  "communicationInsights": {
    "responsePatterns": "How quickly they typically respond",
    "preferredCommunicationTiming": "Best times to contact",
    "engagementTriggers": ["What typically prompts them to engage"],
    "decisionMakingStyle": "fast/deliberate/committee-based"
  },
  "recommendations": {
    "immediateActions": ["Actions to take in next 30 days"],
    "strategicActions": ["Long-term relationship building actions"],
    "keyMetricsToTrack": ["Important indicators to monitor"],
    "successProbability": 0.0
  }
}

Analyze patterns in:
1. Order timing and frequency from invoice history
2. Quote-to-order conversion rates and timing
3. Deal progression patterns and success factors
4. Communication response patterns from activities and emails
5. Seasonal ordering behavior
6. Value progression over time
7. Risk indicators from payment and communication patterns
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
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: predictionPrompt
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
    let salesPrediction;
    try {
      salesPrediction = JSON.parse(analysisText);
    } catch (e) {
      console.error('Failed to parse Claude response:', analysisText);
      throw new Error('Invalid response from Claude');
    }

    // Store prediction results in customer intelligence
    await supabase
      .from('customer_intelligence')
      .upsert({
        customer_id: customerId,
        opportunity_score: salesPrediction.nextOrderPrediction?.probabilityScore || 0,
        risk_score: salesPrediction.riskAssessment?.churnRisk || 0,
        next_best_action: salesPrediction.recommendations?.immediateActions?.[0] || 'Continue monitoring',
        last_analysis: new Date().toISOString()
      }, {
        onConflict: 'customer_id'
      });

    // Log successful analysis
    await supabase
      .from('ai_performance_metrics')
      .insert({
        metric_type: 'predictive_sales_success',
        metric_value: 1,
        context: { 
          customer_id: customerId,
          analysis_type: analysisType,
          data_points: {
            invoices: analysisData.orderHistory.invoices.length,
            quotes: analysisData.orderHistory.quotes.length,
            deals: analysisData.salesPipeline.deals.length,
            activities: analysisData.communicationPatterns.activities.length
          }
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        prediction: salesPrediction,
        dataAnalyzed: {
          invoiceCount: analysisData.orderHistory.invoices.length,
          quoteCount: analysisData.orderHistory.quotes.length,
          dealCount: analysisData.salesPipeline.deals.length,
          activityCount: analysisData.communicationPatterns.activities.length,
          emailCount: analysisData.communicationPatterns.emails.length
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in claude-predictive-sales:', error);
    
    // Log error metric
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase
        .from('ai_performance_metrics')
        .insert({
          metric_type: 'predictive_sales_error',
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