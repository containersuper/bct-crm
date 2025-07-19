import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Eye, 
  Save, 
  Copy, 
  Edit, 
  Trash2, 
  Plus, 
  FileText, 
  Globe, 
  BarChart3, 
  Zap,
  History,
  Upload,
  Download
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmailTemplate {
  id: string;
  name: string;
  type: 'new_quote' | 'follow_up' | 'quote_accepted' | 'invoice';
  brand: string;
  language: 'en' | 'de' | 'fr' | 'nl';
  subject: string;
  content: string;
  variables: any[];
  is_active: boolean;
  is_ab_test: boolean;
  ab_test_group?: string;
  version: number;
  created_at: string;
  updated_at: string;
}

interface TemplatePerformance {
  emails_sent: number;
  emails_opened: number;
  emails_clicked: number;
  conversions: number;
}

const templateTypes = [
  { value: 'new_quote', label: 'New Quote' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'quote_accepted', label: 'Quote Accepted' },
  { value: 'invoice', label: 'Invoice' }
];

const languages = [
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'nl', label: 'Nederlands', flag: '🇳🇱' }
];

const brands = ['Brand 1', 'Brand 2', 'Brand 3', 'Brand 4'];

const defaultVariables = {
  new_quote: ['customer_name', 'quote_number', 'total_amount', 'valid_until', 'brand_name'],
  follow_up: ['customer_name', 'quote_number', 'quote_date', 'valid_until', 'brand_name'],
  quote_accepted: ['customer_name', 'quote_number', 'brand_name'],
  invoice: ['customer_name', 'invoice_number', 'quote_number', 'invoice_amount', 'due_date', 'brand_name']
};

const sampleData = {
  customer_name: 'John Smith',
  quote_number: 'Q-2024-001',
  total_amount: '€2,850.00',
  valid_until: '2024-02-15',
  brand_name: 'Ocean Freight Solutions',
  quote_date: '2024-01-15',
  invoice_number: 'INV-2024-001',
  invoice_amount: '€2,850.00',
  due_date: '2024-02-15'
};

