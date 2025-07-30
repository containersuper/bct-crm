import { EmailProcessingDashboard } from "@/components/email/EmailProcessingDashboard";

export default function EmailProcessing() {
  console.log('EmailProcessing page component rendered');
  
  return (
    <div className="min-h-screen bg-background">
      <EmailProcessingDashboard />
    </div>
  );
}