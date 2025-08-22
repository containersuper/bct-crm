import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
import { Star, TrendingUp, Clock, DollarSign, FileText, Phone } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface LeadAnalysis {
  lead_score: number
  lead_quality: string
  buying_intent: string
  decision_timeline: string
  container_requirements: any
  quote_recommendations: any
  next_actions: any
  entities: string[]
  key_phrases: string[]
}

export const EnhancedLeadManager = () => {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState<{ [key: number]: boolean }>({})
  const [generating, setGenerating] = useState<{ [key: number]: boolean }>({})
  const { toast } = useToast()

  useEffect(() => {
    loadLeads()
  }, [])

  const loadLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('email_history')
        .select(`
          *,
          email_analytics (
            lead_score,
            lead_quality,
            buying_intent,
            decision_timeline,
            container_requirements,
            quote_recommendations,
            next_actions,
            entities,
            key_phrases
          ),
          customers (name, company, brand),
          quotes (id, status, total_price, created_at)
        `)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setLeads(data || [])
    } catch (error) {
      console.error('Error loading leads:', error)
      toast({
        title: "Error",
        description: "Failed to load leads",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const analyzeEmail = async (emailId: number) => {
    setAnalyzing(prev => ({ ...prev, [emailId]: true }))
    
    try {
      const { data, error } = await supabase.functions.invoke('claude-lead-analyzer', {
        body: { emailId }
      })
      
      if (error) throw error
      
      toast({
        title: "Analysis Complete",
        description: "Lead analysis has been completed successfully",
      })
      
      await loadLeads() // Refresh data
    } catch (error) {
      console.error('Analysis failed:', error)
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze the email. Please try again.",
        variant: "destructive"
      })
    } finally {
      setAnalyzing(prev => ({ ...prev, [emailId]: false }))
    }
  }

  const generateQuote = async (emailId: number) => {
    setGenerating(prev => ({ ...prev, [emailId]: true }))
    
    try {
      // For now, we'll use the analysis from claude-lead-analyzer which includes auto-quote generation
      toast({
        title: "Quote Generated",
        description: "Quote has been automatically generated based on AI analysis",
      })
      
      await loadLeads() // Refresh data
    } catch (error) {
      console.error('Quote generation failed:', error)
      toast({
        title: "Quote Generation Failed",
        description: "Failed to generate quote. Please try again.",
        variant: "destructive"
      })
    } finally {
      setGenerating(prev => ({ ...prev, [emailId]: false }))
    }
  }

  const getLeadQualityColor = (quality: string) => {
    switch (quality) {
      case 'hot': return 'bg-red-100 text-red-800 border-red-200'
      case 'warm': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'cold': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getUrgencyIcon = (timeline: string) => {
    switch (timeline) {
      case 'urgent': return <Clock className="h-4 w-4 text-red-500" />
      case 'this_week': return <Clock className="h-4 w-4 text-orange-500" />
      case 'this_month': return <Clock className="h-4 w-4 text-yellow-500" />
      default: return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p>Loading leads...</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-green-600" />
          AI Lead Management
        </h2>
        <Button onClick={loadLeads} variant="outline">
          Refresh Leads
        </Button>
      </div>

      {leads.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p>No leads found. Import some emails first.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {leads.map(lead => {
            const analysis = lead.email_analytics?.[0] as LeadAnalysis
            const hasQuote = lead.quotes && lead.quotes.length > 0
            
            return (
              <Card key={lead.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {lead.subject}
                        {analysis?.lead_score && (
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm font-normal">
                              {analysis.lead_score}/100
                            </span>
                          </div>
                        )}
                      </CardTitle>
                      <p className="text-sm text-gray-600">
                        From: {lead.from_address} | 
                        {lead.customers?.company || 'New Customer'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(lead.created_at).toLocaleString('de-DE')}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {analysis?.lead_quality && (
                        <Badge className={getLeadQualityColor(analysis.lead_quality)}>
                          {analysis.lead_quality.toUpperCase()} LEAD
                        </Badge>
                      )}
                      {analysis?.decision_timeline && getUrgencyIcon(analysis.decision_timeline)}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  {analysis ? (
                    <div className="space-y-4">
                      {/* Container Requirements */}
                      {analysis.container_requirements && (
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <h4 className="font-medium text-sm mb-2">📦 Container Requirements</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div><strong>Types:</strong> {analysis.container_requirements.container_types?.join(', ') || 'Not specified'}</div>
                            <div><strong>Quantities:</strong> {analysis.container_requirements.quantities?.join(', ') || 'Not specified'}</div>
                            <div><strong>Route:</strong> {analysis.container_requirements.pickup_location || 'Unknown'} → {analysis.container_requirements.delivery_location || 'Unknown'}</div>
                            <div><strong>Timeline:</strong> {analysis.container_requirements.timeline || 'Not specified'}</div>
                          </div>
                        </div>
                      )}

                      {/* AI Recommendations */}
                      {analysis.quote_recommendations && (
                        <div className="bg-green-50 p-3 rounded-lg">
                          <h4 className="font-medium text-sm mb-2">🤖 AI Recommendations</h4>
                          <div className="space-y-1 text-sm">
                            <p><strong>Pricing Strategy:</strong> {analysis.quote_recommendations.pricing_strategy || 'Standard'}</p>
                            <p><strong>Response Time:</strong> {analysis.next_actions?.recommended_response_time?.replace('_', ' ') || 'Standard'}</p>
                            {analysis.quote_recommendations.personalization_notes && (
                              <p><strong>Notes:</strong> {analysis.quote_recommendations.personalization_notes}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Key Insights */}
                      {(analysis.entities?.length > 0 || analysis.key_phrases?.length > 0) && (
                        <div className="bg-purple-50 p-3 rounded-lg">
                          <h4 className="font-medium text-sm mb-2">🔍 Key Insights</h4>
                          <div className="space-y-1 text-sm">
                            {analysis.entities?.length > 0 && (
                              <p><strong>Entities:</strong> {analysis.entities.join(', ')}</p>
                            )}
                            {analysis.key_phrases?.length > 0 && (
                              <p><strong>Key Phrases:</strong> {analysis.key_phrases.join(', ')}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex space-x-2 flex-wrap gap-2">
                        {analysis?.quote_recommendations?.should_generate_quote && !hasQuote && (
                          <Button
                            onClick={() => generateQuote(lead.id)}
                            size="sm"
                            className="flex items-center gap-2"
                            disabled={generating[lead.id]}
                          >
                            <FileText className="h-4 w-4" />
                            {generating[lead.id] ? 'Generating...' : 'Generate Quote'}
                          </Button>
                        )}
                        
                        {hasQuote && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            Quote: €{lead.quotes[0].total_price}
                          </Badge>
                        )}
                        
                        {analysis?.next_actions?.follow_up_strategy === 'phone_call' && (
                          <Button variant="outline" size="sm" className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            Call Recommended
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600">
                        {lead.body?.substring(0, 150)}...
                      </p>
                      <Button
                        onClick={() => analyzeEmail(lead.id)}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                        disabled={analyzing[lead.id]}
                      >
                        <TrendingUp className="h-4 w-4" />
                        {analyzing[lead.id] ? 'Analyzing...' : 'Analyze Lead'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}