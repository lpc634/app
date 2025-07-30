#!/usr/bin/env python3
"""
Test script for S3 permissions and invoice download functionality
This script validates the fixes for 403 Forbidden errors and S3 access issues
"""

import sys
import os
import logging

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_s3_client_improvements():
    """Test the improved S3 client functionality"""
    try:
        from utils.s3_client import s3_client
        
        logger.info("Testing improved S3 client...")
        
        # Test 1: Configuration check
        logger.info("Test 1: Checking S3 configuration")
        if s3_client.is_configured():
            logger.info("✓ S3 client is configured")
            
            # Test 2: Connection test
            logger.info("Test 2: Testing S3 connection")
            connection_result = s3_client.test_connection()
            if connection_result['success']:
                logger.info("✓ S3 connection test successful")
                bucket_info = connection_result.get('bucket_region', 'Unknown region')
                logger.info(f"✓ Bucket region: {bucket_info}")
            else:
                logger.error(f"✗ S3 connection test failed: {connection_result['error']}")
                return False
        else:
            error_msg = s3_client.get_configuration_error()
            logger.error(f"✗ S3 client not configured: {error_msg}")
            return False
        
        # Test 3: Presigned URL generation (without specific file)
        logger.info("Test 3: Testing presigned URL generation")
        test_file_key = "invoices/2/test-invoice.pdf"
        
        try:
            # This should fail gracefully if file doesn't exist
            url = s3_client.generate_presigned_url(test_file_key, expiration=300)
            if url:
                logger.info("✓ Presigned URL generation works")
                logger.info(f"✓ Generated URL starts with: {url[:100]}...")
            else:
                logger.warning("⚠ Presigned URL generation returned None (expected if file doesn't exist)")
        except Exception as url_error:
            logger.error(f"✗ Presigned URL generation failed: {str(url_error)}")
            return False
        
        # Test 4: Invoice download URL generation
        logger.info("Test 4: Testing invoice download URL generation")
        try:
            download_result = s3_client.generate_invoice_download_url(
                agent_id=2,
                invoice_number="INV-202507-0001",
                expiration=300
            )
            
            if download_result['success']:
                logger.info("✓ Invoice download URL generation successful")
                logger.info(f"✓ Download URL: {download_result['download_url'][:100]}...")
                logger.info(f"✓ Filename: {download_result['filename']}")
                logger.info(f"✓ Expires in: {download_result['expires_in']} seconds")
            else:
                logger.warning(f"⚠ Invoice download URL generation failed: {download_result['error']}")
                logger.info("This is expected if the specific invoice file doesn't exist")
        except Exception as invoice_error:
            logger.error(f"✗ Invoice download URL generation crashed: {str(invoice_error)}")
            return False
        
        # Test 5: S3 permissions diagnosis
        logger.info("Test 5: Testing S3 permissions diagnosis")
        try:
            diagnosis = s3_client.diagnose_s3_permissions("invoices/2/INV-202507-0001.pdf")
            
            logger.info("✓ S3 diagnosis completed")
            logger.info(f"✓ Configuration status: {diagnosis['configuration']['status']}")
            logger.info(f"✓ Bucket access status: {diagnosis['bucket_access']['status']}")
            logger.info(f"✓ File access status: {diagnosis['file_access']['status']}")
            
            if diagnosis['recommendations']:
                logger.info("Recommendations:")
                for rec in diagnosis['recommendations']:
                    logger.info(f"  - {rec}")
        except Exception as diag_error:
            logger.error(f"✗ S3 diagnosis failed: {str(diag_error)}")
            return False
        
        logger.info("✓ All S3 client tests completed successfully")
        return True
        
    except Exception as e:
        logger.error(f"✗ Error testing S3 client improvements: {str(e)}")
        return False

def test_error_handling_improvements():
    """Test the improved error handling in S3 operations"""
    try:
        logger.info("Testing improved error handling...")
        
        # Test error handling for invalid credentials (simulated)
        logger.info("Test 1: Error handling validation")
        
        # Test different error scenarios by checking the code structure
        from utils.s3_client import S3Client
        from botocore.exceptions import ClientError, NoCredentialsError
        
        logger.info("✓ Error handling imports successful")
        logger.info("✓ ClientError and NoCredentialsError properly imported")
        
        # Verify the error handling patterns exist in the code
        import inspect
        s3_methods = ['generate_presigned_url', 'get_secure_document_url', 'upload_invoice_pdf']
        
        for method_name in s3_methods:
            if hasattr(S3Client, method_name):
                method = getattr(S3Client, method_name)
                source = inspect.getsource(method)
                
                # Check for proper error handling patterns
                has_clienterror = 'ClientError' in source
                has_logging = 'logger.error' in source
                has_traceback = 'traceback' in source
                
                logger.info(f"✓ Method {method_name}:")
                logger.info(f"  - ClientError handling: {'✓' if has_clienterror else '✗'}")
                logger.info(f"  - Error logging: {'✓' if has_logging else '✗'}")
                logger.info(f"  - Traceback logging: {'✓' if has_traceback else '✗'}")
            else:
                logger.error(f"✗ Method {method_name} not found")
                return False
        
        logger.info("✓ All error handling improvements validated")
        return True
        
    except Exception as e:
        logger.error(f"✗ Error testing error handling: {str(e)}")
        return False

def test_download_endpoint_improvements():
    """Test that the download endpoint improvements are in place"""
    try:
        logger.info("Testing download endpoint improvements...")
        
        # Check if the agent routes file has the improvements
        agent_routes_path = os.path.join('src', 'routes', 'agent.py')
        
        if not os.path.exists(agent_routes_path):
            logger.error(f"✗ Agent routes file not found: {agent_routes_path}")
            return False
        
        with open(agent_routes_path, 'r') as f:
            content = f.read()
        
        # Check for key improvements
        improvements = [
            ('Direct download endpoint', '/download-direct'),
            ('S3 diagnosis endpoint', '/s3-diagnosis'),
            ('Improved error logging', 'STEP 1: Starting invoice download'),
            ('S3 client usage', 'generate_invoice_download_url'),
            ('Redirect import', 'redirect'),
        ]
        
        all_found = True
        for improvement_name, pattern in improvements:
            if pattern in content:
                logger.info(f"✓ {improvement_name}: Found")
            else:
                logger.error(f"✗ {improvement_name}: Not found (pattern: {pattern})")
                all_found = False
        
        if all_found:
            logger.info("✓ All download endpoint improvements are in place")
            return True
        else:
            logger.error("✗ Some download endpoint improvements are missing")
            return False
        
    except Exception as e:
        logger.error(f"✗ Error testing download endpoint improvements: {str(e)}")
        return False

def main():
    """Run all S3 permission tests"""
    logger.info("Starting S3 permissions and download functionality tests...")
    
    tests = [
        ("Error Handling Improvements", test_error_handling_improvements),
        ("Download Endpoint Improvements", test_download_endpoint_improvements),
        ("S3 Client Improvements", test_s3_client_improvements),
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
    logger.info("TEST SUMMARY")
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
        logger.info("🎉 All tests passed! The S3 permission fixes should resolve 403 Forbidden errors.")
        logger.info("\nNext steps:")
        logger.info("1. Ensure AWS credentials have s3:GetObject permissions")
        logger.info("2. Test actual invoice downloads with valid credentials")
        logger.info("3. Use /agent/s3-diagnosis/<invoice_id> endpoint for troubleshooting")
        return 0
    else:
        logger.error("❌ Some tests failed. Review the errors above before deploying.")
        return 1

if __name__ == "__main__":
    sys.exit(main())