import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmailAnalysisDashboard } from '@/components/ai/EmailAnalysisDashboard';
import { AIResponseGenerator } from '@/components/ai/AIResponseGenerator';
import { CustomerIntelligenceProfile } from '@/components/ai/CustomerIntelligenceProfile';
import { SmartPricingCalculator } from '@/components/ai/SmartPricingCalculator';
import { Brain, MessageCircle, User, Calculator, BarChart3 } from 'lucide-react';

// Mock data for demo
const mockEmail = {
  id: 1,
  subject: "Urgent: Container shipping quote needed",
  from_address: "john@logistics-company.com",
  body: "Hello, we need an urgent quote for 2x 20ft containers from Hamburg to Rotterdam. Please respond ASAP.",
  received_at: new Date().toISOString()
};

const mockCustomer = {
  id: 1,
  name: "John Smith",
  email: "john@logistics-company.com",
  company: "Global Logistics Ltd",
  phone: "+49 30 12345678",
  brand: "Premium",
  created_at: new Date().toISOString()
};

export default function AICRMDashboard() {
  const [selectedTab, setSelectedTab] = useState('analysis');

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Brain className="h-8 w-8 text-primary" />
          AI-Powered CRM
        </h1>
        <p className="text-muted-foreground">
          Intelligent customer relationship management with Claude AI
        </p>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
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
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            AI Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="mt-6">
          <EmailAnalysisDashboard 
            email={mockEmail}
            onGenerateResponse={() => setSelectedTab('response')}
            onCreateQuote={() => setSelectedTab('pricing')}
            onMarkProcessed={() => {}}
          />
        </TabsContent>

        <TabsContent value="response" className="mt-6">
          <AIResponseGenerator email={mockEmail} />
        </TabsContent>

        <TabsContent value="intelligence" className="mt-6">
          <CustomerIntelligenceProfile customer={mockCustomer} />
        </TabsContent>

        <TabsContent value="pricing" className="mt-6">
          <SmartPricingCalculator customerId={mockCustomer.id} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}