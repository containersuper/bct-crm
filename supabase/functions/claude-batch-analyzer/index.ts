import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailData {
  id: number;
  subject: string;
  from_address: string;
  to_address: string;
  body: string;
  received_at: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batchSize = 20, forceReanalysis = false } = await req.json();
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Clean up stuck jobs and create new processing job
    await supabase
      .from('email_processing_jobs')
      .update({ status: 'failed', error_details: { reason: 'Job timeout - cleaned up by new batch' } })
      .eq('status', 'running');

    // Create new processing job
    const { data: jobData, error: jobError } = await supabase
      .from('email_processing_jobs')
      .insert({
        job_type: 'batch_analysis',
        batch_size: batchSize,
        status: 'running',
        emails_processed: 0,
        success_count: 0,
        error_count: 0
      })
      .select()
      .single();

    if (jobError || !jobData) {
      throw new Error(`Failed to create processing job: ${jobError?.message}`);
    }

    const jobId = jobData.id;

    // Get emails that need analysis
    let query = supabase
      .from('email_history')
      .select('id, subject, from_address, to_address, body, received_at')
      .order('received_at', { ascending: false })
      .limit(batchSize);

    if (!forceReanalysis) {
      query = query.in('analysis_status', ['pending', 'failed']);
    }

    const { data: emails, error: emailError } = await query;

    if (emailError || !emails || emails.length === 0) {
      // Update job status to completed
      await supabase
        .from('email_processing_jobs')
        .update({ 
          status: 'completed',
          emails_processed: 0,
          success_count: 0,
          error_count: 0
        })
        .eq('id', jobId);

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No emails to analyze',
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing batch of ${emails.length} emails`);

    // Generate batch ID
    const batchId = crypto.randomUUID();

    // Update emails to processing status
    const emailIds = emails.map(e => e.id);
    await supabase
      .from('email_history')
      .update({ 
        analysis_status: 'processing',
        last_analyzed: new Date().toISOString()
      })
      .in('id', emailIds);

    // Process emails in smaller chunks to avoid Claude rate limits
    const chunkSize = 5;
    const results = [];
    
    for (let i = 0; i < emails.length; i += chunkSize) {
      const chunk = emails.slice(i, i + chunkSize);
      const chunkResults = await Promise.allSettled(
        chunk.map(email => analyzeEmail(email, batchId))
      );
      
      results.push(...chunkResults);
      
      // Small delay between chunks
      if (i + chunkSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Update email statuses and save analytics
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const email = emails[i];

      if (result.status === 'fulfilled' && result.value) {
        // Save analysis to database
        const { error: analyticsError } = await supabase
          .from('email_analytics')
          .upsert({
            email_id: email.id,
            language: result.value.language || 'en',
            sentiment: result.value.sentiment || 'neutral',
            sentiment_score: result.value.sentiment_score || 0.5,
            intent: result.value.intent || 'unknown',
            intent_confidence: result.value.intent_confidence || 0.0,
            urgency: result.value.urgency || 'low',
            entities: result.value.entities || [],
            key_phrases: result.value.key_phrases || [],
            batch_id: batchId,
            analysis_timestamp: new Date().toISOString()
          }, {
            onConflict: 'email_id'
          });

        if (!analyticsError) {
          await supabase
            .from('email_history')
            .update({ analysis_status: 'completed' })
            .eq('id', email.id);
          successCount++;
        } else {
          await supabase
            .from('email_history')
            .update({ analysis_status: 'failed' })
            .eq('id', email.id);
          failureCount++;
        }
      } else {
        await supabase
          .from('email_history')
          .update({ analysis_status: 'failed' })
          .eq('id', email.id);
        failureCount++;
      }
    }

    // Log batch metrics
    await supabase
      .from('ai_performance_metrics')
      .insert({
        metric_type: 'batch_analysis_completed',
        metric_value: successCount,
        context: { 
          batch_id: batchId,
          total_emails: emails.length,
          success_count: successCount,
          failure_count: failureCount
        }
      });

    // Update final job status
    await supabase
      .from('email_processing_jobs')
      .update({ 
        status: 'completed',
        emails_processed: emails.length,
        success_count: successCount,
        error_count: failureCount
      })
      .eq('id', jobId);

    console.log(`Batch ${batchId} completed: ${successCount} success, ${failureCount} failures`);

    return new Response(JSON.stringify({
      success: true,
      batch_id: batchId,
      job_id: jobId,
      processed: emails.length,
      success_count: successCount,
      failure_count: failureCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in claude-batch-analyzer:', error);
    
    // Try to update job status to failed if we have a jobId
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase
        .from('email_processing_jobs')
        .update({ 
          status: 'failed',
          error_details: { error: error.message, timestamp: new Date().toISOString() }
        })
        .eq('status', 'running');
    } catch (updateError) {
      console.error('Failed to update job status:', updateError);
    }
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function analyzeEmail(email: EmailData, batchId: string) {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicApiKey) {
    throw new Error('Anthropic API key not configured');
  }

  const emailContent = `
Subject: ${email.subject || 'No subject'}
From: ${email.from_address || 'Unknown sender'}
To: ${email.to_address || 'Unknown recipient'}
Date: ${email.received_at || 'Unknown date'}
Body: ${email.body || 'No content'}
  `.trim();

  const analysisPrompt = `
Analyze this shipping/logistics email and extract the following information in JSON format:

1. Language (de, en, fr, nl, or other)
2. Sentiment (positive, neutral, negative) with score 0-1
3. Intent (price_inquiry, order, complaint, follow_up, general_inquiry, spam) with confidence 0-1
4. Urgency level (low, medium, high, critical)
5. Key entities (container types, routes, quantities, dates, companies, people)
6. Key phrases (important terms or phrases)

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
  "key_phrases": ["urgent delivery", "best price", "container shipping"]
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
  
  try {
    return JSON.parse(analysisText);
  } catch (e) {
    console.error('Failed to parse Claude response for email', email.id, ':', analysisText);
    throw new Error('Invalid response from Claude');
  }
}