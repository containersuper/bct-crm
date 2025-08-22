import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  FileText, 
  Download, 
  Mail, 
  Plus, 
  Trash2, 
  Calculator,
  Save,
  Send,
  Euro
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

interface QuoteData {
  id?: number;
  quoteNumber: string;
  customerName: string;
  customerCompany: string;
  customerEmail: string;
  customerAddress: string;
  customerCity: string;
  customerPostalCode: string;
  items: QuoteItem[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  discount: number;
  validUntil: string;
  terms: string;
  notes: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  createdAt: string;
}

const COMPANY_INFO = {
  name: "BCT Container Trading GmbH",
  address: "Musterstraße 123",
  city: "12345 Hamburg",
  phone: "+49 40 123456789",
  email: "info@bct-trading.de",
  website: "www.bct-trading.de",
  ustId: "DE123456789",
  bankName: "Deutsche Bank AG",
  iban: "DE89 3704 0044 0532 0130 00",
  bic: "COBADEFFXXX"
};

export function ProfessionalQuoteGenerator() {
  const [quote, setQuote] = useState<QuoteData>({
    quoteNumber: `AN-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    customerName: "",
    customerCompany: "",
    customerEmail: "",
    customerAddress: "",
    customerCity: "",
    customerPostalCode: "",
    items: [{
      id: "1",
      description: "",
      quantity: 1,
      unit: "Stück",
      unitPrice: 0,
      total: 0
    }],
    subtotal: 0,
    vatRate: 19,
    vatAmount: 0,
    total: 0,
    discount: 0,
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    terms: "Zahlbar innerhalb von 30 Tagen ohne Abzug.",
    notes: "",
    status: 'draft',
    createdAt: new Date().toISOString()
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    calculateTotals();
  }, [quote.items, quote.discount, quote.vatRate]);

  const calculateTotals = () => {
    const subtotal = quote.items.reduce((sum, item) => sum + item.total, 0);
    const discountAmount = (subtotal * quote.discount) / 100;
    const discountedSubtotal = subtotal - discountAmount;
    const vatAmount = (discountedSubtotal * quote.vatRate) / 100;
    const total = discountedSubtotal + vatAmount;

    setQuote(prev => ({
      ...prev,
      subtotal,
      vatAmount,
      total
    }));
  };

  const addItem = () => {
    const newItem: QuoteItem = {
      id: Date.now().toString(),
      description: "",
      quantity: 1,
      unit: "Stück",
      unitPrice: 0,
      total: 0
    };
    setQuote(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const removeItem = (id: string) => {
    setQuote(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  const updateItem = (id: string, field: keyof QuoteItem, value: any) => {
    setQuote(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'quantity' || field === 'unitPrice') {
            updatedItem.total = updatedItem.quantity * updatedItem.unitPrice;
          }
          return updatedItem;
        }
        return item;
      })
    }));
  };

  const saveQuote = async () => {
    setIsSaving(true);
    try {
      const quoteData = {
        quote_number: quote.quoteNumber,
        content: JSON.stringify(quote),
        total_price: quote.total,
        status: quote.status,
        ai_generated: false,
        brand: 'bct',
        reference_number: quote.quoteNumber,
        pricing_breakdown: {
          subtotal: quote.subtotal,
          discount: quote.discount,
          vatAmount: quote.vatAmount,
          total: quote.total
        },
        terms: {
          validUntil: quote.validUntil,
          payment: quote.terms,
          notes: quote.notes
        }
      };

      let result;
      if (quote.id) {
        result = await supabase
          .from('quotes')
          .update(quoteData)
          .eq('id', quote.id);
      } else {
        result = await supabase
          .from('quotes')
          .insert(quoteData)
          .select()
          .single();
        
        if (result.data) {
          setQuote(prev => ({ ...prev, id: result.data.id }));
        }
      }

      if (result.error) throw result.error;

      toast({
        title: "Angebot gespeichert",
        description: `Angebot ${quote.quoteNumber} wurde erfolgreich gespeichert.`
      });
    } catch (error) {
      console.error('Error saving quote:', error);
      toast({
        title: "Fehler",
        description: "Angebot konnte nicht gespeichert werden.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const exportToPDF = async () => {
    setIsExporting(true);
    try {
      const element = document.getElementById('quote-preview');
      if (!element) throw new Error('Quote preview element not found');

      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Angebot_${quote.quoteNumber}.pdf`);
      
      toast({
        title: "PDF erstellt",
        description: "Das Angebot wurde als PDF heruntergeladen."
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: "Fehler",
        description: "PDF konnte nicht erstellt werden.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const sendQuoteByEmail = async () => {
    if (!quote.customerEmail) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie eine E-Mail-Adresse des Kunden ein.",
        variant: "destructive"
      });
      return;
    }

    setIsSending(true);
    try {
      // First save the quote
      await saveQuote();

      // Send email
      const { error } = await supabase.functions.invoke('send-quote-email', {
        body: {
          quote,
          customerEmail: quote.customerEmail,
          customerName: quote.customerName
        }
      });

      if (error) throw error;

      // Update quote status to sent
      setQuote(prev => ({ ...prev, status: 'sent' }));

      toast({
        title: "Angebot versendet",
        description: `Das Angebot wurde erfolgreich an ${quote.customerEmail} gesendet.`
      });
    } catch (error) {
      console.error('Error sending quote:', error);
      toast({
        title: "Fehler",
        description: "Angebot konnte nicht versendet werden.",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'sent': return 'outline';
      case 'accepted': return 'default';
      case 'rejected': return 'destructive';
      case 'expired': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return 'Entwurf';
      case 'sent': return 'Versendet';
      case 'accepted': return 'Angenommen';
      case 'rejected': return 'Abgelehnt';
      case 'expired': return 'Abgelaufen';
      default: return status;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Angebot erstellen</h1>
          <p className="text-muted-foreground">
            Professionelle Geschäftsangebote erstellen und verwalten
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusColor(quote.status)}>
            {getStatusText(quote.status)}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Nr. {quote.quoteNumber}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quote Form */}
        <div className="space-y-6">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Kundeninformationen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customerName">Name</Label>
                  <Input
                    id="customerName"
                    value={quote.customerName}
                    onChange={(e) => setQuote(prev => ({ ...prev, customerName: e.target.value }))}
                    placeholder="Max Mustermann"
                  />
                </div>
                <div>
                  <Label htmlFor="customerCompany">Unternehmen</Label>
                  <Input
                    id="customerCompany"
                    value={quote.customerCompany}
                    onChange={(e) => setQuote(prev => ({ ...prev, customerCompany: e.target.value }))}
                    placeholder="Muster GmbH"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="customerEmail">E-Mail</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={quote.customerEmail}
                  onChange={(e) => setQuote(prev => ({ ...prev, customerEmail: e.target.value }))}
                  placeholder="max@muster-gmbh.de"
                />
              </div>
              <div>
                <Label htmlFor="customerAddress">Adresse</Label>
                <Input
                  id="customerAddress"
                  value={quote.customerAddress}
                  onChange={(e) => setQuote(prev => ({ ...prev, customerAddress: e.target.value }))}
                  placeholder="Musterstraße 123"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customerPostalCode">PLZ</Label>
                  <Input
                    id="customerPostalCode"
                    value={quote.customerPostalCode}
                    onChange={(e) => setQuote(prev => ({ ...prev, customerPostalCode: e.target.value }))}
                    placeholder="12345"
                  />
                </div>
                <div>
                  <Label htmlFor="customerCity">Stadt</Label>
                  <Input
                    id="customerCity"
                    value={quote.customerCity}
                    onChange={(e) => setQuote(prev => ({ ...prev, customerCity: e.target.value }))}
                    placeholder="Berlin"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quote Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Positionen
                </CardTitle>
                <Button onClick={addItem} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Position hinzufügen
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {quote.items.map((item, index) => (
                <div key={item.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Position {index + 1}</span>
                    {quote.items.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label>Beschreibung</Label>
                      <Textarea
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        placeholder="Container 20ft High Cube..."
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <Label>Menge</Label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <Label>Einheit</Label>
                        <Select value={item.unit} onValueChange={(value) => updateItem(item.id, 'unit', value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Stück">Stück</SelectItem>
                            <SelectItem value="kg">kg</SelectItem>
                            <SelectItem value="m">m</SelectItem>
                            <SelectItem value="m²">m²</SelectItem>
                            <SelectItem value="m³">m³</SelectItem>
                            <SelectItem value="Std">Std</SelectItem>
                            <SelectItem value="Tag">Tag</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Einzelpreis (€)</Label>
                        <Input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <Label>Gesamt (€)</Label>
                        <Input
                          type="number"
                          value={item.total.toFixed(2)}
                          readOnly
                          className="bg-muted"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Pricing and Terms */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Euro className="h-5 w-5" />
                Preise & Konditionen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="discount">Rabatt (%)</Label>
                  <Input
                    id="discount"
                    type="number"
                    value={quote.discount}
                    onChange={(e) => setQuote(prev => ({ ...prev, discount: parseFloat(e.target.value) || 0 }))}
                    min="0"
                    max="100"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label htmlFor="vatRate">MwSt. (%)</Label>
                  <Input
                    id="vatRate"
                    type="number"
                    value={quote.vatRate}
                    onChange={(e) => setQuote(prev => ({ ...prev, vatRate: parseFloat(e.target.value) || 0 }))}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="validUntil">Gültig bis</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={quote.validUntil}
                  onChange={(e) => setQuote(prev => ({ ...prev, validUntil: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="terms">Zahlungsbedingungen</Label>
                <Textarea
                  id="terms"
                  value={quote.terms}
                  onChange={(e) => setQuote(prev => ({ ...prev, terms: e.target.value }))}
                  placeholder="Zahlbar innerhalb von 30 Tagen ohne Abzug."
                />
              </div>
              <div>
                <Label htmlFor="notes">Anmerkungen</Label>
                <Textarea
                  id="notes"
                  value={quote.notes}
                  onChange={(e) => setQuote(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Zusätzliche Hinweise..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={saveQuote} disabled={isSaving} className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Speichern...' : 'Speichern'}
            </Button>
            <Button onClick={exportToPDF} variant="outline" disabled={isExporting}>
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exportiere...' : 'PDF'}
            </Button>
            <Button onClick={sendQuoteByEmail} variant="outline" disabled={isSending}>
              <Send className="h-4 w-4 mr-2" />
              {isSending ? 'Sende...' : 'E-Mail'}
            </Button>
          </div>
        </div>

        {/* Quote Preview */}
        <div className="lg:sticky lg:top-6 h-fit">
          <Card>
            <CardHeader>
              <CardTitle>Vorschau</CardTitle>
            </CardHeader>
            <CardContent>
              <div id="quote-preview" className="bg-white p-6 border rounded-lg space-y-6 text-sm">
                {/* Company Header */}
                <div className="text-center border-b pb-4">
                  <h1 className="text-2xl font-bold text-primary">{COMPANY_INFO.name}</h1>
                  <p className="text-muted-foreground">{COMPANY_INFO.address}</p>
                  <p className="text-muted-foreground">{COMPANY_INFO.city}</p>
                  <p className="text-muted-foreground">
                    Tel: {COMPANY_INFO.phone} | E-Mail: {COMPANY_INFO.email}
                  </p>
                </div>

                {/* Quote Header */}
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <h2 className="font-bold text-lg mb-2">ANGEBOT</h2>
                    <p><strong>Angebotsnummer:</strong> {quote.quoteNumber}</p>
                    <p><strong>Datum:</strong> {new Date().toLocaleDateString('de-DE')}</p>
                    <p><strong>Gültig bis:</strong> {new Date(quote.validUntil).toLocaleDateString('de-DE')}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Kunde:</h3>
                    {quote.customerName && <p>{quote.customerName}</p>}
                    {quote.customerCompany && <p><strong>{quote.customerCompany}</strong></p>}
                    {quote.customerAddress && <p>{quote.customerAddress}</p>}
                    {(quote.customerPostalCode || quote.customerCity) && (
                      <p>{quote.customerPostalCode} {quote.customerCity}</p>
                    )}
                    {quote.customerEmail && <p>{quote.customerEmail}</p>}
                  </div>
                </div>

                {/* Items Table */}
                <div>
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 p-2 text-left">Pos.</th>
                        <th className="border border-gray-300 p-2 text-left">Beschreibung</th>
                        <th className="border border-gray-300 p-2 text-center">Menge</th>
                        <th className="border border-gray-300 p-2 text-center">Einheit</th>
                        <th className="border border-gray-300 p-2 text-right">Einzelpreis</th>
                        <th className="border border-gray-300 p-2 text-right">Gesamt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quote.items.map((item, index) => (
                        <tr key={item.id}>
                          <td className="border border-gray-300 p-2">{index + 1}</td>
                          <td className="border border-gray-300 p-2">{item.description}</td>
                          <td className="border border-gray-300 p-2 text-center">{item.quantity}</td>
                          <td className="border border-gray-300 p-2 text-center">{item.unit}</td>
                          <td className="border border-gray-300 p-2 text-right">{item.unitPrice.toFixed(2)} €</td>
                          <td className="border border-gray-300 p-2 text-right">{item.total.toFixed(2)} €</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between">
                      <span>Zwischensumme:</span>
                      <span>{quote.subtotal.toFixed(2)} €</span>
                    </div>
                    {quote.discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Rabatt ({quote.discount}%):</span>
                        <span>-{((quote.subtotal * quote.discount) / 100).toFixed(2)} €</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>MwSt. ({quote.vatRate}%):</span>
                      <span>{quote.vatAmount.toFixed(2)} €</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Gesamtsumme:</span>
                      <span>{quote.total.toFixed(2)} €</span>
                    </div>
                  </div>
                </div>

                {/* Terms */}
                {(quote.terms || quote.notes) && (
                  <div className="border-t pt-4 space-y-3">
                    {quote.terms && (
                      <div>
                        <h4 className="font-semibold">Zahlungsbedingungen:</h4>
                        <p className="text-sm">{quote.terms}</p>
                      </div>
                    )}
                    {quote.notes && (
                      <div>
                        <h4 className="font-semibold">Anmerkungen:</h4>
                        <p className="text-sm">{quote.notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="border-t pt-4 text-xs text-gray-600">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p><strong>Bankverbindung:</strong></p>
                      <p>{COMPANY_INFO.bankName}</p>
                      <p>IBAN: {COMPANY_INFO.iban}</p>
                      <p>BIC: {COMPANY_INFO.bic}</p>
                    </div>
                    <div>
                      <p><strong>Kontakt:</strong></p>
                      <p>USt-ID: {COMPANY_INFO.ustId}</p>
                      <p>Web: {COMPANY_INFO.website}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}