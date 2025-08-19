from flask import current_app
from src.models.user import User
from src.integrations.telegram_client import send_message


def notify_agent(agent_id: int, title: str, body: str, notification_type: str = "general"):
    """
    Send notification to an agent via Telegram (if connected) and in-app notification
    
    Args:
        agent_id: ID of the agent to notify
        title: Notification title
        body: Notification message body
        notification_type: Type of notification (job_assignment, invoice_generated, etc.)
    
    Returns:
        dict: Status of notification delivery
    """
    try:
        # Get the agent
        agent = User.query.get(agent_id)
        if not agent:
            current_app.logger.warning(f"Agent {agent_id} not found for notification")
            return {"status": "error", "message": "Agent not found"}
        
        results = {"in_app": False, "telegram": False}
        
        # Send in-app notification (create Notification record)
        try:
            from src.models.user import Notification, db
            
            notification = Notification(
                user_id=agent_id,
                title=title,
                message=body,
                type=notification_type
            )
            db.session.add(notification)
            db.session.commit()
            results["in_app"] = True
            
            current_app.logger.info(f"In-app notification sent to agent {agent_id}: {title}")
            
        except Exception as e:
            current_app.logger.error(f"Failed to create in-app notification for agent {agent_id}: {str(e)}")
            db.session.rollback()
        
        # Send Telegram notification if agent is connected and opted in
        if current_app.config.get('TELEGRAM_ENABLED', False):
            if agent.telegram_chat_id and agent.telegram_opt_in:
                try:
                    # Format message for Telegram
                    telegram_message = f"<b>{title}</b>\n\n{body}"
                    
                    result = send_message(agent.telegram_chat_id, telegram_message)
                    
                    if result.get('status') != 'error':
                        results["telegram"] = True
                        current_app.logger.info(f"Telegram notification sent to agent {agent_id}: {title}")
                    else:
                        current_app.logger.error(f"Telegram notification failed for agent {agent_id}: {result.get('message')}")
                        
                except Exception as e:
                    current_app.logger.error(f"Exception sending Telegram notification to agent {agent_id}: {str(e)}")
            else:
                current_app.logger.debug(f"Agent {agent_id} not connected to Telegram or opted out")
        
        return {
            "status": "success",
            "results": results,
            "agent_name": f"{agent.first_name} {agent.last_name}"
        }
        
    except Exception as e:
        current_app.logger.error(f"Error in notify_agent for agent {agent_id}: {str(e)}")
        return {"status": "error", "message": str(e)}


def notify_job_assignment(agent_id: int, job_data: dict):
    """
    Notify agent about a new job assignment with clean, professional formatting
    
    Args:
        agent_id: ID of the agent
        job_data: Complete job information dictionary
    """
    title = "🚨 NEW JOB ASSIGNMENT"
    
    # Parse arrival time for better formatting
    from datetime import datetime
    try:
        if isinstance(job_data.get('arrival_time'), str):
            arrival_dt = datetime.strptime(job_data['arrival_time'], '%Y-%m-%d %H:%M')
        else:
            arrival_dt = job_data.get('arrival_time')
        
        formatted_date = arrival_dt.strftime('%d %b %Y')
        formatted_time = arrival_dt.strftime('%H:%M')
    except:
        formatted_date = job_data.get('arrival_time', 'TBD')
        formatted_time = ''
    
    # Priority emoji mapping
    urgency_emoji = {"High": "🔴", "Medium": "🟡", "Standard": "🟢", "Low": "🔵"}
    priority_emoji = urgency_emoji.get(job_data.get('urgency_level', 'Standard'), '🟢')
    
    # Get weather information (simplified)
    weather_info = ""
    try:
        if job_data.get('postcode'):
            import requests
            import os
            
            api_key = os.environ.get('OPENWEATHER_API_KEY')
            if api_key:
                geocoding_url = f"http://api.openweathermap.org/data/2.5/geo/1.0/zip"
                geocoding_params = {'zip': f"{job_data['postcode']},GB", 'appid': api_key}
                geocoding_response = requests.get(geocoding_url, params=geocoding_params, timeout=5)
                
                if geocoding_response.status_code == 200:
                    geocoding_data = geocoding_response.json()
                    lat, lon = geocoding_data.get('lat'), geocoding_data.get('lon')
                    
                    if lat and lon:
                        current_weather_url = f"http://api.openweathermap.org/data/2.5/weather"
                        current_params = {'lat': lat, 'lon': lon, 'appid': api_key, 'units': 'metric'}
                        current_response = requests.get(current_weather_url, params=current_params, timeout=5)
                        
                        if current_response.status_code == 200:
                            current_data = current_response.json()
                            temp = round(current_data['main']['temp'])
                            desc = current_data['weather'][0]['description'].title()
                            icon_map = {
                                '01d': '☀️', '01n': '🌙', '02d': '⛅', '02n': '☁️', '03d': '☁️', '03n': '☁️', 
                                '04d': '☁️', '04n': '☁️', '09d': '🌦️', '09n': '🌦️', '10d': '🌧️', '10n': '🌧️',
                                '11d': '⛈️', '11n': '⛈️', '13d': '🌨️', '13n': '🌨️', '50d': '🌫️', '50n': '🌫️'
                            }
                            icon = icon_map.get(current_data['weather'][0]['icon'], '🌤️')
                            weather_info = f"\n<b>🌤️ Weather:</b> {icon} {desc}, {temp}°C"
    except:
        pass
    
    # Build professional notification
    body_parts = [
        f"<b>🚨 NEW JOB ASSIGNMENT</b>",
        "",
        f"<b>📍 Location:</b>",
        f"{job_data['address']}"
    ]
    
    # Add postcode if available
    if job_data.get('postcode'):
        body_parts.append(f"{job_data['postcode']}")
    
    # Job details section
    body_parts.extend([
        "",
        f"<b>📋 Job Details:</b>",
        f"- Type: {job_data['job_type']}",
        f"- Date: {formatted_date}",
        f"- Time: {formatted_time}" if formatted_time else f"- Time: {formatted_date}",
        f"- Priority: {priority_emoji} {job_data.get('urgency_level', 'Standard')}"
    ])
    
    # Add additional details if available
    if job_data.get('agents_required', 1) > 1:
        body_parts.append(f"- Agents Required: {job_data['agents_required']}")
    
    if job_data.get('hourly_rate'):
        body_parts.append(f"- Rate: £{job_data['hourly_rate']}/hour")
    
    if job_data.get('lead_agent_name'):
        body_parts.append(f"- Lead Agent: {job_data['lead_agent_name']}")
    
    if job_data.get('police_liaison_required'):
        body_parts.append("- 👮‍♂️ Police Liaison Required")
    
    # Instructions section
    if job_data.get('instructions'):
        body_parts.extend([
            "",
            f"<b>📝 Instructions:</b>",
            f"{job_data['instructions']}"
        ])
    
    # Navigation section
    navigation_link = ""
    if job_data.get('maps_link'):
        navigation_link = job_data['maps_link']
    elif job_data.get('location_lat') and job_data.get('location_lng'):
        navigation_link = f"https://www.google.com/maps/dir/?api=1&destination={job_data['location_lat']},{job_data['location_lng']}"
    else:
        navigation_link = f"https://www.google.com/maps/search/?api=1&query={job_data['address'].replace(' ', '+')}"
    
    body_parts.extend([
        "",
        f"<b>🗺 Navigation:</b>",
        f"<a href='{navigation_link}'>Open in Maps</a>"
    ])
    
    # Add weather if available
    if weather_info:
        body_parts.append(weather_info)
    
    # Action required section
    body_parts.extend([
        "",
        f"<b>⚠️ ACTION REQUIRED:</b>",
        f"Open V3 Services app → Jobs → Pending",
        f"Accept or decline this assignment"
    ])
    
    body = "\n".join(body_parts)
    
    return notify_agent(agent_id, title, body, "job_assignment")


