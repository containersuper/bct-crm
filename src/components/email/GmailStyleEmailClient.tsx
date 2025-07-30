import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Archive, Delete, Star, StarOff, ChevronDown, Menu, Settings, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface EmailLabel {
  id: string;
  email_id?: number;
  label_type: string;
  confidence_score: number;
  is_ai_generated: boolean;
  manually_overridden: boolean;
  metadata?: any;
}

interface EmailItem {
  id: number;
  subject: string;
  body: string;
  from_address: string;
  to_address: string;
  received_at: string;
  brand: string;
  processed: boolean;
  analysis_status: string;
  email_analytics?: {
    sentiment: string;
    intent: string;
    urgency: string;
    urgency_priority: number;
  };
  email_labels?: EmailLabel[];
}

const categories = [
  { id: 'neue-kunden', icon: '🆕', label: 'Neue Kunden', count: 5 },
  { id: 'bestandskunden', icon: '👥', label: 'Bestandskunden', count: 12 },
  { id: 'auftragsanfragen', icon: '📦', label: 'Auftragsanfragen', count: 3 },
  { id: 'container-news', icon: '📊', label: 'Container News (Lieferanten)', count: 8 },
  { id: 'allgemein', icon: '📑', label: 'Allgemein', count: 15 },
  { id: 'spam', icon: '🗑️', label: 'Spam', count: 2 },
];

