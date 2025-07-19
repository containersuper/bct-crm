import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, FileText, Send, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Quote {
  id: number;
  quote_number: string;
  customer_id: number;
  items: any;
  total_price: number;
  discount: number;
  status: string;
  pdf_url?: string;
  created_at: string;
  customers?: {
    name: string;
    email: string;
    company?: string;
  };
}

export function QuoteList() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchQuotes();
  }, []);

  useEffect(() => {
    const filtered = quotes.filter((quote) =>
      quote.quote_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.customers?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.customers?.company?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredQuotes(filtered);
  }, [quotes, searchTerm]);

  const fetchQuotes = async () => {
    try {
      const { data, error } = await supabase
        .from("quotes")
        .select(`
          *,
          customers (
            name,
            email,
            company
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQuotes(data || []);
    } catch (error) {
      console.error("Error fetching quotes:", error);
      toast.error("Failed to fetch quotes");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-800";
      case "sent":
        return "bg-blue-100 text-blue-800";
      case "accepted":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleStatusUpdate = async (quoteId: number, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("quotes")
        .update({ status: newStatus })
        .eq("id", quoteId);

      if (error) throw error;
      
      toast.success("Quote status updated");
      fetchQuotes();
    } catch (error) {
      console.error("Error updating quote status:", error);
      toast.error("Failed to update quote status");
    }
  };

  if (loading) {
    return <div>Loading quotes...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search quotes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Quotes Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quote Number</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredQuotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No quotes found
                </TableCell>
              </TableRow>
            ) : (
              filteredQuotes.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell className="font-medium">
                    {quote.quote_number}
                  </TableCell>
                  <TableCell>{quote.customers?.name}</TableCell>
                  <TableCell>{quote.customers?.company || "-"}</TableCell>
                  <TableCell>€{quote.total_price?.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(quote.status)}>
                      {quote.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(quote.created_at), "MMM dd, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // TODO: Implement quote preview
                          toast.info("Quote preview coming soon");
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      
                      {quote.pdf_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            window.open(quote.pdf_url, "_blank");
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {quote.status === "draft" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // TODO: Implement email sending
                            handleStatusUpdate(quote.id, "sent");
                          }}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}