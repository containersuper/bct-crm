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

    // Get email with analysis and customer data
    const { data: emailData, error } = await supabase
      .from('email_history')
      .select(`
        *,
        email_analytics (*),
        customers (
          *,
          customer_intelligence (*),
          quotes (total_price, created_at, status)
        )
      `)
      .eq('id', emailId)
      .single();

    if (error) throw error;

    const analysis = emailData.email_analytics?.[0];
    const customer = emailData.customers;
    const requirements = analysis?.container_requirements;

    // Get market pricing data
    const { data: pricingData } = await supabase
      .from('container_pricing')
      .select('*')
      .eq('container_type', requirements?.container_types?.[0] || '20ft')
      .eq('route_from', requirements?.pickup_location || 'Hamburg')
      .eq('route_to', requirements?.delivery_location || 'Berlin')
      .order('created_at', { ascending: false })
      .limit(1);

    // Generate quote with Claude
    const quotePrompt = `
Generate a professional German container trading quote based on this analysis:

Email Analysis:
${JSON.stringify(analysis, null, 2)}

Customer Information:
${JSON.stringify(customer, null, 2)}

Container Requirements:
${JSON.stringify(requirements, null, 2)}

Market Pricing Reference:
${JSON.stringify(pricingData, null, 2)}

Generate a complete quote in JSON format:

{
  "quote_content": "Sehr geehrte Damen und Herren,\\n\\nvielen Dank für Ihre Anfrage bezüglich Container-Transport. Gerne unterbreiten wir Ihnen folgendes Angebot:\\n\\n[Details des Angebots]\\n\\nWir freuen uns auf Ihre Rückmeldung.\\n\\nMit freundlichen Grüßen\\nIhr BCT Team",
  "pricing": {
    "container_cost": 12000,
    "transport_cost": 2500,
    "handling_fee": 750,
    "insurance": 250,
    "total": 15500
  },
  "terms": {
    "delivery_time": "7-10 Werktage",
    "payment_terms": "30 Tage netto",
    "validity": "14 Tage",
    "warranty": "12 Monate"
  },
  "personalization": {
    "customer_name": "extracted from email",
    "reference_number": "BCT-2024-001",
    "special_notes": "Erwähnung der schnellen Lieferung wie gewünscht"
  },
  "ai_reasoning": {
    "pricing_strategy": "competitive pricing due to high lead score",
    "margin": 0.25,
    "confidence": 0.92,
    "risk_factors": ["market volatility", "transport availability"]
  }
}

Make sure to:
1. Use proper German business language
2. Base pricing on market data provided
3. Include personalized elements from the email
4. Adjust pricing strategy based on lead quality and customer history
5. Include all necessary business terms and conditions
`;

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
        messages: [{ role: 'user', content: quotePrompt }]
      })
    });

    const claudeData = await claudeResponse.json();
    
    if (!claudeData.content || !claudeData.content[0]) {
      throw new Error('Invalid response from Claude API');
    }

    let quoteData;
    try {
      quoteData = JSON.parse(claudeData.content[0].text);
    } catch (parseError) {
      console.error('Failed to parse Claude response:', claudeData);
      throw new Error('Invalid JSON response from Claude');
    }

    // Generate reference number if not provided
    const referenceNumber = quoteData.personalization?.reference_number || 
                           `BCT-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    // Create customer if new
    let customerId = customer?.id;
    if (!customerId && emailData.from_address) {
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          name: quoteData.personalization?.customer_name || emailData.from_address.split('@')[0],
          email: emailData.from_address,
          company: quoteData.personalization?.customer_name || 'Unknown Company',
          brand: emailData.brand || 'bct'
        })
        .select()
        .single();

      if (customerError) {
        console.error('Customer creation error:', customerError);
      } else {
        customerId = newCustomer.id;
        
        // Update email with customer_id
        await supabase
          .from('email_history')
          .update({ customer_id: customerId })
          .eq('id', emailId);
      }
    }

    // Save quote to database
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        customer_id: customerId,
        email_id: emailId,
        quote_number: referenceNumber,
        content: quoteData.quote_content,
        total_price: quoteData.pricing?.total || 0,
        pricing_breakdown: quoteData.pricing || {},
        terms: quoteData.terms || {},
        status: 'draft',
        brand: emailData.brand || 'bct',
        ai_generated: true,
        ai_reasoning: quoteData.ai_reasoning || {},
        reference_number: referenceNumber,
        items: [{
          description: `Container Quote - ${requirements?.container_types?.join(', ') || '20ft'}`,
          quantity: requirements?.quantities?.reduce((a: number, b: number) => a + b, 0) || 1,
          unit_price: quoteData.pricing?.total || 0,
          total: quoteData.pricing?.total || 0
        }]
      })
      .select()
      .single();

    if (quoteError) {
      console.error('Quote creation error:', quoteError);
      throw quoteError;
    }

    // Log performance metrics
    await supabase
      .from('ai_performance_metrics')
      .insert({
        metric_type: 'quote_generation_success',
        metric_value: 1,
        context: { 
          email_id: emailId,
          quote_id: quote.id,
          total_price: quoteData.pricing?.total || 0,
          confidence: quoteData.ai_reasoning?.confidence || 0
        }
      });

    console.log(`Successfully generated quote ${referenceNumber} for email ${emailId}`);

    return new Response(JSON.stringify({ 
      success: true, 
      quote,
      quoteData 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Quote generation error:', error);
    
    // Log error metrics
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    await supabase
      .from('ai_performance_metrics')
      .insert({
        metric_type: 'quote_generation_error',
        metric_value: 0,
        context: { error: error.message }
      });

    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});