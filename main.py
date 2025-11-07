# --- Load environment variables from .env file FIRST ---
from dotenv import load_dotenv
load_dotenv()

# --- Standard Library and System Imports ---
import os
import sys
import requests
import logging
import threading
import random
import time
import smtplib
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# --- Get Git SHA for version tracking ---
GIT_SHA = os.environ.get('GIT_SHA', 'dev')

# --- Add 'src' to the Python path ---
sys.path.insert(0, 'src')

# --- Flask and Extension Imports ---
from flask import Flask, send_from_directory, jsonify, request
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_migrate import Migrate

# --- Application-specific Imports ---
from src.extensions import db
from src.models.user import User
from src.models.vehicle import VehicleSighting
from src.models.vehicle_details import VehicleDetails
from src.scheduler import init_scheduler
from src.models.user import Setting

# --- Route Blueprint Imports ---
from src.routes.user import user_bp
from src.routes.intelligence import intelligence_bp
from src.routes.auth import auth_bp, check_if_token_revoked
from src.routes.availability import availability_bp
from src.routes.jobs import jobs_bp
from src.routes.notifications import notifications_bp
from src.routes.fcm_notifications import fcm_bp
from src.routes.weather import weather_bp
from src.routes.analytics import analytics_bp
from src.routes.agent import agent_bp
from src.routes.health import health_bp
# REMOVED: from src.routes.utils import utils_bp
from src.routes.admin import admin_bp
from src.routes.vehicles import vehicles_bp
from src.routes.invoices import invoices_bp
from src.routes.telegram import telegram_bp, telegram_api_bp, agent_telegram_bp
from src.routes.police_interactions import bp as police_bp
from src.routes.forms import forms_bp
from src.routes.authority_to_act import authority_bp
from src.routes.contact_forms import contact_forms_bp
from src.routes.crm import crm_bp


# --- Flask App Initialization ---
static_folder_path = os.path.join(os.path.dirname(__file__), 'dist')
app = Flask(__name__, static_folder=static_folder_path)

# --- App Configuration ---
SECRET = os.environ.get('SECRET_KEY', 'v3-services-secret-key-change-in-production')
app.config['SECRET_KEY'] = SECRET
app.config['JWT_SECRET_KEY'] = SECRET
app.config['JWT_ALGORITHM'] = 'HS256'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# --- UPLOAD FOLDER CONFIGURATION (FINAL HEROKU FIX) ---
UPLOAD_FOLDER = os.path.join('/tmp', 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
# ----------------------------------------------------

# --- AWS S3 Configuration ---
app.config['AWS_ACCESS_KEY_ID'] = os.environ.get('AWS_ACCESS_KEY_ID')
app.config['AWS_SECRET_ACCESS_KEY'] = os.environ.get('AWS_SECRET_ACCESS_KEY')
app.config['AWS_S3_BUCKET'] = os.environ.get('AWS_S3_BUCKET')
app.config['AWS_S3_REGION'] = os.environ.get('AWS_S3_REGION')
# --------------------------------

# --- VAPID Keys for Push Notifications ---
app.config['VAPID_PUBLIC_KEY'] = os.environ.get('VAPID_PUBLIC_KEY', 'BCVp6sM-3kVT43iVnAUrkXYc2gVdofIMc3tB4p7Q2Qv5G2b5P2iRzBEe-s2w9i5n-8T0aHkXyGNIk2N8yA9fUo8=')
app.config['VAPID_PRIVATE_KEY'] = os.environ.get('VAPID_PRIVATE_KEY', 'jVpVIp5k2wOgrqI2nvy5kY7rBCEy5d2o1d5sJ6sW1Yg=')

# --- Database Configuration for Heroku ---
DATABASE_URL = os.environ.get('DATABASE_URL')
if DATABASE_URL:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
else:
    db_dir = os.path.join(os.path.dirname(__file__), 'database')
    os.makedirs(db_dir, exist_ok=True)
    app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(db_dir, 'app.db')}"

