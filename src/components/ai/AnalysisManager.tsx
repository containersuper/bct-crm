import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Brain, Play, RefreshCw, CheckCircle, XCircle, Clock, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AnalysisStats {
  totalEmails: number;
  pendingAnalysis: number;
  completedAnalysis: number;
  failedAnalysis: number;
  lastBatchTimestamp?: string;
}

interface BatchProgress {
  batchId: string;
  processed: number;
  successCount: number;
  failureCount: number;
  isRunning: boolean;
}

export function AnalysisManager() {
  const [stats, setStats] = useState<AnalysisStats>({
    totalEmails: 0,
    pendingAnalysis: 0,
    completedAnalysis: 0,
    failedAnalysis: 0
  });
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [isRunningBatch, setIsRunningBatch] = useState(false);
  const [isRunningHistorical, setIsRunningHistorical] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      // Get email analysis stats
      const { data: emailStats, error: emailError } = await supabase
        .from('email_history')
        .select('analysis_status');

      if (emailError) throw emailError;

      const stats = emailStats?.reduce((acc, email) => {
        acc.totalEmails++;
        switch (email.analysis_status) {
          case 'pending':
            acc.pendingAnalysis++;
            break;
          case 'completed':
            acc.completedAnalysis++;
            break;
          case 'failed':
            acc.failedAnalysis++;
            break;
        }
        return acc;
      }, {
        totalEmails: 0,
        pendingAnalysis: 0,
        completedAnalysis: 0,
        failedAnalysis: 0
      }) || {
        totalEmails: 0,
        pendingAnalysis: 0,
        completedAnalysis: 0,
        failedAnalysis: 0
      };

      // Get last batch info
      const { data: lastBatch } = await supabase
        .from('ai_performance_metrics')
        .select('measured_at, context')
        .eq('metric_type', 'batch_analysis_completed')
        .order('measured_at', { ascending: false })
        .limit(1)
        .single();

      setStats({
        ...stats,
        lastBatchTimestamp: lastBatch?.measured_at
      });

    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const runBatchAnalysis = async () => {
    setIsRunningBatch(true);
    try {
      const { data, error } = await supabase.functions.invoke('claude-batch-analyzer', {
        body: { 
          batchSize: 50,
          forceReanalysis: false 
        }
      });

      if (error) throw error;

      setBatchProgress({
        batchId: data.batch_id,
        processed: data.processed,
        successCount: data.success_count,
        failureCount: data.failure_count,
        isRunning: false
      });

      toast({
        title: "Batch Analysis Complete",
        description: `Analyzed ${data.processed} emails with ${data.success_count} successes`,
      });

      loadStats();
    } catch (error) {
      console.error('Error running batch analysis:', error);
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRunningBatch(false);
    }
  };

  const runHistoricalAnalysis = async () => {
    setIsRunningHistorical(true);
    try {
      const { data, error } = await supabase.functions.invoke('claude-batch-analyzer', {
        body: { 
          batchSize: 100,
          forceReanalysis: true 
        }
      });

      if (error) throw error;

      toast({
        title: "Historical Analysis Started",
        description: `Processing ${data.processed} historical emails`,
      });

      loadStats();
    } catch (error) {
      console.error('Error running historical analysis:', error);
      toast({
        title: "Historical Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRunningHistorical(false);
    }
  };

  const runCronJob = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('ai-analysis-cron');

      if (error) throw error;

      toast({
        title: "Full Sync Complete",
        description: "Tokens refreshed, emails synced, and analysis updated",
      });

      loadStats();
    } catch (error) {
      console.error('Error running cron job:', error);
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const progressPercentage = stats.totalEmails > 0 
    ? Math.round((stats.completedAnalysis / stats.totalEmails) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Analysis Manager
          </CardTitle>
          <CardDescription>
            Monitor and manage AI email analysis across your entire email history
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{stats.totalEmails}</div>
              <div className="text-sm text-muted-foreground">Total Emails</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.completedAnalysis}</div>
              <div className="text-sm text-muted-foreground">Analyzed</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{stats.pendingAnalysis}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-red-600">{stats.failedAnalysis}</div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Analysis Progress</span>
              <span>{progressPercentage}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Batch Progress */}
          {batchProgress && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Last batch ({batchProgress.batchId.slice(0, 8)}): 
                Processed {batchProgress.processed} emails with {batchProgress.successCount} successes
                {batchProgress.failureCount > 0 && ` and ${batchProgress.failureCount} failures`}
              </AlertDescription>
            </Alert>
          )}

          {/* Last Analysis Info */}
          {stats.lastBatchTimestamp && (
            <div className="text-sm text-muted-foreground">
              Last analysis: {new Date(stats.lastBatchTimestamp).toLocaleString()}
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              onClick={runBatchAnalysis}
              disabled={isRunningBatch}
              className="flex items-center gap-2"
            >
              {isRunningBatch ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Analyze New Emails
            </Button>

            <Button 
              onClick={runHistoricalAnalysis}
              disabled={isRunningHistorical}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isRunningHistorical ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Clock className="h-4 w-4" />
              )}
              Analyze All Historical
            </Button>

            <Button 
              onClick={runCronJob}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <Zap className="h-4 w-4" />
              Full Sync & Analysis
            </Button>
          </div>

          {/* Status Indicators */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Auto-refresh: Active
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Brain className="h-3 w-3" />
              Claude API: Connected
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}