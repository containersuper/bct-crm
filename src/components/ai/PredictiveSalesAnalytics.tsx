import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, TrendingUp, Target, AlertTriangle, CheckCircle, Brain, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface PredictiveSalesAnalyticsProps {
  customerId: number;
}

interface SalesPrediction {
  nextOrderPrediction: {
    probabilityScore: number;
    predictedDate: string;
    predictedValue: number;
    confidence: number;
    reasoning: string;
  };
  buyingPatterns: {
    averageOrderValue: number;
    orderFrequency: string;
    seasonalTrends: string[];
    preferredRoutes: string[];
    growthTrend: string;
  };
  riskAssessment: {
    churnRisk: number;
    paymentRisk: number;
    competitorThreat: number;
    riskFactors: string[];
    mitigationActions: string[];
  };
  opportunities: {
    upsellPotential: number;
    crossSellOpportunities: string[];
    volumeIncreasePotential: number;
    newRoutePotential: string[];
    recommendedActions: string[];
  };
  dealPipelineInsights: {
    averageDealsToClose: number;
    typicalSalesCycle: number;
    winRate: number;
    averageDealSize: number;
    bestApproachTiming: string;
  };
  communicationInsights: {
    responsePatterns: string;
    preferredCommunicationTiming: string;
    engagementTriggers: string[];
    decisionMakingStyle: string;
  };
  recommendations: {
    immediateActions: string[];
    strategicActions: string[];
    keyMetricsToTrack: string[];
    successProbability: number;
  };
}