# --- Email Configuration ---
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = os.environ.get('MAIL_PORT', 587)
app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'True').lower() == 'true'
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER', 'V3 Services <no-reply@v3-services.com>')

# --- Telegram Integration Configuration ---
from distutils.util import strtobool

def env_bool(name, default=False):
    val = os.getenv(name)
    return bool(strtobool(val)) if val is not None else default

# Compute TELEGRAM_ENABLED server-side with proper validation
TELEGRAM_ENABLED = (
    env_bool("TELEGRAM_ENABLED", False) and 
    bool(os.getenv("TELEGRAM_BOT_TOKEN")) and 
    bool(os.getenv("TELEGRAM_WEBHOOK_SECRET"))
)

app.config['TELEGRAM_ENABLED'] = TELEGRAM_ENABLED
app.config['TELEGRAM_BOT_TOKEN'] = os.environ.get("TELEGRAM_BOT_TOKEN", "")
app.config['TELEGRAM_BOT_USERNAME'] = os.environ.get("TELEGRAM_BOT_USERNAME", "V3JobsBot")
app.config['TELEGRAM_WEBHOOK_SECRET'] = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")
app.config['PUBLIC_BASE_URL'] = os.environ.get("PUBLIC_BASE_URL", "https://v3-app.herokuapp.com")
# Admin Telegram group (optional)
app.config['TELEGRAM_ADMIN_CHAT_ID'] = os.environ.get('TELEGRAM_ADMIN_CHAT_ID')
app.config['TELEGRAM_ADMIN_THREAD_ID'] = os.environ.get('TELEGRAM_ADMIN_THREAD_ID')
app.config['TELEGRAM_SET_WEBHOOK_ON_START'] = os.environ.get('TELEGRAM_SET_WEBHOOK_ON_START', 'false')
app.config['NOTIFICATIONS_ENABLED'] = env_bool('NOTIFICATIONS_ENABLED', True)

# --- CORS Configuration for Heroku ---
LIVE_APP_URL = os.environ.get('LIVE_APP_URL', 'https://v3-app-49c3d1eff914.herokuapp.com')
origins = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176"]
if LIVE_APP_URL:
    origins.append(LIVE_APP_URL)

