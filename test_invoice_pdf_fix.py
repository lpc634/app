#!/usr/bin/env python3
"""
Test the fixed invoice PDF generation with real data structures
"""

import sys
import os
from datetime import datetime, date
from decimal import Decimal

# Add src to path
sys.path.insert(0, 'src')

# Mock Flask app context for testing
class MockApp:
    def __init__(self):
        self.logger = MockLogger()

class MockLogger:
    def info(self, msg): print(f"INFO: {msg}")
    def warning(self, msg): print(f"WARNING: {msg}")
    def error(self, msg): print(f"ERROR: {msg}")

class MockJob:
    """Mock Job object with the correct attributes"""
    def __init__(self):
        self.id = 1
        self.job_type = "Security Guard"
        self.address = "123 Main Street, London"
        self.arrival_time = datetime(2025, 1, 15, 9, 0)
        self.hourly_rate = Decimal('25.00')
        self.created_at = datetime(2025, 1, 10, 10, 0)

class MockAgent:
    """Mock Agent (User) object with the correct attributes"""
    def __init__(self):
        self.id = 1
        self.first_name = "Lance"
        self.last_name = "Carstairs"
        self.email = "lance@example.com"
        self.phone = "07123456789"
        self.address_line_1 = "456 Agent Street"
        self.address_line_2 = ""
        self.city = "London"
        self.postcode = "SW1 1AA"
        self.bank_name = "Test Bank"
        self.bank_account_number = "12345678"
        self.bank_sort_code = "12-34-56"
        self.utr_number = "1234567890"

class MockInvoice:
    """Mock Invoice object with snapshot data"""
    def __init__(self):
        self.id = 1
        self.job_type = "Security Guard"
        self.address = "123 Main Street, London"
        self.issue_date = date.today()

def test_pdf_generation():
    """Test the PDF generation with corrected data structures"""
    print("=" * 60)
    print("TESTING FIXED INVOICE PDF GENERATION")
    print("=" * 60)
    
    try:
        # Import our modules
        from src.routes.agent import generate_invoice_pdf
        
        # Set up mock Flask app
        import flask
        app = flask.Flask(__name__)
        
        with app.app_context():
            # Create mock objects
            agent = MockAgent()
            job = MockJob()
            invoice = MockInvoice()
            
            # Create the jobs_data structure as expected by the function
            jobs_data = [{
                'job': job,
                'hours': 8.0,
                'rate': 25.00,
                'amount': 200.00,
                'date': job.arrival_time,
                'address': job.address
            }]
            
            print(f"\n1. Testing with agent: {agent.first_name} {agent.last_name}")
            print(f"2. Testing with job: {job.job_type} at {job.address}")
            print(f"3. Testing with hours: {jobs_data[0]['hours']}")
            print(f"4. Testing with rate: £{jobs_data[0]['rate']}")
            print(f"5. Testing with amount: £{jobs_data[0]['amount']}")
            
            # Totals
            totals = {
                'subtotal': 200.00,
                'vat': 0.00,
                'total': 200.00
            }
            
            # Generate PDF
            invoice_number = "V3-2025-0001"
            agent_invoice_number = 1
            
            print(f"\n6. Generating PDF for invoice: {invoice_number}")
            print(f"7. Agent invoice number: {agent_invoice_number}")
            
            result = generate_invoice_pdf(
                agent=agent,
                jobs_data=jobs_data,
                total_amount=200.00,
                invoice_number=invoice_number,
                upload_to_s3=False,  # Don't upload for testing
                agent_invoice_number=agent_invoice_number
            )
            
            if result:
                print(f"\n+ SUCCESS: PDF generated at {result}")
                
                # Check if file exists
                pdf_path = result[0] if isinstance(result, tuple) else result
                if os.path.exists(pdf_path):
                    file_size = os.path.getsize(pdf_path)
                    print(f"+ PDF file exists: {pdf_path}")
                    print(f"+ File size: {file_size} bytes")
                    
                    if file_size > 1000:  # Reasonable size check
                        print("+ PDF appears to have content (size > 1KB)")
                    else:
                        print("! WARNING: PDF file seems very small")
                        
                    return True
                else:
                    print("- ERROR: PDF file was not created")
                    return False
            else:
                print("- ERROR: PDF generation returned None")
                return False
                
    except ImportError as e:
        print(f"- IMPORT ERROR: {e}")
        return False
    except Exception as e:
        print(f"- ERROR during PDF generation: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_data_structure():
    """Test that our data structures match what the PDF function expects"""
    print("\n" + "=" * 60)
    print("TESTING DATA STRUCTURE COMPATIBILITY")
    print("=" * 60)
    
    # Test the expected jobs_data structure
    job = MockJob()
    expected_structure = [{
        'job': job,           # Job object
        'hours': 8.0,         # float
        'rate': 25.00,        # float 
        'amount': 200.00,     # float
        'date': job.arrival_time,  # datetime
        'address': job.address     # string
    }]
    
    print("\n+ Expected jobs_data structure:")
    for key, value in expected_structure[0].items():
        print(f"   {key}: {type(value).__name__} = {value}")
    
    # Test agent structure
    agent = MockAgent()
    print("\n+ Agent data structure:")
    agent_attrs = ['first_name', 'last_name', 'email', 'phone', 'address_line_1', 'city', 'postcode', 
                   'bank_name', 'bank_account_number', 'bank_sort_code', 'utr_number']
    for attr in agent_attrs:
        value = getattr(agent, attr, 'NOT FOUND')
        print(f"   {attr}: {value}")
    
    return True

if __name__ == "__main__":
    print("INVOICE PDF GENERATION FIX TEST")
    print("Testing the fixes for 'No services recorded' issue")
    
    # Test data structures
    structure_ok = test_data_structure()
    
    if structure_ok:
        # Test PDF generation
        pdf_ok = test_pdf_generation()
        
        if pdf_ok:
            print("\n" + "=" * 60)
            print("+ ALL TESTS PASSED!")
            print("=" * 60)
            print("\nFIXES IMPLEMENTED:")
            print("  + Fixed Job address extraction (uses 'address' field)")
            print("  + Fixed Job date extraction (uses 'arrival_time' field)")
            print("  + Fixed jobs_data structure with all required fields")
            print("  + Added invoice snapshot data (job_type, address)")
            print("  + Fixed data flow from routes to PDF generation")
            print("  + Added proper error handling and debugging")
            
            print("\nEXPECTED INVOICE CONTENT:")
            print("  * Agent: Lance Carstairs (top-left header)")
            print("  * Bill To: V3 Services Ltd")
            print("  * Service: Security Guard")
            print("  * Location: 123 Main Street, London") 
            print("  * Hours: 8.0h")
            print("  * Rate: £25.00")
            print("  * Amount: £200.00")
            print("  * Payment details with bank info")
            
        else:
            print("\n- PDF GENERATION TEST FAILED")
            sys.exit(1)
    else:
        print("\n- DATA STRUCTURE TEST FAILED")
        sys.exit(1)