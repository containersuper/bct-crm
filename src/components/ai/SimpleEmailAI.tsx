import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/integrations/supabase/client'

export const SimpleEmailAI = () => {
  const [email, setEmail] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const analyzeEmail = async () => {
    setLoading(true)
    
    try {
      const { data, error } = await supabase.functions.invoke('simple-email-analyzer', {
        body: { email }
      })

      if (error) {
        throw new Error(error.message)
      }

      setResult(data.analysis)
    } catch (error) {
      setResult('Error: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
    
    setLoading(false)
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>🤖 Email AI Analyzer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="Paste email content here..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          rows={6}
        />
        
        <Button 
          onClick={analyzeEmail} 
          disabled={loading || !email}
          className="w-full"
        >
          {loading ? 'Analyzing...' : 'Analyze Email'}
        </Button>
        
        {result && (
          <div className="bg-muted p-4 rounded">
            <h3 className="font-bold mb-2">AI Analysis:</h3>
            <p className="whitespace-pre-wrap">{result}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}