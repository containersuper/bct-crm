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
    <div className="flex h-screen bg-background">
      {/* Left Sidebar */}
      <div className="w-[200px] border-r border-border bg-background flex flex-col">
        <div className="p-4">
          <Button className="w-full bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-full font-medium">
            <Plus className="w-4 h-4 mr-2" />
            Verfassen
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-2">
            {/* Inbox */}
            <Button
              variant={selectedCategory === 'inbox' ? 'secondary' : 'ghost'}
              className="w-full justify-start mb-1 h-8 text-sm"
              onClick={() => setSelectedCategory('inbox')}
            >
              <span className="flex-1">Posteingang</span>
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
                  className="w-full justify-start h-8 text-sm"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  <span className="mr-2">{category.icon}</span>
                  <span className="flex-1 text-left">{category.label}</span>
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
            <Button variant="ghost" className="w-full justify-start h-8 text-sm">
              <span className="w-3 h-3 bg-blue-500 rounded mr-2"></span>
              Wichtig
            </Button>
            <Button variant="ghost" className="w-full justify-start h-8 text-sm">
              <span className="w-3 h-3 bg-green-500 rounded mr-2"></span>
              Verfolgen
            </Button>

            <Separator className="my-3" />

            {/* More */}
            <Button variant="ghost" className="w-full justify-start h-8 text-sm">
              <Settings className="w-4 h-4 mr-2" />
              Mehr
            </Button>
          </div>
        </ScrollArea>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="border-b border-border p-3 bg-background">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
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
                  className="pl-10 bg-muted/50 border-0 focus:bg-background"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
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

        {/* Email List */}
        <div className="flex-1 flex">
          <div className="flex-1 border-r border-border">
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
                        className="mr-3"
                      />
                      
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="mr-3 p-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStar();
                        }}
                      >
                        <StarOff className="w-4 h-4" />
                      </Button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-32 text-sm truncate">
                            {email.from_address?.split('@')[0] || 'Unknown'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm truncate">
                                {email.subject || 'Kein Betreff'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                - {email.body?.substring(0, 50)}...
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {email.email_analytics && (
                              <>
                                <Badge variant="outline" className={getUrgencyColor(email.email_analytics.urgency)}>
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

          {/* Email Preview */}
          {selectedEmail && (
            <div className="w-96 bg-background">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <div className="mb-4">
                    <h3 className="font-semibold text-lg mb-2">{selectedEmail.subject}</h3>
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                      <span>{selectedEmail.from_address}</span>
                      <span>{formatDate(selectedEmail.received_at)}</span>
                    </div>
                  </div>
                  
                  <div className="prose max-w-none">
                    <div className="whitespace-pre-wrap text-sm">
                      {selectedEmail.body}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-[300px] border-l border-border bg-background p-4 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Kundeninfo</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {selectedEmail ? (
              <div className="space-y-2 text-sm">
                <div><strong>E-Mail:</strong> {selectedEmail.from_address}</div>
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
            <CardTitle className="text-sm">KI-Analyse</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {selectedEmail?.email_analytics ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Sentiment:</span>
                  <Badge variant="outline">{selectedEmail.email_analytics.sentiment}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Intent:</span>
                  <Badge variant="outline">{selectedEmail.email_analytics.intent}</Badge>
                </div>
                <div className="flex justify-between">
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
            <Button size="sm" className="w-full">Antworten</Button>
            <Button size="sm" variant="outline" className="w-full">Weiterleiten</Button>
            <Button size="sm" variant="outline" className="w-full">Angebot erstellen</Button>
            <Button size="sm" variant="outline" className="w-full">Kunde hinzufügen</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}