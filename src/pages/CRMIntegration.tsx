import { useSearchParams } from 'react-router-dom';
import { TeamLeaderConnection } from "@/components/crm/TeamLeaderConnection";
import { TeamLeaderAuthCallback } from "@/components/crm/TeamLeaderAuthCallback";

export default function CRMIntegration() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');

  // Handle OAuth callback
  if (code) {
    return <TeamLeaderAuthCallback />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">CRM Integration</h1>
        <p className="text-muted-foreground">
          Connect to TeamLeader and import your CRM data step by step
        </p>
      </div>
      
      <div className="max-w-2xl">
        <TeamLeaderConnection />
      </div>
    </div>
  );
}