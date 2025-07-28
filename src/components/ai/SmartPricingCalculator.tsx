import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Calculator, TrendingUp, Target, DollarSign, Brain } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SmartPricingCalculatorProps {
  customerId: number;
}

export function SmartPricingCalculator({ customerId }: SmartPricingCalculatorProps) {
  const [pricing, setPricing] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [quoteItems, setQuoteItems] = useState('');
  const [route, setRoute] = useState('');
  const [urgency, setUrgency] = useState('normal');
  const [targetMargin, setTargetMargin] = useState(15);
  const { toast } = useToast();

  const calculatePricing = async () => {
    setIsCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('claude-smart-pricing', {
        body: { 
          customerId,
          quoteItems: JSON.parse(quoteItems || '[]'),
          route,
          urgency,
          targetMargin
        }
      });

      if (error) throw error;
      if (data.success) {
        setPricing(data.pricing);
        toast({
          title: 'Pricing Calculated',
          description: 'AI pricing analysis completed',
        });
      }
    } catch (error) {
      console.error('Pricing error:', error);
      toast({
        title: 'Calculation Failed',
        description: 'Failed to calculate smart pricing',
        variant: 'destructive',
      });
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Smart Pricing Calculator
          </CardTitle>
          <CardDescription>AI-powered pricing optimization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Route</Label>
              <Input 
                value={route} 
                onChange={(e) => setRoute(e.target.value)}
                placeholder="Hamburg to Rotterdam"
              />
            </div>
            <div>
              <Label>Target Margin (%)</Label>
              <Input 
                type="number"
                value={targetMargin} 
                onChange={(e) => setTargetMargin(Number(e.target.value))}
              />
            </div>
          </div>
          
          <Button onClick={calculatePricing} disabled={isCalculating}>
            <Brain className="h-4 w-4 mr-2" />
            {isCalculating ? 'Calculating...' : 'Calculate Smart Price'}
          </Button>
        </CardContent>
      </Card>

      {pricing && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Pricing Recommendation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  ${pricing.recommended_price?.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Recommended</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {(pricing.win_probability * 100).toFixed(0)}%
                </div>
                <div className="text-sm text-muted-foreground">Win Probability</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {pricing.margin_analysis?.actual_margin?.toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Margin</div>
              </div>
            </div>
            
            <Progress value={pricing.win_probability * 100} className="h-3" />
            
            <div className="space-y-2">
              <h4 className="font-medium">Strategy</h4>
              <Badge variant="secondary">{pricing.pricing_strategy}</Badge>
              <p className="text-sm text-muted-foreground">
                {pricing.explanation}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}