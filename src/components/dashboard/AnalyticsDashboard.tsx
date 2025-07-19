import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, Download, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
  Area,
  AreaChart
} from "recharts";

// Mock data for the dashboard
const mockData = {
  revenueByBrand: [
    { name: "Brand 1", value: 342000, color: "#8884d8" },
    { name: "Brand 2", value: 289000, color: "#82ca9d" },
    { name: "Brand 3", value: 198000, color: "#ffc658" },
    { name: "Brand 4", value: 156000, color: "#ff7c7c" }
  ],
  monthlyTrends: [
    { month: "Jan", brand1: 28000, brand2: 24000, brand3: 18000, brand4: 12000, quotes: 156 },
    { month: "Feb", brand1: 32000, brand2: 26000, brand3: 20000, brand4: 14000, quotes: 178 },
    { month: "Mar", brand1: 29000, brand2: 28000, brand3: 22000, brand4: 16000, quotes: 189 },
    { month: "Apr", brand1: 35000, brand2: 30000, brand3: 19000, brand4: 18000, quotes: 201 },
    { month: "May", brand1: 38000, brand2: 32000, brand3: 24000, brand4: 19000, quotes: 223 },
    { month: "Jun", brand1: 42000, brand2: 35000, brand3: 26000, brand4: 21000, quotes: 245 }
  ],
  conversionRates: [
    { brand: "Brand 1", rate: 68, quotes: 145, conversions: 98 },
    { brand: "Brand 2", rate: 72, quotes: 132, conversions: 95 },
    { brand: "Brand 3", rate: 59, quotes: 118, conversions: 70 },
    { brand: "Brand 4", rate: 45, quotes: 89, conversions: 40 }
  ],
  topCustomers: [
    { name: "Global Shipping Co.", revenue: 125000, brand: "Brand 1", orders: 45 },
    { name: "Maritime Solutions", revenue: 98000, brand: "Brand 2", orders: 38 },
    { name: "Ocean Freight Ltd", revenue: 87000, brand: "Brand 1", orders: 32 },
    { name: "Container Express", revenue: 76000, brand: "Brand 3", orders: 28 },
    { name: "Port Authority Inc", revenue: 65000, brand: "Brand 2", orders: 24 }
  ],
  containerTypes: [
    { name: "20ft Standard", value: 245, percentage: 35 },
    { name: "40ft Standard", value: 189, percentage: 27 },
    { name: "40ft High Cube", value: 156, percentage: 22 },
    { name: "20ft Refrigerated", value: 78, percentage: 11 },
    { name: "40ft Refrigerated", value: 32, percentage: 5 }
  ],
  popularRoutes: [
    { route: "Hamburg - Rotterdam", volume: 156, revenue: 285000 },
    { route: "Hamburg - Antwerp", volume: 134, revenue: 245000 },
    { route: "Bremen - Southampton", volume: 98, revenue: 189000 },
    { route: "Bremerhaven - Felixstowe", volume: 87, revenue: 165000 },
    { route: "Hamburg - Le Havre", volume: 76, revenue: 142000 },
    { route: "Rotterdam - Hamburg", volume: 65, revenue: 118000 }
  ]
};

