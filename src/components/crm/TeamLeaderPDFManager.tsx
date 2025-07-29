import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PDFManagerProps {
  type: 'invoices' | 'quotes';
  title: string;
}

interface PDFStats {
  total: number;
  pending: number;
  completed: number;
  failed: number;
}

export function TeamLeaderPDFManager({ type, title }: PDFManagerProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [stats, setStats] = useState<PDFStats | null>(null);
  const { toast } = useToast();

  const fetchStats = async () => {
    try {
      const tableName = type === 'invoices' ? 'teamleader_invoices' : 'teamleader_quotes';
      
      const [totalResult, pendingResult, completedResult, failedResult] = await Promise.all([
        supabase.from(tableName).select('id', { count: 'exact', head: true }),
        supabase.from(tableName).select('id', { count: 'exact', head: true }).eq('pdf_download_status', 'pending'),
        supabase.from(tableName).select('id', { count: 'exact', head: true }).eq('pdf_download_status', 'completed'),
        supabase.from(tableName).select('id', { count: 'exact', head: true }).eq('pdf_download_status', 'failed')
      ]);

      setStats({
        total: totalResult.count || 0,
        pending: pendingResult.count || 0,
        completed: completedResult.count || 0,
        failed: failedResult.count || 0
      });
    } catch (error) {
      console.error('Error fetching PDF stats:', error);
    }
  };

  const downloadPDFs = async () => {
    setIsDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke('teamleader-pdf-downloader', {
        body: {
          type,
          limit: 50,
          batch_size: 5
        }
      });

      if (error) throw error;

      toast({
        title: "PDF Download Complete",
        description: `Downloaded ${data.total_downloaded} PDFs successfully. ${data.total_errors} errors.`,
      });

      // Refresh stats
      await fetchStats();
    } catch (error: any) {
      console.error('Error downloading PDFs:', error);
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download PDFs",
        variant: "destructive"
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const testPDFDownload = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('teamleader-test-pdf');
      
      if (error) throw error;
      
      toast({
        title: "Test Successful",
        description: data.message || "PDF download test completed",
      });
      
      console.log('Test results:', data);
    } catch (error: any) {
      console.error('Test error:', error);
      toast({
        title: "Test Failed",
        description: error.message || "PDF download test failed",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: "default" as const,
      failed: "destructive" as const,
      pending: "secondary" as const
    };
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {status}
      </Badge>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {title} PDFs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 mb-4">
          <Button onClick={fetchStats} variant="outline" size="sm">
            Refresh Stats
          </Button>
          <Button onClick={testPDFDownload} variant="outline" size="sm">
            Test PDF API
          </Button>
          <Button 
            onClick={downloadPDFs} 
            disabled={isDownloading || !stats?.pending}
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            {isDownloading ? "Downloading..." : "Download PDFs"}
          </Button>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total {title}</div>
            </div>
            
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold">
                <Clock className="h-5 w-5 text-yellow-500" />
                {stats.pending}
              </div>
              <div className="text-sm text-muted-foreground">Pending Download</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold">
                <CheckCircle className="h-5 w-5 text-green-500" />
                {stats.completed}
              </div>
              <div className="text-sm text-muted-foreground">Downloaded</div>
            </div>
            
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold">
                <XCircle className="h-5 w-5 text-red-500" />
                {stats.failed}
              </div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </div>
          </div>
        )}

        {!stats && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Click "Refresh Stats" to load PDF status</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}