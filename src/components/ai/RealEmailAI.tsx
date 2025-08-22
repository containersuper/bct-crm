import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/integrations/supabase/client'

export const RealEmailAI = () => {
  const [emails, setEmails] = useState([])
  const [analyzing, setAnalyzing] = useState({})
  const [results, setResults] = useState({})

  // Load emails from your database
  useEffect(() => {
    loadEmails()
  }, [])

  const loadEmails = async () => {
    try {
      const { data, error } = await supabase
        .from('email_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setEmails(data || [])
    } catch (error) {
      console.error('Error loading emails:', error)
    }
  }

  const analyzeEmail = async (email) => {
    setAnalyzing(prev => ({ ...prev, [email.id]: true }))
    
    try {
      const { data, error } = await supabase.functions.invoke('simple-email-analyzer', {
        body: { 
          email: `Subject: ${email.subject}\n\nFrom: ${email.from_address}\nTo: ${email.to_address}\n\n${email.body}` 
        }
      })

      if (error) throw new Error(error.message)

      // Try to parse structured response
      const analysis = {
        summary: data.analysis,
        parsed: tryParseStructuredResponse(data.analysis)
      }

      setResults(prev => ({ ...prev, [email.id]: analysis }))

      // Save to Supabase email_analytics table if we got structured data
      if (analysis.parsed) {
        await supabase
          .from('email_analytics')
          .upsert({
            email_id: email.id,
            intent: analysis.parsed.type || 'other',
            urgency: analysis.parsed.urgency || 'medium',
            entities: {
              containers: analysis.parsed.containers,
              route: analysis.parsed.route
            },
            analysis_timestamp: new Date().toISOString()
          })
      }

    } catch (error) {
      setResults(prev => ({ ...prev, [email.id]: { error: error.message } }))
    }
    
    setAnalyzing(prev => ({ ...prev, [email.id]: false }))
  }

  const tryParseStructuredResponse = (text) => {
    try {
      // Look for JSON-like patterns in the response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      return null
    } catch {
      return null
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">📧 Real Email Analysis</h2>
        <Button onClick={loadEmails} variant="outline">
          Refresh Emails
        </Button>
      </div>

      {emails.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p>No emails found. Check your email sync or try importing some emails first.</p>
          </CardContent>
        </Card>
      ) : (
        emails.map(email => (
          <Card key={email.id} className="w-full">
            <CardHeader>
              <CardTitle className="text-lg">{email.subject || 'No Subject'}</CardTitle>
              <p className="text-sm text-muted-foreground">
                From: {email.from_address} | 
                {new Date(email.created_at).toLocaleDateString('de-DE')}
              </p>
            </CardHeader>
            
            <CardContent>
              <div className="mb-4">
                <p className="text-sm bg-muted p-3 rounded">
                  {email.body?.substring(0, 200)}...
                </p>
              </div>

              {results[email.id] && (
                <div className="bg-primary/5 p-3 rounded mb-4">
                  <h4 className="font-bold text-sm mb-2">🤖 AI Analysis:</h4>
                  {results[email.id].error ? (
                    <p className="text-destructive">{results[email.id].error}</p>
                  ) : (
                    <div className="space-y-2">
                      {results[email.id].parsed ? (
                        <div className="space-y-1 text-sm">
                          <p><strong>Type:</strong> {results[email.id].parsed.type}</p>
                          <p><strong>Urgency:</strong> {results[email.id].parsed.urgency}</p>
                          <p><strong>Containers:</strong> {results[email.id].parsed.containers}</p>
                          <p><strong>Route:</strong> {results[email.id].parsed.route}</p>
                          <p><strong>Summary:</strong> {results[email.id].parsed.summary}</p>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{results[email.id].summary}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={() => analyzeEmail(email)}
                disabled={analyzing[email.id]}
                size="sm"
              >
                {analyzing[email.id] ? 'Analyzing...' : '🤖 Analyze with AI'}
              </Button>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}