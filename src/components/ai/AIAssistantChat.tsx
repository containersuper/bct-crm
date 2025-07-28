import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { 
  MessageCircle, 
  Send, 
  Brain, 
  User, 
  Bot,
  Sparkles,
  X,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isTyping?: boolean;
}

interface AIAssistantChatProps {
  isFloating?: boolean;
  onClose?: () => void;
}

const exampleQueries = [
  "Show me all price inquiries from last week",
  "What's the best price for customer ABC Corp?",
  "Draft a follow-up for the Munich shipment",
  "Analyze sentiment for Brand 1 emails",
  "Generate customer intelligence report",
  "Calculate optimal pricing for 20ft container"
];

export function AIAssistantChat({ isFloating = false, onClose }: AIAssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Hello! I\'m your AI assistant powered by Claude. I can help you analyze emails, generate responses, provide customer insights, and optimize pricing. What would you like to know?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Add typing indicator
    const typingMessage: Message = {
      id: 'typing',
      type: 'assistant',
      content: 'Claude is thinking...',
      timestamp: new Date(),
      isTyping: true
    };
    setMessages(prev => [...prev, typingMessage]);

    try {
      // Simulate AI processing (in real implementation, this would call Claude)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Remove typing indicator
      setMessages(prev => prev.filter(m => m.id !== 'typing'));

      // Generate response based on query type
      let response = '';
      const query = input.toLowerCase();

      if (query.includes('price') || query.includes('pricing')) {
        response = 'I can help you with pricing analysis. Based on the customer\'s history and market data, I recommend using the Smart Pricing Calculator in the AI CRM section. Would you like me to analyze a specific customer or route?';
      } else if (query.includes('email') || query.includes('sentiment')) {
        response = 'For email analysis, I can examine sentiment, intent, and urgency levels. I found several emails that need attention. Would you like me to generate responses for high-priority emails?';
      } else if (query.includes('customer') || query.includes('intelligence')) {
        response = 'I can provide detailed customer intelligence including communication patterns, price sensitivity, and business insights. Which customer would you like me to analyze?';
      } else {
        response = 'I understand you\'re looking for assistance. I can help with email analysis, customer intelligence, pricing optimization, and response generation. Could you be more specific about what you need?';
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI Chat error:', error);
      setMessages(prev => prev.filter(m => m.id !== 'typing'));
      toast({
        title: 'Chat Error',
        description: 'Failed to get AI response',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setInput(example);
  };

  if (isFloating && isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsMinimized(false)}
          className="rounded-full h-12 w-12 shadow-lg"
          size="icon"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  const chatContent = (
    <>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Assistant
            <Badge variant="secondary" className="text-xs">
              Claude 3.5
            </Badge>
          </CardTitle>
          {isFloating && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(true)}
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
              {onClose && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 flex flex-col h-full">
        {/* Example Queries */}
        {messages.length <= 1 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Try asking:</h4>
            <div className="grid grid-cols-1 gap-1">
              {exampleQueries.slice(0, 3).map((example, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  className="justify-start text-xs h-auto p-2 text-muted-foreground hover:text-foreground"
                  onClick={() => handleExampleClick(example)}
                >
                  <Sparkles className="h-3 w-3 mr-2 flex-shrink-0" />
                  "{example}"
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${
                  message.type === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                <div className={`flex-shrink-0 rounded-full p-2 ${
                  message.type === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted'
                }`}>
                  {message.type === 'user' ? (
                    <User className="h-3 w-3" />
                  ) : (
                    <Bot className="h-3 w-3" />
                  )}
                </div>
                
                <div className={`flex-1 space-y-1 ${
                  message.type === 'user' ? 'text-right' : ''
                }`}>
                  <div className={`inline-block max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    message.type === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}>
                    {message.isTyping ? (
                      <div className="flex items-center gap-1">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                        </div>
                      </div>
                    ) : (
                      message.content
                    )}
                  </div>
                  <div className={`text-xs text-muted-foreground ${
                    message.type === 'user' ? 'text-right' : ''
                  }`}>
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about your CRM data..."
            className="flex-1"
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            disabled={isLoading}
          />
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || isLoading}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </>
  );

  if (isFloating) {
    return (
      <div className="fixed bottom-4 right-4 z-50 w-96 h-[600px]">
        <Card className="h-full shadow-2xl border-primary/20">
          {chatContent}
        </Card>
      </div>
    );
  }

  return (
    <Card className="h-[600px] flex flex-col">
      {chatContent}
    </Card>
  );
}