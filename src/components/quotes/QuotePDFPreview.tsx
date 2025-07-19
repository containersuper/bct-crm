import { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Send, X } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { toast } from "sonner";

interface QuoteData {
  customerName?: string;
  customerEmail?: string;
  customerCompany?: string;
  customerPhone?: string;
  items?: Array<{
    description?: string;
    containerType?: string;
    route?: string;
    quantity?: number;
    unitPrice?: number;
    total?: number;
  }>;
  subtotal?: number;
  discount?: number;
  discountAmount?: number;
  total?: number;
  terms?: string;
}

interface QuotePDFPreviewProps {
  quote: QuoteData;
  onClose: () => void;
}

export function QuotePDFPreview({ quote, onClose }: QuotePDFPreviewProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const generatePDF = async () => {
    if (!contentRef.current) return;

    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 30;

      pdf.addImage(imgData, "PNG", imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      
      // Download the PDF
      const quoteNumber = `Q-${Date.now()}`;
      pdf.save(`quote-${quoteNumber}.pdf`);
      
      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    }
  };

  const sendEmail = async () => {
    // TODO: Implement email sending functionality
    toast.info("Email sending functionality coming soon");
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Quote Preview
            <div className="flex items-center gap-2">
              <Button onClick={sendEmail} className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Send via Email
              </Button>
              <Button onClick={generatePDF} variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
              <Button onClick={onClose} variant="ghost" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-4 bg-gray-50">
          <div 
            ref={contentRef}
            className="bg-white p-8 shadow-lg max-w-3xl mx-auto"
            style={{ minHeight: "297mm" }}
          >
            {/* Header */}
            <div className="border-b-2 border-primary pb-6 mb-8">
              <div className="flex justify-between items-start">
                <div>
                  <div className="w-32 h-16 bg-gray-200 rounded flex items-center justify-center mb-4">
                    <span className="text-xs text-gray-500">Company Logo</span>
                  </div>
                  <h1 className="text-3xl font-bold text-primary">QUOTE</h1>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary mb-2">
                    Q-{Date.now()}
                  </div>
                  <div className="text-sm text-gray-600">
                    Date: {new Date().toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Information */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">Bill To:</h3>
                <div className="space-y-1">
                  <div className="font-medium">{quote.customerName}</div>
                  {quote.customerCompany && (
                    <div className="text-gray-600">{quote.customerCompany}</div>
                  )}
                  <div className="text-gray-600">{quote.customerEmail}</div>
                  {quote.customerPhone && (
                    <div className="text-gray-600">{quote.customerPhone}</div>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">From:</h3>
                <div className="space-y-1">
                  <div className="font-medium">Your Company Name</div>
                  <div className="text-gray-600">Your Address</div>
                  <div className="text-gray-600">City, Country</div>
                  <div className="text-gray-600">contact@yourcompany.com</div>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-8">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Description</th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Container</th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Route</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-semibold">Qty</th>
                    <th className="border border-gray-300 px-4 py-3 text-right font-semibold">Unit Price</th>
                    <th className="border border-gray-300 px-4 py-3 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items?.map((item, index) => (
                    <tr key={index}>
                      <td className="border border-gray-300 px-4 py-3">{item.description || ""}</td>
                      <td className="border border-gray-300 px-4 py-3">{item.containerType || ""}</td>
                      <td className="border border-gray-300 px-4 py-3">{item.route || ""}</td>
                      <td className="border border-gray-300 px-4 py-3 text-center">{item.quantity || 0}</td>
                      <td className="border border-gray-300 px-4 py-3 text-right">€{(item.unitPrice || 0).toFixed(2)}</td>
                      <td className="border border-gray-300 px-4 py-3 text-right">€{(item.total || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-8">
              <div className="w-64">
                <div className="flex justify-between py-2 border-b">
                  <span>Subtotal:</span>
                  <span>€{(quote.subtotal || 0).toFixed(2)}</span>
                </div>
                {(quote.discount || 0) > 0 && (
                  <div className="flex justify-between py-2 border-b text-red-600">
                    <span>Discount ({quote.discount || 0}%):</span>
                    <span>-€{(quote.discountAmount || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between py-3 border-b-2 border-primary font-bold text-lg">
                  <span>Total:</span>
                  <span>€{(quote.total || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Terms & Conditions */}
            {quote.terms && (
              <div className="mb-8">
                <h3 className="font-semibold text-gray-800 mb-3">Terms & Conditions:</h3>
                <div className="text-sm text-gray-600 whitespace-pre-wrap">
                  {quote.terms}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="border-t pt-6 text-center text-sm text-gray-500">
              <p>Thank you for your business!</p>
              <p>This quote is valid for 30 days from the date of issue.</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}