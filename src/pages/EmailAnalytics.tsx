import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Brain, 
  Mail, 
  TrendingUp, 
  Clock, 
  DollarSign, 
  AlertCircle,
  Play,
  Pause,
  RefreshCw
} from "lucide-react";

interface AnalysisStats {
  totalEmails: number;
  analyzedEmails: number;
  pendingEmails: number;
  failedEmails: number;
  processingRate: number;
  estimatedTime: string;
}

interface CategoryBreakdown {
  priceInquiries: number;
  orders: number;
  complaints: number;
  general: number;
  spam: number;
}

export default function EmailAnalytics() {
  const [stats, setStats] = useState<AnalysisStats>({
    totalEmails: 0,
    analyzedEmails: 0,
    pendingEmails: 0,
    failedEmails: 0,
    processingRate: 0,
    estimatedTime: "Calculating..."
  });

  const [categories, setCategories] = useState<CategoryBreakdown>({
    priceInquiries: 0,
    orders: 0,
    complaints: 0,
    general: 0,
    spam: 0
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [currentBatch, setCurrentBatch] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      // Get total email counts
      const { data: totalData } = await supabase
        .from('email_history')
        .select('analysis_status', { count: 'exact' });

      const totalEmails = totalData?.length || 0;
      const analyzedEmails = totalData?.filter(e => e.analysis_status === 'completed').length || 0;
      const pendingEmails = totalData?.filter(e => e.analysis_status === 'pending').length || 0;
      const failedEmails = totalData?.filter(e => e.analysis_status === 'failed').length || 0;

      // Get category breakdown from analyzed emails
      const { data: analyticsData } = await supabase
        .from('email_analytics')
        .select('intent');

      const categoryBreakdown = {
        priceInquiries: analyticsData?.filter(a => a.intent === 'price_inquiry').length || 0,
        orders: analyticsData?.filter(a => a.intent === 'order').length || 0,
        complaints: analyticsData?.filter(a => a.intent === 'complaint').length || 0,
        general: analyticsData?.filter(a => a.intent === 'general_inquiry').length || 0,
        spam: analyticsData?.filter(a => a.intent === 'spam').length || 0,
      };

      // Calculate processing rate
      const { data: recentMetrics } = await supabase
        .from('ai_performance_metrics')
        .select('metric_value, created_at')
        .eq('metric_type', 'batch_analysis_completed')
        .gte('created_at', new Date(Date.now() - 3600000).toISOString())
        .order('created_at', { ascending: false });

      const processingRate = recentMetrics?.length > 0 ? 
        recentMetrics.reduce((acc, m) => acc + Number(m.metric_value), 0) / 
        (recentMetrics.length / 6) : 0; // emails per 10 minutes

      const estimatedMinutes = processingRate > 0 ? Math.ceil(pendingEmails / (processingRate / 10)) : 0;
      const estimatedTime = estimatedMinutes > 0 ? 
        `${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60}m` : "Calculating...";

      setStats({
        totalEmails,
        analyzedEmails,
        pendingEmails,
        failedEmails,
        processingRate: Math.round(processingRate * 10) / 10,
        estimatedTime
      });

      setCategories(categoryBreakdown);

    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const startBatchAnalysis = async () => {
    try {
      setIsProcessing(true);
      
      toast({
        title: "Starting AI Analysis",
        description: "Processing large batch of emails...",
      });

      const { data, error } = await supabase.functions.invoke('claude-batch-analyzer', {
        body: { 
          batchSize: 50,
          forceReanalysis: false 
        }
      });

      if (error) throw error;

      setCurrentBatch(data.batch_id);
      
      toast({
        title: "Batch Analysis Started",
        description: `Processing ${data.processed} emails in batch ${data.batch_id}`,
      });

      // Refresh stats
      setTimeout(loadStats, 2000);

    } catch (error: any) {
      console.error('Error starting batch analysis:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to start analysis",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const startMassProcessing = async () => {
    try {
      setIsProcessing(true);
      
      toast({
        title: "Starting Mass Processing",
        description: "Processing ALL pending emails in batches...",
      });

      // Process in batches of 100 until all done
      let remainingEmails = stats.pendingEmails;
      let batchCount = 0;
      
      while (remainingEmails > 0 && batchCount < 20) { // Safety limit
        const { data, error } = await supabase.functions.invoke('claude-batch-analyzer', {
          body: { 
            batchSize: Math.min(100, remainingEmails),
            forceReanalysis: false 
          }
        });

        if (error) throw error;

        batchCount++;
        remainingEmails -= data.processed;
        
        toast({
          title: `Batch ${batchCount} Complete`,
          description: `Processed ${data.success_count}/${data.processed} emails. ${remainingEmails} remaining.`,
        });

        // Wait between batches to avoid rate limits
        if (remainingEmails > 0) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }

        // Refresh stats
        await loadStats();
      }

      toast({
        title: "Mass Processing Complete",
        description: `Processed ${batchCount} batches successfully!`,
      });

    } catch (error: any) {
      console.error('Error in mass processing:', error);
      toast({
        title: "Error",
        description: error.message || "Failed during mass processing",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const progressPercentage = stats.totalEmails > 0 ? (stats.analyzedEmails / stats.totalEmails) * 100 : 0;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8" />
            Email AI Analytics
          </h1>
          <p className="text-muted-foreground">
            Comprehensive AI analysis of your email database
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={loadStats}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button 
            onClick={startBatchAnalysis}
            disabled={isProcessing}
            variant="default"
          >
            {isProcessing ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
            Analyze Batch (50)
          </Button>
          <Button 
            onClick={startMassProcessing}
            disabled={isProcessing || stats.pendingEmails === 0}
            variant="destructive"
            size="lg"
          >
            <Brain className="mr-2 h-4 w-4" />
            Process All ({stats.pendingEmails.toLocaleString()})
          </Button>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEmails.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              In your database
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Analyzed</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.analyzedEmails.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {progressPercentage.toFixed(1)}% complete
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pendingEmails.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.estimatedTime} remaining
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.processingRate}</div>
            <p className="text-xs text-muted-foreground">
              emails per 10 minutes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={progressPercentage} className="h-3" />
            <div className="flex justify-between text-sm">
              <span>{stats.analyzedEmails.toLocaleString()} analyzed</span>
              <span>{progressPercentage.toFixed(1)}% complete</span>
              <span>{stats.pendingEmails.toLocaleString()} remaining</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Email Categories Analyzed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-yellow-500" />
                  <span>Price Inquiries</span>
                </div>
                <Badge variant="secondary">{categories.priceInquiries}</Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-500" />
                  <span>Orders</span>
                </div>
                <Badge variant="secondary">{categories.orders}</Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span>Complaints</span>
                </div>
                <Badge variant="secondary">{categories.complaints}</Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-green-500" />
                  <span>General Inquiries</span>
                </div>
                <Badge variant="secondary">{categories.general}</Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-gray-500" />
                  <span>Spam</span>
                </div>
                <Badge variant="secondary">{categories.spam}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analysis Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900">Business Intelligence</h4>
                <p className="text-sm text-blue-700 mt-1">
                  {categories.priceInquiries} price inquiries found - potential revenue opportunities
                </p>
              </div>
              
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-900">Customer Service</h4>
                <p className="text-sm text-green-700 mt-1">
                  {categories.complaints} complaints identified for immediate attention
                </p>
              </div>
              
              <div className="p-4 bg-purple-50 rounded-lg">
                <h4 className="font-medium text-purple-900">Process Optimization</h4>
                <p className="text-sm text-purple-700 mt-1">
                  AI can auto-categorize {Math.round((stats.analyzedEmails / stats.totalEmails) * 100)}% of your emails
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Batch Info */}
      {currentBatch && (
        <Card>
          <CardHeader>
            <CardTitle>Current Processing Batch</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Batch ID: {currentBatch}</Badge>
              <span className="text-sm text-muted-foreground">
                Processing emails with AI analysis...
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}