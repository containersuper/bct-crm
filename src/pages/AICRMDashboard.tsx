import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { EmailAnalysisDashboard } from '@/components/ai/EmailAnalysisDashboard';
import { AIResponseGenerator } from '@/components/ai/AIResponseGenerator';
import { CustomerIntelligenceProfile } from '@/components/ai/CustomerIntelligenceProfile';
import { SmartPricingCalculator } from '@/components/ai/SmartPricingCalculator';
import { AIAssistantChat } from '@/components/ai/AIAssistantChat';
import { GmailTokenManager } from '@/components/email/GmailTokenManager';
import { EmailInboxIntegrated } from '@/components/email/EmailInboxIntegrated';
import { AnalysisManager } from '@/components/ai/AnalysisManager';
import { Brain, MessageCircle, User, Calculator, BarChart3, AlertTriangle } from 'lucide-react';

// Mock data for demo - using real email data
const useRealEmailData = () => {
  const [emails, setEmails] = useState([]);
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch real emails
      const { data: emailData } = await supabase
        .from('email_history')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(1);
      
      if (emailData && emailData.length > 0) {
        setEmails(emailData);
        
        // Extract customer info from email
        const email = emailData[0];
        const mockCustomer = {
          id: 1,
          name: email.from_address?.split('<')[0]?.trim() || "Unknown Customer",
          email: email.from_address?.match(/<(.+)>/)?.[1] || email.from_address,
          company: "Customer Company",
          phone: "+49 30 12345678",
          brand: email.brand || "General",
          created_at: new Date().toISOString()
        };
        setCustomers([mockCustomer]);
      }
    };
    
    fetchData();
  }, []);

  return { emails, customers };
};

export default function AICRMDashboard() {
  const [selectedTab, setSelectedTab] = useState('analysis');
  const [showAIChat, setShowAIChat] = useState(false);
  const { emails, customers } = useRealEmailData();

  // Use real data if available, fallback to mock data
  const currentEmail = emails[0] || {
    id: 1,
    subject: "No emails available",
    from_address: "demo@example.com",
    body: "Please connect your Gmail account and sync emails to see AI analysis.",
    received_at: new Date().toISOString()
  };

  const currentCustomer = customers[0] || {
    id: 1,
    name: "Demo Customer",
    email: "demo@example.com",
    company: "Demo Company",
    phone: "+49 30 12345678",
    brand: "General",
    created_at: new Date().toISOString()
  };

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                <Brain className="h-8 w-8 text-primary" />
                AI-Powered CRM
              </h1>
              <p className="text-muted-foreground">
                Intelligent customer relationship management with Claude AI
              </p>
            </div>
            <Button 
              onClick={() => setShowAIChat(true)}
              className="flex items-center gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              AI Assistant
            </Button>
          </div>
        </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Email Analysis
          </TabsTrigger>
          <TabsTrigger value="response" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Auto Response
          </TabsTrigger>
          <TabsTrigger value="intelligence" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Customer Intelligence
          </TabsTrigger>
          <TabsTrigger value="pricing" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Smart Pricing
          </TabsTrigger>
          <TabsTrigger value="manager" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Analysis Manager
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            AI Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="mt-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <EmailInboxIntegrated 
                onEmailSelect={(email) => {
                  setSelectedTab('response');
                  // Convert email format for compatibility
                  const convertedEmail = {
                    id: parseInt(email.id.toString()),
                    subject: email.subject || '',
                    from_address: email.from_address || '',
                    to_address: email.to_address || '',
                    body: email.body || '',
                    received_at: email.received_at || '',
                    direction: email.direction || 'incoming',
                    processed: email.processed || false,
                    brand: email.brand || ''
                  };
                  // Store selected email for other tabs
                  (window as any).selectedEmail = convertedEmail;
                }}
                onCreateQuote={() => setSelectedTab('pricing')}
              />
            </div>
            <div>
              <EmailAnalysisDashboard 
                email={currentEmail}
                onGenerateResponse={() => setSelectedTab('response')}
                onCreateQuote={() => setSelectedTab('pricing')}
                onMarkProcessed={() => {}}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="response" className="mt-6">
          <AIResponseGenerator email={currentEmail} />
        </TabsContent>

        <TabsContent value="intelligence" className="mt-6">
          <CustomerIntelligenceProfile customer={currentCustomer} />
        </TabsContent>

        <TabsContent value="pricing" className="mt-6">
          <SmartPricingCalculator customerId={currentCustomer.id} />
        </TabsContent>

        <TabsContent value="manager" className="mt-6">
          <AnalysisManager />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <div className="space-y-6">
            {/* Gmail Token Status */}
            <GmailTokenManager />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    AI Performance Analytics
                  </CardTitle>
                  <CardDescription>
                    Track AI performance metrics and ROI
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Analytics dashboard coming soon</p>
                  </div>
                </CardContent>
              </Card>
              
              <AIAssistantChat />
            </div>
          </div>
        </TabsContent>
      </Tabs>
      </div>

      {/* Floating AI Assistant */}
      {showAIChat && (
        <AIAssistantChat 
          isFloating 
          onClose={() => setShowAIChat(false)} 
        />
      )}
    </>
  );
}