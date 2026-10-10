import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Loader2 } from "lucide-react";
import { useAuth } from "@/useAuth";
import { toast } from "sonner";

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time

export default function Notices() {
  const { apiCall } = useAuth();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState("");
  const [values, setValues] = useState({});
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(null); // { url, filename } of the last notice generated

  useEffect(() => {
    loadNotices();
  }, []);

  // Free the previous PDF when a new one replaces it or the page closes
  useEffect(() => () => {
    if (preview) window.URL.revokeObjectURL(preview.url);
  }, [preview]);

  const loadNotices = async () => {
    try {
      const response = await apiCall("/admin/notices/types");
      setNotices(response.notices);
      const first = response.notices.find((notice) => notice.available);
      if (first) setSelectedType(first.key);
    } catch (err) {
      toast.error("Failed to load notices");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const notice = notices.find((n) => n.key === selectedType);
  const fields = notice?.fields || [];
  // Answers are kept by field name, so they carry over when another notice asks the same question
  const valueOf = (field) => values[field.name] ?? (field.type === "date" ? today() : "");
  const setValue = (name, value) => setValues((prev) => ({ ...prev, [name]: value }));
  const complete = fields.every((field) => valueOf(field).trim());

  const generate = async () => {
    try {
      setGenerating(true);
      const blob = await apiCall("/admin/notices/generate", {
        method: "POST",
        responseType: "blob",
        body: JSON.stringify({
          type: selectedType,
          values: Object.fromEntries(fields.map((field) => [field.name, valueOf(field).trim()])),
        }),
      });
      setPreview({
        url: window.URL.createObjectURL(blob),
        filename: `${notice.label} - ${(values.address || "").replace(/[\\/:*?"<>|\r\n]+/g, " ").trim()}.pdf`,
      });
      toast.success("Notice ready");
    } catch (err) {
      toast.error("Failed to generate notice");
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notices</h1>
        <p className="text-muted-foreground mt-2">
          Choose a notice, fill in the details and print it ready to serve
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create a Notice</CardTitle>
          <CardDescription>
            Notices name the landowner only and carry no company details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Notice</label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a notice" />
              </SelectTrigger>
              <SelectContent>
                {notices.map((n) => (
                  <SelectItem key={n.key} value={n.key} disabled={!n.available}>
                    {n.label}{!n.available && " (wording to be added)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {fields.map((field) => (
            <div key={field.name}>
              <label className="text-sm font-medium mb-2 block" htmlFor={`notice-${field.name}`}>{field.label}</label>
              {field.type === "textarea" ? (
                <Textarea
                  id={`notice-${field.name}`}
                  rows={2}
                  maxLength={field.max}
                  value={valueOf(field)}
                  onChange={(e) => setValue(field.name, e.target.value)}
                />
              ) : (
                <Input
                  id={`notice-${field.name}`}
                  type={field.type}
                  maxLength={field.max}
                  value={valueOf(field)}
                  onChange={(e) => setValue(field.name, e.target.value)}
                />
              )}
            </div>
          ))}

          <Button onClick={generate} disabled={!notice?.available || !complete || generating}>
            {generating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            Generate Notice
          </Button>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Your Notice</CardTitle>
              <CardDescription>Check it, then download to print</CardDescription>
            </div>
            <Button asChild>
              <a href={preview.url} download={preview.filename}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </a>
            </Button>
          </CardHeader>
          <CardContent>
            {/* Phones don't show PDFs inline, so the preview is for larger screens */}
            <iframe
              title="Notice preview"
              src={preview.url}
              className="hidden md:block w-full h-[900px] rounded border border-border bg-white"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
