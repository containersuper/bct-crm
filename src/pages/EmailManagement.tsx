import { useState, useEffect } from "react";
import { EmailInboxIntegrated } from "@/components/email/EmailInboxIntegrated";
import { EnhancedLeadManager } from "@/components/ai/EnhancedLeadManager";
import { QuoteDashboard } from "@/components/quotes/QuoteDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export default function EmailManagement() {
  const [stats, setStats] = useState({
    hotLeads: 0,
    pendingQuotes: 0,
    unprocessedEmails: 0
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setStats({
        hotLeads: 5,
        pendingQuotes: 3,
        unprocessedEmails: 12
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AI-Powered Email Management</h1>
        <p className="text-muted-foreground mb-4">
          Automated lead identification and quote generation for all your brands
        </p>
        
        {/* Stats Dashboard */}
        <div className="flex gap-4 mb-6">
          <Badge variant="destructive" className="px-3 py-1">
            🔥 {stats.hotLeads} Hot Leads
          </Badge>
          <Badge variant="outline" className="px-3 py-1">
            📄 {stats.pendingQuotes} Draft Quotes
          </Badge>
          <Badge variant="secondary" className="px-3 py-1">
            📧 {stats.unprocessedEmails} Unprocessed
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="leads" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="leads">🎯 Lead Management</TabsTrigger>
          <TabsTrigger value="inbox">📧 Email Inbox</TabsTrigger>
          <TabsTrigger value="quotes">💰 Quote Dashboard</TabsTrigger>
          <TabsTrigger value="analytics">📊 AI Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="leads">
          <EnhancedLeadManager />
        </TabsContent>

        <TabsContent value="inbox">
          <EmailInboxIntegrated />
        </TabsContent>

        <TabsContent value="quotes">
          <QuoteDashboard />
        </TabsContent>

        <TabsContent value="analytics">
          <div className="text-center p-8">
            <h3 className="text-lg font-semibold mb-2">AI Analytics Dashboard</h3>
            <p className="text-muted-foreground">
              Advanced analytics and performance metrics coming soon...
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}