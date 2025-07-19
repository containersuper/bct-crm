import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Mail, Settings } from "lucide-react";

interface ConnectionStatusProps {
  onOpenSettings?: () => void;
}

export const ConnectionStatus = ({ onOpenSettings }: ConnectionStatusProps) => {
  // Mock connection status - in real implementation this would come from your email service
  const connections = [
    { 
      provider: "Gmail", 
      account: "brand1@gmail.com", 
      connected: true, 
      lastSync: "2 minutes ago" 
    },
    { 
      provider: "Outlook", 
      account: "brand2@outlook.com", 
      connected: true, 
      lastSync: "5 minutes ago" 
    },
    { 
      provider: "Gmail", 
      account: "brand3@gmail.com", 
      connected: false, 
      lastSync: "Never" 
    },
    { 
      provider: "Outlook", 
      account: "brand4@outlook.com", 
      connected: false, 
      lastSync: "Never" 
    }
  ];

  const connectedCount = connections.filter(c => c.connected).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Accounts
          </span>
          <Badge variant={connectedCount > 0 ? "default" : "destructive"}>
            {connectedCount}/{connections.length} Connected
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {connections.map((connection, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div className="flex items-center gap-3">
                {connection.connected ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {connection.provider}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {connection.account}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge 
                  variant={connection.connected ? "default" : "secondary"}
                  className="text-xs"
                >
                  {connection.connected ? "Connected" : "Disconnected"}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  Last sync: {connection.lastSync}
                </p>
              </div>
            </div>
          ))}
        </div>

        {onOpenSettings && (
          <Button 
            variant="outline" 
            className="w-full"
            onClick={onOpenSettings}
          >
            <Settings className="h-4 w-4 mr-2" />
            Manage Connections
          </Button>
        )}
      </CardContent>
    </Card>
  );
};