import { TeamLeaderSync } from "@/components/crm/TeamLeaderSync";

export default function CRMIntegration() {
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