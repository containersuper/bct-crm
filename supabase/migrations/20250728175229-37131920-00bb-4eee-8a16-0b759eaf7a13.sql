-- Add some test emails for processing
INSERT INTO public.email_history (
  subject, 
  body, 
  from_address, 
  to_address, 
  direction, 
  analysis_status,
  received_at
) VALUES 
(
  'Price inquiry for 20ft container shipping',
  'Hello, I would like to get a quote for shipping a 20ft container from Hamburg to Rotterdam. Please provide your best rates. Thanks!',
  'customer@example.com',
  'info@shipping.com',
  'inbound',
  'pending',
  now() - interval '1 hour'
),
(
  'Urgent: Container delay issue',
  'Our container ABCD1234 is delayed and we need immediate assistance. This is causing major disruption to our operations.',
  'urgent@logistics.com',
  'support@shipping.com',
  'inbound',
  'pending',
  now() - interval '2 hours'
),
(
  'Follow up on quote request',
  'Hi, I sent a quote request last week but have not received a response yet. Could you please check on this?',
  'followup@trader.com',
  'sales@shipping.com',
  'inbound',
  'pending',
  now() - interval '30 minutes'
);

-- Update the RLS policy to make sure the system can process these emails
CREATE POLICY "System can manage all email processing" 
ON public.email_history 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);