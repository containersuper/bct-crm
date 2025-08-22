import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
import { FileText, Clock, CheckCircle, XCircle, DollarSign, TrendingUp } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Quote {
  id: number
  quote_number: string
  customer_id: number
  total_price: number
  status: string
  created_at: string
  reference_number: string
  content: string
  ai_generated: boolean
  ai_reasoning: any
  pricing_breakdown: any
  terms: any
  customers: {
    name: string
    company: string
    email: string
  }
}

export const QuoteDashboard = () => {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    sent: 0,
    accepted: 0,
    totalValue: 0
  })
  const { toast } = useToast()

  useEffect(() => {
    loadQuotes()
  }, [])

  const loadQuotes = async () => {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          customers (name, company, email)
        `)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error

      setQuotes(data || [])
      calculateStats(data || [])
    } catch (error) {
      console.error('Error loading quotes:', error)
      toast({
        title: "Error",
        description: "Failed to load quotes",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (quotesData: Quote[]) => {
    const stats = quotesData.reduce((acc, quote) => {
      acc.total += 1
      acc.totalValue += Number(quote.total_price || 0)
      
      switch (quote.status) {
        case 'draft':
          acc.draft += 1
          break
        case 'sent':
          acc.sent += 1
          break
        case 'accepted':
          acc.accepted += 1
          break
      }
      
      return acc
    }, { total: 0, draft: 0, sent: 0, accepted: 0, totalValue: 0 })

    setStats(stats)
  }

  const updateQuoteStatus = async (quoteId: number, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('quotes')
        .update({ status: newStatus })
        .eq('id', quoteId)

      if (error) throw error

      toast({
        title: "Status Updated",
        description: `Quote status changed to ${newStatus}`,
      })

      await loadQuotes() // Refresh data
    } catch (error) {
      console.error('Error updating quote status:', error)
      toast({
        title: "Error",
        description: "Failed to update quote status",
        variant: "destructive"
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'sent': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'accepted': return 'bg-green-100 text-green-800 border-green-200'
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Clock className="h-4 w-4" />
      case 'sent': return <FileText className="h-4 w-4" />
      case 'accepted': return <CheckCircle className="h-4 w-4" />
      case 'rejected': return <XCircle className="h-4 w-4" />
      default: return <FileText className="h-4 w-4" />
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p>Loading quotes...</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Total Quotes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Draft
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.draft}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sent}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Accepted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.accepted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              Total Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{stats.totalValue.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quotes List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Recent Quotes</h3>
          <Button onClick={loadQuotes} variant="outline">
            Refresh
          </Button>
        </div>

        {quotes.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p>No quotes found. Generate some quotes from email leads first.</p>
            </CardContent>
          </Card>
        ) : (
          quotes.map(quote => (
            <Card key={quote.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {quote.reference_number || quote.quote_number}
                      {quote.ai_generated && (
                        <Badge variant="outline" className="text-xs">
                          🤖 AI Generated
                        </Badge>
                      )}
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      Customer: {quote.customers?.name || quote.customers?.company || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Created: {new Date(quote.created_at).toLocaleDateString('de-DE')}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(quote.status)}>
                      {getStatusIcon(quote.status)}
                      <span className="ml-1">{quote.status.toUpperCase()}</span>
                    </Badge>
                    <div className="text-right">
                      <div className="text-lg font-bold">€{Number(quote.total_price).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                {/* Quote Content Preview */}
                {quote.content && (
                  <div className="bg-gray-50 p-3 rounded-lg mb-4">
                    <p className="text-sm">
                      {quote.content.substring(0, 200)}...
                    </p>
                  </div>
                )}

                {/* AI Reasoning */}
                {quote.ai_reasoning && (
                  <div className="bg-blue-50 p-3 rounded-lg mb-4">
                    <h4 className="font-medium text-sm mb-2">🤖 AI Analysis</h4>
                    <div className="text-sm space-y-1">
                      <p><strong>Strategy:</strong> {quote.ai_reasoning.pricing_strategy}</p>
                      <p><strong>Confidence:</strong> {Math.round((quote.ai_reasoning.confidence || 0) * 100)}%</p>
                      <p><strong>Margin:</strong> {Math.round((quote.ai_reasoning.margin || 0) * 100)}%</p>
                    </div>
                  </div>
                )}

                {/* Pricing Breakdown */}
                {quote.pricing_breakdown && (
                  <div className="bg-green-50 p-3 rounded-lg mb-4">
                    <h4 className="font-medium text-sm mb-2">💰 Pricing Breakdown</h4>
                    <div className="text-sm space-y-1">
                      {Object.entries(quote.pricing_breakdown).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="capitalize">{key.replace('_', ' ')}:</span>
                          <span>€{Number(value).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  {quote.status === 'draft' && (
                    <Button
                      onClick={() => updateQuoteStatus(quote.id, 'sent')}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <TrendingUp className="h-4 w-4" />
                      Mark as Sent
                    </Button>
                  )}
                  
                  {quote.status === 'sent' && (
                    <>
                      <Button
                        onClick={() => updateQuoteStatus(quote.id, 'accepted')}
                        size="sm"
                        variant="default"
                        className="flex items-center gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Accept
                      </Button>
                      <Button
                        onClick={() => updateQuoteStatus(quote.id, 'rejected')}
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}