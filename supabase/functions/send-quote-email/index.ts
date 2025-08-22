import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuoteEmailRequest {
  quote: any;
  customerEmail: string;
  customerName: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { quote, customerEmail, customerName }: QuoteEmailRequest = await req.json();

    // Create email content
    const emailSubject = `Angebot ${quote.quoteNumber} von BCT Container Trading GmbH`;
    
    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
          }
          .header {
            background-color: #2563eb;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background-color: #f9fafb;
            padding: 30px;
            border-radius: 0 0 8px 8px;
          }
          .quote-details {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border: 1px solid #e5e7eb;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 0.9em;
            color: #6b7280;
          }
          .btn {
            display: inline-block;
            background-color: #2563eb;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
          }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 8px 12px;
            text-align: left;
          }
          th {
            background-color: #f3f4f6;
            font-weight: bold;
          }
          .text-right {
            text-align: right;
          }
          .total-row {
            font-weight: bold;
            background-color: #f9fafb;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>BCT Container Trading GmbH</h1>
          <p>Ihr Partner für Container-Lösungen</p>
        </div>
        
        <div class="content">
          <h2>Sehr geehrte${customerName.includes(' ') ? 'r' : ''} ${customerName || 'Damen und Herren'},</h2>
          
          <p>vielen Dank für Ihr Interesse an unseren Dienstleistungen. Gerne unterbreiten wir Ihnen hiermit unser Angebot:</p>
          
          <div class="quote-details">
            <h3>Angebot ${quote.quoteNumber}</h3>
            <p><strong>Datum:</strong> ${new Date().toLocaleDateString('de-DE')}</p>
            <p><strong>Gültig bis:</strong> ${new Date(quote.validUntil).toLocaleDateString('de-DE')}</p>
            
            <table>
              <thead>
                <tr>
                  <th>Pos.</th>
                  <th>Beschreibung</th>
                  <th>Menge</th>
                  <th>Einheit</th>
                  <th class="text-right">Einzelpreis</th>
                  <th class="text-right">Gesamt</th>
                </tr>
              </thead>
              <tbody>
                ${quote.items.map((item: any, index: number) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${item.description}</td>
                    <td>${item.quantity}</td>
                    <td>${item.unit}</td>
                    <td class="text-right">${item.unitPrice.toFixed(2)} €</td>
                    <td class="text-right">${item.total.toFixed(2)} €</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div style="margin-top: 20px; text-align: right;">
              <p>Zwischensumme: ${quote.subtotal.toFixed(2)} €</p>
              ${quote.discount > 0 ? `<p style="color: #059669;">Rabatt (${quote.discount}%): -${((quote.subtotal * quote.discount) / 100).toFixed(2)} €</p>` : ''}
              <p>MwSt. (${quote.vatRate}%): ${quote.vatAmount.toFixed(2)} €</p>
              <p class="total-row" style="font-size: 1.2em; padding: 10px; border: 2px solid #2563eb; border-radius: 4px; background-color: #eff6ff;">
                <strong>Gesamtsumme: ${quote.total.toFixed(2)} €</strong>
              </p>
            </div>
            
            ${quote.terms ? `
              <div style="margin-top: 20px;">
                <h4>Zahlungsbedingungen:</h4>
                <p>${quote.terms}</p>
              </div>
            ` : ''}
            
            ${quote.notes ? `
              <div style="margin-top: 15px;">
                <h4>Anmerkungen:</h4>
                <p>${quote.notes}</p>
              </div>
            ` : ''}
          </div>
          
          <p>Gerne stehen wir Ihnen für Rückfragen zur Verfügung und freuen uns auf Ihre Rückmeldung.</p>
          
          <p>Mit freundlichen Grüßen<br>
          Ihr BCT Container Trading Team</p>
          
          <div class="footer">
            <h4>BCT Container Trading GmbH</h4>
            <p>
              Musterstraße 123<br>
              12345 Hamburg<br>
              Tel: +49 40 123456789<br>
              E-Mail: info@bct-trading.de<br>
              Web: www.bct-trading.de
            </p>
            <p>
              <strong>Bankverbindung:</strong><br>
              Deutsche Bank AG<br>
              IBAN: DE89 3704 0044 0532 0130 00<br>
              BIC: COBADEFFXXX
            </p>
            <p style="font-size: 0.8em; margin-top: 20px;">
              USt-ID: DE123456789 | Geschäftsführer: Max Mustermann | Amtsgericht Hamburg HRB 123456
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "BCT Container Trading <angebote@bct-trading.de>",
      to: [customerEmail],
      subject: emailSubject,
      html: emailContent,
      replyTo: "info@bct-trading.de"
    });

    console.log("Quote email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      messageId: emailResponse.data?.id 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-quote-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);