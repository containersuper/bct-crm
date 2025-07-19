import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calculator, Save, History, Truck, Shield, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ContainerType {
  id: string;
  name: string;
  basePrice: number;
}

interface Route {
  id: string;
  name: string;
  distance: number;
  pricePerKm: number;
}

interface PricingResult {
  basePrice: number;
  transportCost: number;
  volumeDiscount: number;
  surcharges: number;
  expressDelivery: number;
  insurance: number;
  subtotal: number;
  totalDiscount: number;
  finalTotal: number;
}

interface PricingCalculatorProps {
  onPriceCalculated?: (price: number, breakdown: PricingResult) => void;
  initialQuantity?: number;
  initialContainerType?: string;
  initialRoute?: string;
}

const containerTypes: ContainerType[] = [
  { id: "20ft", name: "20ft Standard", basePrice: 1200 },
  { id: "40ft", name: "40ft Standard", basePrice: 2000 },
  { id: "40ft-hc", name: "40ft High Cube", basePrice: 2200 },
];

const routes: Route[] = [
  { id: "hamburg-rotterdam", name: "Hamburg - Rotterdam", distance: 450, pricePerKm: 1.8 },
  { id: "hamburg-antwerp", name: "Hamburg - Antwerp", distance: 520, pricePerKm: 1.7 },
  { id: "bremen-southampton", name: "Bremen - Southampton", distance: 680, pricePerKm: 2.0 },
  { id: "bremerhaven-felixstowe", name: "Bremerhaven - Felixstowe", distance: 720, pricePerKm: 2.1 },
  { id: "hamburg-lehavre", name: "Hamburg - Le Havre", distance: 780, pricePerKm: 2.2 },
  { id: "rotterdam-hamburg", name: "Rotterdam - Hamburg", distance: 450, pricePerKm: 1.8 },
];

const cargoSurcharges = [
  { id: "none", name: "Standard Cargo", multiplier: 0 },
  { id: "hazardous", name: "Hazardous Materials", multiplier: 0.25 },
  { id: "oversized", name: "Oversized Cargo", multiplier: 0.15 },
  { id: "fragile", name: "Fragile Goods", multiplier: 0.10 },
  { id: "perishable", name: "Perishable Goods", multiplier: 0.20 },
];

