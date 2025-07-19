import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QuoteForm } from "@/components/quotes/QuoteForm";
import { QuoteList } from "@/components/quotes/QuoteList";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function QuoteManagement() {
  const [activeTab, setActiveTab] = useState("list");

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quote Management</h1>
          <p className="text-muted-foreground">
            Create, manage, and send professional quotes to your customers
          </p>
        </div>
        <Button
          onClick={() => setActiveTab("create")}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Quote
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="list" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            All Quotes
          </TabsTrigger>
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Quote
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quote Management</CardTitle>
              <CardDescription>
                View and manage all your quotes, track their status, and send follow-ups
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QuoteList />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create New Quote</CardTitle>
              <CardDescription>
                Generate a professional quote with automatic calculations and PDF export
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QuoteForm onQuoteCreated={() => setActiveTab("list")} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}