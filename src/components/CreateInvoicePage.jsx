import React from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, ListPlus, ArrowLeft } from 'lucide-react';

const CreateInvoicePage = () => {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <Link to="/agent/invoices" className="flex items-center space-x-2 text-v3-text-muted hover:text-v3-orange transition-colors w-fit mb-4">
          <ArrowLeft size={20} />
          <span>Back to My Invoices</span>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Create New Invoice</h1>
        <p className="text-muted-foreground">How would you like to create this invoice?</p>
      </div>

      {/* Option Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Option 1: Create from Jobs */}
        <Link 
          to="/agent/invoices/new/from-jobs" 
          className="dashboard-card p-8 text-center hover:border-v3-orange hover:bg-v3-bg-card transition-all group"
        >
          <Briefcase className="mx-auto h-12 w-12 text-v3-orange mb-4 transition-transform group-hover:scale-110" />
          <h2 className="text-xl font-bold text-v3-text-lightest">From Completed Jobs</h2>
          <p className="text-v3-text-muted mt-2">Select jobs from a list to automatically add them to your invoice.</p>
        </Link>

        {/* Option 2: Create Miscellaneous Invoice */}
        <Link 
          to="/agent/invoices/new/misc"
          className="dashboard-card p-8 text-center hover:border-v3-orange hover:bg-v3-bg-card transition-all group"
        >
          <ListPlus className="mx-auto h-12 w-12 text-v3-orange mb-4 transition-transform group-hover:scale-110" />
          <h2 className="text-xl font-bold text-v3-text-lightest">Miscellaneous Invoice</h2>
          <p className="text-v3-text-muted mt-2">Create a blank invoice and manually add line items for expenses like fuel, equipment, etc.</p>
        </Link>
        
      </div>
    </div>
  );
};

export default CreateInvoicePage;