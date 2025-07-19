import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailInbox } from "@/components/email/EmailInbox";
import { EmailSettings } from "@/components/email/EmailSettings";
import { Mail, Settings, Inbox } from "lucide-react";

const EmailManagement = () => {
  const [activeTab, setActiveTab] = useState("inbox");

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Email Management</h1>
          <p className="text-muted-foreground">Manage emails from all your brand websites in one place</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="inbox" className="flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              Inbox
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="mt-6">
            <EmailInbox />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <EmailSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default EmailManagement;