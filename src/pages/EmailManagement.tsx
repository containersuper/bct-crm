import { EmailAccountManager } from "@/components/email/EmailAccountManager";
import { EmailInboxIntegrated } from "@/components/email/EmailInboxIntegrated";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function EmailManagement() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Email Management</h1>
        <p className="text-muted-foreground">
          Manage your email accounts and process incoming emails from all your brands
        </p>
      </div>

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
    </div>
  );
}