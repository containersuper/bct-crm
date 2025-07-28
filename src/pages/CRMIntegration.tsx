import { useSearchParams } from 'react-router-dom';
import { TeamLeaderSync } from "@/components/crm/TeamLeaderSync";
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
          Manage your TeamLeader CRM synchronization and data mapping
        </p>
      </div>
      
      <TeamLeaderSync />
    </div>
  );
}