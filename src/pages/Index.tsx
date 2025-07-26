import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Mail, Users, FileText, Receipt, Database, BarChart3, Layout } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const features = [
    {
      icon: BarChart3,
      title: "Analytics Dashboard",
      description: "Multi-brand analytics with revenue tracking and performance metrics",
      path: "/dashboard"
    },
    {
      icon: Mail,
      title: "Email Management",
      description: "Unified inbox for all brand emails with automated processing",
      path: "/emails"
    },
    {
      icon: Layout,
      title: "Email Templates",
      description: "Create and manage email templates with multi-language support",
      path: "/email-templates"
    },
    {
      icon: Database,
      title: "CRM Integration",
      description: "Sync customer data with TeamLeader CRM",
      path: "/crm"
    },
    {
      icon: Mail,
      title: "Email Templates",
      description: "Create and manage email templates with multi-language support",
      path: "/templates"
    },
    {
      icon: FileText,
      title: "Quote Generation",
      description: "Create and send professional quotes with PDF generation",
      path: "/quotes"
    },
    {
      icon: Receipt,
      title: "Invoice Management",
      description: "Generate invoices and track payments",
      path: "/invoices"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-12 px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">CRM System</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Streamline your business operations with our integrated email management, 
            customer tracking, and invoice generation system.
          </p>
          {!user && (
            <div className="mt-6">
              <Button 
                onClick={() => navigate("/auth")}
                size="lg"
                className="mr-4"
              >
                Sign In
              </Button>
              <Button 
                onClick={() => navigate("/auth")}
                variant="outline"
                size="lg"
              >
                Get Started
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {features.map((feature, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <feature.icon className="h-8 w-8 text-primary" />
                  {feature.title}
                </CardTitle>
                <CardDescription className="text-base">
                  {feature.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => navigate(feature.path)}
                  className="w-full"
                >
                  Access {feature.title}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Index;
