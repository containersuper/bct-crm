import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw } from 'lucide-react';

export function TeamLeaderAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        toast.error('Authorization failed: ' + error);
        navigate('/crm');
        return;
      }

      if (!code) {
        toast.error('Authorization code not found');
        navigate('/crm');
        return;
      }

      try {
        const { data, error: authError } = await supabase.functions.invoke('teamleader-auth', {
          body: { action: 'token', code }
        });

        if (authError) throw authError;

        toast.success('Successfully connected to TeamLeader!');
        navigate('/crm');
      } catch (error) {
        console.error('Token exchange error:', error);
        toast.error('Failed to complete authorization');
        navigate('/crm');
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <Card className="max-w-md mx-auto mt-8">
      <CardContent className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Completing TeamLeader authorization...
      </CardContent>
    </Card>
  );
}