export function EmailTemplateManager() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [activeTab, setActiveTab] = useState('templates');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'new_quote' as EmailTemplate['type'],
    brand: 'Brand 1',
    language: 'en' as EmailTemplate['language'],
    subject: '',
    content: '',
    is_ab_test: false,
    ab_test_group: ''
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setTemplates((data || []).map(template => ({
        ...template,
        variables: Array.isArray(template.variables) ? template.variables : JSON.parse(template.variables as string || '[]')
      })));
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to fetch email templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    try {
      const variables = defaultVariables[formData.type];
      
      if (selectedTemplate) {
        // Update existing template
        const { error } = await supabase
          .from('email_templates')
          .update({
            name: formData.name,
            type: formData.type,
            brand: formData.brand,
            language: formData.language,
            subject: formData.subject,
            content: formData.content,
            variables: JSON.stringify(variables),
            is_ab_test: formData.is_ab_test,
            ab_test_group: formData.ab_test_group || null
          })
          .eq('id', selectedTemplate.id);

        if (error) throw error;
        toast.success('Template updated successfully');
      } else {
        // Create new template
        const { error } = await supabase
          .from('email_templates')
          .insert({
            name: formData.name,
            type: formData.type,
            brand: formData.brand,
            language: formData.language,
            subject: formData.subject,
            content: formData.content,
            variables: JSON.stringify(variables),
            is_ab_test: formData.is_ab_test,
            ab_test_group: formData.ab_test_group || null
          });

        if (error) throw error;
        toast.success('Template created successfully');
      }

      fetchTemplates();
      resetForm();
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      
      toast.success('Template deleted successfully');
      fetchTemplates();
      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  const handleCloneTemplate = (template: EmailTemplate) => {
    setFormData({
      name: `${template.name} (Copy)`,
      type: template.type,
      brand: template.brand,
      language: template.language,
      subject: template.subject,
      content: template.content,
      is_ab_test: false,
      ab_test_group: ''
    });
    setSelectedTemplate(null);
    setIsEditing(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'new_quote',
      brand: 'Brand 1',
      language: 'en',
      subject: '',
      content: '',
      is_ab_test: false,
      ab_test_group: ''
    });
    setSelectedTemplate(null);
  };

  const renderPreview = () => {
    if (!selectedTemplate) return null;

    let previewSubject = selectedTemplate.subject;
    let previewContent = selectedTemplate.content;

    // Replace variables with sample data
    Object.entries(sampleData).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      previewSubject = previewSubject.replace(regex, value);
      previewContent = previewContent.replace(regex, value);
    });

    return (
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Subject:</Label>
          <div className="p-3 border rounded-md bg-muted">{previewSubject}</div>
        </div>
        <div>
          <Label className="text-sm font-medium">Content:</Label>
          <div 
            className="p-4 border rounded-md bg-white min-h-[200px]"
            dangerouslySetInnerHTML={{ __html: previewContent }}
          />
        </div>
      </div>
    );
  };

  const filteredTemplates = useMemo(() => {
    return templates;
  }, [templates]);

  const getPerformanceMetrics = (template: EmailTemplate): TemplatePerformance => {
    // Mock performance data - in real app, fetch from email_template_performance table
    return {
      emails_sent: Math.floor(Math.random() * 1000) + 100,
      emails_opened: Math.floor(Math.random() * 500) + 50,
      emails_clicked: Math.floor(Math.random() * 100) + 10,
      conversions: Math.floor(Math.random() * 50) + 5
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Email Template Manager</h2>
          <p className="text-muted-foreground">Create and manage email templates with multi-language support</p>
        </div>
        <Button onClick={() => { resetForm(); setIsEditing(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="ab-testing">A/B Testing</TabsTrigger>
        </TabsList>

        {/* Templates List */}
        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Email Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {filteredTemplates.map((template) => (
                  <div key={template.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium">{template.name}</h3>
                        <Badge variant="outline">{templateTypes.find(t => t.value === template.type)?.label}</Badge>
                        <Badge variant="secondary">{template.brand}</Badge>
                        <span className="text-lg">{languages.find(l => l.value === template.language)?.flag}</span>
                        {template.is_ab_test && <Badge className="bg-purple-500">A/B Test</Badge>}
                        {!template.is_active && <Badge variant="destructive">Inactive</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">v{template.version} • Last updated: {new Date(template.updated_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => { setSelectedTemplate(template); setPreviewMode(true); }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedTemplate(template);
                          setFormData({
                            name: template.name,
                            type: template.type,
                            brand: template.brand,
                            language: template.language,
                            subject: template.subject,
                            content: template.content,
                            is_ab_test: template.is_ab_test,
                            ab_test_group: template.ab_test_group || ''
                          });
                          setIsEditing(true);
                          setActiveTab('editor');
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleCloneTemplate(template)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteTemplate(template.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Template Editor */}
        <TabsContent value="editor">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Template Editor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Template Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter template name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="type">Template Type</Label>
                    <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {templateTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="brand">Brand</Label>
                    <Select value={formData.brand} onValueChange={(value) => setFormData({ ...formData, brand: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {brands.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="language">Language</Label>
                    <Select value={formData.language} onValueChange={(value: any) => setFormData({ ...formData, language: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {languages.map((lang) => (
                          <SelectItem key={lang.value} value={lang.value}>
                            {lang.flag} {lang.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="subject">Email Subject</Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Enter email subject"
                  />
                </div>

                <div>
                  <Label htmlFor="content">Email Content</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Enter email content (HTML supported)"
                    rows={10}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={formData.is_ab_test}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_ab_test: checked })}
                    />
                    <Label>Enable A/B Testing</Label>
                  </div>

                  {formData.is_ab_test && (
                    <div>
                      <Label htmlFor="ab_test_group">A/B Test Group</Label>
                      <Input
                        id="ab_test_group"
                        value={formData.ab_test_group}
                        onChange={(e) => setFormData({ ...formData, ab_test_group: e.target.value })}
                        placeholder="Enter test group name (e.g., A, B)"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <Label>Available Variables</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {defaultVariables[formData.type].map((variable) => (
                      <Badge key={variable} variant="outline" className="cursor-pointer">
                        {`{{${variable}}}`}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSaveTemplate} disabled={!formData.name || !formData.subject || !formData.content}>
                    <Save className="mr-2 h-4 w-4" />
                    Save Template
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent>
                {formData.subject || formData.content ? (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Subject:</Label>
                      <div className="p-3 border rounded-md bg-muted">
                        {formData.subject.replace(/{{(\w+)}}/g, (match, key) => sampleData[key as keyof typeof sampleData] || match)}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Content:</Label>
                      <div 
                        className="p-4 border rounded-md bg-white min-h-[200px]"
                        dangerouslySetInnerHTML={{ 
                          __html: formData.content.replace(/{{(\w+)}}/g, (match, key) => sampleData[key as keyof typeof sampleData] || match)
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    Start editing to see preview
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Analytics */}
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Template Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Opened</TableHead>
                    <TableHead>Clicked</TableHead>
                    <TableHead>Conversions</TableHead>
                    <TableHead>Open Rate</TableHead>
                    <TableHead>Click Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => {
                    const metrics = getPerformanceMetrics(template);
                    const openRate = ((metrics.emails_opened / metrics.emails_sent) * 100).toFixed(1);
                    const clickRate = ((metrics.emails_clicked / metrics.emails_sent) * 100).toFixed(1);
                    
                    return (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {templateTypes.find(t => t.value === template.type)?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{metrics.emails_sent}</TableCell>
                        <TableCell>{metrics.emails_opened}</TableCell>
                        <TableCell>{metrics.emails_clicked}</TableCell>
                        <TableCell>{metrics.conversions}</TableCell>
                        <TableCell>
                          <Badge variant={parseFloat(openRate) > 25 ? "default" : "secondary"}>
                            {openRate}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={parseFloat(clickRate) > 5 ? "default" : "secondary"}>
                            {clickRate}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* A/B Testing */}
        <TabsContent value="ab-testing">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                A/B Testing Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {templates.filter(t => t.is_ab_test).map((template) => {
                  const metrics = getPerformanceMetrics(template);
                  const openRate = ((metrics.emails_opened / metrics.emails_sent) * 100).toFixed(1);
                  
                  return (
                    <div key={template.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-medium">{template.name}</h3>
                          <p className="text-sm text-muted-foreground">Group: {template.ab_test_group}</p>
                        </div>
                        <Badge className="bg-purple-500">Active Test</Badge>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold">{metrics.emails_sent}</div>
                          <div className="text-sm text-muted-foreground">Sent</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold">{openRate}%</div>
                          <div className="text-sm text-muted-foreground">Open Rate</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold">{metrics.conversions}</div>
                          <div className="text-sm text-muted-foreground">Conversions</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold">
                            {((metrics.conversions / metrics.emails_sent) * 100).toFixed(1)}%
                          </div>
                          <div className="text-sm text-muted-foreground">Conv. Rate</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {templates.filter(t => t.is_ab_test).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No A/B tests currently running
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={previewMode} onOpenChange={setPreviewMode}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
          </DialogHeader>
          {renderPreview()}
        </DialogContent>
      </Dialog>
    </div>
  );
}