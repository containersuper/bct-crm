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
    const { emailId } = await req.json();
    
    if (!emailId) {
      throw new Error('Email ID is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get email data with customer information
    const { data: email, error: emailError } = await supabase
      .from('email_history')
      .select(`
        *,
        customers (
          id,
          name,
          company,
          email,
          customer_intelligence (
            customer_tier
          )
        )
      `)
      .eq('id', emailId)
      .single();

    if (emailError || !email) {
      throw new Error('Email not found');
    }

    const isExistingCustomer = !!email.customers;
    const customerTier = email.customers?.customer_intelligence?.[0]?.customer_tier || 'standard';

    // Prepare email content for Claude
    const emailContent = `
Subject: ${email.subject || 'No subject'}
From: ${email.from_address || 'Unknown sender'}
To: ${email.to_address || 'Unknown recipient'}
Body: ${email.body || 'No content'}
Brand: ${email.brand || 'unknown'}
Customer Status: ${isExistingCustomer ? `Existing customer (${customerTier} tier)` : 'Unknown/New sender'}
    `.trim();

    // Call Claude API for analysis
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const analysisPrompt = `
Analyze this email and extract the following information in JSON format:

1. Language (de, en, fr, nl, or other)
2. Sentiment (positive, neutral, negative) with score 0-1
3. Intent (price_inquiry, order, complaint, follow_up, general_inquiry, spam) with confidence 0-1
4. Urgency level (low, medium, high, critical)
5. Key entities (container types, routes, quantities, dates, companies, people)
6. Key phrases (important terms or phrases)
7. Email category with confidence score

For the email category, analyze the content and customer status to determine the most appropriate label:
- NEUKUNDE: First-time sender, new customer inquiry
- BESTANDSKUNDE: Email from existing customer
- AUFTRAGSBEZOGEN: References existing orders, quotes, or specific projects
- PREISANFRAGE: Price inquiry, quote request, cost estimation
- LIEFERANTEN-INFO: From suppliers about inventory, shipping, product updates
- NEWSLETTER: Marketing emails, newsletters, promotional content
- URGENT: High priority emails requiring immediate attention

Email content:
${emailContent}

Respond only with valid JSON in this exact format:
{
  "language": "en",
  "sentiment": "neutral",
  "sentiment_score": 0.5,
  "intent": "price_inquiry",
  "intent_confidence": 0.8,
  "urgency": "medium",
  "entities": [
    {"type": "container", "value": "20ft", "confidence": 0.9},
    {"type": "route", "value": "Hamburg to Rotterdam", "confidence": 0.8}
  ],
  "key_phrases": ["urgent delivery", "best price", "container shipping"],
  "category": {
    "label": "PREISANFRAGE",
    "confidence": 0.85
  }
}
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
        max_tokens: 1000,
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
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (e) {
      console.error('Failed to parse Claude response:', analysisText);
      throw new Error('Invalid response from Claude');
    }

    // Store analysis in database
    const { data: analyticsData, error: analyticsError } = await supabase
      .from('email_analytics')
      .upsert({
        email_id: emailId,
        language: analysis.language || 'en',
        sentiment: analysis.sentiment || 'neutral',
        sentiment_score: analysis.sentiment_score || 0.5,
        intent: analysis.intent || 'unknown',
        intent_confidence: analysis.intent_confidence || 0.0,
        urgency: analysis.urgency || 'low',
        entities: analysis.entities || [],
        key_phrases: analysis.key_phrases || [],
        analysis_timestamp: new Date().toISOString()
      }, {
        onConflict: 'email_id'
      })
      .select()
      .single();

    if (analyticsError) {
      console.error('Database error:', analyticsError);
      throw new Error('Failed to save analysis');
    }

    // Store email label if categorization was provided
    if (analysis.category && analysis.category.label) {
      const { error: labelError } = await supabase
        .from('email_labels')
        .upsert({
          email_id: emailId,
          label_type: analysis.category.label,
          confidence_score: analysis.category.confidence || 0.5,
          is_ai_generated: true,
          manually_overridden: false,
          metadata: {
            customer_tier: customerTier,
            is_existing_customer: isExistingCustomer,
            analysis_timestamp: new Date().toISOString()
          }
        }, {
          onConflict: 'email_id,label_type'
        });

      if (labelError) {
        console.error('Error inserting label:', labelError);
        // Don't throw error, analysis is still successful
      }
    }

    // Log performance metric
    await supabase
      .from('ai_performance_metrics')
      .insert({
        metric_type: 'email_analysis_success',
        metric_value: 1,
        context: { 
          email_id: emailId, 
          confidence: analysis.intent_confidence,
          category: analysis.category?.label,
          category_confidence: analysis.category?.confidence
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        analysis: analyticsData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in claude-email-analyzer:', error);
    
    // Log error metric
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase
        .from('ai_performance_metrics')
        .insert({
          metric_type: 'email_analysis_error',
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