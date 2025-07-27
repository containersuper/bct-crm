import { useState, useEffect } from "react";
import { EmailAccountManager } from "@/components/email/EmailAccountManager";
import { EmailInboxIntegrated } from "@/components/email/EmailInboxIntegrated";
import { EmailConnectionGuide } from "@/components/email/EmailConnectionGuide";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function EmailManagement() {
  const { user } = useAuth();
  const [hasConnectedAccounts, setHasConnectedAccounts] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    checkConnectedAccounts();
  }, [user]);

  const checkConnectedAccounts = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      setHasConnectedAccounts((data || []).length > 0);
    } catch (error) {
      console.error('Error checking accounts:', error);
    }
  };

  const handleConnectGmail = () => {
    setIsConnecting(true);
    // This will trigger the Gmail connection process
    // The actual connection logic is in EmailAccountManager
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Email Management</h1>
        <p className="text-muted-foreground">
          Manage your email accounts and process incoming emails from all your brands
        </p>
      </div>

      {!hasConnectedAccounts ? (
        <EmailConnectionGuide 
          onConnectGmail={handleConnectGmail}
          isConnecting={isConnecting}
          hasConnectedAccounts={hasConnectedAccounts}
        />
      ) : (
        <Tabs defaultValue="inbox" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="inbox">Unified Inbox</TabsTrigger>
            <TabsTrigger value="accounts">Account Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="inbox">
            <EmailInboxIntegrated />
          </TabsContent>

          <TabsContent value="accounts">
            <EmailAccountManager />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}