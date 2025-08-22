-- Create notifications table
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info', -- 'info', 'success', 'warning', 'error', 'hot_lead', 'quote_generated', 'system'
  priority text NOT NULL DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  is_read boolean NOT NULL DEFAULT false,
  action_url text,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  read_at timestamp with time zone,
  expires_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Add replica identity for real-time updates
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Create index for performance
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_expires ON public.notifications(expires_at) WHERE expires_at IS NOT NULL;