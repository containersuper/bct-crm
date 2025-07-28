import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle, Clock, RefreshCw, Settings, ArrowLeftRight, History, Calendar, LogIn } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SyncStatus {
  status: 'idle' | 'syncing' | 'success' | 'error' | 'disconnected' | 'connected';
  lastSync: string | null;
  nextSync: string | null;
  progress: number;
  message: string;
}

interface FieldMapping {
  id?: string;
  ourField: string;
  teamLeaderField: string;
  fieldType: 'contact' | 'company';
  enabled: boolean;
}

interface SyncHistoryItem {
  id: string;
  sync_type: string;
  status: string;
  records_processed: number;
  records_success: number;
  records_failed: number;
  started_at: string;
  completed_at: string | null;
  error_details?: any;
}

interface ConflictItem {
  id: string;
  record_type: string;
  conflict_field: string;
  our_value: string;
  teamleader_value: string;
  resolution: string;
  created_at: string;
}

interface TeamLeaderConnection {
  id: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  is_active: boolean;
}

export function TeamLeaderSync() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    status: 'disconnected',
    lastSync: null,
    nextSync: null,
    progress: 0,
    message: 'Not connected to TeamLeader'
  });

  const [connection, setConnection] = useState<TeamLeaderConnection | null>(null);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [syncInterval, setSyncInterval] = useState('4'); // hours
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkConnection();
    loadFieldMappings();
    loadSyncHistory();
    loadConflicts();
  }, []);

  const checkConnection = async () => {
    try {
      const { data: connections, error } = await supabase
        .from('teamleader_connections')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (connections) {
        setConnection(connections);
        setSyncStatus(prev => ({
          ...prev,
          status: 'connected',
          message: 'Connected to TeamLeader'
        }));
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      toast.error('Failed to check TeamLeader connection');
    } finally {
      setLoading(false);
    }
  };

  const loadFieldMappings = async () => {
    try {
      const { data, error } = await supabase
        .from('teamleader_field_mappings')
        .select('*')
        .eq('is_active', true)
        .order('created_at');

      if (error) throw error;

      if (data && data.length > 0) {
        setFieldMappings(data.map(mapping => ({
          id: mapping.id,
          ourField: mapping.our_field,
          teamLeaderField: mapping.teamleader_field,
          fieldType: mapping.field_type as 'contact' | 'company',
          enabled: mapping.is_active
        })));
      } else {
        // Create default mappings
        await createDefaultMappings();
      }
    } catch (error) {
      console.error('Error loading field mappings:', error);
    }
  };

  const createDefaultMappings = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const defaultMappings = [
        { our_field: 'name', teamleader_field: 'first_name', field_type: 'contact', user_id: user.id },
        { our_field: 'email', teamleader_field: 'email', field_type: 'contact', user_id: user.id },
        { our_field: 'phone', teamleader_field: 'telephone', field_type: 'contact', user_id: user.id },
        { our_field: 'company', teamleader_field: 'company_name', field_type: 'contact', user_id: user.id },
        { our_field: 'name', teamleader_field: 'name', field_type: 'company', user_id: user.id },
        { our_field: 'email', teamleader_field: 'email', field_type: 'company', user_id: user.id },
        { our_field: 'phone', teamleader_field: 'telephone', field_type: 'company', user_id: user.id }
      ];

      const { data, error } = await supabase
        .from('teamleader_field_mappings')
        .insert(defaultMappings)
        .select();

      if (error) throw error;

      if (data) {
        setFieldMappings(data.map(mapping => ({
          id: mapping.id,
          ourField: mapping.our_field,
          teamLeaderField: mapping.teamleader_field,
          fieldType: mapping.field_type as 'contact' | 'company',
          enabled: mapping.is_active
        })));
      }
    } catch (error) {
      console.error('Error creating default mappings:', error);
    }
  };

  const loadSyncHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('teamleader_sync_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setSyncHistory(data || []);
    } catch (error) {
      console.error('Error loading sync history:', error);
    }
  };

  const loadConflicts = async () => {
    try {
      const { data, error } = await supabase
        .from('teamleader_conflicts')
        .select('*')
        .eq('resolution', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConflicts(data || []);
    } catch (error) {
      console.error('Error loading conflicts:', error);
    }
  };

  const handleAuthorization = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('teamleader-auth', {
        body: { action: 'authorize' }
      });

      if (error) throw error;

      // Open authorization URL in new window
      window.open(data.authUrl, '_blank');
      toast.info('Please complete authorization in the new window');
    } catch (error) {
      console.error('Authorization error:', error);
      toast.error('Failed to start authorization');
    }
  };

  const handleManualSync = async (fullSync = false) => {
    if (!connection) {
      toast.error('Please connect to TeamLeader first');
      return;
    }

    setSyncStatus({
      ...syncStatus,
      status: 'syncing',
      progress: 0,
      message: fullSync ? 'Starting full data import...' : 'Starting sync...'
    });

    try {
      setSyncStatus(prev => ({ ...prev, progress: 10, message: fullSync ? 'Importing ALL data from TeamLeader...' : 'Importing from TeamLeader...' }));
      
       const { data, error } = await supabase.functions.invoke('teamleader-sync', {
        body: { 
          action: fullSync ? 'full_import' : 'sync', 
          syncType: 'all',
          fullSync: fullSync,
          batchSize: fullSync ? 200 : 100,
          maxPages: fullSync ? 15 : 5
        }
      });

      if (error) throw error;

      setSyncStatus(prev => ({ ...prev, progress: 100, message: 'Sync completed successfully!' }));

      // Reload data
      await Promise.all([
        loadSyncHistory(),
        loadConflicts()
      ]);

      setSyncStatus(prev => ({
        ...prev,
        status: 'success',
        lastSync: new Date().toLocaleString(),
        nextSync: autoSyncEnabled ? new Date(Date.now() + parseInt(syncInterval) * 60 * 60 * 1000).toLocaleString() : null
      }));

      toast.success(`${fullSync ? 'Full import' : 'Sync'} completed! Processed: ${data.processed}, Success: ${data.success}, Failed: ${data.failed}`);
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus(prev => ({
        ...prev,
        status: 'error',
        message: error.message || 'Sync failed'
      }));
      toast.error('Sync failed: ' + (error.message || 'Unknown error'));
    }
  };

  const updateFieldMapping = async (index: number, field: keyof FieldMapping, value: any) => {
    const mapping = fieldMappings[index];
    if (!mapping.id) return;

    try {
      const { error } = await supabase
        .from('teamleader_field_mappings')
        .update({
          [field === 'ourField' ? 'our_field' : 
           field === 'teamLeaderField' ? 'teamleader_field' :
           field === 'fieldType' ? 'field_type' :
           field === 'enabled' ? 'is_active' : field]: value
        })
        .eq('id', mapping.id);

      if (error) throw error;

      const updated = [...fieldMappings];
      updated[index] = { ...updated[index], [field]: value };
      setFieldMappings(updated);
    } catch (error) {
      console.error('Error updating field mapping:', error);
      toast.error('Failed to update field mapping');
    }
  };

  const resolveConflict = async (conflictId: string, useOurValue: boolean) => {
    try {
      const { error } = await supabase
        .from('teamleader_conflicts')
        .update({
          resolution: useOurValue ? 'use_ours' : 'use_theirs',
          resolved_at: new Date().toISOString()
        })
        .eq('id', conflictId);

      if (error) throw error;

      setConflicts(prev => prev.filter(conflict => conflict.id !== conflictId));
      toast.success(`Conflict resolved using ${useOurValue ? 'our' : 'TeamLeader'} value`);
    } catch (error) {
      console.error('Error resolving conflict:', error);
      toast.error('Failed to resolve conflict');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'syncing':
      case 'running':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'disconnected':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      success: 'default',
      completed: 'default',
      error: 'destructive',
      failed: 'destructive',
      partial: 'secondary',
      syncing: 'outline',
      running: 'outline',
      pending: 'outline'
    } as const;
    
    return <Badge variant={variants[status as keyof typeof variants] || 'outline'}>{status}</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Loading TeamLeader integration...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      {!connection && (
        <Alert>
          <LogIn className="h-4 w-4" />
          <AlertTitle>TeamLeader Not Connected</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-3">Connect your TeamLeader account to start syncing customer data.</p>
            <Button onClick={handleAuthorization}>
              Connect to TeamLeader
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Sync Status Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            TeamLeader CRM Sync Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {getStatusIcon(syncStatus.status)}
                <span className="font-medium">Status: {syncStatus.status}</span>
              </div>
              {syncStatus.status === 'syncing' && (
                <div className="space-y-2">
                  <Progress value={syncStatus.progress} className="w-full" />
                  <p className="text-sm text-muted-foreground">{syncStatus.message}</p>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="font-medium">Last Sync</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {syncStatus.lastSync || 'Never'}
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">Next Sync</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {autoSyncEnabled ? syncStatus.nextSync || 'Not scheduled' : 'Manual only'}
              </p>
            </div>
          </div>
          
          <Separator className="my-4" />
          
          <div className="flex gap-4 flex-wrap">
            <Button 
              onClick={() => handleManualSync(false)} 
              disabled={syncStatus.status === 'syncing' || !connection}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncStatus.status === 'syncing' ? 'animate-spin' : ''}`} />
              {syncStatus.status === 'syncing' ? 'Syncing...' : 'Quick Sync'}
            </Button>
            
            <Button 
              onClick={() => handleManualSync(true)} 
              disabled={syncStatus.status === 'syncing' || !connection}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncStatus.status === 'syncing' ? 'animate-spin' : ''}`} />
              {syncStatus.status === 'syncing' ? 'Full Importing...' : 'Full Import (ALL Data)'}
            </Button>
            
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <span>💡 Quick: 500 records | Full: 3000+ records</span>
            </div>
          </div>
          
          <Separator className="my-4" />
          
          <div className="flex items-center gap-2">
            <Switch 
              checked={autoSyncEnabled} 
              onCheckedChange={setAutoSyncEnabled}
              disabled={!connection}
            />
            <Label>Auto Sync</Label>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="mapping" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="mapping">Field Mapping</TabsTrigger>
          <TabsTrigger value="conflicts">
            Conflicts {conflicts.length > 0 && 
            <Badge variant="destructive" className="ml-1">{conflicts.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Field Mapping Configuration */}
        <TabsContent value="mapping">
          <Card>
            <CardHeader>
              <CardTitle>Field Mapping Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {fieldMappings.map((mapping, index) => (
                  <div key={mapping.id || index} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border rounded-lg">
                    <div>
                      <Label>Our Field</Label>
                      <Input 
                        value={mapping.ourField} 
                        onChange={(e) => updateFieldMapping(index, 'ourField', e.target.value)}
                      />
                    </div>
                    
                    <div className="flex items-center justify-center">
                      <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    
                    <div>
                      <Label>TeamLeader Field</Label>
                      <Input 
                        value={mapping.teamLeaderField} 
                        onChange={(e) => updateFieldMapping(index, 'teamLeaderField', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label>Type</Label>
                      <Select 
                        value={mapping.fieldType} 
                        onValueChange={(value) => updateFieldMapping(index, 'fieldType', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contact">Contact</SelectItem>
                          <SelectItem value="company">Company</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center justify-center">
                      <Switch 
                        checked={mapping.enabled} 
                        onCheckedChange={(checked) => updateFieldMapping(index, 'enabled', checked)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conflict Resolution */}
        <TabsContent value="conflicts">
          <Card>
            <CardHeader>
              <CardTitle>Data Conflicts</CardTitle>
            </CardHeader>
            <CardContent>
              {conflicts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-lg font-medium">No conflicts to resolve</p>
                  <p className="text-muted-foreground">All data is synchronized</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {conflicts.map((conflict) => (
                    <Alert key={conflict.id}>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Conflict in {conflict.conflict_field}</AlertTitle>
                      <AlertDescription className="mt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-3 border rounded">
                            <div className="font-medium">Our Value</div>
                            <div className="font-mono">{conflict.our_value}</div>
                            <Button 
                              size="sm" 
                              className="mt-2"
                              onClick={() => resolveConflict(conflict.id, true)}
                            >
                              Use This Value
                            </Button>
                          </div>
                          
                          <div className="p-3 border rounded">
                            <div className="font-medium">TeamLeader Value</div>
                            <div className="font-mono">{conflict.teamleader_value}</div>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="mt-2"
                              onClick={() => resolveConflict(conflict.id, false)}
                            >
                              Use This Value
                            </Button>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sync History */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Sync History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {syncHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg font-medium">No sync history</p>
                    <p className="text-muted-foreground">Run your first sync to see history</p>
                  </div>
                ) : (
                  syncHistory.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{item.sync_type}</Badge>
                          {getStatusBadge(item.status)}
                          <span className="text-sm text-muted-foreground">
                            {new Date(item.started_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>Processed: {item.records_processed}</span>
                          <span>Success: {item.records_success}</span>
                          {item.records_failed > 0 && <span>Failed: {item.records_failed}</span>}
                        </div>
                      </div>
                      {getStatusIcon(item.status)}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Sync Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="sync-interval">Auto Sync Interval (hours)</Label>
                    <Select value={syncInterval} onValueChange={setSyncInterval}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Every hour</SelectItem>
                        <SelectItem value="4">Every 4 hours</SelectItem>
                        <SelectItem value="8">Every 8 hours</SelectItem>
                        <SelectItem value="24">Daily</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Auto Sync Enabled</Label>
                    <Switch 
                      checked={autoSyncEnabled} 
                      onCheckedChange={setAutoSyncEnabled}
                      disabled={!connection}
                    />
                  </div>
                </div>
              </div>

              {connection && (
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">TeamLeader Connection</h4>
                      <p className="text-sm text-muted-foreground">
                        Connected and ready to sync
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={handleAuthorization}
                    >
                      Reconnect
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}