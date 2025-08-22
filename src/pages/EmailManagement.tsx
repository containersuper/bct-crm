import { useState, useEffect } from "react";
import { EmailInboxIntegrated } from "@/components/email/EmailInboxIntegrated";
import { EnhancedLeadManager } from "@/components/ai/EnhancedLeadManager";
import { QuoteDashboard } from "@/components/quotes/QuoteDashboard";
import { ProfessionalQuoteGenerator } from "@/components/quotes/ProfessionalQuoteGenerator";
import { AIAnalyticsDashboard } from "@/components/ai/AIAnalyticsDashboard";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Activity, 
  TrendingUp, 
  Mail, 
  Users, 
  DollarSign, 
  Clock, 
  RefreshCw,
  Zap,
  Target,
  BarChart3,
  Bell,
  Settings
} from "lucide-react";

export default function EmailManagement() {
  const [stats, setStats] = useState({
    hotLeads: 0,
    pendingQuotes: 0,
    unprocessedEmails: 0,
    totalEmails: 0,
    processedEmails: 0,
    conversionRate: 0,
    activeJobs: 0,
    processingSpeed: 0
  });
  const [autoProcessing, setAutoProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [processingProgress, setProcessingProgress] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      
      // Load multiple stats in parallel
      const [
        { count: hotLeads },
        { count: pendingQuotes },
        { count: unprocessedEmails },
        { count: totalEmails },
        { count: processedEmails },
        { data: activeJobsData }
      ] = await Promise.all([
        supabase
          .from('email_analytics')
          .select('*', { count: 'exact', head: true })
          .eq('urgency', 'high'),
        supabase
          .from('quotes')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'draft'),
        supabase
          .from('email_history')
          .select('*', { count: 'exact', head: true })
          .eq('analysis_status', 'pending'),
        supabase
          .from('email_history')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('email_history')
          .select('*', { count: 'exact', head: true })
          .eq('analysis_status', 'completed'),
        supabase
          .from('email_processing_jobs')
          .select('*')
          .eq('status', 'running')
      ]);

      // Calculate conversion rate
      const conversionRate = hotLeads && pendingQuotes 
        ? Math.round((pendingQuotes / hotLeads) * 100) 
        : 0;

      // Calculate processing progress
      const progress = totalEmails > 0 
        ? Math.round((processedEmails / totalEmails) * 100) 
        : 0;

      setStats({
        hotLeads: hotLeads || 0,
        pendingQuotes: pendingQuotes || 0,
        unprocessedEmails: unprocessedEmails || 0,
        totalEmails: totalEmails || 0,
        processedEmails: processedEmails || 0,
        conversionRate,
        activeJobs: activeJobsData?.length || 0,
        processingSpeed: 2.3 // Mock data - could be calculated from actual processing times
      });

      setProcessingProgress(progress);
    } catch (error) {
      console.error('Error loading stats:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard statistics",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAutoProcessing = async () => {
    try {
      const newState = !autoProcessing;
      setAutoProcessing(newState);

      if (newState) {
        // Start auto-processing
        const { error } = await supabase.functions.invoke('claude-batch-analyzer', {
          body: { batchSize: 25, continuous: true }
        });

        if (error) throw error;

        toast({
          title: "Auto-Processing Enabled",
          description: "Emails will be automatically processed as they arrive",
        });
      } else {
        toast({
          title: "Auto-Processing Disabled",
          description: "Manual processing mode activated",
        });
      }
    } catch (error) {
      console.error('Error toggling auto-processing:', error);
      setAutoProcessing(!autoProcessing); // Revert on error
      toast({
        title: "Error",
        description: "Failed to toggle auto-processing",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Enhanced Header with Notifications */}
      <div className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">AI Email Management</h1>
                <p className="text-muted-foreground">
                  Automated lead identification and quote generation for all your brands
                </p>
              </div>
              
              {/* Real-time Status Indicator */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${stats.activeJobs > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                <span className="text-sm text-muted-foreground">
                  {stats.activeJobs > 0 ? 'Processing...' : 'Idle'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Auto-Processing Toggle */}
              <div className="flex items-center gap-2">
                <Label htmlFor="auto-processing" className="text-sm font-medium">
                  Auto-Processing
                </Label>
                <Switch
                  id="auto-processing"
                  checked={autoProcessing}
                  onCheckedChange={toggleAutoProcessing}
                />
              </div>

              {/* Refresh Button */}
              <Button 
                variant="outline" 
                size="sm"
                onClick={loadStats}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              {/* Notifications */}
              <NotificationCenter />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Real-time Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalEmails.toLocaleString()}</div>
              <div className="flex items-center gap-2 mt-2">
                <Progress value={processingProgress} className="flex-1" />
                <span className="text-xs text-muted-foreground">{processingProgress}%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.processedEmails} processed • {stats.unprocessedEmails} pending
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hot Leads</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.hotLeads}</div>
              <div className="flex items-center gap-1 mt-2">
                <Badge variant="destructive" className="text-xs">
                  🔥 High Priority
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Requiring immediate attention
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quotes Generated</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.pendingQuotes}</div>
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp className="h-3 w-3 text-green-600" />
                <span className="text-xs text-green-600">{stats.conversionRate}% conversion</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                AI-generated quotes ready
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processing Speed</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.processingSpeed}s</div>
              <div className="flex items-center gap-1 mt-2">
                <Zap className="h-3 w-3 text-purple-600" />
                <span className="text-xs text-purple-600">
                  {stats.activeJobs} active jobs
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Average per email
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Tabs */}
        <Tabs defaultValue="leads" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 h-12">
            <TabsTrigger value="leads" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Lead Management
              {stats.hotLeads > 0 && (
                <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {stats.hotLeads}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="inbox" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Inbox
              {stats.unprocessedEmails > 0 && (
                <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {stats.unprocessedEmails}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="quote-generator" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Quote Generator
            </TabsTrigger>
            <TabsTrigger value="quotes" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Quote Dashboard
              {stats.pendingQuotes > 0 && (
                <Badge variant="outline" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {stats.pendingQuotes}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              AI Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leads" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Lead Management</h3>
                <p className="text-sm text-muted-foreground">
                  AI-powered lead identification and management
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={stats.hotLeads > 0 ? "destructive" : "secondary"}>
                  {stats.hotLeads} Hot Leads
                </Badge>
              </div>
            </div>
            <EnhancedLeadManager />
          </TabsContent>

          <TabsContent value="inbox" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Email Inbox</h3>
                <p className="text-sm text-muted-foreground">
                  Integrated email management with AI analysis
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={autoProcessing ? "default" : "outline"}>
                  {autoProcessing ? "Auto-Processing On" : "Manual Mode"}
                </Badge>
              </div>
            </div>
            <EmailInboxIntegrated />
          </TabsContent>

          <TabsContent value="quote-generator" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Quote Generator</h3>
                <p className="text-sm text-muted-foreground">
                  Create professional German business quotes
                </p>
              </div>
            </div>
            <ProfessionalQuoteGenerator />
          </TabsContent>

          <TabsContent value="quotes" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Quote Dashboard</h3>
                <p className="text-sm text-muted-foreground">
                  Manage and track all generated quotes
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {stats.conversionRate}% Conversion Rate
                </Badge>
              </div>
            </div>
            <QuoteDashboard />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">AI Analytics</h3>
                <p className="text-sm text-muted-foreground">
                  Real-time insights and performance metrics
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={stats.activeJobs > 0 ? "default" : "secondary"}>
                  <Activity className="h-3 w-3 mr-1" />
                  {stats.activeJobs > 0 ? "Processing" : "Idle"}
                </Badge>
              </div>
            </div>
            <AIAnalyticsDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}