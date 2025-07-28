import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, AlertTriangle, CheckCircle, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmailAccount {
  id: string;
  email: string;
  provider: string;
  token_expires_at: string;
  is_active: boolean;
  sync_status: string;
  last_sync_error: string | null;
}

export function GmailTokenManager() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [refreshingAccounts, setRefreshingAccounts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load email accounts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const isTokenExpired = (expiresAt: string) => {
    return new Date(expiresAt) <= new Date();
  };

  const refreshToken = async (accountId: string) => {
    setRefreshingAccounts(prev => new Set([...prev, accountId]));
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase.functions.invoke('gmail-auth', {
        body: { 
          action: 'refresh-token',
          userId: user.id
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Token Refreshed',
          description: 'Gmail access token has been refreshed successfully',
        });
        await loadAccounts(); // Reload accounts to show updated token
      } else {
        throw new Error(data.error || 'Failed to refresh token');
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      toast({
        title: 'Refresh Failed',
        description: 'Failed to refresh Gmail token. You may need to reconnect your account.',
        variant: 'destructive',
      });
    } finally {
      setRefreshingAccounts(prev => {
        const newSet = new Set(prev);
        newSet.delete(accountId);
        return newSet;
      });
    }
  };

  const reconnectAccount = () => {
    // Redirect to Gmail OAuth
    window.location.href = `/oauth/gmail/callback`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Loading email accounts...
          </div>
        </CardContent>
      </Card>
    );
  }

  const expiredAccounts = accounts.filter(account => isTokenExpired(account.token_expires_at));
  const activeAccounts = accounts.filter(account => !isTokenExpired(account.token_expires_at));

  return (
    <div className="space-y-4">
      {expiredAccounts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {expiredAccounts.length} Gmail account(s) have expired tokens and need to be refreshed.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Gmail Account Status
          </CardTitle>
          <CardDescription>
            Manage Gmail account connections and token status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {accounts.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No Gmail accounts connected</p>
              <Button onClick={reconnectAccount}>
                Connect Gmail Account
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => {
                const expired = isTokenExpired(account.token_expires_at);
                const refreshing = refreshingAccounts.has(account.id);
                
                return (
                  <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${expired ? 'bg-red-500' : 'bg-green-500'}`} />
                      <div>
                        <div className="font-medium">{account.email}</div>
                        <div className="text-sm text-muted-foreground">
                          Token expires: {new Date(account.token_expires_at).toLocaleString()}
                        </div>
                        {account.last_sync_error && (
                          <div className="text-sm text-red-600 mt-1">
                            Error: {account.last_sync_error}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant={expired ? 'destructive' : 'default'}>
                        {expired ? 'Expired' : 'Active'}
                      </Badge>
                      
                      {expired && (
                        <Button
                          size="sm"
                          onClick={() => refreshToken(account.id)}
                          disabled={refreshing}
                          className="flex items-center gap-1"
                        >
                          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
                          {refreshing ? 'Refreshing...' : 'Refresh Token'}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {accounts.length > 0 && (
            <div className="border-t pt-4">
              <Button 
                variant="outline" 
                onClick={reconnectAccount}
                className="w-full"
              >
                Add Another Gmail Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {activeAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Healthy Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {activeAccounts.length} account(s) with valid tokens and working properly.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}