import React from 'react';
import ContactForm from '../components/ContactForm';

export default function ContactFormPage() {
  return (
    <ContactForm
      apiEndpoint="/api/contact-form"
      onSuccess={(data) => {
        console.log('Form submitted successfully:', data);
      }}
      onError={(error) => {
        console.error('Form submission error:', error);
      }}
    />
  );
}
