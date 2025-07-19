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
import { AlertCircle, CheckCircle, Clock, RefreshCw, Settings, ArrowLeftRight, History, Calendar } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

interface SyncStatus {
  status: 'idle' | 'syncing' | 'success' | 'error';
  lastSync: string | null;
  nextSync: string | null;
  progress: number;
  message: string;
}

interface FieldMapping {
  ourField: string;
  teamLeaderField: string;
  direction: 'bidirectional' | 'to_teamleader' | 'from_teamleader';
  enabled: boolean;
}

interface SyncHistoryItem {
  id: string;
  timestamp: string;
  type: 'manual' | 'auto';
  status: 'success' | 'error' | 'partial';
  recordsProcessed: number;
  conflicts: number;
  message: string;
}

interface ConflictItem {
  id: string;
  recordId: string;
  field: string;
  ourValue: string;
  teamLeaderValue: string;
  lastModified: {
    ours: string;
    teamLeader: string;
  };
  resolved: boolean;
}

const defaultFieldMappings: FieldMapping[] = [
  { ourField: 'name', teamLeaderField: 'name', direction: 'bidirectional', enabled: true },
  { ourField: 'email', teamLeaderField: 'email', direction: 'bidirectional', enabled: true },
  { ourField: 'company', teamLeaderField: 'company_name', direction: 'bidirectional', enabled: true },
  { ourField: 'phone', teamLeaderField: 'telephone', direction: 'bidirectional', enabled: true },
  { ourField: 'brand', teamLeaderField: 'custom_field_brand', direction: 'from_teamleader', enabled: false },
];

