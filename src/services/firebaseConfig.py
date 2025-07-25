"""
Firebase Cloud Messaging (FCM) Configuration and Service
Handles server-side push notifications using Firebase Admin SDK
"""

import os
import json
import logging
from typing import List, Dict, Optional
import firebase_admin
from firebase_admin import credentials, messaging
from flask import current_app

logger = logging.getLogger(__name__)

class FCMService:
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(FCMService, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not self._initialized:
            self.app = None
            self._initialized = True
    
    def initialize_firebase(self):
        """Initialize Firebase Admin SDK with service account credentials"""
        try:
            # Check if already initialized
            if firebase_admin._apps:
                logger.info("Firebase Admin SDK already initialized")
                return True
            
            # Get Firebase service account from environment variable
            service_account_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON')
            
            if not service_account_json:
                logger.error("FIREBASE_SERVICE_ACCOUNT_JSON environment variable not set")
                return False
            
            try:
                # Parse the JSON string
                service_account_info = json.loads(service_account_json)
                
                # Initialize Firebase Admin SDK
                cred = credentials.Certificate(service_account_info)
                self.app = firebase_admin.initialize_app(cred)
                
                logger.info("Firebase Admin SDK initialized successfully")
                return True
                
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON in FIREBASE_SERVICE_ACCOUNT_JSON: {e}")
                return False
            except Exception as e:
                logger.error(f"Error initializing Firebase Admin SDK: {e}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to initialize Firebase: {e}")
            return False
    
    def send_push_notification(self, fcm_tokens: List[str], title: str, body: str, data: Optional[Dict] = None) -> Dict:
        """
        Send push notification to multiple FCM tokens
        
        Args:
            fcm_tokens: List of FCM registration tokens
            title: Notification title
            body: Notification body
            data: Optional additional data payload
            
        Returns:
            Dict with success/failure counts and details
        """
        if not fcm_tokens:
            return {"success_count": 0, "failure_count": 0, "errors": ["No FCM tokens provided"]}
        
        if not firebase_admin._apps:
            if not self.initialize_firebase():
                return {"success_count": 0, "failure_count": len(fcm_tokens), "errors": ["Firebase not initialized"]}
        
        try:
            # Create the notification payload
            notification = messaging.Notification(
                title=title,
                body=body
            )
            
            # Create Android-specific configuration
            android_config = messaging.AndroidConfig(
                notification=messaging.AndroidNotification(
                    title=title,
                    body=body,
                    priority="high",
                    default_sound=True,
                    click_action="FLUTTER_NOTIFICATION_CLICK"
                ),
                priority="high"
            )
            
            # Create APNs (iOS) configuration
            apns_config = messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        alert=messaging.ApsAlert(
                            title=title,
                            body=body
                        ),
                        sound="default",
                        badge=1
                    )
                )
            )
            
            # Create web push configuration
            webpush_config = messaging.WebpushConfig(
                notification=messaging.WebpushNotification(
                    title=title,
                    body=body,
                    icon="/logo-512x512.png",  # Adjust path as needed
                    badge="/logo-512x512.png"
                )
            )
            
            # Prepare data payload
            data_payload = data or {}
            data_payload.update({
                "click_action": "FLUTTER_NOTIFICATION_CLICK",
                "notification_type": "job_assignment"
            })
            
            # Create messages for each token
            messages = []
            for token in fcm_tokens:
                message = messaging.Message(
                    notification=notification,
                    data=data_payload,
                    token=token,
                    android=android_config,
                    apns=apns_config,
                    webpush=webpush_config
                )
                messages.append(message)
            
            # Send batch notification
            response = messaging.send_all(messages)
            
            # Process results
            success_count = response.success_count
            failure_count = response.failure_count
            errors = []
            
            # Log failed tokens for cleanup
            if response.responses:
                for idx, resp in enumerate(response.responses):
                    if not resp.success:
                        error_msg = f"Token {idx}: {resp.exception}"
                        errors.append(error_msg)
                        logger.warning(f"FCM send failed for token {idx}: {resp.exception}")
            
            logger.info(f"FCM batch send completed: {success_count} success, {failure_count} failures")
            
            return {
                "success_count": success_count,
                "failure_count": failure_count,
                "errors": errors,
                "total_tokens": len(fcm_tokens)
            }
            
        except Exception as e:
            logger.error(f"Error sending FCM notifications: {e}")
            return {
                "success_count": 0,
                "failure_count": len(fcm_tokens),
                "errors": [f"FCM send error: {str(e)}"],
                "total_tokens": len(fcm_tokens)
            }
    
    def send_to_user_tokens(self, user_tokens: Dict[int, List[str]], title: str, body: str, data: Optional[Dict] = None) -> Dict:
        """
        Send notifications to multiple users with their FCM tokens
        
        Args:
            user_tokens: Dict mapping user_id to list of FCM tokens
            title: Notification title
            body: Notification body
            data: Optional additional data payload
            
        Returns:
            Dict with results per user and overall stats
        """
        all_tokens = []
        user_token_mapping = {}
        
        # Flatten tokens and create mapping
        for user_id, tokens in user_tokens.items():
            for token in tokens:
                all_tokens.append(token)
                user_token_mapping[token] = user_id
        
        if not all_tokens:
            return {"success_count": 0, "failure_count": 0, "users_notified": 0}
        
        # Send to all tokens
        result = self.send_push_notification(all_tokens, title, body, data)
        
        # Calculate users successfully notified
        users_notified = len(set(user_tokens.keys())) if result["success_count"] > 0 else 0
        result["users_notified"] = users_notified
        
        return result

# Global FCM service instance
fcm_service = FCMService()