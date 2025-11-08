"""
Email Sync Service - IMAP email fetching and storage
"""

import imaplib
import email
from email.header import decode_header
from datetime import datetime
from src.models.crm_email import CRMEmail
from src.extensions import db
import logging

logger = logging.getLogger(__name__)


class EmailSyncService:
    """Service for syncing emails via IMAP"""

    @staticmethod
    def sync_contact_emails(crm_user, contact):
        """Sync emails for a specific contact"""
        if not crm_user.imap_server or not crm_user.imap_email:
            raise Exception("Email not configured")

        results = {
            'success': False,
            'new_emails': 0,
            'total_emails': 0,
            'error': None
        }

        try:
            # Connect to IMAP server
            if crm_user.imap_use_ssl:
                mail = imaplib.IMAP4_SSL(crm_user.imap_server, crm_user.imap_port or 993)
            else:
                mail = imaplib.IMAP4(crm_user.imap_server, crm_user.imap_port or 143)

            # Login
            mail.login(crm_user.imap_email, crm_user.imap_password)

            # Select INBOX
            mail.select('INBOX')

            # Fetch ALL emails (no search filter - we'll filter in Python)
            # This works with ALL IMAP servers, even strict ones
            status, messages = mail.search(None, 'ALL')

            if status != 'OK':
                raise Exception("Failed to search emails")

            email_ids = messages[0].split()
            results['total_emails'] = len(email_ids)

            # Only process the last 100 emails to avoid taking too long
            # We'll filter these by the contact's email address
            contact_email_lower = contact.email.lower()

            # Fetch each email from INBOX
            for email_id in email_ids[-100:]:  # Last 100 emails
                try:
                    status, msg_data = mail.fetch(email_id, '(RFC822)')
                    if status != 'OK':
                        continue

                    raw_email = msg_data[0][1]
                    email_message = email.message_from_bytes(raw_email)

                    # Parse sender and recipient first
                    sender = EmailSyncService._parse_email_address(email_message.get('From', ''))
                    recipient = EmailSyncService._parse_email_address(email_message.get('To', ''))

                    # FILTER: Only process if this email involves the contact
                    if contact_email_lower not in sender.lower() and contact_email_lower not in recipient.lower():
                        continue  # Skip - this email doesn't involve this contact

                    # Parse rest of email details
                    email_uid = email_id.decode()
                    subject = EmailSyncService._decode_header(email_message.get('Subject', ''))
                    date_str = email_message.get('Date', '')
                    email_date = EmailSyncService._parse_date(date_str)

                    # Get email body
                    body_text, body_html = EmailSyncService._get_email_body(email_message)

                    # Determine if sent or received
                    is_sent = sender.lower() == crm_user.imap_email.lower()

                    # Check if email already exists
                    existing = CRMEmail.query.filter_by(
                        user_id=crm_user.id,
                        email_uid=f"INBOX_{email_uid}"
                    ).first()

                    if not existing:
                        # Create new email record
                        new_email = CRMEmail(
                            contact_id=contact.id,
                            user_id=crm_user.id,
                            email_uid=f"INBOX_{email_uid}",
                            subject=subject,
                            sender=sender,
                            recipient=recipient,
                            date=email_date,
                            body_text=body_text,
                            body_html=body_html,
                            is_sent=is_sent,
                            synced_at=datetime.utcnow()
                        )
                        db.session.add(new_email)
                        results['new_emails'] += 1

                except Exception as e:
                    logger.error(f"Error processing email {email_id}: {str(e)}")
                    continue

            # Also check SENT folder
            try:
                mail.select('"Sent"')  # Try common sent folder name
            except:
                try:
                    mail.select('[Gmail]/Sent Mail')  # Gmail format
                except:
                    try:
                        mail.select('Sent Items')  # Outlook format
                    except:
                        logger.warning("Could not find Sent folder")
                        mail.select('INBOX')  # Fallback to INBOX

            # Search sent folder using ALL and filter in Python
            try:
                status, messages = mail.search(None, 'ALL')
                if status == 'OK':
                    sent_ids = messages[0].split()
                    for email_id in sent_ids[-50:]:  # Limit to last 50
                        try:
                            status, msg_data = mail.fetch(email_id, '(RFC822)')
                            if status != 'OK':
                                continue

                            raw_email = msg_data[0][1]
                            email_message = email.message_from_bytes(raw_email)

                            # Parse recipient first
                            recipient = EmailSyncService._parse_email_address(email_message.get('To', ''))

                            # FILTER: Only if sent TO this contact
                            if contact_email_lower not in recipient.lower():
                                continue

                            # Parse rest of details
                            email_uid = email_id.decode()
                            subject = EmailSyncService._decode_header(email_message.get('Subject', ''))
                            sender = EmailSyncService._parse_email_address(email_message.get('From', ''))
                            date_str = email_message.get('Date', '')
                            email_date = EmailSyncService._parse_date(date_str)

                            body_text, body_html = EmailSyncService._get_email_body(email_message)

                            # Check if already exists
                            existing = CRMEmail.query.filter_by(
                                user_id=crm_user.id,
                                email_uid=f"SENT_{email_uid}"
                            ).first()

                            if not existing:
                                new_email = CRMEmail(
                                    contact_id=contact.id,
                                    user_id=crm_user.id,
                                    email_uid=f"SENT_{email_uid}",
                                    subject=subject,
                                    sender=sender,
                                    recipient=recipient,
                                    date=email_date,
                                    body_text=body_text,
                                    body_html=body_html,
                                    is_sent=True,
                                    synced_at=datetime.utcnow()
                                )
                                db.session.add(new_email)
                                results['new_emails'] += 1

                        except Exception as e:
                            logger.error(f"Error processing sent email {email_id}: {str(e)}")
                            continue
            except Exception as e:
                logger.warning(f"Could not search sent folder: {str(e)}")

            # Commit all new emails
            db.session.commit()

            # Logout
            mail.logout()

            results['success'] = True
            return results

        except Exception as e:
            db.session.rollback()
            logger.exception(f"Email sync failed: {str(e)}")
            results['error'] = str(e)
            return results

    @staticmethod
    def _decode_header(header):
        """Decode email header"""
        if not header:
            return ''
        decoded_parts = decode_header(header)
        decoded_str = ''
        for part, encoding in decoded_parts:
            if isinstance(part, bytes):
                decoded_str += part.decode(encoding or 'utf-8', errors='ignore')
            else:
                decoded_str += part
        return decoded_str

    @staticmethod
    def _parse_email_address(address_str):
        """Extract email address from 'Name <email@domain.com>' format"""
        if not address_str:
            return ''
        if '<' in address_str and '>' in address_str:
            return address_str.split('<')[1].split('>')[0].strip()
        return address_str.strip()

    @staticmethod
    def _parse_date(date_str):
        """Parse email date string"""
        try:
            from email.utils import parsedate_to_datetime
            return parsedate_to_datetime(date_str)
        except:
            return datetime.utcnow()

    @staticmethod
    def _get_email_body(email_message):
        """Extract text and HTML body from email"""
        body_text = ''
        body_html = ''

        if email_message.is_multipart():
            for part in email_message.walk():
                content_type = part.get_content_type()
                content_disposition = str(part.get('Content-Disposition', ''))

                if 'attachment' not in content_disposition:
                    if content_type == 'text/plain':
                        try:
                            body_text = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                        except:
                            pass
                    elif content_type == 'text/html':
                        try:
                            body_html = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                        except:
                            pass
        else:
            content_type = email_message.get_content_type()
            try:
                payload = email_message.get_payload(decode=True).decode('utf-8', errors='ignore')
                if content_type == 'text/plain':
                    body_text = payload
                elif content_type == 'text/html':
                    body_html = payload
            except:
                pass

        return body_text, body_html
