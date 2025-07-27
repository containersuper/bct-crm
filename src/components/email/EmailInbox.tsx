import { useState, useEffect } from "react";
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
import { Search, Filter, RefreshCw } from "lucide-react";

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

export const EmailInbox = () => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const brands = ["Brand 1", "Brand 2", "Brand 3", "Brand 4"];

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_history')
        .select('*')
        .order('received_at', { ascending: false });

      if (error) throw error;

      // Transform data and add mock fields for demo
      const emailsWithMockData = data?.map((email, index) => ({
        ...email,
        sender_email: `contact@brand${(index % 4) + 1}.com`,
        sender_name: `Brand ${(index % 4) + 1} Support`,
        brand: brands[index % 4],
        is_processed: index % 3 === 0
      })) || [];

      setEmails(emailsWithMockData);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch emails",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredEmails = emails.filter(email => {
    const matchesSearch = email.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         email.sender_email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBrand = brandFilter === "all" || email.brand === brandFilter;
    const matchesStatus = statusFilter === "all" || 
                         (statusFilter === "processed" && email.is_processed) ||
                         (statusFilter === "unprocessed" && !email.is_processed);
    
    return matchesSearch && matchesBrand && matchesStatus;
  });

  const markAsProcessed = async (emailId: number) => {
    try {
      const { error } = await supabase
        .from('email_history')
        .update({ 
          attachments: { ...emails.find(e => e.id === emailId)?.attachments, is_processed: true }
        })
        .eq('id', emailId);

      if (error) throw error;

      setEmails(emails.map(email => 
        email.id === emailId ? { ...email, is_processed: true } : email
      ));

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
              Email Filters
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchEmails}
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
                placeholder="Search emails..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Brand</label>
              <Select value={brandFilter} onValueChange={setBrandFilter}>
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
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
              <div className="text-sm text-muted-foreground mb-2">Quick Stats</div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm">Total</span>
                  <Badge variant="secondary">{emails.length}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Unprocessed</span>
                  <Badge variant="destructive">{emails.filter(e => !e.is_processed).length}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email List */}
      <div className="lg:col-span-1">
        <EmailList 
          emails={filteredEmails}
          selectedEmail={selectedEmail}
          onSelectEmail={setSelectedEmail}
          loading={loading}
        />
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