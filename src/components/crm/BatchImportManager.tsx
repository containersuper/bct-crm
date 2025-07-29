import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Download, RefreshCw, CheckCircle, AlertCircle, Package } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface BatchProgress {
  id: string;
  import_type: string;
  total_estimated: number;
  total_imported: number;
  last_imported_page: number;
  batch_size: number;
  status: string;
  started_at: string;
  last_updated_at: string;
  completed_at: string | null;
  error_details: any;
}

const IMPORT_TYPES = [
  { type: 'contacts', label: 'Kontakte', icon: '👤' },
  { type: 'companies', label: 'Unternehmen', icon: '🏢' },
  { type: 'deals', label: 'Aufträge', icon: '💼' },
  { type: 'invoices', label: 'Rechnungen', icon: '🧾' },
  { type: 'quotes', label: 'Angebote', icon: '📋' },
  { type: 'projects', label: 'Projekte', icon: '📁' }
];

export function BatchImportManager() {
  const [progress, setProgress] = useState<Record<string, BatchProgress>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [importing, setImporting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const { data, error } = await supabase
        .from('teamleader_batch_import_progress')
        .select('*')
        .order('last_updated_at', { ascending: false });

      if (error) throw error;

      const progressMap: Record<string, BatchProgress> = {};
      data?.forEach(item => {
        progressMap[item.import_type] = item;
      });
      setProgress(progressMap);
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  const startBatchImport = async (importType: string) => {
    setImporting(prev => ({ ...prev, [importType]: true }));
    
    try {
      // Use the proven teamleader-sync function instead
      const { data, error } = await supabase.functions.invoke('teamleader-sync', {
        body: { 
          action: 'import',
          syncType: importType
        }
      });

      if (error) throw error;

      if (data && typeof data === 'object' && 'processed' in data) {
        await loadProgress();
        
        const imported = data.processed || 0;
        const successful = data.failed !== undefined ? data.processed - data.failed : imported;
        
        if (successful > 0) {
          toast.success(`${successful} ${importType} erfolgreich importiert!`);
        }
        
        if (data.failed && data.failed > 0) {
          toast.error(`${data.failed} ${importType} konnten nicht importiert werden.`);
        }

        if (imported === 0) {
          toast.info(`Alle ${importType} sind bereits importiert.`);
        }
      } else {
        throw new Error('Unerwartetes Response-Format von der Sync-Function');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error(`Import Fehler: ${error.message}`);
    } finally {
      setImporting(prev => ({ ...prev, [importType]: false }));
    }
  };

  const getProgressPercentage = (progressItem: BatchProgress): number => {
    if (progressItem.status === 'completed') return 100;
    if (progressItem.total_estimated === 0) return 0;
    return Math.min((progressItem.total_imported / progressItem.total_estimated) * 100, 95);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'active':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Package className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'default',
      failed: 'destructive',
      active: 'secondary',
      paused: 'outline'
    } as const;
    
    const labels = {
      completed: 'Abgeschlossen',
      failed: 'Fehler',
      active: 'Aktiv',
      paused: 'Pausiert'
    };
    
    return <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
      {labels[status as keyof typeof labels] || status}
    </Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Stapel-Import von TeamLeader
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6">
          <Package className="h-4 w-4" />
          <AlertDescription>
            <strong>Stapel-Import:</strong> Importiert schrittweise alle Daten von TeamLeader. 
            Jeder Klick importiert ~100 Datensätze. Ideal für den einmaligen Komplettimport aller Daten.
          </AlertDescription>
        </Alert>

        <div className="space-y-6">
          {IMPORT_TYPES.map(({ type, label, icon }) => {
            const progressItem = progress[type];
            const isImporting = importing[type];
            const hasProgress = !!progressItem;
            const isCompleted = progressItem?.status === 'completed';
            const canContinue = hasProgress && !isCompleted && !isImporting;
            const canStart = !hasProgress && !isImporting;

            return (
              <div key={type} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{icon}</span>
                    <div>
                      <h3 className="font-semibold">{label}</h3>
                      {progressItem && (
                        <p className="text-sm text-muted-foreground">
                          {progressItem.total_imported} importiert
                          {progressItem.total_estimated > 0 && ` von ~${progressItem.total_estimated}`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {progressItem && getStatusIcon(progressItem.status)}
                    {progressItem && getStatusBadge(progressItem.status)}
                  </div>
                </div>

                {progressItem && (
                  <div className="space-y-2">
                    <Progress 
                      value={getProgressPercentage(progressItem)} 
                      className="w-full" 
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        Fortschritt: {progressItem.total_imported} Datensätze
                      </span>
                      <span>
                        {getProgressPercentage(progressItem).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {canStart && (
                    <Button 
                      onClick={() => startBatchImport(type)}
                      disabled={isImporting}
                      className="flex items-center gap-2"
                    >
                      <Download className={`h-4 w-4 ${isImporting ? 'animate-spin' : ''}`} />
                      {isImporting ? 'Importiere...' : 'Stapel Import starten'}
                    </Button>
                  )}

                  {canContinue && (
                    <Button 
                      onClick={() => startBatchImport(type)}
                      disabled={isImporting}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${isImporting ? 'animate-spin' : ''}`} />
                      {isImporting ? 'Importiere...' : 'Weiter importieren'}
                    </Button>
                  )}

                  {isCompleted && (
                    <Button 
                      onClick={() => startBatchImport(type)}
                      disabled={isImporting}
                      variant="secondary"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${isImporting ? 'animate-spin' : ''}`} />
                      {isImporting ? 'Aktualisiere...' : 'Aktualisieren'}
                    </Button>
                  )}
                </div>

                {progressItem?.error_details && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Fehler beim Import: {JSON.stringify(progressItem.error_details)}
                    </AlertDescription>
                  </Alert>
                )}

                <Separator />
              </div>
            );
          })}
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-semibold mb-2">💡 Anleitung:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>Stapel Import starten:</strong> Beginnt den Import für den Datentyp</li>
            <li>• <strong>Weiter importieren:</strong> Holt die nächsten ~100 Datensätze</li>
            <li>• <strong>Fortschritt:</strong> Zeigt bereits importierte Datensätze an</li>
            <li>• <strong>Robust:</strong> Bei Fehlern einfach "Weiter importieren" klicken</li>
            <li>• <strong>Sicher:</strong> Vermeidet doppelte Importe automatisch</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}