export function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [selectedBrand, setSelectedBrand] = useState<string>("all");

  const brands = ["all", "Brand 1", "Brand 2", "Brand 3", "Brand 4"];

  const exportToCSV = (data: any[], filename: string) => {
    const csvContent = [
      Object.keys(data[0]).join(","),
      ...data.map(row => Object.values(row).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredData = useMemo(() => {
    if (selectedBrand === "all") return mockData;
    
    // Filter data by selected brand
    return {
      ...mockData,
      revenueByBrand: mockData.revenueByBrand.filter(item => item.name === selectedBrand),
      conversionRates: mockData.conversionRates.filter(item => item.brand === selectedBrand),
      topCustomers: mockData.topCustomers.filter(item => item.brand === selectedBrand)
    };
  }, [selectedBrand]);

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (current < previous) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const getConversionBadge = (rate: number) => {
    if (rate >= 70) return <Badge className="bg-green-500">Excellent</Badge>;
    if (rate >= 60) return <Badge className="bg-blue-500">Good</Badge>;
    if (rate >= 50) return <Badge className="bg-yellow-500">Fair</Badge>;
    return <Badge variant="destructive">Poor</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold">Multi-Brand Analytics</h2>
          <p className="text-muted-foreground">Comprehensive business performance overview</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={selectedBrand} onValueChange={setSelectedBrand}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select brand" />
            </SelectTrigger>
            <SelectContent>
              {brands.map(brand => (
                <SelectItem key={brand} value={brand}>
                  {brand === "all" ? "All Brands" : brand}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} -{" "}
                      {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  "Pick a date range"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <Button onClick={() => exportToCSV(mockData.revenueByBrand, "analytics-data")}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            {getTrendIcon(985000, 942000)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€985,000</div>
            <p className="text-xs text-muted-foreground">+4.6% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Quotes</CardTitle>
            {getTrendIcon(245, 223)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">245</div>
            <p className="text-xs text-muted-foreground">+9.9% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Conversion</CardTitle>
            {getTrendIcon(61, 58)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">61%</div>
            <p className="text-xs text-muted-foreground">+5.2% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            {getTrendIcon(148, 142)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">148</div>
            <p className="text-xs text-muted-foreground">+4.2% from last month</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Brand */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Distribution by Brand</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={filteredData.revenueByBrand}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {filteredData.revenueByBrand.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`€${Number(value).toLocaleString()}`, "Revenue"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Quote & Revenue Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={mockData.monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Area yAxisId="left" type="monotone" dataKey="brand1" stackId="1" stroke="#8884d8" fill="#8884d8" />
                  <Area yAxisId="left" type="monotone" dataKey="brand2" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
                  <Area yAxisId="left" type="monotone" dataKey="brand3" stackId="1" stroke="#ffc658" fill="#ffc658" />
                  <Area yAxisId="left" type="monotone" dataKey="brand4" stackId="1" stroke="#ff7c7c" fill="#ff7c7c" />
                  <Line yAxisId="right" type="monotone" dataKey="quotes" stroke="#ff7300" strokeWidth={3} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Conversion Rates */}
        <Card>
          <CardHeader>
            <CardTitle>Conversion Rates by Brand</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredData.conversionRates}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="brand" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="rate" fill="#8884d8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Container Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Container Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockData.containerTypes.map((type, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{type.name}</span>
                      <span className="text-sm text-muted-foreground">{type.value} units</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${type.percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="ml-4 text-sm font-semibold">{type.percentage}%</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle>Top Customers by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Orders</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.topCustomers.map((customer, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{customer.brand}</Badge>
                    </TableCell>
                    <TableCell>€{customer.revenue.toLocaleString()}</TableCell>
                    <TableCell>{customer.orders}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Brand Performance Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Performance Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand</TableHead>
                  <TableHead>Conversion Rate</TableHead>
                  <TableHead>Quotes</TableHead>
                  <TableHead>Performance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockData.conversionRates.map((brand, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{brand.brand}</TableCell>
                    <TableCell>{brand.rate}%</TableCell>
                    <TableCell>{brand.quotes}</TableCell>
                    <TableCell>{getConversionBadge(brand.rate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Popular Routes Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Most Popular Routes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockData.popularRoutes} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="route" type="category" width={150} />
                <Tooltip 
                  formatter={(value, name) => [
                    name === "volume" ? `${value} shipments` : `€${Number(value).toLocaleString()}`,
                    name === "volume" ? "Volume" : "Revenue"
                  ]}
                />
                <Bar dataKey="volume" fill="#8884d8" />
                <Bar dataKey="revenue" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}