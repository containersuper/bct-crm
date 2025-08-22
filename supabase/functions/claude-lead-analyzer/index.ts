import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emailId } = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get email with customer history
    const { data: email, error } = await supabase
      .from('email_history')
      .select(`
        *,
        customers (
          id, name, company, email, brand,
          customer_intelligence (*),
          quotes (created_at, total_price, status)
        )
      `)
      .eq('id', emailId)
      .single();

    if (error) throw error;

    // Enhanced AI prompt for lead identification
    const leadAnalysisPrompt = `
Analyze this container trading email for lead identification and quote preparation:

Email Content:
Subject: ${email.subject}
From: ${email.from_address}
Body: ${email.body}
Brand: ${email.brand}
Customer Status: ${email.customers ? 'Existing' : 'New'}
Previous Orders: ${email.customers?.quotes?.length || 0}

Provide detailed analysis in JSON format:

{
  "language": "en|de|nl|fr",
  "sentiment": "positive|neutral|negative",
  "lead_analysis": {
    "lead_quality": "hot|warm|cold|spam",
    "lead_score": 85,
    "buying_intent": "immediate|planning|researching|price_shopping",
    "decision_timeline": "urgent|this_week|this_month|next_quarter",
    "budget_indicators": "high|medium|low|unknown"
  },
  "container_requirements": {
    "container_types": ["20ft", "40ft"],
    "quantities": [5, 10],
    "condition": "new|used|any",
    "pickup_location": "Hamburg",
    "delivery_location": "Berlin",
    "timeline": "within 2 weeks",
    "special_requirements": ["refrigerated", "customs_cleared"]
  },
  "customer_profile": {
    "company_size": "small|medium|large|enterprise",
    "industry": "logistics|manufacturing|retail|other",
    "experience_level": "expert|intermediate|beginner",
    "price_sensitivity": "low|medium|high",
    "relationship_potential": "one_time|recurring|strategic"
  },
  "quote_recommendations": {
    "should_generate_quote": true,
    "pricing_strategy": "competitive|premium|budget",
    "urgency_level": "immediate|standard|low",
    "personalization_notes": "Mention fast delivery capability",
    "upsell_opportunities": ["insurance", "additional_containers", "return_transport"]
  },
  "next_actions": {
    "priority": "high|medium|low",
    "recommended_response_time": "1_hour|same_day|next_day",
    "follow_up_strategy": "phone_call|email|meeting",
    "internal_notes": "High-value lead, competitor mentioned"
  },
  "entities": ["company_names", "locations", "container_types"],
  "key_phrases": ["urgent", "best price", "long-term partnership"]
}
`;

    // Call Claude API
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [{ role: 'user', content: leadAnalysisPrompt }]
      })
    });

    const claudeData = await claudeResponse.json();
    let analysis;

    try {
      analysis = JSON.parse(claudeData.content[0].text);
    } catch (parseError) {
      console.error('Failed to parse Claude response:', claudeData);
      throw new Error('Invalid JSON response from Claude');
    }

    // Save enhanced analysis
    const { error: analyticsError } = await supabase
      .from('email_analytics')
      .upsert({
        email_id: emailId,
        language: analysis.language || 'en',
        sentiment: analysis.sentiment || 'neutral',
        intent: analysis.lead_analysis?.buying_intent || 'unknown',
        urgency: analysis.next_actions?.priority || 'medium',
        urgency_priority: analysis.next_actions?.priority === 'high' ? 1 : 
                         analysis.next_actions?.priority === 'medium' ? 2 : 3,
        entities: analysis.entities || [],
        key_phrases: analysis.key_phrases || [],
        analysis_timestamp: new Date().toISOString()
      });

    if (analyticsError) {
      console.error('Analytics save error:', analyticsError);
    }

    // Auto-generate quote if recommended
    if (analysis.quote_recommendations?.should_generate_quote) {
      await generateAutoQuote(supabase, emailId, email, analysis);
    }

    // Log performance metrics
    await supabase
      .from('ai_performance_metrics')
      .insert({
        metric_type: 'lead_analysis_success',
        metric_value: 1,
        context: { 
          email_id: emailId,
          lead_score: analysis.lead_analysis?.lead_score || 0,
          lead_quality: analysis.lead_analysis?.lead_quality || 'unknown'
        }
      });

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Lead analysis error:', error);
    
    // Log error metrics
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    await supabase
      .from('ai_performance_metrics')
      .insert({
        metric_type: 'lead_analysis_error',
        metric_value: 0,
        context: { error: error.message }
      });

    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function generateAutoQuote(supabase: any, emailId: number, email: any, analysis: any) {
  try {
    const requirements = analysis.container_requirements;
    const recommendations = analysis.quote_recommendations;

    // Create customer if new
    let customerId = email.customer_id;
    if (!customerId) {
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          name: email.from_address.split('@')[0],
          email: email.from_address,
          company: analysis.customer_profile?.company_size || 'Unknown',
          brand: email.brand
        })
        .select()
        .single();

      if (customerError) {
        console.error('Customer creation error:', customerError);
        return;
      }
      
      customerId = newCustomer.id;
      
      // Update email with customer_id
      await supabase
        .from('email_history')
        .update({ customer_id: customerId })
        .eq('id', emailId);
    }

    // Generate quote items based on requirements
    const quoteItems = requirements.container_types?.map((type: string, index: number) => ({
      description: `${type} Container`,
      quantity: requirements.quantities?.[index] || 1,
      unit_price: getEstimatedPrice(type, recommendations.pricing_strategy),
      total: (requirements.quantities?.[index] || 1) * getEstimatedPrice(type, recommendations.pricing_strategy)
    })) || [];

    const totalPrice = quoteItems.reduce((sum: number, item: any) => sum + item.total, 0);

    // Create quote
    const quoteNumber = `Q-${Date.now()}`;
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        quote_number: quoteNumber,
        customer_id: customerId,
        items: quoteItems,
        total_price: totalPrice,
        status: 'draft'
      })
      .select()
      .single();

    if (quoteError) {
      console.error('Quote creation error:', quoteError);
      return;
    }

    console.log(`Auto-generated quote ${quoteNumber} for email ${emailId}`);
    
  } catch (error) {
    console.error('Auto-quote generation error:', error);
  }
}

function getEstimatedPrice(containerType: string, strategy: string): number {
  const basePrices: { [key: string]: number } = {
    '20ft': 2500,
    '40ft': 4000,
    '40ft_hc': 4200,
    '45ft': 4500
  };

  const basePrice = basePrices[containerType] || 3000;
  
  // Adjust based on pricing strategy
  switch (strategy) {
    case 'premium':
      return basePrice * 1.2;
    case 'budget':
      return basePrice * 0.8;
    case 'competitive':
    default:
      return basePrice;
  }
}