CORS(app, origins=origins, supports_credentials=True, allow_headers=["Content-Type", "Authorization"], methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# --- Initialize Extensions ---
db.init_app(app)
migrate = Migrate(app, db)
jwt = JWTManager(app)

# --- JWT Configuration ---
@jwt.token_in_blocklist_loader
def check_if_token_is_revoked_wrapper(jwt_header, jwt_payload):
    return check_if_token_revoked(jwt_header, jwt_payload)


# --- User lookup loader for get_current_user() (Flask-JWT-Extended v4+) ---
@jwt.user_lookup_loader
def load_user_from_jwt(_jwt_header, jwt_data):
    """Resolve the current user from the JWT subject (sub).

    Tokens are issued with identity=str(user.id), so convert to int safely.
    """
    identity = jwt_data.get("sub")
    try:
        user_id = int(identity) if identity is not None else None
    except (TypeError, ValueError):
        user_id = None
    return User.query.get(user_id) if user_id is not None else None



# --- Register Blueprints ---
app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(intelligence_bp, url_prefix='/api')
app.register_blueprint(auth_bp, url_prefix='/api')
app.register_blueprint(availability_bp, url_prefix='/api')
app.register_blueprint(jobs_bp, url_prefix='/api')
app.register_blueprint(notifications_bp, url_prefix='/api')
app.register_blueprint(fcm_bp, url_prefix='/api')
app.register_blueprint(weather_bp, url_prefix='/api')
app.register_blueprint(analytics_bp, url_prefix='/api')
app.register_blueprint(agent_bp, url_prefix='/api')
app.register_blueprint(health_bp, url_prefix='/api')
# REMOVED: app.register_blueprint(utils_bp, url_prefix='/api')
app.register_blueprint(admin_bp, url_prefix='/api')
# --- THIS LINE IS NOW UNCOMMENTED ---
app.register_blueprint(vehicles_bp, url_prefix='/api')
app.register_blueprint(invoices_bp, url_prefix='/api')
app.register_blueprint(telegram_bp)
app.register_blueprint(telegram_api_bp)
app.register_blueprint(agent_telegram_bp)
app.register_blueprint(police_bp, url_prefix='/api')
app.register_blueprint(forms_bp, url_prefix='/api')
app.register_blueprint(authority_bp, url_prefix='/api')
app.register_blueprint(contact_forms_bp, url_prefix='/api')
app.register_blueprint(crm_bp, url_prefix='/api/crm')

# ==================== CONTACT FORM AUTOMATION ====================
# Contact Form Endpoint with OpenAI Auto-Reply, Telegram & Email Integration

@app.route('/api/contact-form', methods=['POST', 'OPTIONS'])
def contact_form():
    """
    Handle contact form submissions with automated GPT replies, Telegram notifications, and email sending.
    Replaces Cognito Forms integration.
    """
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response, 200

    try:
        # Get form data
        data = request.get_json()

        # Extract fields
        first_name = data.get('firstName', '').strip()
        last_name = data.get('lastName', '').strip()
        company_name = data.get('companyName', '').strip()
        email = data.get('email', '').strip()
        phone = data.get('phone', '').strip()
        request_callback = data.get('requestCallback', False)
        comments = data.get('comments', '').strip()

        # Validate required fields
        if not email or not comments:
            return jsonify({
                'status': 'error',
                'message': 'Email and comments are required'
            }), 400

        # Convert to internal format
        fields = {
            "name": f"{first_name} {last_name}".strip() or "Not provided",
            "email": email,
            "phone": phone or "Not provided",
            "company_name": company_name or "Not provided",
            "callback_requested": "Yes" if request_callback else "No",
            "comments": comments
        }

        # Generate request ID
        request_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")

        app.logger.info(f"[Contact Form {request_id}] Processing submission from {fields['name']} ({email})")

        # STEP 1: Generate GPT Reply FIRST
        app.logger.info(f"[Contact Form {request_id}] Generating GPT reply...")
        gpt_reply = generate_gpt_reply(fields, request_id)

        # STEP 1.5: Save to database
        app.logger.info(f"[Contact Form {request_id}] Saving to database...")
        try:
            from src.models.contact_form import ContactFormSubmission
            submission = ContactFormSubmission(
                first_name=first_name,
                last_name=last_name,
                company_name=company_name if company_name else None,
                email=email,
                phone=phone,
                callback_requested=request_callback,
                comments=comments,
                gpt_reply=gpt_reply,
                request_id=request_id,
                telegram_sent=False,  # Will update after sending
                email_sent=False,  # Will update after sending
                status='pending'
            )
            db.session.add(submission)
            db.session.commit()
            app.logger.info(f"[Contact Form {request_id}] Saved to database with ID: {submission.id}")
        except Exception as e:
            app.logger.error(f"[Contact Form {request_id}] Failed to save to database: {str(e)}")
            db.session.rollback()

        # STEP 2: Send Telegram Notification (immediately)
        app.logger.info(f"[Contact Form {request_id}] Sending Telegram notification...")
        telegram_sent = send_telegram_notification(fields, gpt_reply, request_id)

        # Update telegram status in database
        try:
            submission.telegram_sent = telegram_sent
            db.session.commit()
        except Exception:
            pass

        # STEP 3: Queue customer email with delay (background thread)
        app.logger.info(f"[Contact Form {request_id}] Queuing customer email...")
        threading.Thread(
            target=send_customer_email_delayed,
            args=(fields, gpt_reply, request_id)
        ).start()

        # STEP 4: Send team notification if callback requested (background thread)
        if fields['callback_requested'] == "Yes":
            app.logger.info(f"[Contact Form {request_id}] Queuing team notification email...")
            threading.Thread(
                target=send_team_notification,
                args=(fields, gpt_reply, request_id)
            ).start()

        # Return success response immediately
        response = jsonify({
            'status': 'success',
            'message': 'Contact form processed successfully',
            'request_id': request_id,
            'data': {
                'email_queued': True,
                'gpt_reply_generated': True,
                'telegram_notification_sent': telegram_sent
            }
        })
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 200

    except Exception as e:
        app.logger.error(f"[Contact Form] Error processing form: {str(e)}")
        response = jsonify({
            'status': 'error',
            'message': f'Error processing contact form: {str(e)}'
        })
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 500


def generate_gpt_reply(fields, request_id):
    """
    Generate personalized GPT reply using OpenAI API.
    Returns fallback message if OpenAI fails.
    """
    try:
        import openai

        openai_api_key = os.environ.get('OPENAI_API_KEY')
        if not openai_api_key:
            app.logger.warning(f"[Contact Form {request_id}] OPENAI_API_KEY not set, using fallback")
            return generate_fallback_reply(fields)

        # Set API key
        openai.api_key = openai_api_key

        # Prepare callback instruction
        if fields['callback_requested'] == "Yes":
            callback_instruction = """
IMPORTANT: The person has requested a callback, so you should mention that someone will CALL them.
- For eviction matters (travellers/trespassers/unauthorised access), say someone from the eviction team will call within 2 hours during working hours.
- For security matters (CCTV/vacant property/barriers), say a security specialist will call within 2 hours during working hours.
- For general inquiries, say someone from the team will call to discuss their requirements."""
        else:
            callback_instruction = """
IMPORTANT: The person has NOT requested a callback, so do NOT mention calling.
- For eviction matters (travellers/trespassers/unauthorised access), say someone from the eviction team will be in touch within 2 hours during working hours.
- For security matters (CCTV/vacant property/barriers), say a security specialist will get back to you within 2 hours during working hours.
- For general inquiries, say someone from the team will be in touch - but never mention calling specifically."""

        # System prompt
        system_prompt = f"""You are an assistant working for V3 Services, a company that handles traveller evictions and property security.

When someone fills in a contact form, your job is to reply directly in 2-3 clear, professional sentences.

Do not offer advice. Do not ask questions. Do not explain services. Do not mention the company name.
Do not start with greetings like "Thank you for getting in contact" - the email template handles the greeting.

{callback_instruction}

SPECIALIST ROUTING:
- Travellers, trespassers, unauthorised access, squatters, evictions -> eviction team
- Security, CCTV, vacant property, barriers, protection, surveillance -> security specialist
- General inquiries -> team

Use their **first name** only if it's present, but do not start with greetings.

End every message with:
- Admin Team

Maintain a confident and calm tone. No sales language. No fluff. Clear and human. Write in a natural, conversational style - avoid robotic or overly formal language."""

        # User message
        user_message = f"Name: {fields['name']}\nComments: {fields['comments']}\nCallback Requested: {fields['callback_requested']}"

        # Call OpenAI API
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            temperature=0.7,
            max_tokens=200
        )

        gpt_reply = response.choices[0].message.content.strip()
        app.logger.info(f"[Contact Form {request_id}] GPT reply generated successfully")
        return gpt_reply

    except Exception as e:
        app.logger.error(f"[Contact Form {request_id}] OpenAI error: {str(e)}, using fallback")
        return generate_fallback_reply(fields)


