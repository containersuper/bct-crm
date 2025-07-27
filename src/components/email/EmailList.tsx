import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Mail, MailOpen } from "lucide-react";

interface Email {
  id: number;
  customer_id: number | null;
  subject: string;
  body: string;
  direction: string;
  attachments: any;
  created_at: string;
  received_at?: string;
  sender_email?: string;
  sender_name?: string;
  brand?: string;
  is_processed?: boolean;
}

interface EmailListProps {
  emails: Email[];
  selectedEmail: Email | null;
  onSelectEmail: (email: Email) => void;
  loading: boolean;
}

export const EmailList = ({ emails, selectedEmail, onSelectEmail, loading }: EmailListProps) => {
  const getBrandColor = (brand?: string) => {
    switch (brand) {
      case "Brand 1": return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
      case "Brand 2": return "bg-green-500/10 text-green-700 dark:text-green-300";
      case "Brand 3": return "bg-purple-500/10 text-purple-700 dark:text-purple-300";
      case "Brand 4": return "bg-orange-500/10 text-orange-700 dark:text-orange-300";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    if (hours < 48) return "Yesterday";
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Emails</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-fit max-h-[800px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Emails ({emails.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[700px] overflow-y-auto">
          {emails.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No emails found</p>
            </div>
          ) : (
            emails.map((email) => (
              <div
                key={email.id}
                className={cn(
                  "p-4 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors",
                  selectedEmail?.id === email.id && "bg-muted"
                )}
                onClick={() => onSelectEmail(email)}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {email.is_processed ? (
                        <MailOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <Mail className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                      <span className="font-medium text-foreground truncate">
                        {email.sender_name || email.sender_email}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs", getBrandColor(email.brand))}
                      >
                        {email.brand}
                      </Badge>
                      {!email.is_processed && (
                        <div className="w-2 h-2 bg-primary rounded-full" />
                      )}
                    </div>
                  </div>
                  
                  <div className="text-sm text-foreground font-medium line-clamp-2">
                    {email.subject || "No Subject"}
                  </div>
                  
                  <div className="text-sm text-muted-foreground line-clamp-2">
                    {email.body ? email.body.substring(0, 100) + "..." : "No content"}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(email.received_at || email.created_at)}
                    </span>
                    {email.direction && (
                      <Badge variant="outline" className="text-xs">
                        {email.direction}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};