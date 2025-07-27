import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Mail, Settings, RefreshCw } from 'lucide-react';

interface EmailConnectionGuideProps {
  onConnectGmail: () => void;
  isConnecting: boolean;
  hasConnectedAccounts: boolean;
}

export const EmailConnectionGuide = ({ 
  onConnectGmail, 
  isConnecting, 
  hasConnectedAccounts 
}: EmailConnectionGuideProps) => {
  if (hasConnectedAccounts) {
    return (
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          Your Gmail account is connected! You can now sync and manage your emails.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Connect Your Email Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            To start managing emails, you need to connect your Gmail account first.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <h4 className="font-medium">How it works:</h4>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Click "Connect Gmail Account" below</li>
            <li>Authorize access to your Gmail account</li>
            <li>Your emails will be securely synced to the platform</li>
            <li>Start managing and creating quotes from emails</li>
          </ol>
        </div>

        <div className="pt-4">
          <Button 
            onClick={onConnectGmail}
            disabled={isConnecting}
            className="w-full"
          >
            {isConnecting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Settings className="h-4 w-4 mr-2" />
                Connect Gmail Account
              </>
            )}
          </Button>
        </div>

        <Alert>
          <AlertDescription className="text-xs">
            <strong>Note:</strong> We only access emails you explicitly sync. Your privacy and security are our priority.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};