def generate_fallback_reply(fields):
    """
    Generate intelligent fallback reply based on keywords and callback status.
    """
    comments_lower = fields['comments'].lower()
    callback_requested = fields['callback_requested'] == "Yes"
    name_part = fields['name'].split()[0] if fields['name'] != "Not provided" else ""

    # Detect keywords
    is_eviction = any(word in comments_lower for word in ['traveller', 'trespasser', 'squatter', 'eviction', 'unauthorised'])
    is_security = any(word in comments_lower for word in ['security', 'cctv', 'vacant', 'barrier', 'protection', 'surveillance'])

    # Generate response based on context
    if callback_requested:
        if is_eviction:
            reply = f"Someone from our eviction team will call you within 2 hours during working hours to discuss your situation."
        elif is_security:
            reply = f"A security specialist will call you within 2 hours during working hours to discuss your requirements."
        else:
            reply = f"Someone from our team will call you to discuss your requirements."
    else:
        if is_eviction:
            reply = f"Someone from our eviction team will be in touch within 2 hours during working hours."
        elif is_security:
            reply = f"A security specialist will get back to you within 2 hours during working hours."
        else:
            reply = f"Someone from our team will be in touch shortly."

    return f"{reply}\n\n- Admin Team"


def send_telegram_notification(fields, gpt_reply, request_id):
    """
    Send Telegram notification to admin group.
    Returns True if successful, False otherwise.
    """
    try:
        bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
        chat_id = os.environ.get('TELEGRAM_ADMIN_CHAT_ID')

        if not bot_token or not chat_id:
            app.logger.warning(f"[Contact Form {request_id}] Telegram credentials not set")
            return False

        # Format message
        message = f"""📬 New Contact Form Submission

👤 Name: {fields['name']}
📧 Email: {fields['email']}
📱 Phone: {fields['phone']}
🏢 Company: {fields['company_name']}
📞 Callback: {fields['callback_requested']}

💬 Comments:
{fields['comments']}

🤖 GPT Reply:
{gpt_reply}

🆔 Request ID: {request_id}"""

        # Send to Telegram
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            'chat_id': chat_id,
            'text': message,
            'parse_mode': 'HTML'
        }

        response = requests.post(url, json=payload, timeout=10)

        if response.status_code == 200:
            app.logger.info(f"[Contact Form {request_id}] Telegram notification sent successfully")
            return True
        else:
            app.logger.error(f"[Contact Form {request_id}] Telegram API error: {response.status_code}")
            return False

    except Exception as e:
        app.logger.error(f"[Contact Form {request_id}] Telegram error: {str(e)}")
        return False


