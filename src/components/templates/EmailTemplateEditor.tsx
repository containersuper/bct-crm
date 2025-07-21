import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Eye, Save, Copy, Trash2, Plus, Settings, BarChart3, Upload, Download } from "lucide-react";
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
  variables: string[] | any;
  is_active: boolean;
  is_ab_test: boolean;
  ab_test_group?: string;
  version: number;
  created_at: string;
  updated_at: string;
}

interface TemplateFormData {
  name: string;
  type: EmailTemplate['type'];
  brand: string;
  language: EmailTemplate['language'];
  subject: string;
  content: string;
  is_ab_test: boolean;
  ab_test_group?: string;
}

const templateTypes = [
  { value: 'new_quote', label: 'New Quote' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'quote_accepted', label: 'Quote Accepted' },
  { value: 'invoice', label: 'Invoice' }
];

const languages = [
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'nl', label: 'Nederlands', flag: '🇳🇱' }
];

const brands = ['Brand 1', 'Brand 2', 'Brand 3', 'Brand 4'];

const commonVariables = [
  'customer_name', 'quote_number', 'total_amount', 'valid_until', 
  'brand_name', 'quote_date', 'invoice_number', 'invoice_amount', 
  'due_date', 'company_name', 'customer_email'
];

const sampleData = {
  customer_name: 'John Smith',
  quote_number: 'Q-2024-001',
  total_amount: '€2,500.00',
  valid_until: '2024-02-15',
  brand_name: 'Container Express',
  quote_date: '2024-01-15',
  invoice_number: 'INV-2024-001',
  invoice_amount: '€2,500.00',
  due_date: '2024-02-14',
  company_name: 'Global Shipping Ltd',
  customer_email: 'john.smith@globalshipping.com'
};

