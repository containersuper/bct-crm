import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Mail, Search, Filter, Eye, Reply, FileText, CheckSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmailItem {
  id: string | number;
  external_id: string | null;
  subject: string | null;
  from_address: string | null;
  to_address: string | null;
  body: string | null;
  brand: string | null;
  received_at: string | null;
  direction: string | null;
  processed: boolean | null;
  thread_id?: string | null;
  isUnread?: boolean;
}

interface EmailInboxIntegratedProps {
  onEmailSelect?: (email: EmailItem) => void;
  onCreateQuote?: (email: EmailItem) => void;
}

export function EmailInboxIntegrated({ onEmailSelect, onCreateQuote }: EmailInboxIntegratedProps) {
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_history')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setEmails((data || []).map(email => ({
        id: email.id.toString(),
        external_id: email.external_id || '',
        subject: email.subject || '',
        from_address: email.from_address || '',
        to_address: email.to_address || '',
        body: email.body || '',
        brand: email.brand || 'Unknown',
        received_at: email.received_at || email.created_at || '',
        direction: email.direction as 'incoming' | 'outgoing' || 'incoming',
        processed: email.processed || false,
        thread_id: email.thread_id || undefined,
        isUnread: false
      })));
    } catch (error) {
      console.error('Error fetching emails:', error);
      toast.error('Failed to fetch emails');
    } finally {
      setLoading(false);
    }
  };

  const syncEmails = async () => {
    setSyncing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please log in first');
        return;
      }

      // Sync emails from Gmail
      const { data, error } = await supabase.functions.invoke('fetch-emails', {
        body: { 
          userId: user.id,
          provider: 'gmail',
          maxResults: 100,
          brand: brandFilter !== 'all' ? brandFilter : undefined
        }
      });

      if (error) throw error;

      toast.success(`Synced ${data.count} emails`);
      await fetchEmails();
    } catch (error) {
      console.error('Error syncing emails:', error);
      toast.error('Failed to sync emails');
    } finally {
      setSyncing(false);
    }
  };

  const markAsProcessed = async (emailId: string | number) => {
    try {
      const numericId = typeof emailId === 'string' ? parseInt(emailId) : emailId;
      const { error } = await supabase
        .from('email_history')
        .update({ processed: true })
        .eq('id', numericId);

      if (error) throw error;

      setEmails(prev => prev.map(email => 
        email.id.toString() === emailId.toString() ? { ...email, processed: true } : email
      ));

      toast.success('Email marked as processed');
    } catch (error) {
      console.error('Error marking email as processed:', error);
      toast.error('Failed to mark email as processed');
    }
  };

  const handleCreateQuote = (email: EmailItem) => {
    if (onCreateQuote) {
      onCreateQuote(email);
    } else {
      // Navigate to quote creation with email data
      toast.info('Quote creation feature not yet implemented');
    }
  };

  const handleReply = (email: EmailItem) => {
    // Open reply composer
    toast.info('Reply feature not yet implemented');
  };

  const filteredEmails = emails.filter(email => {
    const matchesSearch = !searchQuery || 
      (email.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (email.from_address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (email.body || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesBrand = brandFilter === 'all' || email.brand === brandFilter;
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'processed' && email.processed) ||
      (statusFilter === 'unprocessed' && !email.processed) ||
      (statusFilter === 'incoming' && email.direction === 'incoming') ||
      (statusFilter === 'outgoing' && email.direction === 'outgoing');

    return matchesSearch && matchesBrand && matchesStatus;
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getBrandColor = (brand: string | null) => {
    switch (brand) {
      case 'Brand 1': return 'bg-blue-100 text-blue-800';
      case 'Brand 2': return 'bg-green-100 text-green-800';
      case 'Brand 3': return 'bg-yellow-100 text-yellow-800';
      case 'Brand 4': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Unified Email Inbox
            </CardTitle>
            <Button onClick={syncEmails} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Emails'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                <SelectItem value="Brand 1">Brand 1</SelectItem>
                <SelectItem value="Brand 2">Brand 2</SelectItem>
                <SelectItem value="Brand 3">Brand 3</SelectItem>
                <SelectItem value="Brand 4">Brand 4</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unprocessed">Unprocessed</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
                <SelectItem value="incoming">Incoming</SelectItem>
                <SelectItem value="outgoing">Outgoing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Email List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Emails ({filteredEmails.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-20 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="mx-auto h-12 w-12 mb-4" />
                <p>No emails found</p>
                <p className="text-sm">Try syncing your emails or adjusting filters</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredEmails.map((email) => (
                  <div
                    key={email.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedEmail?.id === email.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedEmail(email)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${email.isUnread ? 'bg-blue-500' : 'bg-gray-300'}`} />
                        <Badge className={`text-xs ${getBrandColor(email.brand)}`}>
                          {email.brand}
                        </Badge>
                        <Badge variant={email.direction === 'incoming' ? 'secondary' : 'default'} className="text-xs">
                          {email.direction}
                        </Badge>
                        {email.processed && (
                          <Badge variant="outline" className="text-xs">
                            Processed
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(email.received_at)}
                      </span>
                    </div>
                    
                    <h4 className="font-medium text-sm mb-1 truncate">{email.subject}</h4>
                    <p className="text-xs text-muted-foreground mb-2">
                      From: {email.from_address}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {email.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Email Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedEmail ? (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <Badge className={getBrandColor(selectedEmail.brand)}>
                        {selectedEmail.brand}
                      </Badge>
                      <Badge variant={selectedEmail.direction === 'incoming' ? 'secondary' : 'default'}>
                        {selectedEmail.direction}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(selectedEmail.received_at).toLocaleString()}
                    </span>
                  </div>
                  
                  <h3 className="font-semibold text-lg mb-2">{selectedEmail.subject}</h3>
                  
                  <div className="text-sm text-muted-foreground mb-4">
                    <p><strong>From:</strong> {selectedEmail.from_address}</p>
                    <p><strong>To:</strong> {selectedEmail.to_address}</p>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.body.replace(/\n/g, '<br>') }}
                  />
                </div>

                <Separator />

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2">
                  {!selectedEmail.processed && (
                    <Button 
                      size="sm" 
                      onClick={() => markAsProcessed(selectedEmail.id)}
                    >
                      <CheckSquare className="h-4 w-4 mr-2" />
                      Mark as Processed
                    </Button>
                  )}
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleCreateQuote(selectedEmail)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Create Quote
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleReply(selectedEmail)}
                  >
                    <Reply className="h-4 w-4 mr-2" />
                    Reply
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onEmailSelect?.(selectedEmail)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Eye className="mx-auto h-12 w-12 mb-4" />
                <p>Select an email to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}