def get_time_based_greeting():
    """
    Get appropriate greeting based on UK time (morning/afternoon/evening).
    """
    from datetime import datetime
    import pytz

    # Get current time in UK timezone
    uk_tz = pytz.timezone('Europe/London')
    uk_time = datetime.now(uk_tz)
    hour = uk_time.hour

    if 5 <= hour < 12:
        return "Good morning"
    elif 12 <= hour < 17:
        return "Good afternoon"
    else:
        return "Good evening"


def send_customer_email_delayed(fields, gpt_reply, request_id):
    """
    Send customer auto-reply email with random delay (30-60 seconds).
    Runs in background thread.
    """
    try:
        # Random delay between 30-60 seconds
        delay = random.randint(30, 60)
        app.logger.info(f"[Contact Form {request_id}] Waiting {delay} seconds before sending customer email...")
        time.sleep(delay)

        app.logger.info(f"[Contact Form {request_id}] Sending customer email...")

        # Get email configuration
        mail_server = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
        mail_port = int(os.environ.get('MAIL_PORT', 587))
        mail_username = os.environ.get('MAIL_USERNAME')
        mail_password = os.environ.get('MAIL_PASSWORD')

        if not mail_username or not mail_password:
            app.logger.error(f"[Contact Form {request_id}] Email credentials not set")
            return

        # Get first name from the full name
        first_name = fields['name'].split()[0] if fields['name'] and fields['name'] != "Not provided" else ""

        # Get time-appropriate greeting
        greeting = get_time_based_greeting()

        # Create personalized greeting
        if first_name:
            personal_greeting = f"{greeting} {first_name},"
        else:
            personal_greeting = f"{greeting},"

        # Replace newlines with <br> for HTML
        gpt_reply_html = gpt_reply.replace('\n', '<br>')

        # Email body
        email_body = f"""<p>{personal_greeting}</p>
<p>Thank you for getting in touch with V3 Services.</p>
<p>{gpt_reply_html}</p>
<p>&nbsp;</p>
<table style="color: #242424; font-size: small; font-family: Arial, Helvetica, sans-serif; background-color: white;" cellspacing="0" cellpadding="0">
<tbody>
<tr>
<td colspan="2">
<p style="margin: 0; padding: 0;"><span style="color: #ff753d; font-size: 18pt; font-family: Arial, sans-serif;"><strong>V3 Services Ltd</strong></span></p>
<p style="margin: 0 0 10px 0; padding: 0;"><span style="color: #f8723a; font-size: 10pt; font-family: Arial, sans-serif;"><strong><a style="color: #f8723a;" title="http://www.v3-services.com/" href="http://www.v3-services.com/" rel="noopener">www.V3-Services.com</a></strong></span></p>
</td>
</tr>
<tr>
<td style="padding-bottom: 10px;" colspan="2">
<div style="height: 1px; background-color: #ff753d; width: 498px;">&nbsp;</div>
</td>
</tr>
<tr>
<td style="padding-right: 10px; vertical-align: top;"><img style="display: block; border: 0;" src="https://v3-app-49c3d1eff914.herokuapp.com/static/v3-logo.png" alt="V3 Services Logo" width="88" /></td>
<td style="vertical-align: top;">
<p style="margin: 0; padding: 0; line-height: 1.5;"><span style="color: black; font-size: 9pt; font-family: Arial, sans-serif;"><strong>T:&nbsp;</strong>0203 576 1343<br /><strong>E:&nbsp;</strong><a style="color: black;" title="mailto:info@v3-services.com" href="mailto:info@v3-services.com" rel="noopener">info@v3-services.com</a><br /><strong>W:&nbsp;</strong><a style="color: black;" title="http://www.v3-services.com/" href="http://www.v3-services.com/" rel="noopener">www.v3-services.com</a><br /><strong>A:&nbsp;</strong>V3 Services Ltd, 117 Dartford Road, Dartford, DA1 3EN</span></p>
</td>
</tr>
<tr>
<td style="padding-top: 10px;" colspan="2"><img style="display: block; border: 0;" src="https://files.manuscdn.com/user_upload_by_module/session_file/310419663031516064/uXbfYfMdRRQBFEzF.png" alt="signature_banner" width="498" height="128" /></td>
</tr>
<tr>
<td style="padding-top: 10px;" colspan="2" width="498px">
<p style="margin: 0px 0px 10px; padding: 0px; text-align: left;"><span style="color: #ff753d; font-size: 8pt; font-family: Helvetica; text-align: center;"><strong><span style="color: #ff753d;"><a style="color: #ff753d;" href="https://www.v3-services.com/services/trace-locate/" rel="noopener">INVESTIGATION&nbsp;</a></span>|<span>&nbsp;</span><span style="color: #ff753d;"><a style="color: #ff753d;" href="https://www.v3-services.com/services/surveillance/">SURVEILLANCE&nbsp;</a></span>|<span>&nbsp;</span><a style="color: #ff753d;" title="https://www.v3-services.com/services/traveller-evictions/" href="https://www.v3-services.com/services/traveller-evictions/">TRAVELLER EVICTIONS</a>&nbsp;|<span>&nbsp;</span><a style="color: #ff753d;" title="https://www.v3-services.com/services/squatter-evictions/" href="https://www.v3-services.com/services/squatter-evictions/" rel="noopener">SQUATTER EVICTIONS</a>&nbsp;|<span>&nbsp;</span><a style="color: #ff753d;" title="https://www.v3-services.com/services/site-security-access-prevention/" href="https://www.v3-services.com/services/site-security-access-prevention/" rel="noopener">SECURITY</a></strong></span></p>
<p style="margin: 0px; padding: 0px; text-align: justify;"><span style="color: #959595; font-size: 7pt; font-family: Arial, sans-serif;"><strong>The principal is a Member of the United Kingdom Professional Investigators Network</strong>&nbsp;(UKPIN) V3 Services Limited Registered in England No.10653477 Registered Office: 117 Dartford Road, Dartford DA1 3EN VAT No.269383460 ICO: ZA458365 This email and any files transmitted with it are confidential and are intended for the addressee(s) only. If you have received this email in error or there are any problems, please notify the originator immediately. The unauthorised use, disclosure, copying or alteration of this email is strictly forbidden.</span></p>
</td>
</tr>
</tbody>
</table>"""

        # Create message
        msg = MIMEMultipart('alternative')
        msg['From'] = mail_username
        msg['To'] = fields['email']
        msg['Bcc'] = mail_username
        msg['Subject'] = "Thanks for contacting V3 Services"
        msg.attach(MIMEText(email_body, 'html'))

        # Send email
        with smtplib.SMTP(mail_server, mail_port) as server:
            server.starttls()
            server.login(mail_username, mail_password)
            server.send_message(msg)

        app.logger.info(f"[Contact Form {request_id}] Customer email sent successfully to {fields['email']}")

    except Exception as e:
        app.logger.error(f"[Contact Form {request_id}] Error sending customer email: {str(e)}")


