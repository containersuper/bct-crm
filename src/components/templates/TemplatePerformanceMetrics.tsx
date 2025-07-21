import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, TrendingDown, Eye, MousePointer, Mail, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TemplatePerformance {
  id: string;
  template_id: string;
  emails_sent: number;
  emails_opened: number;
  emails_clicked: number;
  conversions: number;
  date: string;
  template?: {
    name: string;
    type: string;
    brand: string;
    language: string;
    is_ab_test: boolean;
    ab_test_group?: string;
  };
}

interface PerformanceMetrics {
  template_name: string;
  template_type: string;
  brand: string;
  language: string;
  is_ab_test: boolean;
  ab_test_group?: string;
  total_sent: number;
  total_opened: number;
  total_clicked: number;
  total_conversions: number;
  open_rate: number;
  click_rate: number;
  conversion_rate: number;
  trend: number;
}

const mockTrendData = [
  { date: '2024-01-01', opened: 85, clicked: 23, conversions: 8 },
  { date: '2024-01-02', opened: 92, clicked: 28, conversions: 12 },
  { date: '2024-01-03', opened: 78, clicked: 19, conversions: 6 },
  { date: '2024-01-04', opened: 96, clicked: 31, conversions: 15 },
  { date: '2024-01-05', opened: 88, clicked: 25, conversions: 10 },
  { date: '2024-01-06', opened: 104, clicked: 36, conversions: 18 },
  { date: '2024-01-07', opened: 91, clicked: 27, conversions: 11 }
];

const performanceColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

