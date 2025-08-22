import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, 
  TrendingUp, 
  Mail, 
  Users, 
  DollarSign, 
  Clock, 
  Target,
  Zap,
  BarChart3,
  RefreshCw,
  PlayCircle
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AnalyticsStats {
  totalEmails: number;
  processedEmails: number;
  hotLeads: number;
  quotesGenerated: number;
  conversionRate: number;
  avgResponseTime: number;
  activeProcessingJobs: number;
  successRate: number;
}

interface ChartData {
  date: string;
  emails: number;
  leads: number;
  quotes: number;
  conversions: number;
}

interface ProcessingStats {
  status: string;
  count: number;
  percentage: number;
}

const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  accent: "hsl(var(--accent))",
  destructive: "hsl(var(--destructive))",
  muted: "hsl(var(--muted))"
};

export function AIAnalyticsDashboard() {
  const [stats, setStats] = useState<AnalyticsStats>({
    totalEmails: 0,
    processedEmails: 0,
    hotLeads: 0,
    quotesGenerated: 0,
    conversionRate: 0,
    avgResponseTime: 0,
    activeProcessingJobs: 0,
    successRate: 0
  });
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [processingStats, setProcessingStats] = useState<ProcessingStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadAnalytics();
    const interval = setInterval(loadAnalytics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadAnalytics = async () => {
    try {
      // Fetch overview stats
      const [emailsData, leadsData, quotesData, jobsData] = await Promise.all([
        supabase.from('email_history').select('*', { count: 'exact', head: true }),
        supabase.from('email_analytics').select('*', { count: 'exact', head: true }).eq('urgency', 'high'),
        supabase.from('quotes').select('*', { count: 'exact', head: true }).eq('ai_generated', true),
        supabase.from('email_processing_jobs').select('*').eq('status', 'running')
      ]);

      // Fetch processed emails count
      const { count: processedCount } = await supabase
        .from('email_history')
        .select('*', { count: 'exact', head: true })
        .eq('analysis_status', 'completed');

      // Calculate conversion rate
      const { count: totalQuotes } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true });

      const conversionRate = leadsData.count ? (totalQuotes || 0) / leadsData.count * 100 : 0;

      // Fetch chart data for the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: weeklyData } = await supabase
        .from('email_history')
        .select('created_at, analysis_status')
        .gte('created_at', sevenDaysAgo.toISOString());

      // Process weekly data into chart format
      const dailyStats = processWeeklyData(weeklyData || []);

      // Fetch processing pipeline stats
      const { data: pipelineData } = await supabase
        .from('email_history')
        .select('analysis_status')
        .not('analysis_status', 'is', null);

      const pipelineStats = processPipelineData(pipelineData || []);

      setStats({
        totalEmails: emailsData.count || 0,
        processedEmails: processedCount || 0,
        hotLeads: leadsData.count || 0,
        quotesGenerated: quotesData.count || 0,
        conversionRate: Math.round(conversionRate * 100) / 100,
        avgResponseTime: 2.3, // Mock data - could be calculated from actual processing times
        activeProcessingJobs: jobsData.data?.length || 0,
        successRate: processedCount ? Math.round((processedCount / (emailsData.count || 1)) * 100) : 0
      });

      setChartData(dailyStats);
      setProcessingStats(pipelineStats);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive"
      });
    }
  };

  const processWeeklyData = (data: any[]): ChartData[] => {
    const dailyMap = new Map();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyMap.set(dateStr, {
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        emails: 0,
        leads: 0,
        quotes: 0,
        conversions: 0
      });
    }

    data.forEach(item => {
      const date = new Date(item.created_at).toISOString().split('T')[0];
      if (dailyMap.has(date)) {
        const day = dailyMap.get(date);
        day.emails++;
        if (item.analysis_status === 'completed') {
          day.leads++;
        }
      }
    });

    return Array.from(dailyMap.values());
  };

  const processPipelineData = (data: any[]): ProcessingStats[] => {
    const statusCounts = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };

    data.forEach(item => {
      if (statusCounts.hasOwnProperty(item.analysis_status)) {
        statusCounts[item.analysis_status as keyof typeof statusCounts]++;
      }
    });

    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    return Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    }));
  };

  const startBatchProcessing = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('claude-batch-analyzer', {
        body: { batchSize: 50 }
      });

      if (error) throw error;

      toast({
        title: "Batch Processing Started",
        description: `Processing ${data.batchSize} emails with AI analysis`,
      });

      // Refresh analytics after a short delay
      setTimeout(loadAnalytics, 2000);
    } catch (error) {
      console.error('Error starting batch processing:', error);
      toast({
        title: "Error",
        description: "Failed to start batch processing",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">AI Analytics Dashboard</h2>
          <p className="text-muted-foreground">
            Real-time insights into email processing and lead generation
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadAnalytics} disabled={isLoading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={startBatchProcessing} disabled={isProcessing}>
            <PlayCircle className="h-4 w-4 mr-2" />
            {isProcessing ? "Processing..." : "Start Batch Processing"}
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEmails.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.processedEmails} processed ({stats.successRate}%)
            </p>
            <Progress value={stats.successRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hot Leads</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.hotLeads}</div>
            <p className="text-xs text-muted-foreground">
              High-priority prospects
            </p>
            <Badge variant="destructive" className="mt-2">
              🔥 Active
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Quotes Generated</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.quotesGenerated}</div>
            <p className="text-xs text-muted-foreground">
              {stats.conversionRate}% conversion rate
            </p>
            <div className="flex items-center mt-2 text-xs text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +12% this week
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeProcessingJobs}</div>
            <p className="text-xs text-muted-foreground">
              Active jobs • {stats.avgResponseTime}s avg
            </p>
            <Badge variant={stats.activeProcessingJobs > 0 ? "default" : "secondary"} className="mt-2">
              <Zap className="h-3 w-3 mr-1" />
              {stats.activeProcessingJobs > 0 ? "Processing" : "Idle"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">📈 Trends</TabsTrigger>
          <TabsTrigger value="pipeline">⚙️ Pipeline</TabsTrigger>
          <TabsTrigger value="performance">🎯 Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Processing Trends (Last 7 Days)</CardTitle>
              <CardDescription>
                Daily email volume and lead identification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="emails" 
                    stackId="1"
                    stroke={CHART_COLORS.primary} 
                    fill={CHART_COLORS.primary}
                    fillOpacity={0.6}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="leads" 
                    stackId="1"
                    stroke={CHART_COLORS.accent} 
                    fill={CHART_COLORS.accent}
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Processing Pipeline</CardTitle>
                <CardDescription>Current email analysis status distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={processingStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      fill={CHART_COLORS.primary}
                      dataKey="count"
                      label={({ status, percentage }) => `${status}: ${percentage}%`}
                    >
                      {processingStats.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={Object.values(CHART_COLORS)[index % Object.values(CHART_COLORS).length]} 
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pipeline Details</CardTitle>
                <CardDescription>Breakdown by processing stage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {processingStats.map((stat, index) => (
                  <div key={stat.status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: Object.values(CHART_COLORS)[index % Object.values(CHART_COLORS).length] }}
                      />
                      <span className="capitalize text-sm font-medium">{stat.status}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{stat.count}</span>
                      <Badge variant="outline">{stat.percentage}%</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Performance Metrics</CardTitle>
              <CardDescription>
                Success rates and processing efficiency
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="leads" fill={CHART_COLORS.primary} />
                  <Bar dataKey="quotes" fill={CHART_COLORS.accent} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}