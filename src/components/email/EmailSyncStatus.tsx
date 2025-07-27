import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, CheckCircle, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EmailAccount {
  id: string;
  provider: string;
  email: string;
  is_active: boolean;
  token_expires_at: string | null;
  last_sync_timestamp?: string;
  sync_status?: string;
  quota_usage?: number;
  sync_error_count?: number;
}

interface EmailSyncStatusProps {
  onSync: () => Promise<void>;
  isLoading: boolean;
}

export const EmailSyncStatus = ({ onSync, isLoading }: EmailSyncStatusProps) => {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncDetails, setSyncDetails] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    fetchAccounts();
    
    // Set up real-time subscription for account updates
    const subscription = supabase
      .channel('email_accounts_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'email_accounts'
      }, (payload) => {
        console.log('Account update:', payload);
        fetchAccounts(); // Refresh accounts when changes occur
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchAccounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const getAccountStatus = (account: EmailAccount) => {
    if (!account.is_active) {
      return { 
        status: 'inactive', 
        color: 'secondary',
        icon: WifiOff,
        text: 'Inactive'
      };
    }

    // Check sync status first
    if (account.sync_status === 'syncing') {
      return {
        status: 'syncing',
        color: 'default',
        icon: RefreshCw,
        text: 'Syncing...'
      };
    }

    if (account.sync_status === 'error') {
      return {
        status: 'error',
        color: 'destructive',
        icon: AlertCircle,
        text: `Sync Error (${account.sync_error_count || 0})`
      };
    }

    if (account.sync_status === 'quota_limited') {
      return {
        status: 'quota_limited',
        color: 'secondary',
        icon: AlertCircle,
        text: 'Quota Limited'
      };
    }

    if (account.token_expires_at) {
      const expiryDate = new Date(account.token_expires_at);
      const now = new Date();
      const hoursUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilExpiry <= 0) {
        return { 
          status: 'expired', 
          color: 'destructive',
          icon: AlertCircle,
          text: 'Token Expired'
        };
      } else if (hoursUntilExpiry <= 24) {
        return { 
          status: 'expiring', 
          color: 'secondary',
          icon: AlertCircle,
          text: `Expires in ${Math.round(hoursUntilExpiry)}h`
        };
      }
    }

    // Show last sync time if available
    if (account.last_sync_timestamp) {
      const lastSync = new Date(account.last_sync_timestamp);
      const minutesAgo = Math.round((new Date().getTime() - lastSync.getTime()) / (1000 * 60));
      
      if (minutesAgo < 60) {
        return {
          status: 'active',
          color: 'default',
          icon: CheckCircle,
          text: `Synced ${minutesAgo}m ago`
        };
      } else {
        const hoursAgo = Math.round(minutesAgo / 60);
        return {
          status: 'active',
          color: 'default',
          icon: CheckCircle,
          text: `Synced ${hoursAgo}h ago`
        };
      }
    }

    return { 
      status: 'active', 
      color: 'default',
      icon: Wifi,
      text: 'Ready to sync'
    };
  };

  const handleSync = async () => {
    setSyncProgress(0);
    setSyncDetails('Initializing sync...');
    
    const interval = setInterval(() => {
      setSyncProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return prev;
        }
        return prev + 10;
      });
    }, 500);

    try {
      setSyncDetails('Connecting to email accounts...');
      await onSync();
      setSyncProgress(100);
      setSyncDetails('Sync completed successfully!');
      setTimeout(() => {
        setSyncProgress(0);
        setSyncDetails('');
        fetchAccounts(); // Refresh account status
      }, 2000);
    } catch (error) {
      clearInterval(interval);
      setSyncProgress(0);
      setSyncDetails('Sync failed. Please try again.');
      setTimeout(() => setSyncDetails(''), 3000);
    }
  };

  const getQuotaInfo = (account: EmailAccount) => {
    if (!account.quota_usage) return null;
    
    const quotaPercentage = (account.quota_usage / 1000000000) * 100; // 1B daily limit
    const color = quotaPercentage > 80 ? 'destructive' : quotaPercentage > 60 ? 'secondary' : 'default';
    
    return {
      percentage: quotaPercentage.toFixed(1),
      color: color,
      usage: account.quota_usage.toLocaleString()
    };
  };

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Email Sync Status</h3>
          <Button
            onClick={handleSync}
            disabled={isLoading || accounts.length === 0 || syncProgress > 0}
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${(isLoading || syncProgress > 0) ? 'animate-spin' : ''}`} />
            Sync Now
          </Button>
        </div>

        {syncProgress > 0 && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between text-sm mb-2">
              <span>Syncing emails...</span>
              <span>{syncProgress}%</span>
            </div>
            <Progress value={syncProgress} className="h-2" />
            {syncDetails && (
              <p className="text-sm text-muted-foreground text-center">{syncDetails}</p>
            )}
          </div>
        )}

        <div className="space-y-3">
          {accounts.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <WifiOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No email accounts connected</p>
              <p className="text-sm">Connect a Gmail account to start syncing</p>
            </div>
          ) : (
            <>
              {accounts.map((account) => {
                const status = getAccountStatus(account);
                const StatusIcon = status.icon;
                const quotaInfo = getQuotaInfo(account);
                
                return (
                  <div key={account.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <StatusIcon className={`h-5 w-5 ${status.status === 'syncing' ? 'animate-spin' : ''}`} />
                      <div>
                        <p className="font-medium">{account.email}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-muted-foreground capitalize">{account.provider}</p>
                          {quotaInfo && (
                            <Badge variant="outline" className="text-xs">
                              Quota: {quotaInfo.percentage}%
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={status.color as any}>
                        {status.text}
                      </Badge>
                      {quotaInfo && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {quotaInfo.usage} / 1B units
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {/* Auto-sync info */}
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">🤖 Automated Sync</p>
                    <p className="text-xs text-muted-foreground">
                      Emails are automatically synced every 10 minutes
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    Active
                  </Badge>
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};