import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, TrendingUp, Target, Zap, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SmartPricingEngineProps {
  customerId: number;
}

interface PricingAnalysis {
  recommendedPrice: number;
  winProbability: number;
  margin: number;
  confidence: number;
  pricingStrategy: string;
  reasoning: {
    customerHistory: string;
    marketPosition: string;
    riskFactors: string[];
    opportunities: string[];
  };
  alternatives: Array<{
    price: number;
    strategy: string;
    winProbability: number;
    reasoning: string;
  }>;
  negotiationInsights: {
    priceFlexibility: string;
    keyDecisionFactors: string[];
    bestApproach: string;
  };
}

export function SmartPricingEngine({ customerId }: SmartPricingEngineProps) {
  const [pricingData, setPricingData] = useState<PricingAnalysis | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [route, setRoute] = useState('');
  const [urgency, setUrgency] = useState('normal');
  const [targetMargin, setTargetMargin] = useState('25');
  const [competitorPrice, setCompetitorPrice] = useState('');
  const [quoteItems, setQuoteItems] = useState([{ description: '', quantity: 1, unit_price: 0 }]);

  const calculateSmartPricing = async () => {
    if (!route.trim()) {
      toast.error('Please enter a route');
      return;
    }

    try {
      setIsCalculating(true);
      toast.info('Analyzing TeamLeader data for smart pricing...');

      const { data, error } = await supabase.functions.invoke('claude-smart-pricing', {
        body: {
          customerId,
          quoteItems,
          route,
          urgency,
          competitorPrice: competitorPrice ? parseFloat(competitorPrice) : null,
          targetMargin: parseFloat(targetMargin)
        }
      });

      if (error) throw error;

      if (data?.success) {
        setPricingData(data.pricing);
        toast.success(`Smart pricing analysis complete! Analyzed ${data.dataUsed.historicalInvoices} invoices and ${data.dataUsed.dealHistory} deals`);
      } else {
        toast.error(data?.error || 'Pricing analysis failed');
      }
    } catch (error) {
      console.error('Smart pricing error:', error);
      toast.error('Failed to calculate smart pricing: ' + error.message);
    } finally {
      setIsCalculating(false);
    }
  };

  const getStrategyIcon = (strategy: string) => {
    switch (strategy) {
      case 'value_based': return <Target className="h-4 w-4" />;
      case 'competitive': return <TrendingUp className="h-4 w-4" />;
      case 'premium': return <Zap className="h-4 w-4" />;
      default: return <Brain className="h-4 w-4" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const addQuoteItem = () => {
    setQuoteItems([...quoteItems, { description: '', quantity: 1, unit_price: 0 }]);
  };

  const updateQuoteItem = (index: number, field: string, value: any) => {
    const updated = [...quoteItems];
    updated[index] = { ...updated[index], [field]: value };
    setQuoteItems(updated);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Smart Pricing Engine
            <Badge variant="secondary">AI-Powered</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="route">Route *</Label>
              <Input
                id="route"
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                placeholder="e.g., Hamburg to Rotterdam"
              />
            </div>
            <div>
              <Label htmlFor="targetMargin">Target Margin (%)</Label>
              <Input
                id="targetMargin"
                type="number"
                value={targetMargin}
                onChange={(e) => setTargetMargin(e.target.value)}
                placeholder="25"
              />
            </div>
            <div>
              <Label htmlFor="urgency">Urgency</Label>
              <select
                id="urgency"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <Label htmlFor="competitorPrice">Competitor Price (€)</Label>
              <Input
                id="competitorPrice"
                type="number"
                value={competitorPrice}
                onChange={(e) => setCompetitorPrice(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Quote Items</Label>
            {quoteItems.map((item, index) => (
              <div key={index} className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateQuoteItem(index, 'description', e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Quantity"
                  value={item.quantity}
                  onChange={(e) => updateQuoteItem(index, 'quantity', parseInt(e.target.value))}
                />
                <Input
                  type="number"
                  placeholder="Unit Price"
                  value={item.unit_price}
                  onChange={(e) => updateQuoteItem(index, 'unit_price', parseFloat(e.target.value))}
                />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addQuoteItem}>
              Add Item
            </Button>
          </div>

          <Button 
            onClick={calculateSmartPricing}
            disabled={isCalculating || !route}
            className="w-full"
          >
            {isCalculating ? 'Analyzing TeamLeader Data...' : 'Calculate Smart Pricing'}
          </Button>
        </CardContent>
      </Card>

      {pricingData && (
        <Tabs defaultValue="recommendation" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="recommendation">Recommendation</TabsTrigger>
            <TabsTrigger value="alternatives">Alternatives</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
            <TabsTrigger value="negotiation">Negotiation</TabsTrigger>
          </TabsList>

          <TabsContent value="recommendation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getStrategyIcon(pricingData.pricingStrategy)}
                  Recommended Pricing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">€{pricingData.recommendedPrice.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Recommended Price</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{(pricingData.winProbability * 100).toFixed(0)}%</div>
                    <div className="text-sm text-muted-foreground">Win Probability</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{pricingData.margin.toFixed(1)}%</div>
                    <div className="text-sm text-muted-foreground">Margin</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${getConfidenceColor(pricingData.confidence)}`}></div>
                      <div className="text-2xl font-bold">{(pricingData.confidence * 100).toFixed(0)}%</div>
                    </div>
                    <div className="text-sm text-muted-foreground">Confidence</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium mb-2">Customer History Analysis</h4>
                    <p className="text-sm text-muted-foreground">{pricingData.reasoning.customerHistory}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Market Position</h4>
                    <p className="text-sm text-muted-foreground">{pricingData.reasoning.marketPosition}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alternatives" className="space-y-4">
            {pricingData.alternatives?.map((alt, index) => (
              <Card key={index}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium">{alt.strategy}</h4>
                      <p className="text-2xl font-bold text-primary">€{alt.price.toLocaleString()}</p>
                    </div>
                    <Badge variant="outline">{(alt.winProbability * 100).toFixed(0)}% win rate</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{alt.reasoning}</p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    Risk Factors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {pricingData.reasoning.riskFactors?.map((risk, index) => (
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
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Opportunities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {pricingData.reasoning.opportunities?.map((opp, index) => (
                      <li key={index} className="text-sm flex items-start gap-2">
                        <CheckCircle className="h-3 w-3 mt-1 text-green-500" />
                        {opp}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="negotiation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Negotiation Strategy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Price Flexibility</h4>
                  <Badge variant={pricingData.negotiationInsights.priceFlexibility === 'high' ? 'default' : 
                                 pricingData.negotiationInsights.priceFlexibility === 'medium' ? 'secondary' : 'destructive'}>
                    {pricingData.negotiationInsights.priceFlexibility} flexibility
                  </Badge>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Key Decision Factors</h4>
                  <div className="flex flex-wrap gap-2">
                    {pricingData.negotiationInsights.keyDecisionFactors?.map((factor, index) => (
                      <Badge key={index} variant="outline">{factor}</Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Best Approach</h4>
                  <p className="text-sm text-muted-foreground">{pricingData.negotiationInsights.bestApproach}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}