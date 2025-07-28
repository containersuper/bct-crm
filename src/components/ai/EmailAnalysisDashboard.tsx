import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Brain, MessageCircle, TrendingUp, Clock, Globe, Heart, AlertTriangle, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmailAnalysis {
  id: string;
  email_id: number;
  language: string;
  sentiment: string;
  sentiment_score: number;
  intent: string;
  intent_confidence: number;
  urgency: string;
  entities: any[];
  key_phrases: string[];
  analysis_timestamp: string;
}

interface Email {
  id: number;
  subject: string;
  from_address: string;
  body: string;
  received_at: string;
  email_analytics?: EmailAnalysis[];
}

interface EmailAnalysisDashboardProps {
  email: Email;
  onGenerateResponse: () => void;
  onCreateQuote: () => void;
  onMarkProcessed: () => void;
}

const languageFlags: { [key: string]: string } = {
  'en': '🇺🇸',
  'de': '🇩🇪',
  'fr': '🇫🇷',
  'nl': '🇳🇱',
  'es': '🇪🇸',
  'it': '🇮🇹'
};

const sentimentColors = {
  positive: 'bg-green-500',
  neutral: 'bg-gray-500',
  negative: 'bg-red-500'
};

const urgencyColors = {
  low: 'bg-blue-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-600'
};

export function EmailAnalysisDashboard({ 
  email, 
  onGenerateResponse, 
  onCreateQuote, 
  onMarkProcessed 
}: EmailAnalysisDashboardProps) {
  const [analysis, setAnalysis] = useState<EmailAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (email.email_analytics && email.email_analytics.length > 0) {
      setAnalysis(email.email_analytics[0]);
    } else {
      analyzeEmail();
    }
  }, [email.id]);

  const analyzeEmail = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('claude-email-analyzer', {
        body: { emailId: email.id }
      });

      if (error) throw error;

      if (data.success) {
        setAnalysis(data.analysis);
        toast({
          title: 'Email Analyzed',
          description: 'AI analysis completed successfully',
        });
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: 'Analysis Failed',
        description: 'Failed to analyze email with AI',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isAnalyzing) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 animate-pulse text-primary" />
            <CardTitle>AI Analysis</CardTitle>
          </div>
          <CardDescription>Claude is analyzing this email...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Analysis
          </CardTitle>
          <CardDescription>No analysis available</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={analyzeEmail} className="w-full">
            <Brain className="h-4 w-4 mr-2" />
            Analyze with Claude
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle>AI Analysis</CardTitle>
            <Badge variant="secondary" className="text-xs">
              Claude 3.5 Sonnet
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {new Date(analysis.analysis_timestamp).toLocaleTimeString()}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Core Insights */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Language */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Language</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{languageFlags[analysis.language] || '🌐'}</span>
              <span className="text-lg font-semibold">{analysis.language.toUpperCase()}</span>
            </div>
          </div>

          {/* Sentiment */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Sentiment</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${sentimentColors[analysis.sentiment as keyof typeof sentimentColors]}`} />
                <span className="capitalize font-semibold">{analysis.sentiment}</span>
              </div>
              <Progress value={analysis.sentiment_score * 100} className="h-2" />
              <span className="text-xs text-muted-foreground">
                {(analysis.sentiment_score * 100).toFixed(0)}% confidence
              </span>
            </div>
          </div>

          {/* Intent */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Intent</span>
            </div>
            <div className="space-y-1">
              <Badge variant="outline" className="text-xs">
                {analysis.intent.replace('_', ' ')}
              </Badge>
              <Progress value={analysis.intent_confidence * 100} className="h-2" />
              <span className="text-xs text-muted-foreground">
                {(analysis.intent_confidence * 100).toFixed(0)}% confidence
              </span>
            </div>
          </div>

          {/* Urgency */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Urgency</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${urgencyColors[analysis.urgency as keyof typeof urgencyColors]}`} />
              <Badge 
                variant={analysis.urgency === 'critical' ? 'destructive' : 'secondary'}
                className="capitalize"
              >
                {analysis.urgency}
                {analysis.urgency === 'critical' && ' 🔥'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Entities */}
        {analysis.entities && analysis.entities.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Key Entities
            </h4>
            <div className="flex flex-wrap gap-2">
              {analysis.entities.map((entity: any, index: number) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="text-xs"
                  title={`Confidence: ${(entity.confidence * 100).toFixed(0)}%`}
                >
                  <span className="capitalize text-muted-foreground text-[10px]">
                    {entity.type}:
                  </span>
                  <span className="ml-1">{entity.value}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Key Phrases */}
        {analysis.key_phrases && analysis.key_phrases.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Key Phrases</h4>
            <div className="flex flex-wrap gap-2">
              {analysis.key_phrases.map((phrase: string, index: number) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  "{phrase}"
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-4 border-t">
          <Button 
            onClick={onGenerateResponse} 
            className="flex items-center gap-2"
            variant="default"
          >
            <Zap className="h-4 w-4" />
            Generate Response
          </Button>
          
          {(analysis.intent === 'price_inquiry' || analysis.intent === 'order') && (
            <Button 
              onClick={onCreateQuote} 
              variant="secondary"
              className="flex items-center gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              Create Quote
            </Button>
          )}
          
          <Button 
            onClick={onMarkProcessed} 
            variant="outline"
            className="flex items-center gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            Mark Processed
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}