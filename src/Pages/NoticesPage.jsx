import { useState, useEffect } from 'react';
import { useAuth } from '@/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Printer, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function NoticesPage() {
  const { apiCall } = useAuth();
  const [noticeTypes, setNoticeTypes] = useState([]);
  const [selectedNoticeType, setSelectedNoticeType] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadNoticeTypes();
  }, []);

  const loadNoticeTypes = async () => {
    try {
      setLoading(true);
      const response = await apiCall('/admin/notices/types');
      setNoticeTypes(response);
    } catch (error) {
      console.error('Error loading notice types:', error);
      toast.error('Failed to load notice types');
    } finally {
      setLoading(false);
    }
  };

  const handleNoticeTypeChange = (noticeTypeId) => {
    const noticeType = noticeTypes.find(nt => nt.id === noticeTypeId);
    setSelectedNoticeType(noticeType);
    
    // Initialize form data with default values
    const initialFormData = {};
    noticeType?.fields.forEach(field => {
      if (field.default) {
        initialFormData[field.name] = field.default;
      } else if (field.type === 'date') {
        initialFormData[field.name] = new Date().toISOString().split('T')[0];
      } else {
        initialFormData[field.name] = '';
      }
    });
    setFormData(initialFormData);
  };

  const handleFieldChange = (fieldName, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleGenerateNotice = async () => {
    // Validate required fields
    const missingFields = selectedNoticeType.fields
      .filter(field => field.required && !formData[field.name])
      .map(field => field.label);

    if (missingFields.length > 0) {
      toast.error(`Please fill in required fields: ${missingFields.join(', ')}`);
      return;
    }

    try {
      setGenerating(true);
      
      // Use apiCall instead of fetch to handle auth and base URL properly
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/admin/notices/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`  // Fixed: use 'token' not 'jwt_token'
        },
        body: JSON.stringify({
          notice_type: selectedNoticeType.id,
          data: formData
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate notice');
      }

      // Get the blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedNoticeType.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Notice generated successfully');
    } catch (error) {
      console.error('Error generating notice:', error);
      toast.error('Failed to generate notice');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrintNotice = async () => {
    // Validate required fields
    const missingFields = selectedNoticeType.fields
      .filter(field => field.required && !formData[field.name])
      .map(field => field.label);

    if (missingFields.length > 0) {
      toast.error(`Please fill in required fields: ${missingFields.join(', ')}`);
      return;
    }

    try {
      setGenerating(true);
      
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/admin/notices/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`  // Fixed: use 'token' not 'jwt_token'
        },
        body: JSON.stringify({
          notice_type: selectedNoticeType.id,
          data: formData
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate notice');
      }

      // Get the blob from response
      const blob = await response.blob();
      
      // Create a URL for the blob and open in new window for printing
      const url = window.URL.createObjectURL(blob);
      const printWindow = window.open(url);
      
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }

      toast.success('Opening print dialog...');
    } catch (error) {
      console.error('Error generating notice:', error);
      toast.error('Failed to generate notice');
    } finally {
      setGenerating(false);
    }
  };

  const renderField = (field) => {
    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            value={formData[field.name] || ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.label}
            rows={4}
          />
        );
      case 'date':
        return (
          <Input
            type="date"
            value={formData[field.name] || ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
          />
        );
      case 'email':
        return (
          <Input
            type="email"
            value={formData[field.name] || ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.label}
          />
        );
      default:
        return (
          <Input
            type="text"
            value={formData[field.name] || ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.label}
          />
        );
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
          Generate professional legal notices and reports for V3 Services
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Notice Type</CardTitle>
          <CardDescription>
            Choose the type of notice you want to generate
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedNoticeType?.id} onValueChange={handleNoticeTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a notice type..." />
            </SelectTrigger>
            <SelectContent>
              {noticeTypes.map(noticeType => (
                <SelectItem key={noticeType.id} value={noticeType.id}>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <div>
                      <div className="font-medium">{noticeType.name}</div>
                      <div className="text-sm text-muted-foreground">{noticeType.description}</div>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedNoticeType && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{selectedNoticeType.name}</CardTitle>
              <CardDescription>{selectedNoticeType.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedNoticeType.fields.map(field => (
                <div key={field.name} className="space-y-2">
                  <Label htmlFor={field.name}>
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  {renderField(field)}
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              onClick={handleGenerateNotice}
              disabled={generating}
              className="flex-1"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download Notice
                </>
              )}
            </Button>
            <Button
              onClick={handlePrintNotice}
              disabled={generating}
              variant="outline"
              className="flex-1"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Printer className="mr-2 h-4 w-4" />
                  Print Notice
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
