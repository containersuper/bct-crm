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
    const { emailId, customInstructions, tone = 'professional' } = await req.json();
    
    if (!emailId) {
      throw new Error('Email ID is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get email data and analysis
    const { data: email, error: emailError } = await supabase
      .from('email_history')
      .select(`
        *,
        email_analytics (*)
      `)
      .eq('id', emailId)
      .single();

    if (emailError || !email) {
      throw new Error('Email not found');
    }

    // Get customer context if available
    let customerContext = '';
    if (email.from_address) {
      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('email', email.from_address)
        .single();

      if (customer) {
        customerContext = `Customer: ${customer.name} (${customer.company || 'Individual'})`;
        
        // Get customer intelligence if available
        const { data: intelligence } = await supabase
          .from('customer_intelligence')
          .select('*')
          .eq('customer_id', customer.id)
          .single();

        if (intelligence) {
          customerContext += `\nCustomer Profile: ${intelligence.ai_summary || 'No profile available'}`;
          customerContext += `\nCommunication Style: ${JSON.stringify(intelligence.communication_style)}`;
          customerContext += `\nPrice Sensitivity: ${intelligence.price_sensitivity}`;
        }
      }
    }

    // Prepare email content for Claude
    const emailContent = `
Subject: ${email.subject || 'No subject'}
From: ${email.from_address || 'Unknown sender'}
To: ${email.to_address || 'Unknown recipient'}
Body: ${email.body || 'No content'}
    `.trim();

    const analysisContext = email.email_analytics?.[0] ? `
Analysis Results:
- Language: ${email.email_analytics[0].language}
- Sentiment: ${email.email_analytics[0].sentiment} (${email.email_analytics[0].sentiment_score})
- Intent: ${email.email_analytics[0].intent} (confidence: ${email.email_analytics[0].intent_confidence})
- Urgency: ${email.email_analytics[0].urgency}
- Key entities: ${JSON.stringify(email.email_analytics[0].entities)}
    ` : '';

    // Call Claude API for response generation
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const responsePrompt = `
You are a professional customer service representative for a logistics/shipping company. Generate a helpful, accurate response to this email.

Guidelines:
- Match the language of the original email
- Use a ${tone} tone
- Be helpful and solution-oriented
- If it's a price inquiry, mention that you'll prepare a detailed quote
- If it's a complaint, acknowledge concerns and offer solutions
- Keep responses concise but complete
- Use proper business email formatting

${customerContext}

${analysisContext}

Original Email:
${emailContent}

${customInstructions ? `Additional Instructions: ${customInstructions}` : ''}

Generate only the email response body (no subject line, no signature). Make it ready to send.
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
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: responsePrompt
          }
        ]
      })
    });

    if (!claudeResponse.ok) {
      throw new Error(`Claude API error: ${claudeResponse.status}`);
    }

    const claudeData = await claudeResponse.json();
    const responseContent = claudeData.content[0].text.trim();
    
    // Calculate confidence score based on analysis
    const analysis = email.email_analytics?.[0];
    let confidenceScore = 0.7; // Base confidence
    
    if (analysis) {
      // Higher confidence for clear intents
      if (analysis.intent_confidence > 0.8) confidenceScore += 0.2;
      // Lower confidence for negative sentiment (requires more careful handling)
      if (analysis.sentiment === 'negative') confidenceScore -= 0.1;
      // Higher confidence for known customers
      if (customerContext) confidenceScore += 0.1;
    }
    
    confidenceScore = Math.min(Math.max(confidenceScore, 0), 1); // Clamp to 0-1

    // Store response in database
    const { data: responseData, error: responseError } = await supabase
      .from('ai_responses')
      .insert({
        email_id: emailId,
        response_content: responseContent,
        confidence_score: confidenceScore,
        language: analysis?.language || 'en',
        tone: tone,
        version: 1,
        is_sent: false
      })
      .select()
      .single();

    if (responseError) {
      console.error('Database error:', responseError);
      throw new Error('Failed to save response');
    }

    // Log performance metric
    await supabase
      .from('ai_performance_metrics')
      .insert({
        metric_type: 'response_generation_success',
        metric_value: 1,
        context: { 
          email_id: emailId, 
          confidence: confidenceScore,
          tone: tone,
          language: analysis?.language || 'en'
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        response: responseData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in claude-auto-response:', error);
    
    // Log error metric
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase
        .from('ai_performance_metrics')
        .insert({
          metric_type: 'response_generation_error',
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