export function PricingCalculator({ 
  onPriceCalculated, 
  initialQuantity = 1,
  initialContainerType = "",
  initialRoute = ""
}: PricingCalculatorProps) {
  const [quantity, setQuantity] = useState(initialQuantity);
  const [selectedContainer, setSelectedContainer] = useState(initialContainerType);
  const [selectedRoute, setSelectedRoute] = useState(initialRoute);
  const [cargoType, setCargoType] = useState("none");
  const [expressDelivery, setExpressDelivery] = useState(false);
  const [includeInsurance, setIncludeInsurance] = useState(false);
  const [insuranceValue, setInsuranceValue] = useState(0);
  const [templateName, setTemplateName] = useState("");
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [pricingResult, setPricingResult] = useState<PricingResult | null>(null);

  useEffect(() => {
    fetchSavedTemplates();
    fetchPriceHistory();
  }, []);

  useEffect(() => {
    if (selectedContainer && selectedRoute && quantity > 0) {
      calculatePrice();
    }
  }, [quantity, selectedContainer, selectedRoute, cargoType, expressDelivery, includeInsurance, insuranceValue]);

  const fetchSavedTemplates = async () => {
    // In a real app, this would fetch from a dedicated templates table
    // For now, we'll use localStorage as a simple solution
    const templates = localStorage.getItem('pricing-templates');
    if (templates) {
      setSavedTemplates(JSON.parse(templates));
    }
  };

  const fetchPriceHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("quotes")
        .select("quote_number, total_price, created_at, items")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setPriceHistory(data || []);
    } catch (error) {
      console.error("Error fetching price history:", error);
    }
  };

  const calculatePrice = () => {
    const container = containerTypes.find(c => c.id === selectedContainer);
    const route = routes.find(r => r.id === selectedRoute);
    const surcharge = cargoSurcharges.find(s => s.id === cargoType);

    if (!container || !route || !surcharge) return;

    // Base calculations
    const basePrice = container.basePrice * quantity;
    const transportCost = route.distance * route.pricePerKm * quantity;

    // Volume discounts
    let volumeDiscountPercent = 0;
    if (quantity >= 4) volumeDiscountPercent = 10;
    else if (quantity >= 3) volumeDiscountPercent = 8;
    else if (quantity >= 2) volumeDiscountPercent = 5;

    const subtotalBeforeDiscounts = basePrice + transportCost;
    const volumeDiscount = (subtotalBeforeDiscounts * volumeDiscountPercent) / 100;

    // Surcharges
    const surchargeAmount = subtotalBeforeDiscounts * surcharge.multiplier;
    
    // Express delivery
    const expressAmount = expressDelivery ? subtotalBeforeDiscounts * 0.20 : 0;

    // Insurance
    const insuranceAmount = includeInsurance ? insuranceValue * 0.02 : 0; // 2% of cargo value

    const subtotal = subtotalBeforeDiscounts + surchargeAmount + expressAmount + insuranceAmount;
    const finalTotal = subtotal - volumeDiscount;

    const result: PricingResult = {
      basePrice,
      transportCost,
      volumeDiscount,
      surcharges: surchargeAmount,
      expressDelivery: expressAmount,
      insurance: insuranceAmount,
      subtotal,
      totalDiscount: volumeDiscount,
      finalTotal
    };

    setPricingResult(result);
    onPriceCalculated?.(finalTotal, result);
  };

  const saveTemplate = () => {
    if (!templateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    const template = {
      id: Date.now().toString(),
      name: templateName,
      containerType: selectedContainer,
      route: selectedRoute,
      cargoType,
      expressDelivery,
      includeInsurance,
      createdAt: new Date().toISOString(),
    };

    const updatedTemplates = [...savedTemplates, template];
    setSavedTemplates(updatedTemplates);
    localStorage.setItem('pricing-templates', JSON.stringify(updatedTemplates));
    
    setTemplateName("");
    toast.success("Pricing template saved!");
  };

  const loadTemplate = (template: any) => {
    setSelectedContainer(template.containerType);
    setSelectedRoute(template.route);
    setCargoType(template.cargoType);
    setExpressDelivery(template.expressDelivery);
    setIncludeInsurance(template.includeInsurance);
    toast.success(`Template "${template.name}" loaded`);
  };

  const getVolumeDiscountBadge = () => {
    if (quantity >= 4) return <Badge variant="default">10% Volume Discount</Badge>;
    if (quantity >= 3) return <Badge variant="secondary">8% Volume Discount</Badge>;
    if (quantity >= 2) return <Badge variant="outline">5% Volume Discount</Badge>;
    return null;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Advanced Pricing Calculator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              />
              {getVolumeDiscountBadge()}
            </div>
            
            <div>
              <Label>Container Type</Label>
              <Select value={selectedContainer} onValueChange={setSelectedContainer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select container" />
                </SelectTrigger>
                <SelectContent>
                  {containerTypes.map((container) => (
                    <SelectItem key={container.id} value={container.id}>
                      {container.name} - €{container.basePrice}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Transport Route</Label>
              <Select value={selectedRoute} onValueChange={setSelectedRoute}>
                <SelectTrigger>
                  <SelectValue placeholder="Select route" />
                </SelectTrigger>
                <SelectContent>
                  {routes.map((route) => (
                    <SelectItem key={route.id} value={route.id}>
                      {route.name} ({route.distance}km)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Additional Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label>Cargo Type</Label>
                <Select value={cargoType} onValueChange={setCargoType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cargoSurcharges.map((cargo) => (
                      <SelectItem key={cargo.id} value={cargo.id}>
                        {cargo.name} {cargo.multiplier > 0 && `(+${cargo.multiplier * 100}%)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <Label>Express Delivery (+20%)</Label>
                </div>
                <Switch checked={expressDelivery} onCheckedChange={setExpressDelivery} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <Label>Include Insurance (2%)</Label>
                </div>
                <Switch checked={includeInsurance} onCheckedChange={setIncludeInsurance} />
              </div>

              {includeInsurance && (
                <div>
                  <Label htmlFor="insurance-value">Cargo Value (€)</Label>
                  <Input
                    id="insurance-value"
                    type="number"
                    min="0"
                    value={insuranceValue}
                    onChange={(e) => setInsuranceValue(parseFloat(e.target.value) || 0)}
                    placeholder="Enter cargo value"
                  />
                </div>
              )}
            </div>

            {/* Real-time Calculation Display */}
            {pricingResult && (
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-lg">Price Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Base Price:</span>
                    <span>€{pricingResult.basePrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Transport:</span>
                    <span>€{pricingResult.transportCost.toFixed(2)}</span>
                  </div>
                  {pricingResult.surcharges > 0 && (
                    <div className="flex justify-between">
                      <span>Surcharges:</span>
                      <span>€{pricingResult.surcharges.toFixed(2)}</span>
                    </div>
                  )}
                  {pricingResult.expressDelivery > 0 && (
                    <div className="flex justify-between">
                      <span>Express Delivery:</span>
                      <span>€{pricingResult.expressDelivery.toFixed(2)}</span>
                    </div>
                  )}
                  {pricingResult.insurance > 0 && (
                    <div className="flex justify-between">
                      <span>Insurance:</span>
                      <span>€{pricingResult.insurance.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>€{pricingResult.subtotal.toFixed(2)}</span>
                  </div>
                  {pricingResult.volumeDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Volume Discount:</span>
                      <span>-€{pricingResult.volumeDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>€{pricingResult.finalTotal.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Template Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Template Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name"
                />
                <Button onClick={saveTemplate} disabled={!selectedContainer || !selectedRoute}>
                  Save Template
                </Button>
              </div>
              
              {savedTemplates.length > 0 && (
                <div className="space-y-2">
                  <Label>Saved Templates:</Label>
                  <div className="flex flex-wrap gap-2">
                    {savedTemplates.map((template) => (
                      <Button
                        key={template.id}
                        variant="outline"
                        size="sm"
                        onClick={() => loadTemplate(template)}
                      >
                        {template.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Historical Price Comparison */}
          {priceHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Recent Quote Prices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {priceHistory.map((quote) => (
                    <div key={quote.quote_number} className="flex justify-between items-center p-2 border rounded">
                      <div>
                        <span className="font-medium">{quote.quote_number}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          {new Date(quote.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <Badge variant="outline">€{quote.total_price?.toFixed(2)}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}