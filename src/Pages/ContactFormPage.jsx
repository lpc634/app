import React from 'react';
import ContactForm from '../components/ContactForm';

export default function ContactFormPage() {
  return (
    <ContactForm
      apiEndpoint="https://v3-app-49c3d1eff914.herokuapp.com/api/contact-form"
      onSuccess={(data) => {
        console.log('Form submitted successfully:', data);
      }}
      onError={(error) => {
        console.error('Form submission error:', error);
      }}
    />
  );
}
