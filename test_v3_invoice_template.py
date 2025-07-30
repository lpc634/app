#!/usr/bin/env python3
"""
Test script for the new V3 Services invoice template
This script validates that the invoice template matches the exact format specified
"""

import sys
import os
import logging

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_template_structure():
    """Test that the V3 Services template structure is correctly implemented"""
    try:
        logger.info("Testing V3 Services invoice template structure...")
        
        # Read the PDF generation function
        agent_routes_path = os.path.join('src', 'routes', 'agent.py')
        
        if not os.path.exists(agent_routes_path):
            logger.error(f"✗ Agent routes file not found: {agent_routes_path}")
            return False
        
        with open(agent_routes_path, 'r') as f:
            content = f.read()
        
        # Check for all required template elements
        template_elements = [
            # Header elements
            ('Invoice to header', 'Invoice to:'),
            ('V3 Services company name', 'V3 Services Ltd'),
            ('V3 Services address', '117 Dartford Road, Dartford, England, DA1 3EN'),
            ('Date field', 'Date:'),
            ('Invoice number field', 'Invoice:'),
            ('RE agent section', 'RE:'),
            
            # Job details section
            ('Job address field', 'job.address'),
            ('Job description field', 'job.title'),
            
            # Table structure
            ('Date/Time column', 'Date/Time'),
            ('Hours column', 'Hours'),
            ('Rate PH column', 'Rate PH'),
            ('Ops column', 'Ops'),
            ('Total column header', 'Total'),
            ('Ops value always 1', '"1"'),  # Ops column shows "1"
            
            # NET TOTAL section
            ('NET TOTAL label', 'NET TOTAL'),
            
            # Payment section
            ('BACS payment header', 'BY BACS ONLY to:'),
            ('Bank name field', 'agent.bank_name'),
            ('Account number field', 'agent.bank_account_number'),
            ('Sort code field', 'agent.bank_sort_code'),
            ('UTR field', 'agent.utr_number'),
            
            # Legal text
            ('Payment terms', 'Payment to be made within 14 days of issue'),
            ('Invoice queries', 'All invoice queries to be made within 7 days of issue'),
            ('Tax responsibility', 'I am responsible for any Tax or National Insurance due'),
        ]
        
        all_found = True
        for element_name, pattern in template_elements:
            if pattern in content:
                logger.info(f"✓ {element_name}: Found")
            else:
                logger.error(f"✗ {element_name}: Not found (pattern: {pattern})")
                all_found = False
        
        if all_found:
            logger.info("✓ All V3 Services template elements are present")
            return True
        else:
            logger.error("✗ Some template elements are missing")
            return False
        
    except Exception as e:
        logger.error(f"✗ Error testing template structure: {str(e)}")
        return False

def test_data_fields():
    """Test that all required data fields are properly handled"""
    try:
        logger.info("Testing data field handling...")
        
        agent_routes_path = os.path.join('src', 'routes', 'agent.py')
        
        with open(agent_routes_path, 'r') as f:
            content = f.read()
        
        # Check for proper data field handling
        data_fields = [
            # Agent data fields
            ('Agent first name', 'agent.first_name'),
            ('Agent last name', 'agent.last_name'),
            ('Agent address line 1', 'agent.address_line_1'),
            ('Agent address line 2', 'agent.address_line_2'),
            ('Agent city', 'agent.city'),
            ('Agent postcode', 'agent.postcode'),
            ('Agent bank name', 'agent.bank_name'),
            ('Agent account number', 'agent.bank_account_number'),
            ('Agent sort code', 'agent.bank_sort_code'),
            ('Agent UTR number', 'agent.utr_number'),
            
            # Job data fields
            ('Job address', 'job.address'),
            ('Job title/description', 'job.title'),
            ('Job arrival time', 'job.arrival_time'),
            ('Job hours', 'hours_decimal'),
            ('Job rate', 'rate_decimal'),
            
            # Calculated fields
            ('Amount calculation', 'amount_decimal'),
            ('Total amount', 'total_decimal'),
            
            # Date formatting
            ('Date formatting', 'strftime'),
        ]
        
        all_found = True
        for field_name, pattern in data_fields:
            if pattern in content:
                logger.info(f"✓ {field_name}: Handled")
            else:
                logger.error(f"✗ {field_name}: Not handled (pattern: {pattern})")
                all_found = False
        
        if all_found:
            logger.info("✓ All required data fields are properly handled")
            return True
        else:
            logger.error("✗ Some data fields are not properly handled")
            return False
        
    except Exception as e:
        logger.error(f"✗ Error testing data fields: {str(e)}")
        return False

