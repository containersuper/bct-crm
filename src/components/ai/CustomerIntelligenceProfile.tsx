import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { 
  Brain, 
  User, 
  TrendingUp, 
  MessageCircle, 
  AlertTriangle, 
  Target, 
  Clock,
  DollarSign,
  Globe,
  RefreshCw,
  Lightbulb,
  BarChart3
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Customer {
  id: number;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  brand?: string;
  created_at: string;
}

interface CustomerIntelligence {
  id: string;
  customer_id: number;
  ai_summary: string;
  communication_style: any;
  business_patterns: any;
  price_sensitivity: string;
  decision_factors: any;
  lifetime_value: number;
  risk_score: number;
  opportunity_score: number;
  next_best_action: string;
  last_analysis: string;
  insights?: string[];
}

interface CustomerIntelligenceProfileProps {
  customer: Customer;
}

const priceSensitivityColors = {
  low: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-red-500'
};

const riskColors = {
  low: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-red-500'
};

export function CustomerIntelligenceProfile({ customer }: CustomerIntelligenceProfileProps) {
  const [intelligence, setIntelligence] = useState<CustomerIntelligence | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [emailStats, setEmailStats] = useState({ total: 0, recent: 0, sentiment: 'neutral' });
  const [quoteStats, setQuoteStats] = useState({ total: 0, won: 0, pending: 0, total_value: 0 });
  const { toast } = useToast();

  useEffect(() => {
    loadIntelligence();
    loadStats();
  }, [customer.id]);

  const loadIntelligence = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_intelligence')
        .select('*')
        .eq('customer_id', customer.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setIntelligence(data);
      }
    } catch (error) {
      console.error('Error loading intelligence:', error);
    }
  };

  const loadStats = async () => {
    try {
      // Load email stats
      const { data: emails, error: emailError } = await supabase
        .from('email_history')
        .select('id, sentiment:email_analytics(sentiment)')
        .or(`from_address.eq.${customer.email},to_address.eq.${customer.email}`);

      if (!emailError && emails) {
        const recentEmails = emails.filter(email => 
          Date.now() - 30 * 24 * 60 * 60 * 1000
        );
        setEmailStats({
          total: emails.length,
          recent: recentEmails.length,
          sentiment: emails[0]?.sentiment?.[0]?.sentiment || 'neutral'
        });
      }

      // Load quote stats
      const { data: quotes, error: quoteError } = await supabase
        .from('quotes')
        .select('status, total_price')
        .eq('customer_id', customer.id);

      if (!quoteError && quotes) {
        const won = quotes.filter(q => q.status === 'accepted').length;
        const pending = quotes.filter(q => q.status === 'pending').length;
        const totalValue = quotes.reduce((sum, q) => sum + (q.total_price || 0), 0);
        
        setQuoteStats({
          total: quotes.length,
          won,
          pending,
          total_value: totalValue
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const generateIntelligence = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('claude-customer-intelligence', {
        body: { customerId: customer.id }
      });

      if (error) throw error;

      if (data.success) {
        setIntelligence(data.intelligence);
        toast({
          title: 'Intelligence Generated',
          description: 'Customer intelligence analysis completed',
        });
      }
    } catch (error) {
      console.error('Intelligence generation error:', error);
      toast({
        title: 'Analysis Failed',
        description: 'Failed to generate customer intelligence',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getRiskLevel = (score: number) => {
    if (score <= 0.3) return 'low';
    if (score <= 0.7) return 'medium';
    return 'high';
  };

  if (isAnalyzing) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 animate-pulse text-primary" />
            <CardTitle>Customer Intelligence</CardTitle>
          </div>
          <CardDescription>Claude is analyzing customer data...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Customer Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="text-lg font-semibold">
                  {customer.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-xl">{customer.name}</CardTitle>
                <CardDescription className="space-y-1">
                  <div>{customer.company || 'Individual Customer'}</div>
                  <div className="flex items-center gap-4 text-sm">
                    <span>{customer.email}</span>
                    {customer.phone && <span>{customer.phone}</span>}
                    {customer.brand && <Badge variant="outline">{customer.brand}</Badge>}
                  </div>
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {intelligence && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Brain className="h-3 w-3" />
                  AI Analyzed
                </Badge>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={generateIntelligence}
                disabled={isAnalyzing}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isAnalyzing ? 'animate-spin' : ''}`} />
                {intelligence ? 'Refresh' : 'Analyze'}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {/* Quick Stats */}
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{emailStats.total}</div>
              <div className="text-sm text-muted-foreground">Total Emails</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{quoteStats.total}</div>
              <div className="text-sm text-muted-foreground">Quotes Sent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">${(quoteStats.total_value / 1000).toFixed(0)}K</div>
              <div className="text-sm text-muted-foreground">Total Value</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {quoteStats.total > 0 ? Math.round((quoteStats.won / quoteStats.total) * 100) : 0}%
              </div>
              <div className="text-sm text-muted-foreground">Win Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!intelligence ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Customer Intelligence
            </CardTitle>
            <CardDescription>
              Generate AI-powered insights about this customer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={generateIntelligence} className="w-full" size="lg">
              <Brain className="h-4 w-4 mr-2" />
              Generate Customer Intelligence
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="communication">Communication</TabsTrigger>
            <TabsTrigger value="business">Business</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* AI Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  AI Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{intelligence.ai_summary}</p>
                <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Last analyzed: {new Date(intelligence.last_analysis).toLocaleString()}
                </div>
              </CardContent>
            </Card>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Price Sensitivity */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Price Sensitivity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${priceSensitivityColors[intelligence.price_sensitivity as keyof typeof priceSensitivityColors]}`} />
                    <Badge variant="outline" className="capitalize">
                      {intelligence.price_sensitivity}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Risk Score */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Risk Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Risk Level</span>
                      <Badge variant={getRiskLevel(intelligence.risk_score) === 'high' ? 'destructive' : 'secondary'}>
                        {getRiskLevel(intelligence.risk_score)}
                      </Badge>
                    </div>
                    <Progress value={intelligence.risk_score * 100} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              {/* Opportunity Score */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Opportunity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Potential</span>
                      <span>{(intelligence.opportunity_score * 100).toFixed(0)}%</span>
                    </div>
                    <Progress value={intelligence.opportunity_score * 100} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Next Best Action */}
            {intelligence.next_best_action && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Next Best Action
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{intelligence.next_best_action}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="communication" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Communication Style
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {intelligence.communication_style && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Preferred Language</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Globe className="h-4 w-4" />
                        <Badge variant="outline">
                          {intelligence.communication_style.preferred_language?.toUpperCase() || 'EN'}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Formality Level</label>
                      <div className="mt-1">
                        <Badge variant="secondary">
                          {intelligence.communication_style.formality_level || 'Professional'}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Response Expectation</label>
                      <div className="mt-1">
                        <Badge variant="outline">
                          {intelligence.communication_style.response_speed_expectation || 'Normal'}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Communication Frequency</label>
                      <div className="mt-1">
                        <Badge variant="outline">
                          {intelligence.communication_style.communication_frequency || 'Medium'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="business" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Business Patterns
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {intelligence.business_patterns && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Typical Order Value</label>
                        <div className="text-lg font-semibold text-primary">
                          ${intelligence.business_patterns.typical_order_value?.toLocaleString() || '0'}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Payment Behavior</label>
                        <Badge variant={intelligence.business_patterns.payment_behavior === 'excellent' ? 'default' : 'secondary'}>
                          {intelligence.business_patterns.payment_behavior || 'Average'}
                        </Badge>
                      </div>
                    </div>

                    {intelligence.business_patterns.preferred_routes && (
                      <div>
                        <label className="text-sm font-medium">Preferred Routes</label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {intelligence.business_patterns.preferred_routes.map((route: string, index: number) => (
                            <Badge key={index} variant="outline">{route}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {intelligence.business_patterns.container_preferences && (
                      <div>
                        <label className="text-sm font-medium">Container Preferences</label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {intelligence.business_patterns.container_preferences.map((container: string, index: number) => (
                            <Badge key={index} variant="outline">{container}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Decision Factors */}
                <div>
                  <label className="text-sm font-medium">Key Decision Factors</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {intelligence.decision_factors.map((factor: string, index: number) => (
                      <Badge key={index} variant="secondary">{factor}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            {intelligence.insights && intelligence.insights.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    AI Insights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {intelligence.insights.map((insight: string, index: number) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-muted rounded">
                        <Lightbulb className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <p className="text-sm">{insight}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <Lightbulb className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No additional insights available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}