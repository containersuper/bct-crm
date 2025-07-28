import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { 
  Bot, 
  Send, 
  Edit3, 
  RotateCcw, 
  Copy, 
  Eye, 
  History,
  Zap,
  Globe,
  Gauge
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Email {
  id: number;
  subject: string;
  from_address: string;
  body: string;
  received_at: string;
}

interface AIResponse {
  id: string;
  response_content: string;
  confidence_score: number;
  language: string;
  tone: string;
  version: number;
  created_at: string;
}

interface AIResponseGeneratorProps {
  email: Email;
  onClose?: () => void;
}

const toneOptions = [
  { value: 'professional', label: 'Professional', icon: '👔' },
  { value: 'friendly', label: 'Friendly', icon: '😊' },
  { value: 'formal', label: 'Formal', icon: '📋' },
  { value: 'casual', label: 'Casual', icon: '😌' },
  { value: 'apologetic', label: 'Apologetic', icon: '🙏' },
  { value: 'urgent', label: 'Urgent', icon: '⚡' }
];

export function AIResponseGenerator({ email, onClose }: AIResponseGeneratorProps) {
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTone, setSelectedTone] = useState('professional');
  const [customInstructions, setCustomInstructions] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [versions, setVersions] = useState<AIResponse[]>([]);
  const { toast } = useToast();

  const generateResponse = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('claude-auto-response', {
        body: { 
          emailId: email.id,
          tone: selectedTone,
          customInstructions: customInstructions || undefined
        }
      });

      if (error) throw error;

      if (data.success) {
        setResponse(data.response);
        setEditedContent(data.response.response_content);
        
        // Add to versions history
        setVersions(prev => [data.response, ...prev]);
        
        toast({
          title: 'Response Generated',
          description: `AI generated a ${selectedTone} response with ${(data.response.confidence_score * 100).toFixed(0)}% confidence`,
        });
      }
    } catch (error) {
      console.error('Response generation error:', error);
      toast({
        title: 'Generation Failed',
        description: 'Failed to generate response with AI',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    const content = editMode ? editedContent : response?.response_content || '';
    navigator.clipboard.writeText(content);
    toast({
      title: 'Copied',
      description: 'Response copied to clipboard',
    });
  };

  const saveResponse = async () => {
    if (!response || !editedContent) return;

    try {
      const { error } = await supabase
        .from('ai_responses')
        .update({ 
          response_content: editedContent,
          version: response.version + 1
        })
        .eq('id', response.id);

      if (error) throw error;

      setResponse(prev => prev ? { ...prev, response_content: editedContent, version: prev.version + 1 } : null);
      setEditMode(false);
      
      toast({
        title: 'Response Saved',
        description: 'Your edits have been saved',
      });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: 'Save Failed',
        description: 'Failed to save response',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* Original Email */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-lg">Original Email</CardTitle>
          <CardDescription>
            From: {email.from_address} • {new Date(email.received_at).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Subject:</h4>
            <p className="text-sm bg-muted p-3 rounded">{email.subject}</p>
          </div>
          <div>
            <h4 className="font-medium mb-2">Content:</h4>
            <div className="text-sm bg-muted p-3 rounded max-h-64 overflow-y-auto whitespace-pre-wrap">
              {email.body}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Response Generator */}
      <div className="space-y-4">
        {/* Generation Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              AI Response Generator
            </CardTitle>
            <CardDescription>
              Generate personalized responses using Claude AI
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Tone Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Response Tone</label>
              <Select value={selectedTone} onValueChange={setSelectedTone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {toneOptions.map(tone => (
                    <SelectItem key={tone.value} value={tone.value}>
                      <span className="flex items-center gap-2">
                        <span>{tone.icon}</span>
                        {tone.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Instructions */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Custom Instructions <span className="text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                placeholder="Add specific instructions for the AI response..."
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                rows={3}
              />
            </div>

            {/* Generate Button */}
            <Button 
              onClick={generateResponse} 
              disabled={isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Zap className="h-4 w-4 mr-2 animate-pulse" />
                  Generating...
                </>
              ) : (
                <>
                  <Bot className="h-4 w-4 mr-2" />
                  Generate Response
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Generated Response */}
        {isGenerating && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-4 w-4 animate-pulse" />
                Generating Response...
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </CardContent>
          </Card>
        )}

        {response && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  AI Generated Response
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    v{response.version}
                  </Badge>
                  <Badge variant={response.confidence_score > 0.8 ? 'default' : 'secondary'}>
                    <Gauge className="h-3 w-3 mr-1" />
                    {(response.confidence_score * 100).toFixed(0)}%
                  </Badge>
                </div>
              </div>
              <CardDescription className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {response.language.toUpperCase()}
                </span>
                <span>Tone: {response.tone}</span>
                <span>{new Date(response.created_at).toLocaleTimeString()}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Confidence Indicator */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Confidence Score</span>
                  <span>{(response.confidence_score * 100).toFixed(0)}%</span>
                </div>
                <Progress value={response.confidence_score * 100} className="h-2" />
              </div>

              <Separator />

              {/* Response Content */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Response Content</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditMode(!editMode)}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </div>
                
                {editMode ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      rows={8}
                      className="font-mono text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveResponse}>
                        Save Changes
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          setEditedContent(response.response_content);
                          setEditMode(false);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-muted p-4 rounded whitespace-pre-wrap text-sm">
                    {response.response_content}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                <Button variant="default" size="sm">
                  <Send className="h-4 w-4 mr-1" />
                  Send Email
                </Button>
                
                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
                
                <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                  <Edit3 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                
                <Button variant="outline" size="sm" onClick={generateResponse}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Regenerate
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Version History */}
        {versions.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4" />
                Version History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {versions.slice(0, 3).map((version, index) => (
                  <div 
                    key={version.id}
                    className="flex items-center justify-between p-2 border rounded text-sm"
                  >
                    <span>v{version.version} - {version.tone}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {(version.confidence_score * 100).toFixed(0)}%
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setResponse(version);
                          setEditedContent(version.response_content);
                        }}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}