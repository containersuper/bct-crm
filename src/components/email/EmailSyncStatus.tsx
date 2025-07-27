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
}

interface EmailSyncStatusProps {
  onSync: () => Promise<void>;
  isLoading: boolean;
}

export const EmailSyncStatus = ({ onSync, isLoading }: EmailSyncStatusProps) => {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [syncProgress, setSyncProgress] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('user_id', user.id);

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
          text: 'Expires Soon'
        };
      }
    }

    return { 
      status: 'active', 
      color: 'default',
      icon: CheckCircle,
      text: 'Connected'
    };
  };

  const handleSync = async () => {
    setSyncProgress(0);
    const interval = setInterval(() => {
      setSyncProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return prev;
        }
        return prev + 10;
      });
    }, 200);

    try {
      await onSync();
      setSyncProgress(100);
      setTimeout(() => setSyncProgress(0), 1000);
    } catch (error) {
      clearInterval(interval);
      setSyncProgress(0);
    }
  };

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Email Sync Status</h3>
          <Button
            onClick={handleSync}
            disabled={isLoading || accounts.length === 0}
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Sync Now
          </Button>
        </div>

        {syncProgress > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span>Syncing emails...</span>
              <span>{syncProgress}%</span>
            </div>
            <Progress value={syncProgress} className="h-2" />
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
            accounts.map((account) => {
              const status = getAccountStatus(account);
              const StatusIcon = status.icon;
              
              return (
                <div key={account.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <StatusIcon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{account.email}</p>
                      <p className="text-sm text-muted-foreground capitalize">{account.provider}</p>
                    </div>
                  </div>
                  <Badge variant={status.color as any}>
                    {status.text}
                  </Badge>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};