export function EmailTemplateEditor() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    type: 'new_quote',
    brand: 'Brand 1',
    language: 'en',
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
        .order('created_at', { ascending: false });

      if (error) throw error;
      const templatesWithParsedVariables = (data || []).map(template => ({
        ...template,
        variables: Array.isArray(template.variables) ? template.variables : JSON.parse(template.variables as string || '[]')
      }));
      setTemplates(templatesWithParsedVariables);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to fetch templates');
    } finally {
      setLoading(false);
    }
  };

  const detectVariables = (text: string): string[] => {
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (!matches.includes(match[1].trim())) {
        matches.push(match[1].trim());
      }
    }
    return matches;
  };

  const substituteVariables = (content: string): string => {
    let substituted = content;
    Object.entries(sampleData).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      substituted = substituted.replace(regex, value);
    });
    return substituted;
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const variables = [
        ...detectVariables(formData.subject),
        ...detectVariables(formData.content)
      ];

      const templateData = {
        ...formData,
        variables: variables,
        is_active: true
      };

      let result;
      if (selectedTemplate) {
        result = await supabase
          .from('email_templates')
          .update(templateData)
          .eq('id', selectedTemplate.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('email_templates')
          .insert(templateData)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      toast.success(selectedTemplate ? 'Template updated!' : 'Template created!');
      setIsEditing(false);
      setSelectedTemplate(null);
      fetchTemplates();
      resetForm();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast.success('Template deleted!');
      fetchTemplates();
      setSelectedTemplate(null);
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  const handleEdit = (template: EmailTemplate) => {
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
  };

  const handleDuplicate = (template: EmailTemplate) => {
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
  };

  const insertVariable = (variable: string) => {
    const textarea = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentContent = formData.content;
      const newContent = currentContent.slice(0, start) + `{{${variable}}}` + currentContent.slice(end);
      
      setFormData(prev => ({ ...prev, content: newContent }));
      
      // Restore cursor position
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + variable.length + 4;
        textarea.focus();
      }, 0);
    }
  };

  const exportTemplates = () => {
    const dataStr = JSON.stringify(templates, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'email-templates.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const getTemplateTypeLabel = (type: string) => {
    return templateTypes.find(t => t.value === type)?.label || type;
  };

  const getLanguageLabel = (lang: string) => {
    const language = languages.find(l => l.value === lang);
    return language ? `${language.flag} ${language.label}` : lang;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Email Template Management</h2>
          <p className="text-muted-foreground">Create and manage email templates for your business communications</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportTemplates}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => { resetForm(); setIsEditing(true); setSelectedTemplate(null); }}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Templates</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedTemplate?.id === template.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-medium text-sm truncate">{template.name}</h4>
                      <div className="flex gap-1">
                        {template.is_ab_test && <Badge variant="secondary" className="text-xs">A/B</Badge>}
                        {!template.is_active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span>{getTemplateTypeLabel(template.type)}</span>
                      <span>{getLanguageLabel(template.language)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
                      <span>{template.brand}</span>
                      <span>v{template.version}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Editor/Preview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>
                {isEditing ? (selectedTemplate ? 'Edit Template' : 'New Template') : 'Template Preview'}
              </CardTitle>
              <div className="flex gap-2">
                {selectedTemplate && !isEditing && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(selectedTemplate)}>
                      <Settings className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDuplicate(selectedTemplate)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Duplicate
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Template</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{selectedTemplate.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(selectedTemplate.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
                
                {isEditing && (
                  <>
                    <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
                      <Eye className="mr-2 h-4 w-4" />
                      {showPreview ? 'Hide' : 'Show'} Preview
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                      <Save className="mr-2 h-4 w-4" />
                      Save
                    </Button>
                    <Button variant="outline" onClick={() => { setIsEditing(false); setShowPreview(false); }}>
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <Tabs defaultValue="editor" value={showPreview ? "preview" : "editor"}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="editor" onClick={() => setShowPreview(false)}>Editor</TabsTrigger>
                  <TabsTrigger value="preview" onClick={() => setShowPreview(true)}>Preview</TabsTrigger>
                </TabsList>

                <TabsContent value="editor" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Template Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter template name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="type">Type</Label>
                      <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as any }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {templateTypes.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="brand">Brand</Label>
                      <Select value={formData.brand} onValueChange={(value) => setFormData(prev => ({ ...prev, brand: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {brands.map(brand => (
                            <SelectItem key={brand} value={brand}>
                              {brand}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="language">Language</Label>
                      <Select value={formData.language} onValueChange={(value) => setFormData(prev => ({ ...prev, language: value as any }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {languages.map(lang => (
                            <SelectItem key={lang.value} value={lang.value}>
                              {lang.flag} {lang.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={formData.is_ab_test}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_ab_test: checked }))}
                    />
                    <Label>A/B Test Template</Label>
                  </div>

                  {formData.is_ab_test && (
                    <div>
                      <Label htmlFor="ab_test_group">A/B Test Group</Label>
                      <Input
                        id="ab_test_group"
                        value={formData.ab_test_group}
                        onChange={(e) => setFormData(prev => ({ ...prev, ab_test_group: e.target.value }))}
                        placeholder="e.g., A, B, Control"
                      />
                    </div>
                  )}

                  <div>
                    <Label htmlFor="subject">Email Subject</Label>
                    <Input
                      id="subject"
                      value={formData.subject}
                      onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                      placeholder="Enter email subject with variables like {{customer_name}}"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label htmlFor="content">Email Content</Label>
                      <div className="text-sm text-muted-foreground">
                        Variables: {[...detectVariables(formData.subject), ...detectVariables(formData.content)].join(', ') || 'None'}
                      </div>
                    </div>
                    <Textarea
                      id="content"
                      name="content"
                      value={formData.content}
                      onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Enter email content with HTML formatting..."
                      rows={12}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div>
                    <Label>Available Variables</Label>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {commonVariables.map(variable => (
                        <Button
                          key={variable}
                          variant="outline"
                          size="sm"
                          onClick={() => insertVariable(variable)}
                          className="text-xs"
                        >
                          {variable}
                        </Button>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="preview" className="space-y-4">
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <div className="mb-4 pb-4 border-b">
                      <div className="text-sm text-muted-foreground mb-1">Subject:</div>
                      <div className="font-semibold">{substituteVariables(formData.subject)}</div>
                    </div>
                    <div 
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: substituteVariables(formData.content) }}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            ) : selectedTemplate ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <div className="font-medium">{getTemplateTypeLabel(selectedTemplate.type)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Brand:</span>
                    <div className="font-medium">{selectedTemplate.brand}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Language:</span>
                    <div className="font-medium">{getLanguageLabel(selectedTemplate.language)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Version:</span>
                    <div className="font-medium">v{selectedTemplate.version}</div>
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="mb-4 pb-4 border-b">
                    <div className="text-sm text-muted-foreground mb-1">Subject:</div>
                    <div className="font-semibold">{substituteVariables(selectedTemplate.subject)}</div>
                  </div>
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: substituteVariables(selectedTemplate.content) }}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Variables:</span>
                    <div className="mt-1">
                      {selectedTemplate.variables.map(variable => (
                        <Badge key={variable} variant="outline" className="mr-1 mb-1">
                          {variable}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Updated:</span>
                    <div className="font-medium">{new Date(selectedTemplate.updated_at).toLocaleDateString()}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Settings className="mx-auto h-12 w-12 mb-4" />
                <p>Select a template to view or create a new one</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}