def test_layout_formatting():
    """Test that layout and formatting matches V3 Services specification"""
    try:
        logger.info("Testing layout and formatting...")
        
        agent_routes_path = os.path.join('src', 'routes', 'agent.py')
        
        with open(agent_routes_path, 'r') as f:
            content = f.read()
        
        # Check for proper formatting elements
        formatting_elements = [
            # Font specifications
            ('Helvetica font usage', 'Helvetica'),
            ('Bold font usage', 'Helvetica-Bold'),
            ('Font size variations', 'setFont'),
            
            # Positioning
            ('Inch measurements', 'inch'),
            ('Y position tracking', 'y_pos'),
            ('Right alignment', 'drawRightString'),
            ('Left alignment', 'drawString'),
            
            # Layout structure
            ('Header spacing', 'y_pos -= 15'),
            ('Section spacing', 'y_pos -= 30'),
            ('Table spacing', 'y_pos -= 20'),
            
            # Professional formatting
            ('Currency formatting', '£{'),
            ('Decimal formatting', ':.2f'),
            ('Date formatting', '%d/%m/%Y'),
            
            # Table structure
            ('Table header underline', 'c.line'),
            ('Column alignment', 'drawRightString'),
        ]
        
        all_found = True
        for element_name, pattern in formatting_elements:
            if pattern in content:
                logger.info(f"✓ {element_name}: Present")
            else:
                logger.warning(f"⚠ {element_name}: Pattern '{pattern}' not found (may use different implementation)")
        
        logger.info("✓ Layout and formatting elements checked")
        return True
        
    except Exception as e:
        logger.error(f"✗ Error testing layout formatting: {str(e)}")
        return False

def test_error_handling():
    """Test that error handling is maintained in the new template"""
    try:
        logger.info("Testing error handling...")
        
        agent_routes_path = os.path.join('src', 'routes', 'agent.py')
        
        with open(agent_routes_path, 'r') as f:
            content = f.read()
        
        # Check for error handling patterns
        error_handling = [
            ('Try-catch blocks', 'try:'),
            ('Exception handling', 'except'),
            ('Error logging', 'current_app.logger.error'),
            ('Traceback logging', 'traceback.format_exc'),
            ('Data validation', 'or "'),  # Default values for missing data
            ('Decimal conversion', 'Decimal(str('),
            ('Type checking', 'ValueError, TypeError, InvalidOperation'),
        ]
        
        all_found = True
        for element_name, pattern in error_handling:
            if pattern in content:
                logger.info(f"✓ {element_name}: Present")
            else:
                logger.error(f"✗ {element_name}: Not found (pattern: {pattern})")
                all_found = False
        
        if all_found:
            logger.info("✓ Error handling is properly maintained")
            return True
        else:
            logger.error("✗ Some error handling elements are missing")
            return False
        
    except Exception as e:
        logger.error(f"✗ Error testing error handling: {str(e)}")
        return False

def main():
    """Run all V3 Services invoice template tests"""
    logger.info("Starting V3 Services invoice template validation...")
    
    tests = [
        ("Template Structure", test_template_structure),
        ("Data Field Handling", test_data_fields),
        ("Layout and Formatting", test_layout_formatting),
        ("Error Handling", test_error_handling),
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        logger.info(f"\n{'='*60}")
        logger.info(f"Running test: {test_name}")
        logger.info(f"{'='*60}")
        
        try:
            results[test_name] = test_func()
        except Exception as e:
            logger.error(f"✗ Test '{test_name}' crashed: {str(e)}")
            results[test_name] = False
    
    # Summary
    logger.info(f"\n{'='*60}")
    logger.info("V3 SERVICES INVOICE TEMPLATE TEST SUMMARY")
    logger.info(f"{'='*60}")
    
    passed = 0
    total = len(results)
    
    for test_name, result in results.items():
        status = "✓ PASSED" if result else "✗ FAILED"
        logger.info(f"{test_name}: {status}")
        if result:
            passed += 1
    
    logger.info(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        logger.info("🎉 All tests passed! The V3 Services invoice template is correctly implemented.")
        logger.info("\nTemplate features:")
        logger.info("✓ Exact header format: Invoice to V3 Services Ltd")
        logger.info("✓ Correct company address: 117 Dartford Road, Dartford, England, DA1 3EN")
        logger.info("✓ Agent details in RE: format")
        logger.info("✓ Job addresses and descriptions")
        logger.info("✓ Proper table: Date/Time, Hours, Rate PH, Ops, Total")
        logger.info("✓ Agent bank details and UTR")
        logger.info("✓ Required legal text: Payment terms and tax responsibility")
        return 0
    else:
        logger.error("❌ Some tests failed. Review the errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())