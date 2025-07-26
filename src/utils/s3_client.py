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

    def upload_invoice_pdf(self, invoice_id, pdf_data, filename=None):
        """
        Upload invoice PDF to S3
        
        Args:
            invoice_id (str): Invoice unique identifier
            pdf_data: PDF file data or file object
            filename (str): Optional custom filename
            
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
            # Generate filename if not provided
            if not filename:
                filename = f"invoice_{invoice_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.pdf"
            else:
                filename = secure_filename(filename)
            
            # Create S3 key
            s3_key = f"invoices/{invoice_id}/{filename}"
            
            # Upload PDF
            if hasattr(pdf_data, 'read'):
                # File-like object
                self.s3_client.upload_fileobj(
                    pdf_data,
                    self.bucket_name,
                    s3_key,
                    ExtraArgs={
                        'ContentType': 'application/pdf',
                        'ServerSideEncryption': 'AES256',
                        'Metadata': {
                            'invoice_id': str(invoice_id),
                            'upload_date': datetime.utcnow().isoformat(),
                            'document_type': 'invoice'
                        }
                    }
                )
            else:
                # Raw data
                self.s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=s3_key,
                    Body=pdf_data,
                    ContentType='application/pdf',
                    ServerSideEncryption='AES256',
                    Metadata={
                        'invoice_id': str(invoice_id),
                        'upload_date': datetime.utcnow().isoformat(),
                        'document_type': 'invoice'
                    }
                )
            
            return {
                'success': True,
                'file_key': s3_key,
                'filename': filename,
                'upload_date': datetime.utcnow().isoformat()
            }
            
        except ClientError as e:
            logger.error(f"AWS S3 error uploading invoice PDF: {str(e)}")
            return {'success': False, 'error': f"S3 upload failed: {str(e)}"}
        except Exception as e:
            logger.error(f"Error uploading invoice PDF: {str(e)}")
            return {'success': False, 'error': str(e)}

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
            logger.error(f"Cannot generate presigned URL: {self.error_message}")
            return None
        
        try:
            response = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': file_key},
                ExpiresIn=expiration
            )
            return response
        except ClientError as e:
            logger.error(f"Error generating presigned URL: {str(e)}")
            return None

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