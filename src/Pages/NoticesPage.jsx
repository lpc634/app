import { useState, useEffect } from 'react';
import { useAuth } from '@/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function NoticesPage() {
  const { apiCall } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await apiCall('/admin/notices/types');
      setTemplates(response.templates || []);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Failed to load notice templates');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async (template) => {
    try {
      setDownloadingTemplate(template.id);

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api${template.download_url}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download template');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template.name.replace(/\s+/g, '_')}_Template.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Template downloaded successfully');
    } catch (error) {
      console.error('Error downloading template:', error);
      toast.error('Failed to download template');
    } finally {
      setDownloadingTemplate(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Notices</h1>
        <p className="text-muted-foreground">
          Download notice templates for V3 Services
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Notice</CardTitle>
          <CardDescription>
            Choose a notice template to download. Edit in Word, then save as PDF.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            onValueChange={(value) => {
              const template = templates.find(t => t.id === value);
              if (template) {
                handleDownloadTemplate(template);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a notice..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map(template => (
                <SelectItem key={template.id} value={template.id}>
                  <div className="flex items-center gap-2">
                    <FileDown className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">{template.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {downloadingTemplate && (
            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Downloading template...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
