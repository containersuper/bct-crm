import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, ExternalLink, Download } from 'lucide-react';
import { toast } from 'sonner';

interface TeamLeaderConnection {
  id: string;
  is_active: boolean;
  token_expires_at: string;
  created_at: string;
}

export function TeamLeaderConnection() {
  const [connection, setConnection] = useState<TeamLeaderConnection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const { data, error } = await supabase
        .from('teamleader_connections')
        .select('*')
        .eq('is_active', true)
        .limit(1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        setConnection(data[0]);
      } else {
        setConnection(null);
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      console.log('Starting TeamLeader connection...');

      const { data, error } = await supabase.functions.invoke('teamleader-auth', {
        body: { action: 'authorize' }
      });

      if (error) {
        console.error('Auth error:', error);
        throw new Error(error.message || 'Failed to get authorization URL');
      }

      if (data?.authUrl) {
        console.log('Redirecting to TeamLeader...');
        window.location.href = data.authUrl;
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (error) {
      console.error('Connection error:', error);
      toast.error('Failed to connect to TeamLeader: ' + error.message);
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const { error } = await supabase
        .from('teamleader_connections')
        .update({ is_active: false })
        .eq('id', connection?.id);

      if (error) throw error;

      setConnection(null);
      toast.success('Disconnected from TeamLeader');
      
      // Automatically check connection status after disconnect
      setTimeout(() => {
        checkConnection();
      }, 500);
    } catch (error) {
      console.error('Disconnect error:', error);
      toast.error('Failed to disconnect');
    }
  };

  const handleTest = async () => {
    try {
      setIsImporting(true);
      console.log('Testing TeamLeader connection...');

      const { data, error } = await supabase.functions.invoke('teamleader-test');

      if (error) {
        console.error('Test error:', error);
        toast.error('Connection test failed: ' + error.message);
        return;
      }

      if (data?.success) {
        toast.success(`Connection works! Found ${data.contactsFound} contacts`);
      } else {
        toast.error(data?.message || 'Connection test failed');
      }
    } catch (error) {
      console.error('Test error:', error);
      toast.error('Test failed: ' + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleImport = async (type: 'contacts' | 'companies' | 'deals' | 'invoices' | 'quotes' | 'projects') => {
    try {
      setIsImporting(true);
      console.log(`Starting FULL import of ${type}...`);
      toast.info(`Starting batch import of all ${type}. This may take a few minutes...`);

      const { data, error } = await supabase.functions.invoke('teamleader-batch-full', {
        body: { type, batchSize: 100 }
      });

      if (error) {
        console.error('Import error:', error);
        throw new Error(error.message || 'Import failed');
      }

      if (data?.success) {
        toast.success(`✅ Complete! Imported ${data.imported} ${type} in ${data.batches} batches`);
      } else {
        throw new Error(data?.error || 'Import failed');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error(`Failed to import ${type}: ` + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading connection status...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          TeamLeader Integration
          {connection ? (
            <Badge variant="default" className="bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="destructive">
              <AlertCircle className="h-3 w-3 mr-1" />
              Not Connected
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {connection ? (
          <>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Connected on: {new Date(connection.created_at).toLocaleDateString()}</p>
              <p>Token expires: {new Date(connection.token_expires_at).toLocaleDateString()}</p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Test Connection</h4>
              <Button 
                onClick={handleTest}
                disabled={isImporting}
                size="sm"
                variant="secondary"
              >
                {isImporting ? 'Testing...' : 'Test Connection'}
              </Button>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Import Data</h4>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  onClick={() => handleImport('contacts')}
                  disabled={isImporting}
                  size="sm"
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Contacts
                </Button>
                <Button 
                  onClick={() => handleImport('companies')}
                  disabled={isImporting}
                  size="sm"
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Companies
                </Button>
                <Button 
                  onClick={() => handleImport('deals')}
                  disabled={isImporting}
                  size="sm"
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Deals
                </Button>
                <Button 
                  onClick={() => handleImport('invoices')}
                  disabled={isImporting}
                  size="sm"
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Invoices
                </Button>
                <Button 
                  onClick={() => handleImport('quotes')}
                  disabled={isImporting}
                  size="sm"
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Quotes
                </Button>
                <Button 
                  onClick={() => handleImport('projects')}
                  disabled={isImporting}
                  size="sm"
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Projects
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button 
                onClick={handleDisconnect}
                variant="destructive"
                size="sm"
              >
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect to TeamLeader to import your CRM data and keep it synchronized.
            </p>
            
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Before connecting, ensure:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Your TeamLeader app is configured</li>
                <li>• Redirect URI is set to: <code className="text-xs bg-muted px-1 rounded">https://eea0dc2e-67b5-433a-93d5-671e25c26865.lovableproject.com/auth/callback/teamleader</code></li>
              </ul>
            </div>

            <Button 
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {isConnecting ? 'Connecting...' : 'Connect to TeamLeader'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}