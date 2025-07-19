import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plus, Minus, FileText, Send, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QuotePDFPreview } from "./QuotePDFPreview";

const quoteItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  containerType: z.string().min(1, "Container type is required"),
  route: z.string().min(1, "Route is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  unitPrice: z.number().min(0, "Unit price must be positive"),
  total: z.number().min(0),
});

const quoteSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Valid email is required"),
  customerCompany: z.string().optional(),
  customerPhone: z.string().optional(),
  items: z.array(quoteItemSchema).min(1, "At least one item is required"),
  subtotal: z.number().min(0),
  discount: z.number().min(0).max(100),
  discountAmount: z.number().min(0),
  total: z.number().min(0),
  terms: z.string().optional(),
});

type QuoteFormData = z.infer<typeof quoteSchema>;

interface QuoteFormProps {
  onQuoteCreated: () => void;
}

const containerTypes = [
  "20ft Standard",
  "40ft Standard", 
  "40ft High Cube",
  "45ft High Cube",
  "20ft Refrigerated",
  "40ft Refrigerated"
];

const routes = [
  "Hamburg - Rotterdam",
  "Hamburg - Antwerp",
  "Bremen - Southampton", 
  "Bremerhaven - Felixstowe",
  "Hamburg - Le Havre",
  "Rotterdam - Hamburg"
];

export function QuoteForm({ onQuoteCreated }: QuoteFormProps) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [quoteData, setQuoteData] = useState<QuoteFormData | null>(null);

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      customerId: "",
      customerName: "",
      customerEmail: "",
      customerCompany: "",
      customerPhone: "",
      items: [{ description: "", containerType: "", route: "", quantity: 1, unitPrice: 0, total: 0 }],
      subtotal: 0,
      discount: 0,
      discountAmount: 0,
      total: 0,
      terms: "Payment due within 30 days. All prices in EUR.",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("name");
    
    if (error) {
      toast.error("Failed to fetch customers");
      return;
    }
    
    setCustomers(data || []);
  };

  const watchedItems = form.watch("items");
  const watchedDiscount = form.watch("discount");

  useEffect(() => {
    const subtotal = watchedItems.reduce((sum, item) => {
      const itemTotal = item.quantity * item.unitPrice;
      form.setValue(`items.${watchedItems.indexOf(item)}.total`, itemTotal);
      return sum + itemTotal;
    }, 0);
    
    const discountAmount = (subtotal * watchedDiscount) / 100;
    const total = subtotal - discountAmount;
    
    form.setValue("subtotal", subtotal);
    form.setValue("discountAmount", discountAmount);
    form.setValue("total", total);
  }, [watchedItems, watchedDiscount, form]);

  const onCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id.toString() === customerId);
    if (customer) {
      form.setValue("customerName", customer.name);
      form.setValue("customerEmail", customer.email);
      form.setValue("customerCompany", customer.company || "");
      form.setValue("customerPhone", customer.phone || "");
    }
  };

  const onSubmit = async (data: QuoteFormData) => {
    setLoading(true);
    try {
      // Generate quote number
      const quoteNumber = `Q-${Date.now()}`;
      
      const { error } = await supabase
        .from("quotes")
        .insert({
          customer_id: parseInt(data.customerId),
          quote_number: quoteNumber,
          items: data.items,
          total_price: data.total,
          discount: data.discount,
          status: "draft",
        });

      if (error) throw error;

      toast.success("Quote created successfully!");
      onQuoteCreated();
      form.reset();
    } catch (error) {
      console.error("Error creating quote:", error);
      toast.error("Failed to create quote");
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = () => {
    const data = form.getValues();
    if (data.customerName && data.customerEmail && data.items && data.items.length > 0) {
      setQuoteData(data as QuoteFormData);
      setShowPreview(true);
    } else {
      toast.error("Please fill in all required fields before preview");
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Customer</FormLabel>
                      <Select onValueChange={(value) => {
                        field.onChange(value);
                        onCustomerSelect(value);
                      }}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id.toString()}>
                              {customer.name} - {customer.company}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerCompany"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Quote Items */}
          <Card>
            <CardHeader>
              <CardTitle>Quote Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-1 md:grid-cols-6 gap-4 p-4 border rounded-lg">
                  <FormField
                    control={form.control}
                    name={`items.${index}.description`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Container shipping..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`items.${index}.containerType`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Container Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {containerTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`items.${index}.route`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Route</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select route" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {routes.map((route) => (
                              <SelectItem key={route} value={route}>
                                {route}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`items.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`items.${index}.unitPrice`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Price (€)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            {...field} 
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <FormLabel>Total (€)</FormLabel>
                      <Input 
                        value={watchedItems[index]?.total?.toFixed(2) || "0.00"}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => remove(index)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ description: "", containerType: "", route: "", quantity: 1, unitPrice: 0, total: 0 })}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </CardContent>
          </Card>

          {/* Pricing Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <FormLabel>Subtotal</FormLabel>
                  <Input 
                    value={`€${form.watch("subtotal")?.toFixed(2) || "0.00"}`}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <FormField
                  control={form.control}
                  name="discount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount (%)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.1"
                          max="100"
                          {...field} 
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div>
                  <FormLabel>Total</FormLabel>
                  <Input 
                    value={`€${form.watch("total")?.toFixed(2) || "0.00"}`}
                    disabled
                    className="bg-muted font-semibold"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Terms & Conditions */}
          <Card>
            <CardHeader>
              <CardTitle>Terms & Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="terms"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        rows={4}
                        placeholder="Enter terms and conditions..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={handlePreview}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Preview PDF
            </Button>
            <Button type="submit" disabled={loading} className="flex items-center gap-2">
              {loading ? "Creating..." : "Create Quote"}
            </Button>
          </div>
        </form>
      </Form>

      {showPreview && quoteData && (
        <QuotePDFPreview 
          quote={quoteData} 
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}