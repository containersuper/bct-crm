import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  RefreshCw, 
  Mail, 
  Search, 
  Filter, 
  Eye, 
  Reply, 
  FileText, 
  CheckSquare,
  AlertCircle,
  Clock,
  Star,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  MessageSquare
} from "lucide-react";
import { EmailSyncStatus } from "./EmailSyncStatus";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

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
  analysis_status?: string | null;
  email_analytics?: {
    sentiment: string;
    intent: string;
    urgency: string;
    sentiment_score: number;
    language: string;
    entities: any;
    key_phrases: any;
  }[];
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
  const [statusFilter, setStatusFilter] = useState("needs_response");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [intentFilter, setIntentFilter] = useState("all");
  const [sortBy, setSortBy] = useState("priority");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_history')
        .select(`
          *,
          email_analytics (
            sentiment,
            intent,
            urgency,
            sentiment_score,
            language,
            entities,
            key_phrases
          )
        `)
        .order('received_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      
      const processedEmails: EmailItem[] = (data || []).map(email => ({
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
        analysis_status: email.analysis_status || 'pending',
        isUnread: !email.processed,
        email_analytics: Array.isArray(email.email_analytics) ? email.email_analytics.map(analytics => ({
          sentiment: analytics.sentiment || 'neutral',
          intent: analytics.intent || 'unknown',
          urgency: analytics.urgency || 'low',
          sentiment_score: analytics.sentiment_score || 0,
          language: analytics.language || 'en',
          entities: analytics.entities || {},
          key_phrases: analytics.key_phrases || {}
        })) : []
      }));

      setEmails(processedEmails);
      
      // Auto-select first unprocessed email
      const firstUnprocessed = processedEmails.find(email => !email.processed);
      if (firstUnprocessed && !selectedEmail) {
        setSelectedEmail(firstUnprocessed);
      }
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
        setSyncing(false);
        return;
      }

      // Check if user has connected Gmail account
      const { data: accounts } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'gmail')
        .eq('is_active', true);

      if (!accounts || accounts.length === 0) {
        toast.error('Please connect your Gmail account first');
        setSyncing(false);
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

      if (error) {
        console.error('Sync error:', error);
        toast.error(error.message || 'Failed to sync emails');
        setSyncing(false);
        return;
      }

      toast.success(`Synced ${data?.count || 0} emails from ${data?.account?.email || 'Gmail'}`);
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

  // Enhanced filtering with AI analysis
  const getResponsePriority = (email: EmailItem) => {
    const analysis = email.email_analytics?.[0];
    if (!analysis) return 0;
    
    let priority = 0;
    
    // Intent-based priority
    if (analysis.intent === 'price_inquiry') priority += 10;
    if (analysis.intent === 'complaint') priority += 8;
    if (analysis.intent === 'support_request') priority += 6;
    
    // Urgency-based priority
    if (analysis.urgency === 'high') priority += 5;
    if (analysis.urgency === 'medium') priority += 3;
    
    // Sentiment-based priority
    if (analysis.sentiment === 'negative') priority += 4;
    if (analysis.sentiment_score < 0.3) priority += 2;
    
    return priority;
  };

  const filteredEmails = emails.filter(email => {
    const analysis = email.email_analytics?.[0];
    
    const matchesSearch = !searchQuery || 
      (email.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (email.from_address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (email.body || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesBrand = brandFilter === 'all' || email.brand === brandFilter;
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'needs_response' && !email.processed && email.direction === 'incoming') ||
      (statusFilter === 'processed' && email.processed) ||
      (statusFilter === 'unprocessed' && !email.processed) ||
      (statusFilter === 'incoming' && email.direction === 'incoming') ||
      (statusFilter === 'outgoing' && email.direction === 'outgoing');

    const matchesUrgency = urgencyFilter === 'all' || analysis?.urgency === urgencyFilter;
    
    const matchesIntent = intentFilter === 'all' || analysis?.intent === intentFilter;

    return matchesSearch && matchesBrand && matchesStatus && matchesUrgency && matchesIntent;
  }).sort((a, b) => {
    if (sortBy === 'priority') {
      return getResponsePriority(b) - getResponsePriority(a);
    } else if (sortBy === 'date') {
      return new Date(b.received_at || 0).getTime() - new Date(a.received_at || 0).getTime();
    } else if (sortBy === 'urgency') {
      const urgencyOrder = { high: 3, medium: 2, low: 1 };
      const aUrgency = a.email_analytics?.[0]?.urgency || 'low';
      const bUrgency = b.email_analytics?.[0]?.urgency || 'low';
      return (urgencyOrder[bUrgency as keyof typeof urgencyOrder] || 1) - (urgencyOrder[aUrgency as keyof typeof urgencyOrder] || 1);
    }
    return 0;
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No date';
    return format(new Date(dateString), 'MMM dd, HH:mm');
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSentimentIcon = (sentiment: string, score: number) => {
    if (sentiment === 'negative' || score < 0.3) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    } else if (sentiment === 'positive' || score > 0.7) {
      return <CheckSquare className="h-4 w-4 text-green-500" />;
    }
    return <Clock className="h-4 w-4 text-yellow-500" />;
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
      <EmailSyncStatus onSync={syncEmails} isLoading={syncing || loading} />
      
      {/* Header and Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Smart Email Inbox
              <Badge variant="secondary" className="ml-2">
                {filteredEmails.filter(e => !e.processed && e.direction === 'incoming').length} need response
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="priority">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4" />
                      Priority
                    </div>
                  </SelectItem>
                  <SelectItem value="date">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Date
                    </div>
                  </SelectItem>
                  <SelectItem value="urgency">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Urgency
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2">
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
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="needs_response">📧 Needs Response</SelectItem>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unprocessed">⏳ Unprocessed</SelectItem>
                <SelectItem value="processed">✅ Processed</SelectItem>
                <SelectItem value="incoming">📥 Incoming</SelectItem>
                <SelectItem value="outgoing">📤 Outgoing</SelectItem>
              </SelectContent>
            </Select>

            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Urgency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Urgency</SelectItem>
                <SelectItem value="high">🔴 High</SelectItem>
                <SelectItem value="medium">🟡 Medium</SelectItem>
                <SelectItem value="low">🟢 Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={intentFilter} onValueChange={setIntentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Intent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Intent</SelectItem>
                <SelectItem value="price_inquiry">💰 Price Inquiry</SelectItem>
                <SelectItem value="complaint">😠 Complaint</SelectItem>
                <SelectItem value="support_request">🛠️ Support</SelectItem>
                <SelectItem value="general_inquiry">❓ General</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                <SelectItem value="Brand 1">Brand 1</SelectItem>
                <SelectItem value="Brand 2">Brand 2</SelectItem>
                <SelectItem value="Brand 3">Brand 3</SelectItem>
                <SelectItem value="Brand 4">Brand 4</SelectItem>
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
                {filteredEmails.map((email) => {
                  const analysis = email.email_analytics?.[0];
                  const priority = getResponsePriority(email);
                  
                  return (
                    <div
                      key={email.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedEmail?.id === email.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
                      } ${priority > 10 ? 'border-l-4 border-l-red-500' : priority > 5 ? 'border-l-4 border-l-yellow-500' : ''}`}
                      onClick={() => setSelectedEmail(email)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          {/* Priority and Sentiment Indicators */}
                          <div className="flex items-center gap-1">
                            {priority > 10 && <Star className="h-3 w-3 text-red-500 fill-current" />}
                            {analysis && getSentimentIcon(analysis.sentiment, analysis.sentiment_score)}
                          </div>
                          
                          <div className={`w-2 h-2 rounded-full ${email.isUnread ? 'bg-blue-500' : 'bg-gray-300'}`} />
                          
                          <Badge className={`text-xs ${getBrandColor(email.brand)}`}>
                            {email.brand}
                          </Badge>
                          
                          <Badge variant={email.direction === 'incoming' ? 'secondary' : 'default'} className="text-xs">
                            {email.direction}
                          </Badge>
                          
                          {/* AI Analysis Badges */}
                          {analysis && (
                            <>
                              <Badge className={`text-xs ${getUrgencyColor(analysis.urgency)}`}>
                                {analysis.urgency}
                              </Badge>
                              
                              {analysis.intent === 'price_inquiry' && (
                                <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">
                                  💰 Quote
                                </Badge>
                              )}
                              
                              {analysis.intent === 'complaint' && (
                                <Badge variant="outline" className="text-xs bg-red-50 text-red-700">
                                  😠 Issue
                                </Badge>
                              )}
                            </>
                          )}
                          
                          {email.processed && (
                            <Badge variant="outline" className="text-xs">
                              ✅ Done
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-muted-foreground block">
                            {formatDate(email.received_at)}
                          </span>
                          {priority > 0 && (
                            <span className="text-xs font-medium text-red-600">
                              Priority: {priority}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <h4 className="font-medium text-sm mb-1 truncate">{email.subject}</h4>
                      <p className="text-xs text-muted-foreground mb-2">
                        From: {email.from_address}
                      </p>
                      
                      {/* AI Analysis Preview */}
                      {analysis && (
                        <div className="text-xs text-muted-foreground mb-2">
                          <span className="font-medium">AI: </span>
                          {analysis.intent.replace('_', ' ')} • {analysis.sentiment} tone
                          {analysis.urgency === 'high' && ' • ⚡ Urgent'}
                        </div>
                      )}
                      
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {email.body}
                      </p>
                    </div>
                  );
                })}
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