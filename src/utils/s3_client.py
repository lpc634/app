import boto3
import os
import logging
from datetime import datetime, timedelta
from botocore.exceptions import ClientError, NoCredentialsError
from werkzeug.utils import secure_filename
import uuid

logger = logging.getLogger(__name__)

class S3Client:
    def __init__(self):
        # Validate AWS environment variables first
        self.aws_access_key_id = os.getenv('AWS_ACCESS_KEY_ID')
        self.aws_secret_access_key = os.getenv('AWS_SECRET_ACCESS_KEY')
        self.aws_region = os.getenv('AWS_S3_REGION')
        self.bucket_name = os.getenv('AWS_S3_BUCKET')
        
        # Check if all required credentials are available
        missing_vars = []
        if not self.aws_access_key_id:
            missing_vars.append('AWS_ACCESS_KEY_ID')
        if not self.aws_secret_access_key:
            missing_vars.append('AWS_SECRET_ACCESS_KEY')
        if not self.aws_region:
            missing_vars.append('AWS_S3_REGION')
        if not self.bucket_name:
            missing_vars.append('AWS_S3_BUCKET')
        
        if missing_vars:
            error_msg = f"Missing AWS environment variables: {', '.join(missing_vars)}"
            logger.error(error_msg)
            self.s3_client = None
            self.configured = False
            self.error_message = error_msg
            return
        
        try:
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=self.aws_access_key_id,
                aws_secret_access_key=self.aws_secret_access_key,
                region_name=self.aws_region
            )
            self.configured = True
            self.error_message = None
            logger.info(f"S3 client initialized successfully for bucket: {self.bucket_name}")
        except NoCredentialsError:
            error_msg = "AWS credentials not found or invalid"
            logger.error(error_msg)
            self.s3_client = None
            self.configured = False
            self.error_message = error_msg
        except Exception as e:
            error_msg = f"Error initializing S3 client: {str(e)}"
            logger.error(error_msg)
            self.s3_client = None
            self.configured = False
            self.error_message = error_msg

    def is_configured(self):
        """Check if S3 client is properly configured"""
        return self.configured
    
    def get_configuration_error(self):
        """Get the configuration error message if any"""
        return self.error_message
    
    def test_connection(self):
        """Test S3 connection by checking bucket access"""
        if not self.configured:
            return {'success': False, 'error': self.error_message}
        
        try:
            # Try to get bucket location (requires minimal permissions)
            response = self.s3_client.get_bucket_location(Bucket=self.bucket_name)
            return {'success': True, 'message': 'S3 connection successful', 'bucket_region': response.get('LocationConstraint', 'us-east-1')}
        except ClientError as e:
            # If bucket location fails, try a simple head bucket operation
            try:
                self.s3_client.head_bucket(Bucket=self.bucket_name)
                return {'success': True, 'message': 'S3 connection successful (limited permissions)'}
            except ClientError as head_error:
                error_msg = f"S3 connection test failed: {str(head_error)}"
                logger.error(error_msg)
                return {'success': False, 'error': error_msg}
        except Exception as e:
            error_msg = f"S3 connection test error: {str(e)}"
            logger.error(error_msg)
            return {'success': False, 'error': error_msg}

    def upload_agent_document(self, agent_id, file, file_type):
        """
        Upload agent identification document to S3
        
        Args:
            agent_id (str): Agent's unique identifier
            file: File object to upload
            file_type (str): Type of document (e.g., 'id_card', 'passport', 'driver_license')
            
        Returns:
            dict: Upload result with file URL and metadata
        """
        # Check if S3 is properly configured
        if not self.configured:
            return {
                'success': False, 
                'error': f'S3 storage not configured: {self.error_message}'
            }
        
        try:
            # Validate file type
            allowed_extensions = {'pdf', 'jpg', 'jpeg', 'png'}
            filename = secure_filename(file.filename)
            if not filename or '.' not in filename:
                raise ValueError("Invalid filename")
            
            file_extension = filename.rsplit('.', 1)[1].lower()
            if file_extension not in allowed_extensions:
                raise ValueError(f"File type not allowed. Allowed types: {allowed_extensions}")
            
            # Generate unique filename
            unique_filename = f"{file_type}_{uuid.uuid4().hex}.{file_extension}"
            
            # Create S3 key with organized folder structure
            s3_key = f"agents/{agent_id}/documents/{unique_filename}"
            
            # Upload file
            self.s3_client.upload_fileobj(
                file,
                self.bucket_name,
                s3_key,
                ExtraArgs={
                    'ContentType': self._get_content_type(file_extension),
                    'ServerSideEncryption': 'AES256',
                    'Metadata': {
                        'agent_id': str(agent_id),
                        'document_type': file_type,
                        'upload_date': datetime.utcnow().isoformat(),
                        'original_filename': filename
                    }
                }
            )
            
            # Return file metadata
            return {
                'success': True,
                'file_key': s3_key,
                'filename': unique_filename,
                'original_filename': filename,
                'file_type': file_type,
                'upload_date': datetime.utcnow().isoformat(),
                'file_size': file.content_length if hasattr(file, 'content_length') else None
            }
            
        except ClientError as e:
            logger.error(f"AWS S3 error uploading agent document: {str(e)}")
            return {'success': False, 'error': f"S3 upload failed: {str(e)}"}
        except Exception as e:
            logger.error(f"Error uploading agent document: {str(e)}")
            return {'success': False, 'error': str(e)}

    def upload_invoice_pdf(self, agent_id, invoice_number, pdf_data, filename=None):
        """
        Upload invoice PDF to S3 with organized structure
        
        Args:
            agent_id (str): Agent's unique identifier
            invoice_number (str): Invoice number
            pdf_data: PDF file data or file object
            filename (str): Optional custom filename
            
        Returns:
            dict: Upload result with file URL and metadata
        """
        # Check if S3 is properly configured
        if not self.configured:
            logger.error(f"S3 UPLOAD FAILED: S3 not configured - {self.error_message}")
            return {
                'success': False, 
                'error': f'S3 storage not configured: {self.error_message}'
            }
        
        try:
            logger.info(f"S3 UPLOAD START: Uploading invoice PDF for agent {agent_id}, invoice {invoice_number}")
            
            # Generate filename if not provided
            if not filename:
                filename = f"{invoice_number}.pdf"
            else:
                filename = secure_filename(filename)
            
            # Create organized S3 key: /invoices/{agent_id}/{invoice_number}.pdf
            s3_key = f"invoices/{agent_id}/{filename}"
            logger.info(f"S3 UPLOAD: Target S3 key: {s3_key}")
            
            # Prepare metadata
            metadata = {
                'agent_id': str(agent_id),
                'invoice_number': invoice_number,
                'upload_date': datetime.utcnow().isoformat(),
                'document_type': 'invoice'
            }
            
            extra_args = {
                'ContentType': 'application/pdf',
                'ServerSideEncryption': 'AES256',
                'Metadata': metadata
            }
            
            # Upload PDF
            if hasattr(pdf_data, 'read'):
                logger.info("S3 UPLOAD: Uploading file-like object")
                # File-like object
                self.s3_client.upload_fileobj(
                    pdf_data,
                    self.bucket_name,
                    s3_key,
                    ExtraArgs=extra_args
                )
            else:
                # Raw data or file path
                if isinstance(pdf_data, str):
                    logger.info(f"S3 UPLOAD: Uploading from file path: {pdf_data}")
                    # File path - check if file exists first
                    if not os.path.exists(pdf_data):
                        error_msg = f"File not found at path: {pdf_data}"
                        logger.error(f"S3 UPLOAD FAILED: {error_msg}")
                        return {'success': False, 'error': error_msg}
                    
                    # Get file size for logging
                    file_size = os.path.getsize(pdf_data)
                    logger.info(f"S3 UPLOAD: File size: {file_size} bytes")
                    
                    with open(pdf_data, 'rb') as file:
                        self.s3_client.upload_fileobj(
                            file,
                            self.bucket_name,
                            s3_key,
                            ExtraArgs=extra_args
                        )
                else:
                    logger.info("S3 UPLOAD: Uploading raw data")
                    # Raw data
                    self.s3_client.put_object(
                        Bucket=self.bucket_name,
                        Key=s3_key,
                        Body=pdf_data,
                        ContentType='application/pdf',
                        ServerSideEncryption='AES256',
                        Metadata=metadata
                    )
            
            logger.info(f"S3 UPLOAD SUCCESS: Invoice PDF uploaded to {s3_key}")
            
            return {
                'success': True,
                'file_key': s3_key,
                'filename': filename,
                'upload_date': datetime.utcnow().isoformat()
            }
            
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            error_message = e.response.get('Error', {}).get('Message', str(e))
            logger.error(f"S3 UPLOAD FAILED: AWS ClientError - {error_code}: {error_message}")
            logger.error(f"S3 UPLOAD FAILED: Full error response: {e.response}")
            
            # Provide more specific error messages based on error code
            if error_code == 'NoSuchBucket':
                return {'success': False, 'error': f'S3 bucket "{self.bucket_name}" does not exist'}
            elif error_code == 'AccessDenied':
                return {'success': False, 'error': 'Access denied - check S3 permissions'}
            elif error_code == 'InvalidBucketName':
                return {'success': False, 'error': f'Invalid bucket name: {self.bucket_name}'}
            else:
                return {'success': False, 'error': f"S3 upload failed - {error_code}: {error_message}"}
                
        except FileNotFoundError as e:
            error_msg = f"File not found: {str(e)}"
            logger.error(f"S3 UPLOAD FAILED: {error_msg}")
            return {'success': False, 'error': error_msg}
        except PermissionError as e:
            error_msg = f"Permission denied accessing file: {str(e)}"
            logger.error(f"S3 UPLOAD FAILED: {error_msg}")
            return {'success': False, 'error': error_msg}
        except Exception as e:
            logger.error(f"S3 UPLOAD FAILED: Unexpected error uploading invoice PDF: {str(e)}")
            import traceback
            logger.error(f"S3 UPLOAD FAILED: Traceback: {traceback.format_exc()}")
            return {'success': False, 'error': f"Upload failed: {str(e)}"}

    def generate_presigned_url(self, file_key, expiration=3600):
        """
        Generate a temporary signed URL for secure file access
        
        Args:
            file_key (str): S3 object key
            expiration (int): URL expiration time in seconds (default: 1 hour)
            
        Returns:
            str: Presigned URL or None if error
        """
        if not self.configured:
            logger.error(f"PRESIGNED URL FAILED: S3 not configured - {self.error_message}")
            return None
        
        try:
            logger.info(f"PRESIGNED URL START: Generating signed URL for {file_key}")
            logger.info(f"PRESIGNED URL: Using bucket {self.bucket_name}, expiration {expiration}s")
            
            # Create a fresh S3 client to ensure credentials are current
            fresh_s3_client = boto3.client(
                's3',
                aws_access_key_id=self.aws_access_key_id,
                aws_secret_access_key=self.aws_secret_access_key,
                region_name=self.aws_region
            )
            
            # Determine content type based on file extension
            file_extension = file_key.lower().split('.')[-1]
            content_type_map = {
                'pdf': 'application/pdf',
                'png': 'image/png',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'gif': 'image/gif',
                'webp': 'image/webp'
            }
            content_type = content_type_map.get(file_extension, 'application/octet-stream')

            # For images, use inline display instead of attachment
            is_image = content_type.startswith('image/')
            content_disposition = f'inline; filename="{file_key.split("/")[-1]}"' if is_image else f'attachment; filename="{file_key.split("/")[-1]}"'

            # Generate the presigned URL
            response = fresh_s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': file_key,
                    'ResponseContentType': content_type,
                    'ResponseContentDisposition': content_disposition
                },
                ExpiresIn=expiration
            )
            
            logger.info(f"PRESIGNED URL SUCCESS: Generated signed URL for {file_key}")
            # Log first 100 chars of URL for debugging (don't log full URL for security)
            logger.info(f"PRESIGNED URL: Generated URL starts with: {response[:100]}...")
            
            return response
            
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            error_message = e.response.get('Error', {}).get('Message', str(e))
            
            logger.error(f"PRESIGNED URL FAILED: AWS ClientError - {error_code}: {error_message}")
            logger.error(f"PRESIGNED URL FAILED: Full error response: {e.response}")
            
            # Provide specific error handling
            if error_code == 'AccessDenied':
                logger.error(f"PRESIGNED URL FAILED: Access denied - check AWS credentials and bucket permissions")
            elif error_code == 'NoSuchBucket':
                logger.error(f"PRESIGNED URL FAILED: Bucket {self.bucket_name} does not exist")
            elif error_code == 'InvalidAccessKeyId':
                logger.error(f"PRESIGNED URL FAILED: Invalid AWS access key ID")
            elif error_code == 'SignatureDoesNotMatch':
                logger.error(f"PRESIGNED URL FAILED: Invalid AWS secret access key")
            
            return None
            
        except NoCredentialsError:
            logger.error(f"PRESIGNED URL FAILED: AWS credentials not found or invalid")
            return None
        except Exception as e:
            logger.error(f"PRESIGNED URL FAILED: Unexpected error generating signed URL: {str(e)}")
            import traceback
            logger.error(f"PRESIGNED URL FAILED: Traceback: {traceback.format_exc()}")
            return None

    def get_secure_document_url(self, file_key, expiration=3600):
        """
        Generate a secure URL for document viewing with proper error handling
        
        Args:
            file_key (str): S3 object key
            expiration (int): URL expiration time in seconds (default: 1 hour)
            
        Returns:
            dict: Result with success status and URL or error message
        """
        if not self.configured:
            error_msg = f'S3 storage not configured: {self.error_message}'
            logger.error(f"S3 GET URL FAILED: {error_msg}")
            return {
                'success': False, 
                'error': error_msg
            }
        
        try:
            logger.info(f"S3 GET URL START: Generating secure URL for {file_key}")
            
            # First check if the object exists
            logger.info(f"S3 GET URL: Checking if object exists: {file_key}")
            head_response = self.s3_client.head_object(Bucket=self.bucket_name, Key=file_key)
            
            # Log object metadata for debugging
            object_size = head_response.get('ContentLength', 'Unknown')
            last_modified = head_response.get('LastModified', 'Unknown')
            content_type = head_response.get('ContentType', 'Unknown')
            logger.info(f"S3 GET URL: Object found - Size: {object_size} bytes, Modified: {last_modified}, Type: {content_type}")
            
            # Generate presigned URL
            logger.info(f"S3 GET URL: Generating presigned URL with {expiration}s expiration")
            url = self.generate_presigned_url(file_key, expiration)
            
            if url:
                logger.info(f"S3 GET URL SUCCESS: Generated secure URL for {file_key}")
                return {
                    'success': True,
                    'url': url,
                    'expires_in': expiration,
                    'file_size': object_size,
                    'content_type': content_type
                }
            else:
                logger.error(f"S3 GET URL FAILED: Failed to generate presigned URL for {file_key}")
                return {
                    'success': False,
                    'error': 'Failed to generate secure URL'
                }
                
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            error_message = e.response.get('Error', {}).get('Message', str(e))
            
            logger.error(f"S3 GET URL FAILED: AWS ClientError - {error_code}: {error_message}")
            logger.error(f"S3 GET URL FAILED: Full error response: {e.response}")
            
            if error_code == 'NoSuchKey':
                logger.error(f"S3 GET URL FAILED: Document not found - {file_key}")
                return {
                    'success': False,
                    'error': 'Document not found in storage'
                }
            elif error_code == 'NoSuchBucket':
                logger.error(f"S3 GET URL FAILED: Bucket not found - {self.bucket_name}")
                return {
                    'success': False,
                    'error': f'S3 bucket "{self.bucket_name}" does not exist'
                }
            elif error_code == 'AccessDenied':
                logger.error(f"S3 GET URL FAILED: Access denied for {file_key}")
                return {
                    'success': False,
                    'error': 'Access denied - insufficient S3 permissions'
                }
            elif error_code in ['404', '403']:
                # 404 = Not Found, 403 = Forbidden (often means file doesn't exist in S3)
                logger.error(f"S3 GET URL FAILED: Document not accessible - {file_key}")
                return {
                    'success': False,
                    'error': 'Document not found in storage'
                }
            else:
                logger.error(f"S3 GET URL FAILED: Unexpected AWS error for {file_key}: {error_code}")
                return {
                    'success': False,
                    'error': f'Storage error: {error_code} - {error_message}'
                }
        except Exception as e:
            logger.error(f"S3 GET URL FAILED: Unexpected error getting document URL for {file_key}: {str(e)}")
            import traceback
            logger.error(f"S3 GET URL FAILED: Traceback: {traceback.format_exc()}")
            return {
                'success': False,
                'error': f'Unexpected error accessing document: {str(e)}'
            }

    def list_agent_documents(self, agent_id):
        """
        List all documents for a specific agent
        
        Args:
            agent_id (str): Agent's unique identifier
            
        Returns:
            list: List of document metadata
        """
        if not self.configured:
            logger.error(f"Cannot list documents: {self.error_message}")
            return []
        
        try:
            prefix = f"agents/{agent_id}/documents/"
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix
            )
            
            documents = []
            if 'Contents' in response:
                for obj in response['Contents']:
                    # Get object metadata
                    metadata_response = self.s3_client.head_object(
                        Bucket=self.bucket_name,
                        Key=obj['Key']
                    )
                    
                    documents.append({
                        'file_key': obj['Key'],
                        'filename': obj['Key'].split('/')[-1],
                        'size': obj['Size'],
                        'last_modified': obj['LastModified'].isoformat(),
                        'metadata': metadata_response.get('Metadata', {})
                    })
            
            return documents
            
        except ClientError as e:
            logger.error(f"Error listing agent documents: {str(e)}")
            return []

    def delete_file(self, file_key):
        """
        Delete a file from S3 (GDPR compliance)
        
        Args:
            file_key (str): S3 object key to delete
            
        Returns:
            bool: True if successful, False otherwise
        """
        if not self.configured:
            logger.error(f"Cannot delete file: {self.error_message}")
            return False
        
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=file_key
            )
            logger.info(f"Successfully deleted file: {file_key}")
            return True
            
        except ClientError as e:
            logger.error(f"Error deleting file {file_key}: {str(e)}")
            return False

    def list_agent_invoices(self, agent_id):
        """
        List all invoices for a specific agent
        
        Args:
            agent_id (str): Agent's unique identifier
            
        Returns:
            list: List of invoice file metadata
        """
        if not self.configured:
            logger.error(f"Cannot list invoices: {self.error_message}")
            return []
        
        try:
            prefix = f"invoices/{agent_id}/"
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix
            )
            
            invoices = []
            if 'Contents' in response:
                for obj in response['Contents']:
                    # Get object metadata
                    metadata_response = self.s3_client.head_object(
                        Bucket=self.bucket_name,
                        Key=obj['Key']
                    )
                    
                    invoices.append({
                        'file_key': obj['Key'],
                        'filename': obj['Key'].split('/')[-1],
                        'size': obj['Size'],
                        'last_modified': obj['LastModified'].isoformat(),
                        'metadata': metadata_response.get('Metadata', {})
                    })
            
            return invoices
            
        except ClientError as e:
            logger.error(f"Error listing agent invoices: {str(e)}")
            return []

    def get_all_invoices_for_period(self, year=None, month=None):
        """
        Get all invoices for a specific time period
        
        Args:
            year (int): Year filter (optional)
            month (int): Month filter (optional)
            
        Returns:
            list: List of invoice file metadata
        """
        if not self.configured:
            logger.error(f"Cannot list invoices: {self.error_message}")
            return []
        
        try:
            prefix = "invoices/"
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix
            )
            
            invoices = []
            if 'Contents' in response:
                for obj in response['Contents']:
                    # Skip folder entries
                    if obj['Key'].endswith('/'):
                        continue
                    
                    # Filter by date if specified
                    if year or month:
                        obj_date = obj['LastModified']
                        if year and obj_date.year != year:
                            continue
                        if month and obj_date.month != month:
                            continue
                    
                    # Get object metadata
                    try:
                        metadata_response = self.s3_client.head_object(
                            Bucket=self.bucket_name,
                            Key=obj['Key']
                        )
                        
                        invoices.append({
                            'file_key': obj['Key'],
                            'filename': obj['Key'].split('/')[-1],
                            'agent_id': obj['Key'].split('/')[1] if len(obj['Key'].split('/')) > 1 else None,
                            'size': obj['Size'],
                            'last_modified': obj['LastModified'].isoformat(),
                            'metadata': metadata_response.get('Metadata', {})
                        })
                    except ClientError as meta_error:
                        logger.warning(f"Could not get metadata for {obj['Key']}: {str(meta_error)}")
                        # Include basic info even if metadata fails
                        invoices.append({
                            'file_key': obj['Key'],
                            'filename': obj['Key'].split('/')[-1],
                            'agent_id': obj['Key'].split('/')[1] if len(obj['Key'].split('/')) > 1 else None,
                            'size': obj['Size'],
                            'last_modified': obj['LastModified'].isoformat(),
                            'metadata': {}
                        })
            
            return invoices
            
        except ClientError as e:
            logger.error(f"Error listing invoices for period: {str(e)}")
            return []

    def generate_invoice_download_url(self, agent_id, invoice_number, expiration=3600):
        """
        Generate download URL for a specific invoice
        
        Args:
            agent_id (str): Agent's unique identifier
            invoice_number (str): Invoice number
            expiration (int): URL expiration time in seconds
            
        Returns:
            dict: Result with success status and URL or error message
        """
        try:
            logger.info(f"INVOICE DOWNLOAD URL: Generating URL for agent {agent_id}, invoice {invoice_number}")
            
            file_key = f"invoices/{agent_id}/{invoice_number}.pdf"
            logger.info(f"INVOICE DOWNLOAD URL: S3 file key: {file_key}")
            
            # Use the improved get_secure_document_url method
            result = self.get_secure_document_url(file_key, expiration)
            
            if result['success']:
                logger.info(f"INVOICE DOWNLOAD URL SUCCESS: Generated URL for {invoice_number}")
                return {
                    'success': True,
                    'download_url': result['url'],
                    'expires_in': result['expires_in'],
                    'invoice_number': invoice_number,
                    'filename': f"{invoice_number}.pdf",
                    'file_size': result.get('file_size', 'Unknown')
                }
            else:
                logger.error(f"INVOICE DOWNLOAD URL FAILED: {result.get('error', 'Unknown error')}")
                return {
                    'success': False,
                    'error': result.get('error', 'Failed to generate download URL')
                }
                
        except Exception as e:
            logger.error(f"INVOICE DOWNLOAD URL FAILED: Unexpected error: {str(e)}")
            import traceback
            logger.error(f"INVOICE DOWNLOAD URL FAILED: Traceback: {traceback.format_exc()}")
            return {
                'success': False,
                'error': f'Failed to generate invoice download URL: {str(e)}'
            }

    def diagnose_s3_permissions(self, file_key=None):
        """
        Diagnose S3 permissions and configuration issues
        
        Args:
            file_key (str): Optional specific file to test access
            
        Returns:
            dict: Diagnosis results with recommendations
        """
        diagnosis = {
            'configuration': {'status': 'unknown', 'details': []},
            'bucket_access': {'status': 'unknown', 'details': []},
            'file_access': {'status': 'unknown', 'details': []},
            'recommendations': []
        }
        
        try:
            logger.info("S3 DIAGNOSIS: Starting S3 permissions diagnosis")
            
            # Test 1: Configuration
            if not self.configured:
                diagnosis['configuration']['status'] = 'failed'
                diagnosis['configuration']['details'].append(f"S3 not configured: {self.error_message}")
                diagnosis['recommendations'].append("Check AWS environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_REGION, AWS_S3_BUCKET")
                return diagnosis
            else:
                diagnosis['configuration']['status'] = 'passed'
                diagnosis['configuration']['details'].append("S3 client is properly configured")
            
            # Test 2: Bucket Access
            try:
                response = self.s3_client.head_bucket(Bucket=self.bucket_name)
                diagnosis['bucket_access']['status'] = 'passed'
                diagnosis['bucket_access']['details'].append(f"Successfully accessed bucket: {self.bucket_name}")
                
                # Check bucket region
                try:
                    location_response = self.s3_client.get_bucket_location(Bucket=self.bucket_name)
                    bucket_region = location_response.get('LocationConstraint') or 'us-east-1'
                    diagnosis['bucket_access']['details'].append(f"Bucket region: {bucket_region}")
                    
                    if bucket_region != self.aws_region:
                        diagnosis['recommendations'].append(f"Warning: Bucket region ({bucket_region}) differs from client region ({self.aws_region})")
                except Exception as region_error:
                    diagnosis['bucket_access']['details'].append(f"Could not determine bucket region: {str(region_error)}")
                    
            except ClientError as bucket_error:
                error_code = bucket_error.response.get('Error', {}).get('Code', 'Unknown')
                diagnosis['bucket_access']['status'] = 'failed'
                diagnosis['bucket_access']['details'].append(f"Bucket access failed: {error_code}")
                
                if error_code == 'NoSuchBucket':
                    diagnosis['recommendations'].append(f"Bucket '{self.bucket_name}' does not exist. Check bucket name and region.")
                elif error_code == 'AccessDenied':
                    diagnosis['recommendations'].append("Access denied to bucket. Check IAM permissions for s3:ListBucket and s3:GetBucketLocation.")
                elif error_code == 'InvalidAccessKeyId':
                    diagnosis['recommendations'].append("Invalid AWS Access Key ID. Check AWS_ACCESS_KEY_ID environment variable.")
                elif error_code == 'SignatureDoesNotMatch':
                    diagnosis['recommendations'].append("Invalid AWS Secret Access Key. Check AWS_SECRET_ACCESS_KEY environment variable.")
                
                return diagnosis
            
            # Test 3: File Access (if file_key provided)
            if file_key:
                try:
                    # Test head_object (requires s3:GetObject permission)
                    head_response = self.s3_client.head_object(Bucket=self.bucket_name, Key=file_key)
                    diagnosis['file_access']['status'] = 'passed'
                    diagnosis['file_access']['details'].append(f"Successfully accessed file: {file_key}")
                    diagnosis['file_access']['details'].append(f"File size: {head_response.get('ContentLength', 'Unknown')} bytes")
                    diagnosis['file_access']['details'].append(f"Content type: {head_response.get('ContentType', 'Unknown')}")
                    
                    # Test presigned URL generation
                    try:
                        test_url = self.generate_presigned_url(file_key, expiration=60)
                        if test_url:
                            diagnosis['file_access']['details'].append("Presigned URL generation: SUCCESS")
                            diagnosis['file_access']['details'].append(f"Test URL generated (60s expiry)")
                        else:
                            diagnosis['file_access']['details'].append("Presigned URL generation: FAILED")
                            diagnosis['recommendations'].append("Check s3:GetObject permissions for presigned URL generation.")
                    except Exception as url_error:
                        diagnosis['file_access']['details'].append(f"Presigned URL generation failed: {str(url_error)}")
                        diagnosis['recommendations'].append("Check s3:GetObject permissions for presigned URL generation.")
                    
                except ClientError as file_error:
                    error_code = file_error.response.get('Error', {}).get('Code', 'Unknown')
                    diagnosis['file_access']['status'] = 'failed'
                    diagnosis['file_access']['details'].append(f"File access failed: {error_code}")
                    
                    if error_code == 'NoSuchKey':
                        diagnosis['recommendations'].append(f"File '{file_key}' does not exist in bucket.")
                    elif error_code == 'AccessDenied':
                        diagnosis['recommendations'].append("Access denied to file. Check IAM permissions for s3:GetObject.")
            else:
                diagnosis['file_access']['status'] = 'skipped'
                diagnosis['file_access']['details'].append("No specific file provided for testing")
            
            logger.info("S3 DIAGNOSIS: Completed S3 permissions diagnosis")
            return diagnosis
            
        except Exception as e:
            logger.error(f"S3 DIAGNOSIS FAILED: Error during diagnosis: {str(e)}")
            diagnosis['configuration']['status'] = 'error'
            diagnosis['configuration']['details'].append(f"Diagnosis error: {str(e)}")
            diagnosis['recommendations'].append("Unexpected error during diagnosis. Check logs for details.")
            return diagnosis

    def create_invoice_batch_zip(self, invoice_list, zip_filename):
        """
        Create a ZIP file containing multiple invoices (for batch download)
        
        Args:
            invoice_list (list): List of invoice file keys
            zip_filename (str): Name for the ZIP file
            
        Returns:
            dict: Result with success status and ZIP file key or error
        """
        if not self.configured:
            return {
                'success': False, 
                'error': f'S3 storage not configured: {self.error_message}'
            }
        
        try:
            import zipfile
            import io
            
            # Create ZIP in memory
            zip_buffer = io.BytesIO()
            
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for file_key in invoice_list:
                    try:
                        # Download file from S3
                        response = self.s3_client.get_object(
                            Bucket=self.bucket_name,
                            Key=file_key
                        )
                        
                        # Add to ZIP with a clean filename
                        filename = file_key.split('/')[-1]  # Just the filename
                        zip_file.writestr(filename, response['Body'].read())
                        
                    except ClientError as e:
                        logger.warning(f"Could not include {file_key} in batch: {str(e)}")
                        continue
            
            # Upload ZIP to S3
            zip_buffer.seek(0)
            zip_key = f"batches/{zip_filename}"
            
            self.s3_client.upload_fileobj(
                zip_buffer,
                self.bucket_name,
                zip_key,
                ExtraArgs={
                    'ContentType': 'application/zip',
                    'ServerSideEncryption': 'AES256',
                    'Metadata': {
                        'batch_created': datetime.utcnow().isoformat(),
                        'invoice_count': str(len(invoice_list)),
                        'document_type': 'invoice_batch'
                    }
                }
            )
            
            return {
                'success': True,
                'file_key': zip_key,
                'filename': zip_filename,
                'invoice_count': len(invoice_list)
            }
            
        except ImportError:
            return {'success': False, 'error': 'ZIP functionality not available'}
        except Exception as e:
            logger.error(f"Error creating invoice batch ZIP: {str(e)}")
            return {'success': False, 'error': str(e)}

    def _get_content_type(self, file_extension):
        """Get appropriate content type for file extension"""
        content_types = {
            'pdf': 'application/pdf',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png'
        }
        return content_types.get(file_extension.lower(), 'application/octet-stream')

# Global S3 client instance - initialization will not raise exceptions
try:
    s3_client = S3Client()
except Exception as e:
    logger.error(f"Failed to initialize global S3 client: {str(e)}")
    # Create a dummy client that always returns configuration errors
    class DummyS3Client:
        def __init__(self, error):
            self.configured = False
            self.error_message = str(error)
        def is_configured(self): return False
        def get_configuration_error(self): return self.error_message
        def test_connection(self): return {'success': False, 'error': self.error_message}
        def upload_agent_document(self, *args, **kwargs): 
            return {'success': False, 'error': f'S3 not configured: {self.error_message}'}
        def upload_invoice_pdf(self, *args, **kwargs): 
            return {'success': False, 'error': f'S3 not configured: {self.error_message}'}
        def generate_presigned_url(self, *args, **kwargs): return None
        def list_agent_documents(self, *args, **kwargs): return []
        def delete_file(self, *args, **kwargs): return False
    
    s3_client = DummyS3Client(e)