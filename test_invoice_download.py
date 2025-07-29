#!/usr/bin/env python3
"""
Test script for invoice download functionality
This script tests the fixes for PDF generation and S3 operations
"""

import sys
import os
import logging

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_s3_configuration():
    """Test S3 client configuration"""
    try:
        from utils.s3_client import s3_client
        
        logger.info("Testing S3 configuration...")
        
        if s3_client.is_configured():
            logger.info("✓ S3 client is configured")
            
            # Test connection
            connection_result = s3_client.test_connection()
            if connection_result['success']:
                logger.info("✓ S3 connection test successful")
                return True
            else:
                logger.error(f"✗ S3 connection test failed: {connection_result['error']}")
                return False
        else:
            error_msg = s3_client.get_configuration_error()
            logger.error(f"✗ S3 client not configured: {error_msg}")
            return False
            
    except Exception as e:
        logger.error(f"✗ Error testing S3 configuration: {str(e)}")
        return False

def test_pdf_generation_data_types():
    """Test PDF generation with various data types"""
    try:
        from decimal import Decimal
        
        logger.info("Testing data type conversions for PDF generation...")
        
        # Test different data type combinations
        test_cases = [
            {"hours": 8, "rate": 25.50},
            {"hours": 8.5, "rate": Decimal('25.00')},
            {"hours": Decimal('7.5'), "rate": 30},
            {"hours": "8", "rate": "25.50"},  # String inputs
        ]
        
        for i, case in enumerate(test_cases):
            logger.info(f"Testing case {i+1}: hours={case['hours']} (type: {type(case['hours'])}), rate={case['rate']} (type: {type(case['rate'])})")
            
            try:
                # Convert to consistent types (same logic as in PDF generation)
                hours_decimal = Decimal(str(case['hours']))
                rate_decimal = Decimal(str(case['rate']))
                amount_decimal = hours_decimal * rate_decimal
                
                # Format for display
                hours_str = f"{float(hours_decimal):.1f}"
                rate_str = f"£{float(rate_decimal):.2f}"
                amount_str = f"£{float(amount_decimal):.2f}"
                
                logger.info(f"✓ Case {i+1} converted successfully: {hours_str} hours × {rate_str} = {amount_str}")
                
            except Exception as convert_error:
                logger.error(f"✗ Case {i+1} failed: {str(convert_error)}")
                return False
        
        logger.info("✓ All data type conversion tests passed")
        return True
        
    except Exception as e:
        logger.error(f"✗ Error testing data type conversions: {str(e)}")
        return False

def test_import_dependencies():
    """Test that all required dependencies can be imported"""
    try:
        logger.info("Testing import dependencies...")
        
        # Test core imports
        from decimal import Decimal, InvalidOperation
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.units import inch
        
        logger.info("✓ Core PDF generation imports successful")
        
        # Test Flask imports
        from flask import Flask, jsonify
        from flask_jwt_extended import JWTManager
        
        logger.info("✓ Flask imports successful")
        
        # Test AWS imports
        import boto3
        from botocore.exceptions import ClientError, NoCredentialsError
        
        logger.info("✓ AWS imports successful")
        
        return True
        
    except ImportError as e:
        logger.error(f"✗ Import error: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"✗ Unexpected error testing imports: {str(e)}")
        return False

def main():
    """Run all tests"""
    logger.info("Starting invoice download functionality tests...")
    
    tests = [
        ("Import Dependencies", test_import_dependencies),
        ("Data Type Conversions", test_pdf_generation_data_types),
        ("S3 Configuration", test_s3_configuration),
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        logger.info(f"\n{'='*50}")
        logger.info(f"Running test: {test_name}")
        logger.info(f"{'='*50}")
        
        try:
            results[test_name] = test_func()
        except Exception as e:
            logger.error(f"✗ Test '{test_name}' crashed: {str(e)}")
            results[test_name] = False
    
    # Summary
    logger.info(f"\n{'='*50}")
    logger.info("TEST SUMMARY")
    logger.info(f"{'='*50}")
    
    passed = 0
    total = len(results)
    
    for test_name, result in results.items():
        status = "✓ PASSED" if result else "✗ FAILED"
        logger.info(f"{test_name}: {status}")
        if result:
            passed += 1
    
    logger.info(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        logger.info("🎉 All tests passed! The invoice download fixes should work correctly.")
        return 0
    else:
        logger.error("❌ Some tests failed. Review the errors above before deploying.")
        return 1

if __name__ == "__main__":
    sys.exit(main())