def send_team_notification(fields, gpt_reply, request_id):
    """
    Send team notification email when callback is requested.
    Runs in background thread.
    """
    try:
        app.logger.info(f"[Contact Form {request_id}] Sending team notification email...")

        # Get email configuration
        mail_server = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
        mail_port = int(os.environ.get('MAIL_PORT', 587))
        mail_username = os.environ.get('MAIL_USERNAME')
        mail_password = os.environ.get('MAIL_PASSWORD')

        if not mail_username or not mail_password:
            app.logger.error(f"[Contact Form {request_id}] Email credentials not set")
            return

        # Team recipients
        team_emails = ['info@v3-services.com', 'Tom@v3-services.com', 'lance@v3-Services.com']

        # Email body
        email_body = f"""<h2>🔔 CALLBACK REQUESTED</h2>
<p><strong>A customer has requested a callback. Please contact them as soon as possible.</strong></p>

<h3>Contact Details:</h3>
<ul>
<li><strong>Name:</strong> {fields['name']}</li>
<li><strong>Email:</strong> {fields['email']}</li>
<li><strong>Phone:</strong> {fields['phone']}</li>
<li><strong>Company:</strong> {fields['company_name']}</li>
</ul>

<h3>Comments:</h3>
<p>{fields['comments']}</p>

<h3>GPT Auto-Reply Sent:</h3>
<p>{gpt_reply.replace(chr(10), '<br>')}</p>

<hr>
<p><small>Request ID: {request_id}<br>
Submitted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</small></p>"""

        # Create message
        msg = MIMEMultipart('alternative')
        msg['From'] = mail_username
        msg['To'] = ', '.join(team_emails)
        msg['Subject'] = f"🔔 CALLBACK REQUESTED - {fields['name']}"
        msg.attach(MIMEText(email_body, 'html'))

        # Send email
        with smtplib.SMTP(mail_server, mail_port) as server:
            server.starttls()
            server.login(mail_username, mail_password)
            server.send_message(msg)

        app.logger.info(f"[Contact Form {request_id}] Team notification sent successfully")

    except Exception as e:
        app.logger.error(f"[Contact Form {request_id}] Error sending team notification: {str(e)}")

