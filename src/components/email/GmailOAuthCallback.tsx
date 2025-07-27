import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export const GmailOAuthCallback = () => {
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    
    if (window.opener) {
      // Send the result back to the parent window
      window.opener.postMessage({
        type: 'gmail-oauth-result',
        code,
        error
      }, window.location.origin);
      
      // Close the popup
      window.close();
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Completing authentication...</p>
      </div>
    </div>
  );
};