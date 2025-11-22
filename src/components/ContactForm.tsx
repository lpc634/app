import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

/** Contact Form Styles - EXACT match to website */
const CONTACT_FORM_CSS = `
* {
  box-sizing: border-box;
}

.contact-form-wrapper {
  font-family: Arial, Helvetica, sans-serif;
  max-width: 580px;
  margin: 0 auto;
  padding: 0;
  background: #fff;
}

.contact-form-header {
  margin-bottom: 20px;
}

.contact-form-title {
  font-size: 24px;
  font-weight: normal;
  color: #000;
  margin: 0 0 5px 0;
}

.contact-form-subtitle {
  font-size: 14px;
  color: #666;
  margin: 0;
  font-weight: normal;
}

.contact-form {
  background: #fff;
  padding: 0;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
  margin-bottom: 18px;
}

.form-row-2 {
  grid-template-columns: 1fr 1fr;
}

@media (max-width: 640px) {
  .form-row-2 {
    grid-template-columns: 1fr;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-label {
  font-size: 15px;
  font-weight: normal;
  color: #000;
  margin-bottom: 8px;
  font-family: Arial, Helvetica, sans-serif;
}

.form-label-required::after {
  content: " *";
  color: #d9534f;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 11px 12px;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 3px;
  background: #eee;
  color: #555;
  font-family: Arial, Helvetica, sans-serif;
  transition: border-color 0.15s, background-color 0.15s;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #66afe9;
  background: #fff;
}

.form-input::placeholder,
.form-textarea::placeholder {
  color: #999;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
  line-height: 1.4;
}

.form-error {
  color: #d9534f;
  font-size: 12px;
  margin-top: 5px;
  font-family: Arial, Helvetica, sans-serif;
}

.radio-group {
  display: flex;
  gap: 20px;
  align-items: center;
  margin-top: 8px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #000;
  cursor: pointer;
  font-family: Arial, Helvetica, sans-serif;
}

.radio-input {
  width: 16px;
  height: 16px;
  cursor: pointer;
  margin: 0;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-start;
  margin-top: 20px;
}

.btn {
  padding: 10px 24px;
  font-size: 15px;
  font-weight: normal;
  border-radius: 3px;
  border: none;
  cursor: pointer;
  font-family: Arial, Helvetica, sans-serif;
  transition: opacity 0.2s;
}

.btn-primary {
  background: #ee722e;
  color: #fff;
  border: 1px solid #ee722e;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.success-message {
  background: #dff0d8;
  border: 1px solid #d6e9c6;
  color: #3c763d;
  padding: 15px;
  border-radius: 3px;
  margin-bottom: 20px;
  font-size: 14px;
}

.error-message {
  background: #f2dede;
  border: 1px solid #ebccd1;
  color: #a94442;
  padding: 15px;
  border-radius: 3px;
  margin-bottom: 20px;
  font-size: 14px;
}
`;

// Form validation schema
const contactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  companyName: z.string().optional(),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(1, "Phone number is required"),
  requestCallback: z.string().default("no"),
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
      // Convert requestCallback string to boolean for API
      const payload = {
        ...data,
        requestCallback: data.requestCallback === "yes",
      };

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        setSubmitStatus({
          type: "success",
          message:
            "Thank you for contacting us! We'll get back to you shortly.",
        });
        reset();
        if (onSuccess) onSuccess(data);
      } else {
        throw new Error(result.message || "Failed to submit form");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to submit form";
      setSubmitStatus({
        type: "error",
        message: errorMessage,
      });
      if (onError) onError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <style>{CONTACT_FORM_CSS}</style>
      <div className="contact-form-wrapper">
        <div className="contact-form-header">
          <h2 className="contact-form-title">Contact us Form</h2>
          <p className="contact-form-subtitle">
            Get in Contact or Request a Callback
          </p>
        </div>

        {submitStatus.type && (
          <div
            className={
              submitStatus.type === "success"
                ? "success-message"
                : "error-message"
            }
          >
            {submitStatus.message}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="contact-form">
          {/* Name */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Name</label>
              <div className="form-row form-row-2" style={{ marginBottom: 0 }}>
                <div>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="First"
                    {...register("firstName")}
                  />
                  {errors.firstName && (
                    <span className="form-error">
                      {errors.firstName.message}
                    </span>
                  )}
                </div>
                <div>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Last"
                    {...register("lastName")}
                  />
                  {errors.lastName && (
                    <span className="form-error">
                      {errors.lastName.message}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Company Name & Email */}
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">Company Name</label>
              <input
                type="text"
                className="form-input"
                {...register("companyName")}
              />
            </div>
            <div className="form-group">
              <label className="form-label form-label-required">Email</label>
              <input
                type="email"
                className="form-input"
                {...register("email")}
              />
              {errors.email && (
                <span className="form-error">{errors.email.message}</span>
              )}
            </div>
          </div>

          {/* Phone & Request Callback */}
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label form-label-required">Phone</label>
              <input type="tel" className="form-input" {...register("phone")} />
              {errors.phone && (
                <span className="form-error">{errors.phone.message}</span>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Request a callback?</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    className="radio-input"
                    value="yes"
                    {...register("requestCallback")}
                  />
                  <span>Yes</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    className="radio-input"
                    value="no"
                    defaultChecked
                    {...register("requestCallback")}
                  />
                  <span>No</span>
                </label>
              </div>
            </div>
          </div>

          {/* Comments */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Comments</label>
              <textarea className="form-textarea" {...register("comments")} />
            </div>
          </div>

          {/* Submit Button */}
          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
