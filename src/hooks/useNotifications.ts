import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CreateNotificationParams {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'hot_lead' | 'quote_generated' | 'system';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  actionUrl?: string;
  metadata?: Record<string, any>;
  expiresAt?: string;
}

export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadUnreadCount();
    
    const channel = supabase
      .channel('notification-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications'
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadUnreadCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .or('expires_at.is.null,expires_at.gt.now()');

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const createNotification = async (params: CreateNotificationParams) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          title: params.title,
          message: params.message,
          type: params.type || 'info',
          priority: params.priority || 'normal',
          action_url: params.actionUrl,
          metadata: params.metadata || {},
          expires_at: params.expiresAt
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error creating notification:', error);
      return { success: false, error };
    }
  };

  const createHotLeadNotification = async (leadData: any) => {
    return createNotification({
      title: '🔥 Hot Lead Detected!',
      message: `High-priority lead from ${leadData.customerName || 'unknown customer'}`,
      type: 'hot_lead',
      priority: 'high',
      actionUrl: '/email-management?tab=leads',
      metadata: { leadId: leadData.id, customerName: leadData.customerName }
    });
  };

  const createQuoteGeneratedNotification = async (quoteData: any) => {
    return createNotification({
      title: '💰 Quote Generated',
      message: `AI generated quote for ${quoteData.customerName} - €${quoteData.totalPrice?.toLocaleString()}`,
      type: 'quote_generated',
      priority: 'normal',
      actionUrl: '/email-management?tab=quotes',
      metadata: { quoteId: quoteData.id, amount: quoteData.totalPrice }
    });
  };

  const createSystemNotification = async (title: string, message: string, priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal') => {
    return createNotification({
      title,
      message,
      type: 'system',
      priority,
      metadata: { source: 'system' }
    });
  };

  return {
    unreadCount,
    createNotification,
    createHotLeadNotification,
    createQuoteGeneratedNotification,
    createSystemNotification,
    loadUnreadCount
  };
}