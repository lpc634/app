import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

// --- STYLES & ANIMATIONS ---
const ANIMATION_STYLES = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-up {
    opacity: 0;
    animation: fadeUp 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  }
  .delay-100 { animation-delay: 0.1s; }
  .delay-200 { animation-delay: 0.2s; }
  .delay-300 { animation-delay: 0.3s; }

  /* Focus Ring - Orange match */
  .focus-ring:focus-within {
    border-color: #ee722e;
    box-shadow: 0 0 0 4px rgba(238, 114, 46, 0.15);
  }
`;

// --- VALIDATION SCHEMA ---
const contactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  companyName: z.string().optional(),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(1, "Phone number is required"),
  requestCallback: z.string(),
  comments: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactFormProps {
  apiEndpoint?: string;
  onSuccess?: (data: ContactFormData) => void;
  onError?: (error: string) => void;
}

export default function ContactForm({
  apiEndpoint = "/api/contact-form",
  onSuccess,
  onError,
}: ContactFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      companyName: "",
      email: "",
      phone: "",
      requestCallback: "no",
      comments: "",
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: "" });

    try {
      const payload = {
        ...data,
        requestCallback: data.requestCallback === "yes",
      };

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        setSubmitStatus({
          type: "success",
          message: "Request received. Dispatching team shortly.",
        });
        reset();
        if (onSuccess) onSuccess(data);
      } else {
        throw new Error(result.message || "Failed to submit form");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to submit form";
      setSubmitStatus({ type: "error", message: errorMessage });
      if (onError) onError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- MOBILE OPTIMIZED CLASSES ---
  // text-base prevents iOS zoom on focus
  // py-3 ensures a good touch target size
  const inputClasses = (hasError: boolean) => `
    w-full px-4 py-3 rounded-lg bg-gray-50 border text-base
    ${hasError ? 'border-red-500 bg-red-50' : 'border-gray-200'}
    text-gray-900
    focus:outline-none focus:bg-white transition-all duration-200
    focus-ring appearance-none
  `;

  const labelClasses = "block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 ml-1";

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4 font-sans">
      <style>{ANIMATION_STYLES}</style>

      {/* Container: reduced rounded corners on mobile for more screen space */}
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl overflow-hidden animate-fade-up">

        {/* Header Section */}
        <div className="bg-gray-900 p-6 md:p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#ee722e]"></div>
          <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>

          <h2 className="relative z-10 text-2xl md:text-3xl font-black text-white uppercase tracking-tight mb-2">
            Contact V3 Services
          </h2>
          <p className="relative z-10 text-gray-400 text-sm font-light">
            Secure your site. Request immediate callback.
          </p>
        </div>

        {/* Status Messages */}
        {submitStatus.type && (
          <div
            className={`px-6 py-4 text-center text-sm font-bold ${
              submitStatus.type === "success"
                ? "bg-green-50 text-green-700 border-b border-green-100"
                : "bg-red-50 text-red-700 border-b border-red-100"
            }`}
          >
            {submitStatus.message}
          </div>
        )}

        {/* Form Section */}
        {/* p-6 on mobile gives more horizontal space for inputs */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 md:p-8 space-y-5">

          {/* Name Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-up delay-100">
            <div>
              <label className={labelClasses}>First Name <span className="text-[#ee722e]">*</span></label>
              <input
                type="text"
                className={inputClasses(!!errors.firstName)}
                {...register("firstName")}
              />
              {errors.firstName && <p className="text-red-500 text-xs mt-1 ml-1">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className={labelClasses}>Last Name <span className="text-[#ee722e]">*</span></label>
              <input
                type="text"
                className={inputClasses(!!errors.lastName)}
                {...register("lastName")}
              />
              {errors.lastName && <p className="text-red-500 text-xs mt-1 ml-1">{errors.lastName.message}</p>}
            </div>
          </div>

          {/* Company & Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-up delay-200">
            <div>
              <label className={labelClasses}>Company Name</label>
              <input
                type="text"
                className={inputClasses(false)}
                {...register("companyName")}
              />
            </div>
            <div>
              <label className={labelClasses}>Email Address <span className="text-[#ee722e]">*</span></label>
              <input
                type="email"
                className={inputClasses(!!errors.email)}
                {...register("email")}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1 ml-1">{errors.email.message}</p>}
            </div>
          </div>

          {/* Phone & Callback */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-up delay-200">
            <div>
              <label className={labelClasses}>Phone Number <span className="text-[#ee722e]">*</span></label>
              <input
                type="tel"
                className={inputClasses(!!errors.phone)}
                {...register("phone")}
              />
              {errors.phone && <p className="text-red-500 text-xs mt-1 ml-1">{errors.phone.message}</p>}
            </div>

            <div className="flex flex-col justify-end pb-1">
              <label className={labelClasses}>Request Immediate Callback?</label>
              <div className="flex gap-4 mt-1">
                <label className="relative flex cursor-pointer items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors w-full md:w-auto justify-center md:justify-start">
                   <input
                    type="radio"
                    value="yes"
                    className="peer h-4 w-4 cursor-pointer text-[#ee722e] focus:ring-[#ee722e]"
                    {...register("requestCallback")}
                  />
                  <span className="text-sm font-medium text-gray-700">Yes</span>
                </label>
                <label className="relative flex cursor-pointer items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors w-full md:w-auto justify-center md:justify-start">
                  <input
                    type="radio"
                    value="no"
                    defaultChecked
                    className="peer h-4 w-4 cursor-pointer text-[#ee722e] focus:ring-[#ee722e]"
                    {...register("requestCallback")}
                  />
                  <span className="text-sm font-medium text-gray-700">No</span>
                </label>
              </div>
            </div>
          </div>

          {/* Comments - Keeping Placeholder here only */}
          <div className="animate-fade-up delay-300">
            <label className={labelClasses}>Site Details / Comments</label>
            <textarea
              className={`${inputClasses(false)} min-h-[120px] resize-none`}
              placeholder="Describe your security concerns or requirements..."
              {...register("comments")}
            />
          </div>

          {/* Action Button */}
          <div className="pt-2 animate-fade-up delay-300">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`
                w-full py-4 px-8 rounded-full text-white font-black uppercase tracking-widest text-lg shadow-lg
                transform transition-all duration-300
                ${isSubmitting
                  ? 'bg-gray-400 cursor-not-allowed opacity-70'
                  : 'bg-[#ee722e] hover:bg-gray-900 hover:-translate-y-1 hover:shadow-xl'
                }
              `}
            >
              {isSubmitting ? "Processing..." : "Submit"}
            </button>
            <p className="text-center text-gray-400 text-xs mt-4">
              Your data is secure.
            </p>
          </div>

        </form>
      </div>
    </div>
  );
}
