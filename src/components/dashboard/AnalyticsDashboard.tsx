import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, Download, TrendingUp, TrendingDown, Minus, RefreshCw, Loader2 } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { useTeamLeaderData } from "@/hooks/useTeamLeaderData";
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

export function AnalyticsDashboard() {
  const { data: teamLeaderData, loading, error, refetch } = useTeamLeaderData();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [selectedBrand, setSelectedBrand] = useState<string>("all");

  const brands = ["all", "ACM", "BCT", "HR", "Contiflex", "Other"];

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

  const chartData = useMemo(() => {
    if (!teamLeaderData) return null;

    // Prepare revenue by brand data
    const revenueByBrand = Object.entries(teamLeaderData.brands)
      .filter(([brand, data]) => selectedBrand === "all" || brand === selectedBrand)
      .map(([brand, data], index) => ({
        name: brand,
        value: data.totalValue,
        color: ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'][index % 5]
      }));

    // Prepare conversion rates (simplified)
    const conversionRates = Object.entries(teamLeaderData.brands)
      .filter(([brand]) => selectedBrand === "all" || brand === selectedBrand)
      .map(([brand, data]) => ({
        brand,
        rate: data.quotes > 0 ? Math.round((data.deals / data.quotes) * 100) : 0,
        quotes: data.quotes,
        deals: data.deals
      }));

    return {
      revenueByBrand,
      conversionRates,
      monthlyTrends: teamLeaderData.monthlyTrends,
      containerTypes: teamLeaderData.containerTypes,
      regions: Object.entries(teamLeaderData.regions).map(([region, data]) => ({
        region,
        deals: data.deals,
        value: data.totalValue
      }))
    };
  }, [teamLeaderData, selectedBrand]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading TeamLeader data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        <span>Error loading data: {error}</span>
        <Button onClick={refetch} variant="outline" className="ml-2">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!teamLeaderData || !chartData) {
    return (
      <div className="flex items-center justify-center h-64">
        <span>No data available</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold">TeamLeader Analytics Dashboard</h2>
          <p className="text-muted-foreground">Real-time container logistics performance across brands and regions</p>
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

          <Button onClick={refetch} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button onClick={() => exportToCSV(chartData.revenueByBrand, "teamleader-analytics")}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{teamLeaderData.totals.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">From {teamLeaderData.totals.deals} deals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Angebote (Quotes)</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamLeaderData.totals.quotes}</div>
            <p className="text-xs text-muted-foreground">Active quotes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aufträge (Deals)</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamLeaderData.totals.deals}</div>
            <p className="text-xs text-muted-foreground">Total deals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rechnungen (Invoices)</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamLeaderData.totals.invoices}</div>
            <p className="text-xs text-muted-foreground">Total invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamLeaderData.totals.customers}</div>
            <p className="text-xs text-muted-foreground">Total customers</p>
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
                    data={chartData.revenueByBrand}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.revenueByBrand.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`€${Number(value).toLocaleString()}`, "Revenue"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Regional Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Regionale Verteilung (Regional Distribution)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.regions}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="region" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === "deals" ? `${value} deals` : `€${Number(value).toLocaleString()}`,
                      name === "deals" ? "Deals" : "Value"
                    ]}
                  />
                  <Bar dataKey="deals" fill="#8884d8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="value" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Brand Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Performance Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.conversionRates}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="brand" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === "rate" ? `${value}%` : value,
                      name === "rate" ? "Conversion Rate" : "Count"
                    ]}
                  />
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
              {teamLeaderData.containerTypes.length > 0 ? (
                teamLeaderData.containerTypes.map((type, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{type.name}</span>
                        <span className="text-sm text-muted-foreground">{type.count} units</span>
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
                ))
              ) : (
                <div className="text-center text-muted-foreground">
                  No container type data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Brand Analysis Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Brand Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand</TableHead>
                  <TableHead>Customers</TableHead>
                  <TableHead>Deals</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(teamLeaderData.brands)
                  .filter(([brand]) => selectedBrand === "all" || brand === selectedBrand)
                  .map(([brand, data]) => (
                    <TableRow key={brand}>
                      <TableCell className="font-medium">
                        <Badge variant="outline">{brand}</Badge>
                      </TableCell>
                      <TableCell>{data.customers}</TableCell>
                      <TableCell>{data.deals}</TableCell>
                      <TableCell>€{data.totalValue.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Regional Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Regional Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Region</TableHead>
                  <TableHead>Deals</TableHead>
                  <TableHead>Total Value</TableHead>
                  <TableHead>Avg. Deal Size</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(teamLeaderData.regions).map(([region, data]) => (
                  <TableRow key={region}>
                    <TableCell className="font-medium">
                      <Badge variant="outline">{region}</Badge>
                    </TableCell>
                    <TableCell>{data.deals}</TableCell>
                    <TableCell>€{data.totalValue.toLocaleString()}</TableCell>
                    <TableCell>
                      €{data.deals > 0 ? Math.round(data.totalValue / data.deals).toLocaleString() : 0}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Container & Logistics Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Container & Logistics Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {teamLeaderData.containerTypes.reduce((sum, type) => sum + type.count, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Total Containers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {Object.keys(teamLeaderData.regions).length}
              </div>
              <div className="text-sm text-muted-foreground">Active Regions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                €{teamLeaderData.totals.totalRevenue > 0 ? 
                  Math.round(teamLeaderData.totals.totalRevenue / Math.max(teamLeaderData.totals.deals, 1)).toLocaleString() : 0}
              </div>
              <div className="text-sm text-muted-foreground">Avg Deal Value</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}