def notify_invoice_generated(agent_id: int, invoice_number: str, amount: float):
    """
    Notify agent that their invoice has been generated
    
    Args:
        agent_id: ID of the agent
        invoice_number: Generated invoice number
        amount: Invoice total amount
    """
    title = f"Invoice {invoice_number} Generated"
    body = f"Your invoice {invoice_number} for £{amount:.2f} has been generated and is ready for download."
    
    return notify_agent(agent_id, title, body, "invoice_generated")


def notify_job_update(agent_id: int, job_title: str, update_message: str):
    """
    Notify agent about job updates
    
    Args:
        agent_id: ID of the agent
        job_title: Title of the job
        update_message: Update details
    """
    title = f"Job Update: {job_title}"
    body = update_message
    
    return notify_agent(agent_id, title, body, "job_update")


def notify_payment_received(agent_id: int, invoice_number: str, amount: float):
    """
    Notify agent that their invoice has been marked as paid
    
    Args:
        agent_id: ID of the agent
        invoice_number: Paid invoice number
        amount: Payment amount
    """
    title = "💰 PAYMENT RECEIVED"
    
    body = f"""<b>💰 PAYMENT RECEIVED</b>

Invoice <code>#{invoice_number}</code> - £{amount:.2f}
Status: ✅ Paid
Processed by: Admin

Thank you for your service!"""
    
    return notify_agent(agent_id, title, body, "payment_received")


def send_test_notification(agent_id: int):
    """
    Send a test notification to verify the system is working
    
    Args:
        agent_id: ID of the agent to send test to
    
    Returns:
        dict: Result of the test
    """
    try:
        agent = User.query.get(agent_id)
        if not agent:
            return {"status": "error", "message": "Agent not found"}
        
        title = "Test Notification"
        body = f"Hello {agent.first_name}! This is a test notification to verify your notification settings are working correctly. ✅"
        
        return notify_agent(agent_id, title, body, "test")
        
    except Exception as e:
        current_app.logger.error(f"Error sending test notification to agent {agent_id}: {str(e)}")
        return {"status": "error", "message": str(e)}


def bulk_notify_agents(agent_ids: list, title: str, body: str, notification_type: str = "general"):
    """
    Send notification to multiple agents
    
    Args:
        agent_ids: List of agent IDs
        title: Notification title
        body: Notification message body
        notification_type: Type of notification
    
    Returns:
        dict: Summary of delivery results
    """
    results = {"success": [], "failed": []}
    
    for agent_id in agent_ids:
        try:
            result = notify_agent(agent_id, title, body, notification_type)
            if result["status"] == "success":
                results["success"].append({
                    "agent_id": agent_id,
                    "agent_name": result.get("agent_name"),
                    "delivery": result.get("results")
                })
            else:
                results["failed"].append({
                    "agent_id": agent_id,
                    "error": result.get("message")
                })
        except Exception as e:
            results["failed"].append({
                "agent_id": agent_id,
                "error": str(e)
            })
    
    current_app.logger.info(f"Bulk notification sent: {len(results['success'])} success, {len(results['failed'])} failed")
    
    return {
        "status": "completed",
        "total": len(agent_ids),
        "success_count": len(results["success"]),
        "failed_count": len(results["failed"]),
        "results": results
    }
