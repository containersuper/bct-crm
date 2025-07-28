import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, batchSize = 50 } = await req.json();

    if (action === 'start') {
      // Start new processing job
      const { data: jobData, error: jobError } = await supabaseClient
        .rpc('start_email_processing', {
          p_job_type: 'smart_analysis',
          p_batch_size: batchSize
        });

      if (jobError) throw jobError;

      const jobId = jobData;

      // Process emails in background
      EdgeRuntime.waitUntil(processEmailsBatch(supabaseClient, jobId, batchSize));

      return new Response(
        JSON.stringify({ success: true, jobId, message: 'Processing started' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'status') {
      // Get current processing status
      const { data: jobs, error } = await supabaseClient
        .from('email_processing_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, currentJob: jobs[0] || null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Email processor error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processEmailsBatch(supabaseClient: any, jobId: string, batchSize: number) {
  try {
    console.log(`Starting batch processing for job ${jobId}`);
    
    // Get unprocessed emails
    const { data: emails, error: emailError } = await supabaseClient
      .from('email_history')
      .select('id, subject, body, from_address, to_address, analysis_status')
      .eq('analysis_status', 'pending')
      .limit(batchSize);

    if (emailError) throw emailError;

    console.log(`Found ${emails?.length || 0} emails to process`);

    if (!emails || emails.length === 0) {
      console.log('No emails found to process - completing job');
      await supabaseClient.rpc('update_processing_job', {
        p_job_id: jobId,
        p_status: 'completed',
        p_emails_processed: 0
      });
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    // Process each email
    for (const email of emails) {
      try {
        // Call AI analysis function
        const { data: analysisResult, error: analysisError } = await supabaseClient.functions.invoke('claude-email-analyzer', {
          body: { 
            emailId: email.id,
            content: email.body,
            subject: email.subject,
            fromAddress: email.from_address
          }
        });

        if (analysisError) {
          throw analysisError;
        }

        // Update email status
        await supabaseClient
          .from('email_history')
          .update({ 
            analysis_status: 'completed',
            last_analyzed: new Date().toISOString()
          })
          .eq('id', email.id);

        successCount++;
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Error processing email ${email.id}:`, error);
        errorCount++;
        errors.push({ emailId: email.id, error: error.message });

        // Update email status to failed
        await supabaseClient
          .from('email_history')
          .update({ analysis_status: 'failed' })
          .eq('id', email.id);
      }
    }

    // Update job status
    const finalStatus = errorCount === 0 ? 'completed' : (successCount === 0 ? 'failed' : 'partial');
    await supabaseClient.rpc('update_processing_job', {
      p_job_id: jobId,
      p_status: finalStatus,
      p_emails_processed: emails.length,
      p_success_count: successCount,
      p_error_count: errorCount,
      p_error_details: errors.length > 0 ? { errors } : null
    });

    console.log(`Batch processing completed: ${successCount} success, ${errorCount} errors`);

    // If there are more emails to process and we had some success, start another batch
    if (successCount > 0 && emails.length === batchSize) {
      const { data: moreEmails } = await supabaseClient
        .from('email_history')
        .select('id')
        .eq('analysis_status', 'pending')
        .limit(1);

      if (moreEmails && moreEmails.length > 0) {
        // Start another job automatically
        const { data: nextJobId } = await supabaseClient.rpc('start_email_processing', {
          p_job_type: 'smart_analysis',
          p_batch_size: batchSize
        });
        
        // Process next batch
        EdgeRuntime.waitUntil(processEmailsBatch(supabaseClient, nextJobId, batchSize));
      }
    }

  } catch (error) {
    console.error(`Batch processing failed for job ${jobId}:`, error);
    await supabaseClient.rpc('update_processing_job', {
      p_job_id: jobId,
      p_status: 'failed',
      p_error_details: { error: error.message }
    });
  }
}