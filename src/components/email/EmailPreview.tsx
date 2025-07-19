import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Reply, Check, PlusCircle, Paperclip } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Email {
  id: number;
  customer_id: number | null;
  subject: string;
  body: string;
  direction: string;
  attachments: any;
  created_at: string;
  sender_email?: string;
  sender_name?: string;
  brand?: string;
  is_processed?: boolean;
}

interface EmailPreviewProps {
  email: Email | null;
  onMarkAsProcessed: (emailId: number) => void;
}

export const EmailPreview = ({ email, onMarkAsProcessed }: EmailPreviewProps) => {
  const { toast } = useToast();

  const handleCreateQuote = () => {
    toast({
      title: "Quote Creation",
      description: "Quote creation feature will be implemented next"
    });
  };

  const handleReply = () => {
    toast({
      title: "Reply",
      description: "Reply feature will be implemented next"
    });
  };

  if (!email) {
    return (
      <Card className="h-fit">
        <CardContent className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Select an email to preview</p>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getBrandColor = (brand?: string) => {
    switch (brand) {
      case "Brand 1": return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
      case "Brand 2": return "bg-green-500/10 text-green-700 dark:text-green-300";
      case "Brand 3": return "bg-purple-500/10 text-purple-700 dark:text-purple-300";
      case "Brand 4": return "bg-orange-500/10 text-orange-700 dark:text-orange-300";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Card className="h-fit">
      <CardHeader>
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg line-clamp-2">
              {email.subject || "No Subject"}
            </CardTitle>
            <Badge 
              variant="outline" 
              className={getBrandColor(email.brand)}
            >
              {email.brand}
            </Badge>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{email.sender_name}</p>
                <p className="text-sm text-muted-foreground">{email.sender_email}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{formatDate(email.created_at)}</p>
                {email.direction && (
                  <Badge variant="outline" className="text-xs mt-1">
                    {email.direction}
                  </Badge>
                )}
              </div>
            </div>
            
            {email.attachments && Object.keys(email.attachments).length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Paperclip className="h-4 w-4" />
                <span>Has attachments</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Separator />
        
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <div className="text-foreground whitespace-pre-wrap">
            {email.body || "No content available"}
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Quick Actions</h4>
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={handleCreateQuote}
              className="flex items-center gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              Create Quote
            </Button>
            
            <Button 
              variant="outline"
              onClick={handleReply}
              className="flex items-center gap-2"
            >
              <Reply className="h-4 w-4" />
              Reply
            </Button>
            
            {!email.is_processed && (
              <Button 
                variant="secondary"
                onClick={() => onMarkAsProcessed(email.id)}
                className="flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                Mark as Processed
              </Button>
            )}
          </div>
          
          {email.is_processed && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-green-600" />
              <span>This email has been processed</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};