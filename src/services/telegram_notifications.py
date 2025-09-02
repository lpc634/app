"""
Telegram notification service for sending job notifications to agents
"""
import logging
import os
import requests
from flask import current_app
from src.integrations.telegram_client import send_message
from urllib.parse import quote_plus
from datetime import datetime
from flask import current_app
from src.integrations.telegram_client import send_message as _send


def fetch_weather(latitude: float, longitude: float) -> dict:
    """Return simple weather summary for a coordinate.

    Uses OpenWeather current weather API when OPENWEATHER_API_KEY is set.
    Returns a minimal, robust structure used by Telegram messages.
    """
    api_key = os.environ.get("OPENWEATHER_API_KEY")
    if not api_key:
        return {"summary": "Unavailable", "temp_c": None, "wind_mph": None, "precip_prob": None}

    try:
        url = "https://api.openweathermap.org/data/2.5/weather"
        params = {"lat": latitude, "lon": longitude, "appid": api_key, "units": "metric"}
        resp = requests.get(url, params=params, timeout=10)
        if resp.status_code != 200:
            return {"summary": "Unavailable", "temp_c": None, "wind_mph": None, "precip_prob": None}
        data = resp.json() or {}

        weather_list = data.get("weather") or []
        description = (weather_list[0].get("description") if weather_list else "Weather") or "Weather"
        summary = description.capitalize()

        main = data.get("main") or {}
        wind = data.get("wind") or {}
        temp_c = main.get("temp")
        wind_mps = wind.get("speed")
        wind_mph = (wind_mps * 2.23694) if isinstance(wind_mps, (int, float)) else None

        # OpenWeather current API does not provide POP directly; leave None
        precip_prob = None

        return {"summary": summary, "temp_c": temp_c, "wind_mph": wind_mph, "precip_prob": precip_prob}
    except Exception:
        return {"summary": "Unavailable", "temp_c": None, "wind_mph": None, "precip_prob": None}


def is_enabled():
    """Check if Telegram notifications are enabled"""
    return current_app.config.get("TELEGRAM_ENABLED", False)


def _area_label(job) -> str:
    for cand in [getattr(job, "town", None), getattr(job, "city", None)]:
        if cand:
            return str(cand)
    pc = getattr(job, "postcode", None)
    if pc:
        return str(pc).split(" ")[0]
    for cand in [getattr(job, "county", None), getattr(job, "region", None)]:
        if cand:
            return str(cand)
    return "Location revealed after acceptance"

def _format_dt(dt: datetime) -> str:
    try:
        return dt.strftime('%a %d %b %H:%M')
    except Exception:
        return str(dt)

def _build_maps(job) -> str:
    addr = getattr(job, 'address', None) or getattr(job, 'full_address', None)
    if addr:
        return f"https://maps.google.com/?q={quote_plus(addr)}"
    lat = getattr(job, 'location_lat', None) or getattr(job, 'lat', None)
    lng = getattr(job, 'location_lng', None) or getattr(job, 'lng', None)
    if lat and lng:
        return f"https://maps.google.com/?q={lat},{lng}"
    return "Maps link unavailable"

def _send_admin_group(text: str) -> bool:
    chat_id = current_app.config.get("TELEGRAM_ADMIN_CHAT_ID")
    if not chat_id:
        return False
    thread_id = current_app.config.get("TELEGRAM_ADMIN_THREAD_ID")
    try:
        _send(chat_id=chat_id, text=text, parse_mode="HTML", message_thread_id=int(thread_id) if thread_id else None)
        return True
    except Exception:
        return False

def send_job_assignment_notification(agent, job):
    """
    Send job assignment notification to agent via Telegram
    
    Args:
        agent: User object with telegram_chat_id
        job: Job object with job details
    
    Returns:
        bool: True if sent successfully, False otherwise
    """
    if not is_enabled():
        logging.info("Telegram notifications disabled, skipping job assignment notification")
        return False
    
    if not agent.telegram_chat_id or not agent.telegram_opt_in:
        logging.info(f"Agent {agent.id} has no Telegram chat_id or opted out, skipping notification")
        return False
    
    try:
        # Pre-accept: no exact location, no maps, no priority
        message = (
            "🆕 <b>New Job Assignment</b>\n\n"
            f"<b>Job:</b> {job.title or job.job_type}\n"
            f"<b>Date/Time:</b> {_format_dt(job.arrival_time) if getattr(job,'arrival_time',None) else 'TBC'}\n"
            f"<b>Area:</b> {_area_label(job)}\n\n"
            "Please open the V3 Services app → Jobs → Pending to accept or decline."
        )
        # Admin broadcast for job creation/assignment
        try:
            _send_admin_group(
                (
                    "📝 <b>Job Created</b>\n\n"
                    f"<b>Job:</b> #{getattr(job,'id','?')} — {job.title or job.job_type}\n"
                    f"<b>When:</b> {_format_dt(job.arrival_time) if getattr(job,'arrival_time',None) else 'TBC'}\n"
                    f"<b>Area:</b> {_area_label(job)}\n"
                )
            )
        except Exception:
            pass
        
        result = send_message(agent.telegram_chat_id, message)
        
        if result.get("ok"):
            logging.info(f"Job assignment notification sent to agent {agent.id} via Telegram")
            return True
        else:
            logging.warning(f"Failed to send job assignment notification to agent {agent.id}: {result}")
            return False
            
    except Exception as e:
        logging.error(f"Error sending job assignment notification to agent {agent.id}: {str(e)}")
        return False