# ==================== END CONTACT FORM AUTOMATION ====================

# --- Version tracking routes and headers ---
@app.route('/__version')
def version():
    """Return the current git commit for version tracking"""
    return jsonify({'git': GIT_SHA})

@app.route('/api/__version')
def api_version():
    """Return the current git commit for version tracking (API scope)"""
    return jsonify({'git': GIT_SHA})

@app.after_request
def after_request(response):
    """Add X-App-Commit header to all responses"""
    response.headers['X-App-Commit'] = GIT_SHA
    return response


# --- Debug Route (add this right after the blueprint registrations) ---
@app.route('/api/debug/users')
def debug_users():
    from src.models.user import User
    users = User.query.all()
    user_data = []
    for user in users:
        user_data.append({
            'email': user.email,
            'role': user.role,
            'first_name': user.first_name,
            'last_name': user.last_name
        })
    return jsonify({'users': user_data, 'count': len(users)})

# Image proxy route for document serving from ngrok
@app.route('/api/images/<path:filename>')
def serve_uploaded_image(filename):
    """
    Proxy images from the ngrok server for document viewing
    This route fetches images from the ngrok server and serves them through the Flask app
    """
    print(f"Trying to serve image: {filename}")  # Add logging
    try:
        # The ngrok server URL where documents are stored
        NGROK_URL = "https://1b069dfae07e.ngrok-free.app"
        
        # Construct the full URL to the file on the ngrok server
        file_url = f"{NGROK_URL}/files/{filename}"
        
        app.logger.info(f"Proxying image request for: {filename} from {file_url}")
        
        # Fetch the file from the ngrok server
        response = requests.get(file_url, timeout=30)
        
        if response.status_code == 200:
            # Forward the content with appropriate headers
            from flask import Response
            return Response(
                response.content,
                mimetype=response.headers.get('Content-Type', 'image/jpeg'),
                headers={
                    'Cache-Control': 'public, max-age=3600',  # Cache for 1 hour
                    'Access-Control-Allow-Origin': '*'
                }
            )
        else:
            app.logger.error(f"Failed to fetch image from ngrok server: {response.status_code}")
            return jsonify({
                'error': 'Image not found on storage server',
                'status_code': response.status_code
            }), 404
            
    except requests.exceptions.Timeout:
        app.logger.error(f"Timeout fetching image: {filename}")
        return jsonify({'error': 'Storage server timeout'}), 504
        
    except requests.exceptions.ConnectionError:
        app.logger.error(f"Connection error fetching image: {filename}")
        return jsonify({'error': 'Cannot connect to storage server'}), 503
        
    except Exception as e:
        app.logger.error(f"Error proxying image {filename}: {str(e)}")
        return jsonify({'error': 'Failed to load image'}), 500

