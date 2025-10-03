import React, { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText } from "lucide-react";
import { JobSelect } from "../common/JobSelect";
import { formsApi } from "../../api/forms";
import { toast } from "sonner";

// Form validation schema
const formStartSchema = z.object({
  job_id: z.string().min(1, "Job selection is required"),
  template_id: z.string().min(1, "Form type is required"),
});

type FormStartData = z.infer<typeof formStartSchema>;

interface AdminFormStartModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultJob?: { id: string; label: string };
}

export function AdminFormStartModal({ isOpen, onClose, defaultJob }: AdminFormStartModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const methods = useForm<FormStartData>({
    resolver: zodResolver(formStartSchema),
    defaultValues: {
      job_id: defaultJob?.id || "",
      template_id: "traveller_eviction", // Default form type
    },
  });

  const { handleSubmit, watch, setValue } = methods;
  const selectedTemplateId = watch("template_id");

  const onSubmit = async (data: FormStartData) => {
    try {
      setIsSubmitting(true);

      await formsApi.start({
        job_id: data.job_id,
        template_id: data.template_id,
      });

      toast.success("Form started successfully", {
        description: "The form has been created and is ready for completion.",
      });

      onClose();
    } catch (error) {
      console.error("Failed to start form:", error);
      toast.error("Failed to start form", {
        description: error.message || "Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formTypes = [
    {
      id: "traveller_eviction",
      name: "Traveller Eviction Report",
      description: "Report for traveller eviction operations",
    },
    // Add more form types here as they become available
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-v3-bg-card border border-v3-border rounded-xl shadow-xl"
          >
            <div className="flex items-center justify-between p-6 border-b border-v3-border">
              <h2 className="text-lg font-semibold text-v3-text-lightest flex items-center gap-2">
                <FileText className="w-5 h-5 text-v3-orange" />
                Start New Form
              </h2>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-v3-bg-dark transition-colors"
              >
                <X className="w-5 h-5 text-v3-text-muted" />
              </button>
            </div>

            <FormProvider {...methods}>
              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
                {/* Job Selection */}
                <JobSelect
                  control={methods.control}
                  name="job_id"
                  defaultJob={defaultJob}
                />

                {/* Form Type Selection */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-v3-text">
                    Form Type <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    {formTypes.map((formType) => (
                      <label
                        key={formType.id}
                        className="flex items-center space-x-3 p-3 rounded-lg border border-v3-border hover:border-v3-orange cursor-pointer transition-colors"
                      >
                        <input
                          type="radio"
                          name="template_id"
                          value={formType.id}
                          checked={selectedTemplateId === formType.id}
                          onChange={(e) => setValue("template_id", e.target.value)}
                          className="w-4 h-4 text-v3-orange focus:ring-v3-orange"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-v3-text-lightest">
                            {formType.name}
                          </div>
                          <div className="text-sm text-v3-text-muted">
                            {formType.description}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  {methods.formState.errors.template_id && (
                    <p className="text-sm text-red-500">
                      {methods.formState.errors.template_id.message}
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2 bg-v3-bg-dark border border-v3-border rounded-lg text-v3-text hover:border-v3-orange transition-colors"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-v3-orange text-white rounded-lg hover:bg-v3-orange-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Starting..." : "Start Form"}
                  </button>
                </div>
              </form>
            </FormProvider>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