export function GmailStyleEmailClient() {
  const { user } = useAuth();
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<Set<number>>(new Set());
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [currentEmailIndex, setCurrentEmailIndex] = useState(-1);

  // Load emails
  const loadEmails = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_history')
        .select(`
          *,
          email_analytics (
            sentiment,
            intent,
            urgency,
            urgency_priority
          ),
          email_labels (
            id,
            label_type,
            confidence_score,
            is_ai_generated,
            manually_overridden,
            metadata
          )
        `)
        .order('received_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setEmails(data || []);
      if (data && data.length > 0 && !selectedEmail) {
        setSelectedEmail(data[0]);
        setCurrentEmailIndex(0);
      }
    } catch (error) {
      console.error('Error loading emails:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedEmail]);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  // Real-time subscriptions for email labels
  useEffect(() => {
    if (!user) return;

    const labelsChannel = supabase
      .channel('email-labels-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_labels'
        },
        (payload) => {
          console.log('Email label change:', payload);
          // Reload emails when labels change
          loadEmails();
        }
      )
      .subscribe();

    const analyticsChannel = supabase
      .channel('email-analytics-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_analytics'
        },
        (payload) => {
          console.log('Email analytics change:', payload);
          // Reload emails when analytics change
          loadEmails();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(labelsChannel);
      supabase.removeChannel(analyticsChannel);
    };
  }, [user, loadEmails]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      
      switch (e.key) {
        case 'j':
          e.preventDefault();
          navigateEmail('next');
          break;
        case 'k':
          e.preventDefault();
          navigateEmail('prev');
          break;
        case 's':
          e.preventDefault();
          toggleStar();
          break;
        case 'x':
          e.preventDefault();
          toggleSelect();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentEmailIndex, emails]);

  const navigateEmail = (direction: 'next' | 'prev') => {
    const newIndex = direction === 'next' 
      ? Math.min(currentEmailIndex + 1, emails.length - 1)
      : Math.max(currentEmailIndex - 1, 0);
    
    setCurrentEmailIndex(newIndex);
    setSelectedEmail(emails[newIndex]);
  };

  const toggleStar = () => {
    if (!selectedEmail) return;
    // TODO: Implement star functionality
  };

  const toggleSelect = () => {
    if (!selectedEmail) return;
    const newSelected = new Set(selectedEmails);
    if (newSelected.has(selectedEmail.id)) {
      newSelected.delete(selectedEmail.id);
    } else {
      newSelected.add(selectedEmail.id);
    }
    setSelectedEmails(newSelected);
  };

  const getUrgencyColor = (urgency?: string) => {
    switch (urgency) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getSentimentIcon = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return '😊';
      case 'negative': return '😞';
      case 'neutral': return '😐';
      default: return '❓';
    }
  };

  const getLabelInfo = (labelType: string) => {
    switch (labelType) {
      case 'NEUKUNDE':
        return { icon: '🆕', color: 'bg-green-100 text-green-800 border-green-200', text: 'Neukunde' };
      case 'BESTANDSKUNDE':
        return { icon: '👤', color: 'bg-blue-100 text-blue-800 border-blue-200', text: 'Bestandskunde' };
      case 'AUFTRAGSBEZOGEN':
        return { icon: '📦', color: 'bg-purple-100 text-purple-800 border-purple-200', text: 'Auftragsbezogen' };
      case 'PREISANFRAGE':
        return { icon: '💰', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', text: 'Preisanfrage' };
      case 'LIEFERANTEN-INFO':
        return { icon: '🚚', color: 'bg-orange-100 text-orange-800 border-orange-200', text: 'Lieferanten-Info' };
      case 'NEWSLETTER':
        return { icon: '📰', color: 'bg-gray-100 text-gray-800 border-gray-200', text: 'Newsletter' };
      case 'URGENT':
        return { icon: '⚡', color: 'bg-red-100 text-red-800 border-red-200', text: 'Urgent' };
      default:
        return { icon: '📑', color: 'bg-muted text-muted-foreground border-border', text: 'Allgemein' };
    }
  };

  const getConfidenceIndicator = (confidence: number) => {
    const percentage = Math.round(confidence * 100);
    if (confidence >= 0.8) return { color: 'text-green-600', symbol: '●', percentage };
    if (confidence >= 0.6) return { color: 'text-yellow-600', symbol: '◐', percentage };
    return { color: 'text-red-600', symbol: '○', percentage };
  };

  const changeEmailLabel = async (emailId: number, newLabelType: string) => {
    try {
      const { error } = await supabase
        .from('email_labels')
        .upsert({
          email_id: emailId,
          label_type: newLabelType,
          confidence_score: 1.0,
          is_ai_generated: false,
          manually_overridden: true,
          metadata: { manually_changed_at: new Date().toISOString() }
        }, {
          onConflict: 'email_id,label_type'
        });

      if (error) throw error;
      
      // Reload emails to show updated labels
      loadEmails();
    } catch (error) {
      console.error('Error updating email label:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString('de-DE', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    }
  };

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-64 min-w-64 border-r border-border bg-background flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <Button className="w-full bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-full font-medium h-12">
            <Plus className="w-4 h-4 mr-2" />
            Verfassen
          </Button>
        </div>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-2">
              {/* Inbox */}
              <Button
                variant={selectedCategory === 'inbox' ? 'secondary' : 'ghost'}
                className="w-full justify-start mb-1 h-9 text-sm"
                onClick={() => setSelectedCategory('inbox')}
              >
                <span className="flex-1 text-left">Posteingang</span>
                <Badge variant="secondary" className="ml-2 text-xs">
                  {emails.filter(e => !e.processed).length}
                </Badge>
              </Button>

              <Separator className="my-3" />

              {/* Categories */}
              <div className="space-y-1">
                {categories.map((category) => (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.id ? 'secondary' : 'ghost'}
                    className="w-full justify-start h-9 text-sm"
                    onClick={() => setSelectedCategory(category.id)}
                  >
                    <span className="mr-2">{category.icon}</span>
                    <span className="flex-1 text-left truncate">{category.label}</span>
                    {category.count > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {category.count}
                      </Badge>
                    )}
                  </Button>
                ))}
              </div>

              <Separator className="my-3" />

              {/* Labels */}
              <div className="text-xs text-muted-foreground mb-2 px-3">Labels</div>
              <Button variant="ghost" className="w-full justify-start h-9 text-sm">
                <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                Wichtig
              </Button>
              <Button variant="ghost" className="w-full justify-start h-9 text-sm">
                <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                Verfolgen
              </Button>

              <Separator className="my-3" />

              {/* More */}
              <Button variant="ghost" className="w-full justify-start h-9 text-sm">
                <Settings className="w-4 h-4 mr-2" />
                Mehr
              </Button>
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Toolbar */}
        <div className="border-b border-border p-3 bg-background shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <Checkbox
                checked={selectedEmails.size === emails.length && emails.length > 0}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedEmails(new Set(emails.map(e => e.id)));
                  } else {
                    setSelectedEmails(new Set());
                  }
                }}
              />
              <Button variant="ghost" size="sm">
                <Archive className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Delete className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 max-w-lg">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="E-Mails durchsuchen"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-muted/50 border-0 focus:bg-background h-9"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="sm">
                <ChevronDown className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={loadEmails}>
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Menu className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Email List and Preview - Horizontal Split */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Email List */}
          <div className="flex-1 border-b border-border min-h-0">
            <div className="h-full overflow-hidden">
              <ScrollArea className="h-full">
                {isLoading ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Lade E-Mails...
                  </div>
                ) : emails.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Keine E-Mails gefunden
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {emails.map((email, index) => (
                      <div
                        key={email.id}
                        className={`flex items-center p-3 hover:bg-muted/50 cursor-pointer transition-colors ${
                          selectedEmail?.id === email.id ? 'bg-blue-50 border-l-4 border-l-[#1a73e8]' : ''
                        } ${!email.processed ? 'font-semibold' : ''}`}
                        onClick={() => {
                          setSelectedEmail(email);
                          setCurrentEmailIndex(index);
                        }}
                      >
                        <Checkbox
                          checked={selectedEmails.has(email.id)}
                          onCheckedChange={(checked) => {
                            const newSelected = new Set(selectedEmails);
                            if (checked) {
                              newSelected.add(email.id);
                            } else {
                              newSelected.delete(email.id);
                            }
                            setSelectedEmails(newSelected);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="mr-3 shrink-0"
                        />
                        
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="mr-3 p-1 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStar();
                          }}
                        >
                          <StarOff className="w-4 h-4" />
                        </Button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <div className="w-32 text-sm truncate shrink-0">
                              {email.from_address?.split('@')[0] || 'Unknown'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm truncate">
                                  {email.subject || 'Kein Betreff'}
                                </span>
                                <span className="text-xs text-muted-foreground hidden sm:inline">
                                  - {email.body?.substring(0, 50)}...
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {/* AI Labels */}
                              {email.email_labels && email.email_labels.length > 0 && (
                                <div className="flex items-center gap-1">
                                  {email.email_labels.slice(0, 2).map((label) => {
                                    const labelInfo = getLabelInfo(label.label_type);
                                    const confidence = getConfidenceIndicator(label.confidence_score);
                                    return (
                                      <div key={label.id} className="flex items-center gap-1">
                                        <Badge 
                                          variant="outline" 
                                          className={`${labelInfo.color} text-xs px-2 py-1 flex items-center gap-1`}
                                          title={`${labelInfo.text} (${confidence.percentage}% Confidence)`}
                                        >
                                          <span>{labelInfo.icon}</span>
                                          <span className="hidden lg:inline">{labelInfo.text}</span>
                                          <span className={`text-xs ${confidence.color}`} title={`${confidence.percentage}% confidence`}>
                                            {confidence.symbol}
                                          </span>
                                        </Badge>
                                      </div>
                                    );
                                  })}
                                  {email.email_labels.length > 2 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{email.email_labels.length - 2}
                                    </Badge>
                                  )}
                                </div>
                              )}
                              
                              {/* Analytics badges */}
                              {email.email_analytics && (
                                <>
                                  <Badge variant="outline" className={`${getUrgencyColor(email.email_analytics.urgency)} hidden xl:flex`}>
                                    {email.email_analytics.urgency}
                                  </Badge>
                                  <span className="text-sm">
                                    {getSentimentIcon(email.email_analytics.sentiment)}
                                  </span>
                                </>
                              )}
                              <div className="text-xs text-muted-foreground w-16 text-right">
                                {formatDate(email.received_at)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          {/* Email Preview Panel */}
          {selectedEmail && (
            <div className="h-80 bg-background border-t border-border shrink-0">
              <div className="h-full overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-6">
                    <div className="mb-6">
                      <h3 className="font-semibold text-lg mb-2 leading-tight">{selectedEmail.subject}</h3>
                      <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                        <span className="truncate">{selectedEmail.from_address}</span>
                        <span className="shrink-0 ml-2">{formatDate(selectedEmail.received_at)}</span>
                      </div>
                    </div>
                    
                    <div className="prose max-w-none">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {selectedEmail.body}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 min-w-80 border-l border-border bg-background shrink-0">
        <div className="h-full overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Kundeninfo</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {selectedEmail ? (
                    <div className="space-y-2 text-sm">
                      <div><strong>E-Mail:</strong> <span className="break-all">{selectedEmail.from_address}</span></div>
                      <div><strong>Brand:</strong> {selectedEmail.brand || 'Unbekannt'}</div>
                      <div><strong>Status:</strong> {selectedEmail.processed ? 'Bearbeitet' : 'Neu'}</div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-sm">Wählen Sie eine E-Mail aus</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">KI-Labels</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {selectedEmail?.email_labels && selectedEmail.email_labels.length > 0 ? (
                    <div className="space-y-3">
                      {selectedEmail.email_labels.map((label) => {
                        const labelInfo = getLabelInfo(label.label_type);
                        const confidence = getConfidenceIndicator(label.confidence_score);
                        return (
                          <div key={label.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant="outline" 
                                className={`${labelInfo.color} text-xs px-2 py-1 flex items-center gap-1`}
                              >
                                <span>{labelInfo.icon}</span>
                                <span>{labelInfo.text}</span>
                              </Badge>
                              {label.manually_overridden && (
                                <Badge variant="secondary" className="text-xs">
                                  Manuell
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs ${confidence.color}`} title={`${confidence.percentage}% confidence`}>
                                {confidence.symbol} {confidence.percentage}%
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                  // TODO: Implement label change dropdown
                                  const newLabel = prompt('Neues Label eingeben:');
                                  if (newLabel) {
                                    changeEmailLabel(selectedEmail.id, newLabel.toUpperCase());
                                  }
                                }}
                              >
                                ✏️
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-sm">Keine AI-Labels verfügbar</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">KI-Analyse</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {selectedEmail?.email_analytics ? (
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span>Sentiment:</span>
                        <Badge variant="outline">{selectedEmail.email_analytics.sentiment}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Intent:</span>
                        <Badge variant="outline">{selectedEmail.email_analytics.intent}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Dringlichkeit:</span>
                        <Badge variant="outline" className={getUrgencyColor(selectedEmail.email_analytics.urgency)}>
                          {selectedEmail.email_analytics.urgency}
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-sm">Keine Analyse verfügbar</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">E-Mail Historie</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-muted-foreground text-sm">
                    Letzte Interaktionen werden hier angezeigt
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Schnellaktionen</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <Button size="sm" className="w-full justify-start">Antworten</Button>
                  <Button size="sm" variant="outline" className="w-full justify-start">Weiterleiten</Button>
                  <Button size="sm" variant="outline" className="w-full justify-start">Angebot erstellen</Button>
                  <Button size="sm" variant="outline" className="w-full justify-start">Kunde hinzufügen</Button>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}