def send_job_acceptance_notification(agent, job):
    """
    Send job acceptance confirmation to agent via Telegram
    
    Args:
        agent: User object with telegram_chat_id  
        job: Job object with job details
    
    Returns:
        bool: True if sent successfully, False otherwise
    """
    if not is_enabled():
        logging.info("Telegram notifications disabled, skipping job acceptance notification")
        return False
    
    if not agent.telegram_chat_id or not agent.telegram_opt_in:
        return False
    
    try:
        # Post-accept: include full address, maps. Weather optional - integrate when service available.
        maps_link = _build_maps(job)
        # Weather using actual location where possible
        try:
            lat = getattr(job, 'location_lat', None) or getattr(job, 'lat', None)
            lng = getattr(job, 'location_lng', None) or getattr(job, 'lng', None)
            weather = fetch_weather(float(lat), float(lng)) if lat and lng else {"summary":"Unavailable","temp_c":None,"wind_mph":None,"precip_prob":None}
        except Exception:
            weather = {"summary":"Unavailable","temp_c":None,"wind_mph":None,"precip_prob":None}
        temp_txt = f"{round(weather['temp_c'])}°C" if isinstance(weather.get('temp_c'), (int, float)) else "–"
        wind_txt = f"{round(weather['wind_mph'])} mph" if isinstance(weather.get('wind_mph'), (int, float)) else "–"
        pop_txt  = f"{round(weather['precip_prob'])}%" if isinstance(weather.get('precip_prob'), (int, float)) else "–"
        message = (
            "✅ <b>Job Accepted</b>\n\n"
            "<b>Job Details:</b>\n"
            f"• <b>Type:</b> {job.title or job.job_type}\n"
            f"• <b>Date/Time:</b> {_format_dt(job.arrival_time) if getattr(job,'arrival_time',None) else 'TBC'}\n"
            f"• <b>Location:</b> {getattr(job,'address',None) or getattr(job,'full_address','Address unavailable')}\n"
            f"• <b>Maps:</b> {maps_link}\n\n"
            "<b>Weather (at start):</b>\n"
            f"• {weather.get('summary','Unavailable')}, {temp_txt}, wind {wind_txt}, precip {pop_txt}\n\n"
            "Please check the app for full instructions."
        )
        
        result = send_message(agent.telegram_chat_id, message)
        
        if result.get("ok"):
            logging.info(f"Job acceptance notification sent to agent {agent.id} via Telegram")
            return True
        else:
            logging.warning(f"Failed to send job acceptance notification to agent {agent.id}: {result}")
            return False
            
    except Exception as e:
        logging.error(f"Error sending job acceptance notification to agent {agent.id}: {str(e)}")
        return False


def send_invoice_notification(agent, invoice):
    """
    Send invoice ready notification to agent via Telegram
    
    Args:
        agent: User object with telegram_chat_id
        invoice: Invoice object with invoice details
    
    Returns:
        bool: True if sent successfully, False otherwise
    """
    if not is_enabled():
        logging.info("Telegram notifications disabled, skipping invoice notification")
        return False
    
    if not agent.telegram_chat_id or not agent.telegram_opt_in:
        return False
    
    try:
        message = f"""
📄 <b>Invoice Ready</b>

<b>Invoice #:</b> {invoice.invoice_number}
<b>Amount:</b> £{float(invoice.total_amount):.2f}
<b>Due Date:</b> {invoice.due_date.strftime('%d/%m/%Y')}

Your invoice is ready for download in the V3 Services app.
        """.strip()
        
        result = send_message(agent.telegram_chat_id, message)
        
        if result.get("ok"):
            logging.info(f"Invoice notification sent to agent {agent.id} via Telegram")
            return True
        else:
            logging.warning(f"Failed to send invoice notification to agent {agent.id}: {result}")
            return False
            
    except Exception as e:
        logging.error(f"Error sending invoice notification to agent {agent.id}: {str(e)}")
        return False


def send_generic_notification(agent, title, message):
    """
    Send generic notification to agent via Telegram
    
    Args:
        agent: User object with telegram_chat_id
        title: Notification title
        message: Notification message
    
    Returns:
        bool: True if sent successfully, False otherwise
    """
    if not is_enabled():
        logging.info("Telegram notifications disabled, skipping generic notification")
        return False
    
    if not agent.telegram_chat_id or not agent.telegram_opt_in:
        return False
    
    try:
        formatted_message = f"""
📢 <b>{title}</b>

{message}
        """.strip()
        
        result = send_message(agent.telegram_chat_id, formatted_message)
        
        if result.get("ok"):
            logging.info(f"Generic notification sent to agent {agent.id} via Telegram")
            return True
        else:
            logging.warning(f"Failed to send generic notification to agent {agent.id}: {result}")
            return False
            
    except Exception as e:
        logging.error(f"Error sending generic notification to agent {agent.id}: {str(e)}")
        return False