export function TemplatePerformanceMetrics() {
  const [performanceData, setPerformanceData] = useState<PerformanceMetrics[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("7d");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPerformanceData();
  }, [selectedBrand, selectedType, dateRange]);

  const fetchPerformanceData = async () => {
    setLoading(true);
    try {
      // For demo purposes, we'll use mock data since the performance tracking would need actual email sending
      const mockData: PerformanceMetrics[] = [
        {
          template_name: 'New Quote Notification - EN',
          template_type: 'new_quote',
          brand: 'Brand 1',
          language: 'en',
          is_ab_test: false,
          total_sent: 245,
          total_opened: 186,
          total_clicked: 47,
          total_conversions: 23,
          open_rate: 75.9,
          click_rate: 19.2,
          conversion_rate: 9.4,
          trend: 5.2
        },
        {
          template_name: 'Follow-up Email - EN',
          template_type: 'follow_up',
          brand: 'Brand 1',
          language: 'en',
          is_ab_test: true,
          ab_test_group: 'A',
          total_sent: 189,
          total_opened: 132,
          total_clicked: 28,
          total_conversions: 15,
          open_rate: 69.8,
          click_rate: 14.8,
          conversion_rate: 7.9,
          trend: -2.1
        },
        {
          template_name: 'Follow-up Email - EN (Variant B)',
          template_type: 'follow_up',
          brand: 'Brand 1',
          language: 'en',
          is_ab_test: true,
          ab_test_group: 'B',
          total_sent: 195,
          total_opened: 156,
          total_clicked: 42,
          total_conversions: 28,
          open_rate: 80.0,
          click_rate: 21.5,
          conversion_rate: 14.4,
          trend: 8.7
        },
        {
          template_name: 'Quote Accepted - EN',
          template_type: 'quote_accepted',
          brand: 'Brand 1',
          language: 'en',
          is_ab_test: false,
          total_sent: 156,
          total_opened: 145,
          total_clicked: 89,
          total_conversions: 142,
          open_rate: 92.9,
          click_rate: 57.1,
          conversion_rate: 91.0,
          trend: 12.3
        },
        {
          template_name: 'Invoice Notification - EN',
          template_type: 'invoice',
          brand: 'Brand 1',
          language: 'en',
          is_ab_test: false,
          total_sent: 203,
          total_opened: 178,
          total_clicked: 156,
          total_conversions: 198,
          open_rate: 87.7,
          click_rate: 76.8,
          conversion_rate: 97.5,
          trend: 3.1
        }
      ];

      // Filter by brand and type if selected
      let filteredData = mockData;
      if (selectedBrand !== "all") {
        filteredData = filteredData.filter(item => item.brand === selectedBrand);
      }
      if (selectedType !== "all") {
        filteredData = filteredData.filter(item => item.template_type === selectedType);
      }

      setPerformanceData(filteredData);
    } catch (error) {
      console.error('Error fetching performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return null;
  };

  const getPerformanceBadge = (rate: number, type: 'open' | 'click' | 'conversion') => {
    let thresholds;
    switch (type) {
      case 'open':
        thresholds = { excellent: 80, good: 60, fair: 40 };
        break;
      case 'click':
        thresholds = { excellent: 20, good: 10, fair: 5 };
        break;
      case 'conversion':
        thresholds = { excellent: 15, good: 8, fair: 3 };
        break;
    }

    if (rate >= thresholds.excellent) return <Badge className="bg-green-500">Excellent</Badge>;
    if (rate >= thresholds.good) return <Badge className="bg-blue-500">Good</Badge>;
    if (rate >= thresholds.fair) return <Badge className="bg-yellow-500">Fair</Badge>;
    return <Badge variant="destructive">Poor</Badge>;
  };

  const chartData = performanceData.map(item => ({
    name: item.template_name.substring(0, 20) + '...',
    'Open Rate': item.open_rate,
    'Click Rate': item.click_rate,
    'Conversion Rate': item.conversion_rate
  }));

  const pieData = performanceData.map((item, index) => ({
    name: item.template_type.replace('_', ' '),
    value: item.total_sent,
    fill: performanceColors[index % performanceColors.length]
  }));

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">Template Performance Metrics</h2>
          <p className="text-muted-foreground">Track and analyze email template performance</p>
        </div>
        
        <div className="flex gap-2">
          <Select value={selectedBrand} onValueChange={setSelectedBrand}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Brands" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              <SelectItem value="Brand 1">Brand 1</SelectItem>
              <SelectItem value="Brand 2">Brand 2</SelectItem>
              <SelectItem value="Brand 3">Brand 3</SelectItem>
              <SelectItem value="Brand 4">Brand 4</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="new_quote">New Quote</SelectItem>
              <SelectItem value="follow_up">Follow-up</SelectItem>
              <SelectItem value="quote_accepted">Quote Accepted</SelectItem>
              <SelectItem value="invoice">Invoice</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="12m">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emails Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {performanceData.reduce((sum, item) => sum + item.total_sent, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">+12% from last period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Open Rate</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {performanceData.length > 0 
                ? (performanceData.reduce((sum, item) => sum + item.open_rate, 0) / performanceData.length).toFixed(1)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">+5.2% from last period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Click Rate</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {performanceData.length > 0 
                ? (performanceData.reduce((sum, item) => sum + item.click_rate, 0) / performanceData.length).toFixed(1)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">+2.1% from last period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Conversion Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {performanceData.length > 0 
                ? (performanceData.reduce((sum, item) => sum + item.conversion_rate, 0) / performanceData.length).toFixed(1)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">+8.7% from last period</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Comparison Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Template Performance Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="Open Rate" fill="#8884d8" />
                  <Bar dataKey="Click Rate" fill="#82ca9d" />
                  <Bar dataKey="Conversion Rate" fill="#ffc658" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Email Volume by Type */}
        <Card>
          <CardHeader>
            <CardTitle>Email Volume by Template Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Email Performance Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mockTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="opened" stroke="#8884d8" name="Opens" />
                  <Line type="monotone" dataKey="clicked" stroke="#82ca9d" name="Clicks" />
                  <Line type="monotone" dataKey="conversions" stroke="#ffc658" name="Conversions" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>A/B Test</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Open Rate</TableHead>
                <TableHead>Click Rate</TableHead>
                <TableHead>Conversion Rate</TableHead>
                <TableHead>Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {performanceData.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.template_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {item.template_type.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.brand}</TableCell>
                  <TableCell>
                    {item.is_ab_test ? (
                      <Badge variant="secondary">
                        {item.ab_test_group || 'A/B'}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{item.total_sent}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span>{item.open_rate.toFixed(1)}%</span>
                        </div>
                        <Progress value={item.open_rate} className="h-2" />
                      </div>
                      {getPerformanceBadge(item.open_rate, 'open')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span>{item.click_rate.toFixed(1)}%</span>
                        </div>
                        <Progress value={item.click_rate} className="h-2" />
                      </div>
                      {getPerformanceBadge(item.click_rate, 'click')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span>{item.conversion_rate.toFixed(1)}%</span>
                        </div>
                        <Progress value={item.conversion_rate} className="h-2" />
                      </div>
                      {getPerformanceBadge(item.conversion_rate, 'conversion')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {getTrendIcon(item.trend)}
                      <span className={item.trend > 0 ? 'text-green-600' : item.trend < 0 ? 'text-red-600' : 'text-gray-600'}>
                        {item.trend > 0 ? '+' : ''}{item.trend.toFixed(1)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}