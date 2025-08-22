import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { Navigation } from "@/components/layout/Navigation";
import { GmailOAuthCallback } from "@/components/email/GmailOAuthCallback";
import { TeamLeaderAuthCallback } from "@/components/crm/TeamLeaderAuthCallback";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import EmailManagement from "./pages/EmailManagement";
import EmailTemplates from "./pages/EmailTemplates";
import QuoteManagement from "./pages/QuoteManagement";
import CRMIntegration from "./pages/CRMIntegration";
import AICRMDashboard from "./pages/AICRMDashboard";
import EmailProcessing from "./pages/EmailProcessing";
import EmailAnalytics from "./pages/EmailAnalytics";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import TestPage from "./pages/TestPage";
import LeadManagement from "./pages/LeadManagement";
import QuoteGenerator from "./pages/QuoteGenerator";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="flex">
            <Navigation />
            <main className="flex-1 ml-64">
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } />
                <Route path="/emails" element={
                  <ProtectedRoute>
                    <EmailManagement />
                  </ProtectedRoute>
                } />
                <Route path="/templates" element={
                  <ProtectedRoute>
                    <EmailTemplates />
                  </ProtectedRoute>
                 } />
                 <Route path="/quote-generator" element={
                   <ProtectedRoute>
                     <QuoteGenerator />
                   </ProtectedRoute>
                 } />
                 <Route path="/quotes" element={
                  <ProtectedRoute>
                    <QuoteManagement />
                  </ProtectedRoute>
                } />
                <Route path="/crm" element={
                  <ProtectedRoute>
                    <CRMIntegration />
                  </ProtectedRoute>
                } />
                <Route path="/ai-crm" element={
                  <ProtectedRoute>
                    <AICRMDashboard />
                  </ProtectedRoute>
                } />
            <Route path="/email-processing" element={
              <ProtectedRoute>
                <EmailProcessing />
              </ProtectedRoute>
            } />
            <Route path="/email-analytics" element={
              <ProtectedRoute>
                <EmailAnalytics />
              </ProtectedRoute>
            } />
            <Route path="/leads" element={
              <ProtectedRoute>
                <LeadManagement />
              </ProtectedRoute>
            } />
                <Route path="/oauth/gmail/callback" element={<GmailOAuthCallback />} />
                <Route path="/auth/callback/gmail" element={<GmailOAuthCallback />} />
                <Route path="/auth/callback/teamleader" element={<TeamLeaderAuthCallback />} />
                <Route path="/test" element={<TestPage />} />
                <Route path="/components/ai/SimpleEmailAI" element={<TestPage />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
