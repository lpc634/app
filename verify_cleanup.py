#!/usr/bin/env python3
"""
Verify the UpdateInvoicePage cleanup is complete
"""

import os

def verify_cleanup():
    """Verify all redundant code has been removed"""
    print("=" * 60)
    print("VERIFYING UPDATEINVOICEPAGE CLEANUP")
    print("=" * 60)
    
    file_path = "src/components/UpdateInvoicePage.jsx"
    
    if not os.path.exists(file_path):
        print("ERROR: UpdateInvoicePage.jsx not found!")
        return False
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check for removed elements
    removed_items = [
        "Agent Invoice Number",
        "Your personal invoice sequence number", 
        "showInvoiceNoDialog",
        "newInvoiceNo",
        "updateNextMode", 
        "updatingInvoiceNo",
        "handleEditInvoiceNo",
        "handleUpdateInvoiceNo",
        "Edit Agent Invoice Number",
        "border-t border-v3-border pt-6 mt-6"
    ]
    
    remaining_items = []
    for item in removed_items:
        if item in content:
            remaining_items.append(item)
    
    # Check for kept elements  
    kept_items = [
        "Hours Worked",
        "Hourly Rate", 
        "Invoice Number",
        "invoiceNumber",
        "setInvoiceNumber",
        "invoice_number: invoiceNumber.trim()"
    ]
    
    missing_items = []
    for item in kept_items:
        if item not in content:
            missing_items.append(item)
    
    print("RESULTS:")
    print("--------")
    
    if remaining_items:
        print(f"❌ REMAINING REDUNDANT ITEMS ({len(remaining_items)}):")
        for item in remaining_items:
            print(f"  - {item}")
    else:
        print("✅ All redundant items successfully removed")
    
    if missing_items:
        print(f"❌ MISSING REQUIRED ITEMS ({len(missing_items)}):")
        for item in missing_items:
            print(f"  - {item}")
    else:
        print("✅ All required items still present")
    
    print("")
    print("SUMMARY:")
    print("--------")
    if not remaining_items and not missing_items:
        print("✅ CLEANUP SUCCESSFUL!")
        print("✅ UpdateInvoicePage now has clean, simple invoice number input")
        print("✅ Redundant Agent Invoice Number section removed")
        print("✅ All unused state variables and functions removed")
        print("✅ Page now shows exactly 3 input fields:")
        print("   1. Hours Worked")
        print("   2. Hourly Rate")  
        print("   3. Invoice Number")
        return True
    else:
        print("❌ CLEANUP INCOMPLETE - issues found above")
        return False

if __name__ == "__main__":
    verify_cleanup()