# --- Static File Serving for Frontend ---
@app.route('/service-worker.js')
def service_worker():
    """Serve service worker with correct MIME type"""
    return send_from_directory('Public', 'service-worker.js', mimetype='application/javascript')

@app.route('/firebase-messaging-sw.js')
def firebase_messaging_sw():
    """Serve Firebase messaging service worker with correct MIME type"""
    return send_from_directory('Public', 'firebase-messaging-sw.js', mimetype='application/javascript')

@app.route('/static/<path:filename>')
def serve_static(filename):
    """Serve static files (like PDFs) from the static directory"""
    static_dir = os.path.join(os.path.dirname(__file__), 'static')
    return send_from_directory(static_dir, filename)

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    # Don't intercept API routes - let blueprints handle them
    if path.startswith('api/'):
        return jsonify({'error': 'API endpoint not found'}), 404
    
    if path != '' and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

# --- Error Handler for 500 Errors ---
@app.errorhandler(500)
def internal_server_error(e):
    app.logger.error(f"Server error: {str(e)}")
    return jsonify({"error": "An internal server error occurred. Please try again."}), 500

# --- App Initialization Block ---
with app.app_context():
    # Avoid creating tables outside Alembic in production
    if os.getenv('FLASK_ENV') == 'development' or os.getenv('RUN_DB_CREATE_ALL') == 'true':
        db.create_all()
    else:
        app.logger.info('Skipping db.create_all() in non-development environment; using Alembic migrations instead')
    init_scheduler(app)  # Then initialize scheduler
    try:
        # Optionally set Telegram webhook on startup
        from src.integrations.telegram_client import ensure_webhook
        ensure_webhook()
    except Exception as e:
        app.logger.warning(f"Skipping Telegram webhook setup: {str(e)}")

    # Seed notifications toggle if missing
    try:
        key = 'notifications_enabled'
        if Setting.get(key, None) is None:
            default_enabled = str(app.config.get('NOTIFICATIONS_ENABLED', 'true')).lower() in ('1','true','yes','on')
            Setting.set_bool(key, default_enabled)
            app.logger.info(f"Seeded {key}={default_enabled}")
    except Exception as e:
        app.logger.warning(f"Unable to seed notifications setting: {e}")

# --- Main Execution (Not used by Gunicorn/Heroku) ---
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
