import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConnectionStatus } from "./ConnectionStatus";
import { useToast } from "@/hooks/use-toast";
import { Mail, Plus, Settings, Trash2, Key } from "lucide-react";

export const EmailSettings = () => {
  const [newAccount, setNewAccount] = useState({
    provider: "",
    email: "",
    brand: ""
  });
  const { toast } = useToast();

  const brands = ["Brand 1", "Brand 2", "Brand 3", "Brand 4"];

  const handleConnectAccount = () => {
    if (!newAccount.provider || !newAccount.email || !newAccount.brand) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    // In real implementation, this would redirect to OAuth flow
    toast({
      title: "OAuth Redirect",
      description: `Redirecting to ${newAccount.provider} OAuth...`,
    });

    // Reset form
    setNewAccount({ provider: "", email: "", brand: "" });
  };

  const handleDisconnectAccount = (account: string) => {
    toast({
      title: "Account Disconnected",
      description: `${account} has been disconnected`,
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Email Account Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="accounts" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="accounts">Accounts</TabsTrigger>
              <TabsTrigger value="add">Add Account</TabsTrigger>
              <TabsTrigger value="sync">Sync Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="accounts" className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-foreground mb-4">Connected Accounts</h3>
                <ConnectionStatus />
              </div>
              
              <div className="space-y-3">
                <h4 className="font-medium text-foreground">Manage Existing Accounts</h4>
                {[
                  { provider: "Gmail", email: "brand1@gmail.com", brand: "Brand 1", connected: true },
                  { provider: "Outlook", email: "brand2@outlook.com", brand: "Brand 2", connected: true },
                  { provider: "Gmail", email: "brand3@gmail.com", brand: "Brand 3", connected: false },
                  { provider: "Outlook", email: "brand4@outlook.com", brand: "Brand 4", connected: false }
                ].map((account, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">{account.email}</p>
                          <p className="text-sm text-muted-foreground">{account.provider} • {account.brand}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={account.connected ? "default" : "secondary"}>
                          {account.connected ? "Connected" : "Disconnected"}
                        </Badge>
                        {account.connected && (
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => handleDisconnectAccount(account.email)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="add" className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-foreground mb-4">Add New Email Account</h3>
                <Card className="p-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="provider">Email Provider</Label>
                      <Select value={newAccount.provider} onValueChange={(value) => setNewAccount({...newAccount, provider: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select email provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gmail">Gmail</SelectItem>
                          <SelectItem value="outlook">Outlook</SelectItem>
                          <SelectItem value="imap">IMAP (Custom)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter email address"
                        value={newAccount.email}
                        onChange={(e) => setNewAccount({...newAccount, email: e.target.value})}
                      />
                    </div>

                    <div>
                      <Label htmlFor="brand">Associate with Brand</Label>
                      <Select value={newAccount.brand} onValueChange={(value) => setNewAccount({...newAccount, brand: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select brand" />
                        </SelectTrigger>
                        <SelectContent>
                          {brands.map(brand => (
                            <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button onClick={handleConnectAccount} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Connect Account with OAuth
                    </Button>

                    <div className="text-sm text-muted-foreground p-4 bg-muted rounded-lg">
                      <Key className="h-4 w-4 inline mr-2" />
                      <strong>Note:</strong> Clicking "Connect Account" will redirect you to the email provider's secure OAuth login page. 
                      We never store your password - only secure access tokens.
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="sync" className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-foreground mb-4">Synchronization Settings</h3>
                <Card className="p-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="sync-frequency">Sync Frequency</Label>
                      <Select defaultValue="5min">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1min">Every minute</SelectItem>
                          <SelectItem value="5min">Every 5 minutes</SelectItem>
                          <SelectItem value="15min">Every 15 minutes</SelectItem>
                          <SelectItem value="30min">Every 30 minutes</SelectItem>
                          <SelectItem value="1hour">Every hour</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="fetch-limit">Emails to fetch per sync</Label>
                      <Select defaultValue="50">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10 emails</SelectItem>
                          <SelectItem value="25">25 emails</SelectItem>
                          <SelectItem value="50">50 emails</SelectItem>
                          <SelectItem value="100">100 emails</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div>
                        <p className="font-medium text-foreground">Auto-categorize by brand</p>
                        <p className="text-sm text-muted-foreground">Automatically assign emails to brands based on recipient address</p>
                      </div>
                      <input type="checkbox" defaultChecked className="h-4 w-4" />
                    </div>

                    <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div>
                        <p className="font-medium text-foreground">Auto-extract customer data</p>
                        <p className="text-sm text-muted-foreground">Automatically create customer records from email signatures</p>
                      </div>
                      <input type="checkbox" defaultChecked className="h-4 w-4" />
                    </div>

                    <Button className="w-full">
                      Save Sync Settings
                    </Button>
                  </div>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};