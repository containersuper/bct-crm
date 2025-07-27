import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Play, Pause, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BackfillProgress {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  emails_processed: number;
  quota_used: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

interface EmailAccount {
  id: string;
  email: string;
  provider: string;
  quota_usage: number;
}

export const EmailBackfillManager = () => {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<BackfillProgress[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchAccounts();
    if (selectedAccount) {
      fetchProgress();
    }
  }, [selectedAccount]);

  const fetchAccounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('email_accounts')
        .select('id, email, provider, quota_usage')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;
      setAccounts(data || []);
      
      if (data && data.length > 0 && !selectedAccount) {
        setSelectedAccount(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast({
        title: "Error",
        description: "Failed to fetch email accounts",
        variant: "destructive"
      });
    }
  };

  const fetchProgress = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !selectedAccount) return;

      const { data, error } = await supabase
        .from('email_backfill_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('email_account_id', selectedAccount)
        .order('start_date', { ascending: true });

      if (error) throw error;
      setProgress(data || []);
    } catch (error) {
      console.error('Error fetching progress:', error);
    }
  };

  const startBackfill = async () => {
    if (!selectedAccount || !startDate || !endDate) {
      toast({
        title: "Missing Information",
        description: "Please select an account and date range",
        variant: "destructive"
      });
      return;
    }

    if (new Date(startDate) >= new Date(endDate)) {
      toast({
        title: "Invalid Date Range",
        description: "Start date must be before end date",
        variant: "destructive"
      });
      return;
    }

    setIsRunning(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('email-backfill', {
        body: {
          userId: user.id,
          accountId: selectedAccount,
          startDate,
          endDate,
          action: 'start'
        }
      });

      if (error) throw error;

      toast({
        title: "Backfill Started",
        description: `Processing emails from ${startDate} to ${endDate}`,
      });

      // Refresh progress
      fetchProgress();

    } catch (error: any) {
      console.error('Backfill error:', error);
      toast({
        title: "Backfill Failed",
        description: error.message || "Failed to start email backfill",
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'in_progress':
        return <RotateCcw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Pause className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'in_progress':
        return <Badge variant="secondary">In Progress</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const totalProgress = progress.length > 0 
    ? (progress.filter(p => p.status === 'completed').length / progress.length) * 100 
    : 0;

  const totalEmails = progress.reduce((sum, p) => sum + (p.emails_processed || 0), 0);
  const totalQuotaUsed = progress.reduce((sum, p) => sum + (p.quota_used || 0), 0);

  const selectedAccountData = accounts.find(a => a.id === selectedAccount);
  const quotaPercentage = selectedAccountData ? (selectedAccountData.quota_usage / 1000000000) * 100 : 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Historical Email Backfill
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Account Selection and Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="account">Email Account</Label>
            <select
              id="account"
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full p-2 border border-input rounded-md bg-background"
            >
              <option value="">Select account...</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.email} ({account.provider})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {/* Quota Status */}
        {selectedAccountData && (
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Daily Quota Usage</span>
              <span className="text-sm text-muted-foreground">{quotaPercentage.toFixed(1)}%</span>
            </div>
            <Progress value={quotaPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {selectedAccountData.quota_usage.toLocaleString()} / 1,000,000,000 units used today
            </p>
          </div>
        )}

        {/* Start Backfill */}
        <div className="flex items-center gap-4">
          <Button
            onClick={startBackfill}
            disabled={isRunning || !selectedAccount || !startDate || !endDate || quotaPercentage > 90}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            {isRunning ? 'Processing...' : 'Start Backfill'}
          </Button>
          
          {quotaPercentage > 90 && (
            <div className="flex items-center gap-2 text-sm text-yellow-600">
              <AlertCircle className="h-4 w-4" />
              Quota limit reached. Try again tomorrow.
            </div>
          )}
        </div>

        {/* Progress Overview */}
        {progress.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg text-center">
                <div className="text-2xl font-bold">{totalEmails.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Emails Processed</div>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <div className="text-2xl font-bold">{totalProgress.toFixed(0)}%</div>
                <div className="text-sm text-muted-foreground">Overall Progress</div>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <div className="text-2xl font-bold">{totalQuotaUsed.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Quota Used</div>
              </div>
            </div>

            <Progress value={totalProgress} className="h-3" />

            {/* Progress Details */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              <h4 className="font-medium">Date Range Progress</h4>
              {progress.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(item.status)}
                    <div>
                      <div className="font-medium">
                        {item.start_date} to {item.end_date}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.emails_processed || 0} emails • {item.quota_used || 0} quota units
                        {item.error_message && (
                          <span className="text-red-500"> • {item.error_message}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(item.status)}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};