export function TeamLeaderSync() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    status: 'idle',
    lastSync: '2024-01-15 14:30:00',
    nextSync: '2024-01-15 18:00:00',
    progress: 0,
    message: 'Ready to sync'
  });

  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>(defaultFieldMappings);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [syncInterval, setSyncInterval] = useState('4'); // hours
  const [retryAttempts, setRetryAttempts] = useState(3);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([
    {
      id: '1',
      recordId: 'customer_123',
      field: 'phone',
      ourValue: '+49 30 12345678',
      teamLeaderValue: '+49 30 87654321',
      lastModified: {
        ours: '2024-01-15 12:00:00',
        teamLeader: '2024-01-15 14:00:00'
      },
      resolved: false
    }
  ]);

  const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>([
    {
      id: '1',
      timestamp: '2024-01-15 14:30:00',
      type: 'auto',
      status: 'success',
      recordsProcessed: 156,
      conflicts: 1,
      message: 'Sync completed with 1 conflict'
    },
    {
      id: '2',
      timestamp: '2024-01-15 10:30:00',
      type: 'manual',
      status: 'success',
      recordsProcessed: 23,
      conflicts: 0,
      message: 'Manual sync completed successfully'
    },
    {
      id: '3',
      timestamp: '2024-01-15 06:30:00',
      type: 'auto',
      status: 'error',
      recordsProcessed: 0,
      conflicts: 0,
      message: 'Authentication failed - API key expired'
    }
  ]);

  const handleManualSync = async () => {
    setSyncStatus({
      ...syncStatus,
      status: 'syncing',
      progress: 0,
      message: 'Starting sync...'
    });

    // Simulate sync progress
    const steps = [
      { progress: 20, message: 'Connecting to TeamLeader...' },
      { progress: 40, message: 'Fetching customer data...' },
      { progress: 60, message: 'Processing updates...' },
      { progress: 80, message: 'Resolving conflicts...' },
      { progress: 100, message: 'Sync completed successfully!' }
    ];

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSyncStatus(prev => ({
        ...prev,
        progress: step.progress,
        message: step.message
      }));
    }

    setSyncStatus(prev => ({
      ...prev,
      status: 'success',
      lastSync: new Date().toLocaleString(),
      nextSync: new Date(Date.now() + parseInt(syncInterval) * 60 * 60 * 1000).toLocaleString()
    }));

    toast.success("Sync completed successfully!");
  };

  const updateFieldMapping = (index: number, field: keyof FieldMapping, value: any) => {
    const updated = [...fieldMappings];
    updated[index] = { ...updated[index], [field]: value };
    setFieldMappings(updated);
  };

  const resolveConflict = (conflictId: string, useOurValue: boolean) => {
    setConflicts(prev => prev.map(conflict => 
      conflict.id === conflictId 
        ? { ...conflict, resolved: true }
        : conflict
    ));
    
    toast.success(`Conflict resolved using ${useOurValue ? 'our' : 'TeamLeader'} value`);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'syncing':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      success: 'default',
      error: 'destructive',
      partial: 'secondary',
      syncing: 'outline'
    } as const;
    
    return <Badge variant={variants[status as keyof typeof variants] || 'outline'}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
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
                {autoSyncEnabled ? syncStatus.nextSync : 'Manual only'}
              </p>
            </div>
          </div>
          
          <Separator className="my-4" />
          
          <div className="flex gap-4">
            <Button 
              onClick={handleManualSync} 
              disabled={syncStatus.status === 'syncing'}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncStatus.status === 'syncing' ? 'animate-spin' : ''}`} />
              {syncStatus.status === 'syncing' ? 'Syncing...' : 'Manual Sync'}
            </Button>
            
            <div className="flex items-center gap-2">
              <Switch 
                checked={autoSyncEnabled} 
                onCheckedChange={setAutoSyncEnabled}
              />
              <Label>Auto Sync</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="mapping" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="mapping">Field Mapping</TabsTrigger>
          <TabsTrigger value="conflicts">
            Conflicts {conflicts.filter(c => !c.resolved).length > 0 && 
            <Badge variant="destructive" className="ml-1">{conflicts.filter(c => !c.resolved).length}</Badge>}
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
                  <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border rounded-lg">
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
                      <Label>Direction</Label>
                      <Select 
                        value={mapping.direction} 
                        onValueChange={(value) => updateFieldMapping(index, 'direction', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bidirectional">Bidirectional</SelectItem>
                          <SelectItem value="to_teamleader">To TeamLeader</SelectItem>
                          <SelectItem value="from_teamleader">From TeamLeader</SelectItem>
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
                
                <Button 
                  variant="outline" 
                  onClick={() => setFieldMappings([...fieldMappings, { 
                    ourField: '', 
                    teamLeaderField: '', 
                    direction: 'bidirectional', 
                    enabled: true 
                  }])}
                >
                  Add Field Mapping
                </Button>
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
              {conflicts.filter(c => !c.resolved).length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-lg font-medium">No conflicts to resolve</p>
                  <p className="text-muted-foreground">All data is synchronized</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {conflicts.filter(c => !c.resolved).map((conflict) => (
                    <Alert key={conflict.id}>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Conflict in {conflict.field} for record {conflict.recordId}</AlertTitle>
                      <AlertDescription className="mt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-3 border rounded">
                            <div className="font-medium">Our Value</div>
                            <div className="text-sm text-muted-foreground mb-2">
                              Modified: {conflict.lastModified.ours}
                            </div>
                            <div className="font-mono">{conflict.ourValue}</div>
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
                            <div className="text-sm text-muted-foreground mb-2">
                              Modified: {conflict.lastModified.teamLeader}
                            </div>
                            <div className="font-mono">{conflict.teamLeaderValue}</div>
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
                {syncHistory.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={item.type === 'manual' ? 'default' : 'secondary'}>
                          {item.type}
                        </Badge>
                        {getStatusBadge(item.status)}
                        <span className="text-sm text-muted-foreground">{item.timestamp}</span>
                      </div>
                      <p className="text-sm">{item.message}</p>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Records: {item.recordsProcessed}</span>
                        {item.conflicts > 0 && <span>Conflicts: {item.conflicts}</span>}
                      </div>
                    </div>
                    {getStatusIcon(item.status)}
                  </div>
                ))}
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
                  
                  <div>
                    <Label htmlFor="retry-attempts">Retry Attempts on Failure</Label>
                    <Input 
                      id="retry-attempts"
                      type="number" 
                      min="1" 
                      max="10"
                      value={retryAttempts}
                      onChange={(e) => setRetryAttempts(parseInt(e.target.value))}
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Enable Auto Sync</Label>
                    <Switch checked={autoSyncEnabled} onCheckedChange={setAutoSyncEnabled} />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label>Sync on Startup</Label>
                    <Switch defaultChecked />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label>Email Notifications</Label>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <h4 className="font-medium">TeamLeader API Configuration</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>API Endpoint</Label>
                    <Input defaultValue="https://api.teamleader.eu" disabled />
                  </div>
                  <div>
                    <Label>Connection Status</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Connected</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <Button>Save Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}