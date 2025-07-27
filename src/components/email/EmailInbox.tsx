import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmailList } from "./EmailList";
import { EmailPreview } from "./EmailPreview";
import { ConnectionStatus } from "./ConnectionStatus";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEmailSearch } from "@/hooks/useEmailSearch";
import { Search, RefreshCw, ChevronDown } from "lucide-react";

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

export const EmailInbox = () => {
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const { toast } = useToast();
  
  const {
    emails,
    loading,
    loadingMore,
    hasMore,
    totalCount,
    searchParams,
    loadMore,
    refresh,
    updateSearchTerm,
    updateBrandFilter,
    updateStatusFilter
  } = useEmailSearch();

  // Get unique brands from emails
  const brands = Array.from(new Set(emails.map(email => email.brand).filter(Boolean)));

  const processedCount = emails.filter(e => e.processed).length;
  const unprocessedCount = emails.filter(e => !e.processed).length;

  const markAsProcessed = async (emailId: number) => {
    try {
      const { error } = await supabase
        .from('email_history')
        .update({ processed: true })
        .eq('id', emailId);

      if (error) throw error;

      // Refresh the search to get updated data
      refresh();

      toast({
        title: "Success",
        description: "Email marked as processed"
      });
    } catch (error: any) {
      toast({
        title: "Error", 
        description: "Failed to update email status",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Sidebar */}
      <div className="lg:col-span-1 space-y-4">
        <ConnectionStatus />
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Email Search
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refresh}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search in all emails..."
                value={searchParams.searchTerm}
                onChange={(e) => updateSearchTerm(e.target.value)}
                className="pl-8"
              />
              {loading && (
                <div className="absolute right-2 top-2.5">
                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Brand</label>
              <Select value={searchParams.brandFilter} onValueChange={updateBrandFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands</SelectItem>
                  {brands.map(brand => (
                    <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Status</label>
              <Select value={searchParams.statusFilter} onValueChange={updateStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="processed">Processed</SelectItem>
                  <SelectItem value="unprocessed">Unprocessed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-2 border-t border-border">
              <div className="text-sm text-muted-foreground mb-2">Search Results</div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm">Found</span>
                  <Badge variant="secondary">{totalCount.toLocaleString()}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Showing</span>
                  <Badge variant="outline">{emails.length}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Unprocessed</span>
                  <Badge variant="destructive">{unprocessedCount}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email List */}
      <div className="lg:col-span-1 space-y-4">
        <EmailList 
          emails={emails}
          selectedEmail={selectedEmail}
          onSelectEmail={setSelectedEmail}
          loading={loading}
        />
        
        {hasMore && !loading && (
          <div className="flex justify-center">
            <Button 
              variant="outline" 
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full"
            >
              {loadingMore ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Loading more...
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Load More Emails
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Email Preview */}
      <div className="lg:col-span-1">
        <EmailPreview 
          email={selectedEmail}
          onMarkAsProcessed={markAsProcessed}
        />
      </div>
    </div>
  );
};