import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle, ExternalLink, Download, Loader2, RefreshCw, Zap, Brain, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

interface TeamLeaderConnection {
  id: string;
  is_active: boolean;
  token_expires_at: string;
  created_at: string;
}

interface SyncProgress {
  type: string;
  imported: number;
  total: number;
  status: 'pending' | 'running' | 'completed' | 'error';
}

interface DataStats {
  customers: number;
  companies: number;
  deals: number;
  invoices: number;
  quotes: number;
  projects: number;
}

export function EnhancedTeamLeaderSync() {
  const [connection, setConnection] = useState<TeamLeaderConnection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress[]>([]);
  const [dataStats, setDataStats] = useState<DataStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiEnhancing, setAiEnhancing] = useState(false);

  useEffect(() => {
    checkConnection();
    loadDataStats();
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

  const loadDataStats = async () => {
    try {
      const [customers, companies, deals, invoices, quotes, projects] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact' }),
        supabase.from('teamleader_companies').select('id', { count: 'exact' }),
        supabase.from('teamleader_deals').select('id', { count: 'exact' }),
        supabase.from('teamleader_invoices').select('id', { count: 'exact' }),
        supabase.from('teamleader_quotes').select('id', { count: 'exact' }),
        supabase.from('teamleader_projects').select('id', { count: 'exact' })
      ]);

      setDataStats({
        customers: customers.count || 0,
        companies: companies.count || 0,
        deals: deals.count || 0,
        invoices: invoices.count || 0,
        quotes: quotes.count || 0,
        projects: projects.count || 0
      });
    } catch (error) {
      console.error('Error loading data stats:', error);
    }
  };

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      const { data, error } = await supabase.functions.invoke('teamleader-auth', {
        body: { action: 'authorize' }
      });

      if (error) throw new Error(error.message || 'Failed to get authorization URL');

      if (data?.authUrl) {
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

  const handleSmartSync = async () => {
    try {
      setIsImporting(true);
      toast.info('Starting intelligent data synchronization...');

      const { data, error } = await supabase.functions.invoke('teamleader-smart-sync');

      if (error) throw error;

      if (data?.success) {
        toast.success(`Smart sync completed! Updated ${data.totalUpdated} records`);
        loadDataStats();
      } else {
        toast.error(data?.message || 'Smart sync failed');
      }
    } catch (error) {
      console.error('Smart sync error:', error);
      toast.error('Smart sync failed: ' + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleFullImport = async () => {
    try {
      setIsImporting(true);
      const types = ['companies', 'deals', 'invoices', 'quotes', 'projects'];
      
      setSyncProgress(types.map(type => ({
        type,
        imported: 0,
        total: 0,
        status: 'pending'
      })));

      toast.info('Starting comprehensive data import...');

      for (const type of types) {
        setSyncProgress(prev => prev.map(p => 
          p.type === type ? { ...p, status: 'running' } : p
        ));

        const { data, error } = await supabase.functions.invoke('teamleader-batch-import', {
          body: { importType: type, batchSize: 100 }
        });

        if (data?.success) {
          setSyncProgress(prev => prev.map(p => 
            p.type === type ? { 
              ...p, 
              imported: data.imported,
              total: data.imported,
              status: 'completed' 
            } : p
          ));
        } else {
          setSyncProgress(prev => prev.map(p => 
            p.type === type ? { ...p, status: 'error' } : p
          ));
        }
      }

      toast.success('Full import completed!');
      loadDataStats();
      checkConnection();
    } catch (error) {
      console.error('Full import error:', error);
      toast.error('Import failed: ' + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleAIEnhancement = async () => {
    try {
      setAiEnhancing(true);
      toast.info('Enhancing AI with TeamLeader data...');

      // Process customer intelligence for all customers
      const { data: customers } = await supabase
        .from('customers')
        .select('id')
        .limit(100);

      if (customers) {
        for (const customer of customers) {
          await supabase.functions.invoke('claude-customer-intelligence', {
            body: { customerId: customer.id }
          });
        }
      }

      toast.success('AI enhancement completed! Your AI is now super smart!');
    } catch (error) {
      console.error('AI enhancement error:', error);
      toast.error('AI enhancement failed: ' + error.message);
    } finally {
      setAiEnhancing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading TeamLeader sync status...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            TeamLeader AI Sync
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
        <CardContent>
          {!connection ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect to TeamLeader to enable AI-powered CRM synchronization.
              </p>
              <Button 
                onClick={handleConnect}
                disabled={isConnecting}
                className="w-full"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {isConnecting ? 'Connecting...' : 'Connect to TeamLeader'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>Connected: {new Date(connection.created_at).toLocaleDateString()}</p>
                <p>Expires: {new Date(connection.token_expires_at).toLocaleDateString()}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  onClick={handleSmartSync}
                  disabled={isImporting || aiEnhancing}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Smart Sync
                </Button>
                
                <Button 
                  onClick={handleFullImport}
                  disabled={isImporting || aiEnhancing}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Full Import
                </Button>
                
                <Button 
                  onClick={handleAIEnhancement}
                  disabled={isImporting || aiEnhancing}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <Brain className="h-4 w-4" />
                  {aiEnhancing ? 'Enhancing...' : 'AI Boost'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Statistics */}
      {dataStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Data Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{dataStats.customers}</div>
                <div className="text-sm text-muted-foreground">Customers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{dataStats.companies}</div>
                <div className="text-sm text-muted-foreground">Companies</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{dataStats.deals}</div>
                <div className="text-sm text-muted-foreground">Deals</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{dataStats.invoices}</div>
                <div className="text-sm text-muted-foreground">Invoices</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{dataStats.quotes}</div>
                <div className="text-sm text-muted-foreground">Quotes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{dataStats.projects}</div>
                <div className="text-sm text-muted-foreground">Projects</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync Progress */}
      {syncProgress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Import Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {syncProgress.map((progress) => (
              <div key={progress.type} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="capitalize font-medium">{progress.type}</span>
                  <span className="text-sm text-muted-foreground">
                    {progress.imported} imported
                  </span>
                </div>
                <Progress 
                  value={progress.status === 'completed' ? 100 : progress.status === 'running' ? 50 : 0}
                  className="h-2"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}