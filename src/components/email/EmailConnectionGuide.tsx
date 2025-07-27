import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Mail, Settings, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EmailConnectionGuideProps {
  onAccountConnected: () => void;
  isConnecting: boolean;
  hasConnectedAccounts: boolean;
}

export const EmailConnectionGuide = ({ 
  onAccountConnected, 
  isConnecting, 
  hasConnectedAccounts 
}: EmailConnectionGuideProps) => {
  
  const connectGmail = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please log in first');
        return;
      }

      // Get OAuth URL from edge function
      const { data, error } = await supabase.functions.invoke('gmail-auth', {
        body: { action: 'auth-url' }
      });

      if (error) throw error;

      // Open OAuth popup
      const popup = window.open(
        data.authUrl,
        'gmail-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        toast.error('Popup blocked. Please allow popups for this site.');
        return;
      }

      // Listen for messages from popup
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'gmail-oauth-result') {
          window.removeEventListener('message', handleMessage);
          
          if (event.data.error) {
            console.error('OAuth error:', event.data.error);
            toast.error('Authentication was cancelled or failed');
          } else if (event.data.code) {
            await handleOAuthCallback(event.data.code, user.id);
          }
        }
      };

      window.addEventListener('message', handleMessage);

      // Check if popup was closed manually
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
        }
      }, 1000);

      // Timeout after 5 minutes
      setTimeout(() => {
        if (!popup.closed) {
          popup.close();
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          toast.error('Authentication timeout');
        }
      }, 300000);

    } catch (error) {
      console.error('Error connecting Gmail:', error);
      toast.error('Failed to connect Gmail account');
    }
  };

  const handleOAuthCallback = async (code: string, userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('gmail-auth', {
        body: { 
          action: 'callback',
          code,
          userId
        }
      });

      if (error) throw error;

      toast.success(`Gmail account connected: ${data.email}`);
      onAccountConnected();
    } catch (error) {
      console.error('OAuth callback error:', error);
      toast.error('Failed to complete Gmail authentication');
    }
  };
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
            onClick={connectGmail}
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