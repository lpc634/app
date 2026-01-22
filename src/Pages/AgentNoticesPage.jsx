import { useState, useEffect } from 'react';
import { useAuth } from '@/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function AgentNoticesPage() {
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
      const response = await apiCall('/notices/types');
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
    <div className="container mx-auto p-4 md:p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Notices</h1>
        <p className="text-muted-foreground">
          Download notice templates for site visits
        </p>
      </div>

      {/* Instructions Card */}
      <Card className="mb-6 border-orange-500/50 bg-orange-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            How to Use Notice Templates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p><strong>1. Download the template</strong> - Select a notice from the dropdown below</p>
          <p><strong>2. Open in Word</strong> - The file will download as a Word document (.docx)</p>
          <p><strong>3. Edit the following details:</strong></p>
          <ul className="list-disc list-inside pl-4 space-y-1 text-muted-foreground">
            <li><strong>Property Address</strong> - Replace with the actual site address</li>
            <li><strong>Landowner Name</strong> - Replace with the client/landowner name</li>
            <li><strong>Vacate Date & Time</strong> - Set the deadline for vacating</li>
            <li><strong>Date Served</strong> - Update to today's date</li>
          </ul>
          <p><strong>4. Save as PDF</strong> - Once edited, save/print as PDF for the site</p>
        </CardContent>
      </Card>

      {/* Template Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Notice</CardTitle>
          <CardDescription>
            Choose a notice template to download
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