export function PredictiveSalesAnalytics({ customerId }: PredictiveSalesAnalyticsProps) {
  const [prediction, setPrediction] = useState<SalesPrediction | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dataAnalyzed, setDataAnalyzed] = useState<any>(null);

  useEffect(() => {
    generatePrediction();
  }, [customerId]);

  const generatePrediction = async () => {
    try {
      setIsAnalyzing(true);
      toast.info('Analyzing complete TeamLeader history for predictions...');

      const { data, error } = await supabase.functions.invoke('claude-predictive-sales', {
        body: {
          customerId,
          analysisType: 'comprehensive_prediction'
        }
      });

      if (error) throw error;

      if (data?.success) {
        setPrediction(data.prediction);
        setDataAnalyzed(data.dataAnalyzed);
        toast.success(`Predictive analysis complete! Analyzed ${data.dataAnalyzed.invoiceCount + data.dataAnalyzed.dealCount + data.dataAnalyzed.activityCount} data points`);
      } else {
        toast.error(data?.error || 'Prediction analysis failed');
      }
    } catch (error) {
      console.error('Predictive analytics error:', error);
      toast.error('Failed to generate predictions: ' + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getRiskColor = (risk: number) => {
    if (risk <= 0.3) return 'text-green-600';
    if (risk <= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getOpportunityColor = (opportunity: number) => {
    if (opportunity >= 0.7) return 'text-green-600';
    if (opportunity >= 0.4) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isAnalyzing) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <Brain className="h-8 w-8 animate-pulse mx-auto text-primary" />
            <div>Analyzing TeamLeader historical data...</div>
            <Progress value={50} className="w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!prediction) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <Button onClick={generatePrediction}>Generate Predictive Analysis</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <Calendar className="h-6 w-6 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold">{formatDate(prediction.nextOrderPrediction.predictedDate)}</div>
              <div className="text-sm text-muted-foreground">Next Order Prediction</div>
              <Badge variant="outline" className="mt-2">
                {(prediction.nextOrderPrediction.probabilityScore * 100).toFixed(0)}% probability
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <div className="text-2xl font-bold">€{prediction.nextOrderPrediction.predictedValue.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Predicted Value</div>
              <Badge variant="secondary" className="mt-2">
                {(prediction.nextOrderPrediction.confidence * 100).toFixed(0)}% confidence
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <Target className="h-6 w-6 mx-auto mb-2 text-blue-600" />
              <div className="text-2xl font-bold">{(prediction.opportunities.upsellPotential * 100).toFixed(0)}%</div>
              <div className="text-sm text-muted-foreground">Upsell Potential</div>
              <Badge variant="outline" className="mt-2">
                {prediction.buyingPatterns.growthTrend}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <AlertTriangle className={`h-6 w-6 mx-auto mb-2 ${getRiskColor(prediction.riskAssessment.churnRisk)}`} />
              <div className={`text-2xl font-bold ${getRiskColor(prediction.riskAssessment.churnRisk)}`}>
                {(prediction.riskAssessment.churnRisk * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-muted-foreground">Churn Risk</div>
              <Badge variant={prediction.riskAssessment.churnRisk <= 0.3 ? 'default' : 'destructive'} className="mt-2">
                {prediction.riskAssessment.churnRisk <= 0.3 ? 'Low Risk' : prediction.riskAssessment.churnRisk <= 0.6 ? 'Medium Risk' : 'High Risk'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="prediction" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="prediction">Prediction</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="recommendations">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="prediction" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Next Order Prediction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Prediction Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Expected Date:</span>
                      <span className="font-medium">{formatDate(prediction.nextOrderPrediction.predictedDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Expected Value:</span>
                      <span className="font-medium">€{prediction.nextOrderPrediction.predictedValue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Probability:</span>
                      <span className="font-medium">{(prediction.nextOrderPrediction.probabilityScore * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Confidence:</span>
                      <span className="font-medium">{(prediction.nextOrderPrediction.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Deal Pipeline Insights</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Avg Sales Cycle:</span>
                      <span className="font-medium">{prediction.dealPipelineInsights.typicalSalesCycle} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Win Rate:</span>
                      <span className="font-medium">{(prediction.dealPipelineInsights.winRate * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Deal Size:</span>
                      <span className="font-medium">€{prediction.dealPipelineInsights.averageDealSize.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">AI Reasoning</h4>
                <p className="text-sm text-muted-foreground">{prediction.nextOrderPrediction.reasoning}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Buying Patterns</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Average Order Value</span>
                    <span className="font-medium">€{prediction.buyingPatterns.averageOrderValue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Order Frequency</span>
                    <Badge variant="outline">{prediction.buyingPatterns.orderFrequency}</Badge>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Growth Trend</span>
                    <Badge variant={prediction.buyingPatterns.growthTrend === 'increasing' ? 'default' : 
                                   prediction.buyingPatterns.growthTrend === 'stable' ? 'secondary' : 'destructive'}>
                      {prediction.buyingPatterns.growthTrend}
                    </Badge>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Seasonal Trends</h4>
                  <div className="flex flex-wrap gap-2">
                    {prediction.buyingPatterns.seasonalTrends?.map((season, index) => (
                      <Badge key={index} variant="outline">{season}</Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Preferred Routes</h4>
                  <div className="space-y-1">
                    {prediction.buyingPatterns.preferredRoutes?.slice(0, 5).map((route, index) => (
                      <div key={index} className="text-sm text-muted-foreground">• {route}</div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Communication Patterns</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Response Patterns</h4>
                  <p className="text-sm text-muted-foreground">{prediction.communicationInsights.responsePatterns}</p>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Best Communication Time</h4>
                  <p className="text-sm text-muted-foreground">{prediction.communicationInsights.preferredCommunicationTiming}</p>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Decision Making Style</h4>
                  <Badge variant="outline">{prediction.communicationInsights.decisionMakingStyle}</Badge>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Engagement Triggers</h4>
                  <div className="space-y-1">
                    {prediction.communicationInsights.engagementTriggers?.map((trigger, index) => (
                      <div key={index} className="text-sm text-muted-foreground">• {trigger}</div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="risks" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${getRiskColor(prediction.riskAssessment.churnRisk)}`}>
                    {(prediction.riskAssessment.churnRisk * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Churn Risk</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${getRiskColor(prediction.riskAssessment.paymentRisk)}`}>
                    {(prediction.riskAssessment.paymentRisk * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Payment Risk</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${getRiskColor(prediction.riskAssessment.competitorThreat)}`}>
                    {(prediction.riskAssessment.competitorThreat * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Competitor Threat</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">Risk Factors</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {prediction.riskAssessment.riskFactors?.map((risk, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <AlertTriangle className="h-3 w-3 mt-1 text-red-500" />
                      {risk}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-blue-600">Mitigation Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {prediction.riskAssessment.mitigationActions?.map((action, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <CheckCircle className="h-3 w-3 mt-1 text-blue-500" />
                      {action}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="opportunities" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${getOpportunityColor(prediction.opportunities.upsellPotential)}`}>
                    {(prediction.opportunities.upsellPotential * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Upsell Potential</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${getOpportunityColor(prediction.opportunities.volumeIncreasePotential)}`}>
                    {(prediction.opportunities.volumeIncreasePotential * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Volume Increase</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">Cross-sell Opportunities</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {prediction.opportunities.crossSellOpportunities?.map((opp, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <CheckCircle className="h-3 w-3 mt-1 text-green-500" />
                      {opp}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-purple-600">New Route Potential</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {prediction.opportunities.newRoutePotential?.map((route, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <Target className="h-3 w-3 mt-1 text-purple-500" />
                      {route}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Immediate Actions (Next 30 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {prediction.recommendations.immediateActions?.map((action, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <CheckCircle className="h-3 w-3 mt-1 text-green-500" />
                      {action}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Strategic Actions (Long-term)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {prediction.recommendations.strategicActions?.map((action, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <Target className="h-3 w-3 mt-1 text-blue-500" />
                      {action}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Success Probability</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Overall Success Probability</span>
                  <span className="text-2xl font-bold text-primary">
                    {(prediction.recommendations.successProbability * 100).toFixed(0)}%
                  </span>
                </div>
                <Progress value={prediction.recommendations.successProbability * 100} className="h-3" />
                
                <div>
                  <h4 className="font-medium mb-2">Key Metrics to Track</h4>
                  <div className="flex flex-wrap gap-2">
                    {prediction.recommendations.keyMetricsToTrack?.map((metric, index) => (
                      <Badge key={index} variant="outline">{metric}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {dataAnalyzed && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Data Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{dataAnalyzed.invoiceCount}</div>
                <div className="text-sm text-muted-foreground">Invoices</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{dataAnalyzed.quoteCount}</div>
                <div className="text-sm text-muted-foreground">Quotes</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">{dataAnalyzed.dealCount}</div>
                <div className="text-sm text-muted-foreground">Deals</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{dataAnalyzed.activityCount}</div>
                <div className="text-sm text-muted-foreground">Activities</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{dataAnalyzed.emailCount}</div>
                <div className="text-sm text-muted-foreground">Emails</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}