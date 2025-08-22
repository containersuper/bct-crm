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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { type, data } = await req.json();

    let notification;

    switch (type) {
      case 'hot_lead_detected':
        notification = {
          title: '🔥 Hot Lead Detected!',
          message: `High-priority lead from ${data.customerName || 'unknown customer'}`,
          type: 'hot_lead',
          priority: 'high',
          action_url: '/email-management?tab=leads',
          metadata: { 
            leadId: data.id, 
            customerName: data.customerName,
            urgency: data.urgency,
            intent: data.intent
          }
        };
        break;

      case 'quote_generated':
        notification = {
          title: '💰 Quote Generated',
          message: `AI generated quote for ${data.customerName} - €${data.totalPrice?.toLocaleString()}`,
          type: 'quote_generated',
          priority: 'normal',
          action_url: '/email-management?tab=quotes',
          metadata: { 
            quoteId: data.id, 
            amount: data.totalPrice,
            customerName: data.customerName
          }
        };
        break;

      case 'processing_complete':
        notification = {
          title: '⚡ Email Processing Complete',
          message: `Processed ${data.emailsProcessed} emails, found ${data.leadsFound} leads`,
          type: 'system',
          priority: 'low',
          action_url: '/email-management?tab=analytics',
          metadata: {
            jobId: data.jobId,
            emailsProcessed: data.emailsProcessed,
            leadsFound: data.leadsFound
          }
        };
        break;

      case 'processing_error':
        notification = {
          title: '❌ Processing Error',
          message: `Email processing failed: ${data.error}`,
          type: 'error',
          priority: 'high',
          action_url: '/email-management?tab=analytics',
          metadata: {
            error: data.error,
            jobId: data.jobId
          }
        };
        break;

      case 'system_alert':
        notification = {
          title: data.title || '🔔 System Alert',
          message: data.message,
          type: 'system',
          priority: data.priority || 'normal',
          action_url: data.actionUrl,
          metadata: data.metadata || {}
        };
        break;

      default:
        throw new Error(`Unknown notification type: ${type}`);
    }

    // Get all active users to send notification to
    // In a real app, you might want to be more selective
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) throw usersError;

    // Create notifications for all users
    const notifications = users.users.map(user => ({
      user_id: user.id,
      ...notification
    }));

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Created ${notifications.length} notifications`,
        notificationsCreated: notifications.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating notifications:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});