import { SimpleEmailAI } from '@/components/ai/SimpleEmailAI'
import { RealEmailAI } from '@/components/ai/RealEmailAI'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function TestPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Email AI Test</h1>
      
      <Tabs defaultValue="simple" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="simple">Simple Test</TabsTrigger>
          <TabsTrigger value="real">Real Emails</TabsTrigger>
        </TabsList>
        
        <TabsContent value="simple" className="mt-6">
          <SimpleEmailAI />
        </TabsContent>
        
        <TabsContent value="real" className="mt-6">
          <RealEmailAI />
        </TabsContent>
      </Tabs>
    </div>
  )
}