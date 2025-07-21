import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, RefreshCw, Mail, CheckCircle, AlertCircle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmailAccount {
  id: string;
  provider: string;
  email: string;
  is_active: boolean;
  created_at: string;
  token_expires_at?: string;
}

export function EmailAccountManager() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast.error('Failed to fetch email accounts');
    } finally {
      setLoading(false);
    }
  };

  const connectGmail = async () => {
    setConnecting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please log in first');
        return;
      }

      // Get OAuth URL from edge function
      const { data, error } = await supabase.functions.invoke('gmail-auth', {
        body: { action: 'auth-url' }
      });

      if (error) throw error;

      // Open OAuth popup
      const popup = window.open(
        data.authUrl,
        'gmail-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      // Listen for OAuth callback
      const checkClosed = setInterval(async () => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          
          // Check for authorization code in URL params (if using redirect)
          const urlParams = new URLSearchParams(window.location.search);
          const code = urlParams.get('code');
          
          if (code) {
            await handleOAuthCallback(code, user.id);
          } else {
            // If no code, check if account was added
            await fetchAccounts();
          }
          setConnecting(false);
        }
      }, 1000);

      // Timeout after 5 minutes
      setTimeout(() => {
        if (popup && !popup.closed) {
          popup.close();
          clearInterval(checkClosed);
          setConnecting(false);
          toast.error('Authentication timeout');
        }
      }, 300000);

    } catch (error) {
      console.error('Error connecting Gmail:', error);
      toast.error('Failed to connect Gmail account');
      setConnecting(false);
    }
  };

  const handleOAuthCallback = async (code: string, userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('gmail-auth', {
        body: { 
          action: 'callback',
          code,
          userId
        }
      });

      if (error) throw error;

      toast.success(`Gmail account connected: ${data.email}`);
      await fetchAccounts();
    } catch (error) {
      console.error('OAuth callback error:', error);
      toast.error('Failed to complete Gmail authentication');
    }
  };

  const disconnectAccount = async (accountId: string) => {
    try {
      const { error } = await supabase
        .from('email_accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;

      toast.success('Email account disconnected');
      await fetchAccounts();
    } catch (error) {
      console.error('Error disconnecting account:', error);
      toast.error('Failed to disconnect account');
    }
  };

  const refreshAccount = async (accountId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.functions.invoke('gmail-auth', {
        body: { 
          action: 'refresh-token',
          userId: user.id
        }
      });

      if (error) throw error;

      toast.success('Account refreshed successfully');
      await fetchAccounts();
    } catch (error) {
      console.error('Error refreshing account:', error);
      toast.error('Failed to refresh account');
    }
  };

  const testConnection = async (account: EmailAccount) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.functions.invoke('fetch-emails', {
        body: { 
          userId: user.id,
          provider: account.provider,
          maxResults: 5
        }
      });

      if (error) throw error;

      toast.success(`Connection successful! Found ${data.count} recent emails`);
    } catch (error) {
      console.error('Connection test failed:', error);
      toast.error('Connection test failed');
    }
  };

  const getAccountStatus = (account: EmailAccount) => {
    if (!account.is_active) {
      return { status: 'inactive', color: 'gray', icon: AlertCircle };
    }
    
    if (account.token_expires_at) {
      const expiresAt = new Date(account.token_expires_at);
      const now = new Date();
      const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursUntilExpiry < 0) {
        return { status: 'expired', color: 'red', icon: AlertCircle };
      } else if (hoursUntilExpiry < 24) {
        return { status: 'expiring', color: 'yellow', icon: AlertCircle };
      }
    }
    
    return { status: 'active', color: 'green', icon: CheckCircle };
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Account Management
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchAccounts} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={connectGmail} disabled={connecting}>
              {connecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Connect Gmail
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription>
              No email accounts connected. Click "Connect Gmail" to get started.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => {
              const { status, color, icon: StatusIcon } = getAccountStatus(account);
              
              return (
                <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <StatusIcon className={`h-5 w-5 text-${color}-500`} />
                    <div>
                      <div className="font-medium">{account.email}</div>
                      <div className="text-sm text-muted-foreground">
                        {account.provider.charAt(0).toUpperCase() + account.provider.slice(1)} • 
                        Connected {new Date(account.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={status === 'active' ? 'default' : status === 'expired' ? 'destructive' : 'secondary'}
                    >
                      {status === 'active' ? 'Active' : 
                       status === 'expired' ? 'Expired' : 
                       status === 'expiring' ? 'Expiring Soon' : 'Inactive'}
                    </Badge>
                    
                    <Button variant="outline" size="sm" onClick={() => testConnection(account)}>
                      Test
                    </Button>
                    
                    {status === 'expired' || status === 'expiring' ? (
                      <Button variant="outline" size="sm" onClick={() => refreshAccount(account.id)}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    ) : null}
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => disconnectAccount(account.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}