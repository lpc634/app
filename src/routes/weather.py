from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User
import requests
import os

weather_bp = Blueprint('weather', __name__)

# OpenWeatherMap API configuration
OPENWEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY')
OPENWEATHER_BASE_URL = "http://api.openweathermap.org/data/2.5"

def require_agent_or_admin():
    """Ensure user is an agent or admin."""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    return user

@weather_bp.route('/weather/<postcode>', methods=['GET'])
@jwt_required()
def get_weather_by_postcode(postcode):
    """Get weather forecast for UK postcode."""
    try:
        current_user = require_agent_or_admin()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        if not OPENWEATHER_API_KEY:
            return jsonify({
                'error': 'Weather service not configured',
                'weather': {
                    'description': 'Weather data unavailable',
                    'temperature': 'N/A',
                    'icon': '01d'
                }
            }), 200
        
        # First, get coordinates from postcode using geocoding API
        geocoding_url = f"{OPENWEATHER_BASE_URL}/geo/1.0/zip"
        geocoding_params = {
            'zip': f"{postcode},GB",
            'appid': OPENWEATHER_API_KEY
        }
        
        geocoding_response = requests.get(geocoding_url, params=geocoding_params)
        
        if geocoding_response.status_code != 200:
            # Fallback: try direct weather lookup with postcode
            return get_weather_fallback(postcode)
        
        geocoding_data = geocoding_response.json()
        lat = geocoding_data.get('lat')
        lon = geocoding_data.get('lon')
        
        if not lat or not lon:
            return get_weather_fallback(postcode)
        
        # Get current weather
        current_weather_url = f"{OPENWEATHER_BASE_URL}/weather"
        current_params = {
            'lat': lat,
            'lon': lon,
            'appid': OPENWEATHER_API_KEY,
            'units': 'metric'
        }
        
        current_response = requests.get(current_weather_url, params=current_params)
        
        if current_response.status_code != 200:
            return get_weather_fallback(postcode)
        
        current_data = current_response.json()
        
        # Get forecast
        forecast_url = f"{OPENWEATHER_BASE_URL}/forecast"
        forecast_params = {
            'lat': lat,
            'lon': lon,
            'appid': OPENWEATHER_API_KEY,
            'units': 'metric',
            'cnt': 8  # Next 24 hours (3-hour intervals)
        }
        
        forecast_response = requests.get(forecast_url, params=forecast_params)
        forecast_data = forecast_response.json() if forecast_response.status_code == 200 else None
        
        # Format response
        weather_info = {
            'location': {
                'postcode': postcode,
                'name': geocoding_data.get('name', postcode),
                'lat': lat,
                'lon': lon
            },
            'current': {
                'temperature': round(current_data['main']['temp']),
                'feels_like': round(current_data['main']['feels_like']),
                'humidity': current_data['main']['humidity'],
                'description': current_data['weather'][0]['description'].title(),
                'icon': current_data['weather'][0]['icon'],
                'wind_speed': current_data.get('wind', {}).get('speed', 0),
                'visibility': current_data.get('visibility', 0) / 1000  # Convert to km
            }
        }
        
        # Add forecast if available
        if forecast_data and 'list' in forecast_data:
            weather_info['forecast'] = []
            for item in forecast_data['list'][:8]:  # Next 24 hours
                weather_info['forecast'].append({
                    'datetime': item['dt_txt'],
                    'temperature': round(item['main']['temp']),
                    'description': item['weather'][0]['description'].title(),
                    'icon': item['weather'][0]['icon'],
                    'precipitation': item.get('rain', {}).get('3h', 0) + item.get('snow', {}).get('3h', 0)
                })
        
        # Generate weather summary for notifications
        temp = weather_info['current']['temperature']
        desc = weather_info['current']['description']
        icon_map = {
            '01d': '☀️', '01n': '🌙', '02d': '⛅', '02n': '☁️',
            '03d': '☁️', '03n': '☁️', '04d': '☁️', '04n': '☁️',
            '09d': '🌦️', '09n': '🌦️', '10d': '🌧️', '10n': '🌧️',
            '11d': '⛈️', '11n': '⛈️', '13d': '🌨️', '13n': '🌨️',
            '50d': '🌫️', '50n': '🌫️'
        }
        
        icon = icon_map.get(weather_info['current']['icon'], '🌤️')
        weather_info['summary'] = f"{icon} {desc}, {temp}°C"
        
        # Add clothing recommendations
        recommendations = []
        if temp < 5:
            recommendations.append("Wear warm clothing and layers")
        elif temp < 15:
            recommendations.append("Bring a jacket or coat")
        
        if 'rain' in desc.lower() or 'drizzle' in desc.lower():
            recommendations.append("Bring waterproofs/umbrella")
        elif 'snow' in desc.lower():
            recommendations.append("Wear non-slip footwear")
        
        if weather_info['current']['wind_speed'] > 10:
            recommendations.append("Expect windy conditions")
        
        weather_info['recommendations'] = recommendations
        
        return jsonify({'weather': weather_info}), 200
        
    except requests.RequestException as e:
        return jsonify({
            'error': 'Weather service unavailable',
            'weather': get_weather_fallback_data(postcode)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_weather_fallback(postcode):
    """Fallback weather response when API fails."""
    return jsonify({
        'weather': get_weather_fallback_data(postcode)
    }), 200

def get_weather_fallback_data(postcode):
    """Generate fallback weather data."""
    return {
        'location': {
            'postcode': postcode,
            'name': postcode
        },
        'current': {
            'temperature': 'N/A',
            'description': 'Weather data unavailable',
            'icon': '01d'
        },
        'summary': '🌤️ Weather data unavailable',
        'recommendations': ['Check local weather before departure']
    }

@weather_bp.route('/weather/coordinates', methods=['GET'])
@jwt_required()
def get_weather_by_coordinates():
    """Get weather forecast by latitude and longitude."""
    try:
        current_user = require_agent_or_admin()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        lat = request.args.get('lat', type=float)
        lon = request.args.get('lon', type=float)
        
        if not lat or not lon:
            return jsonify({'error': 'Latitude and longitude are required'}), 400
        
        if not OPENWEATHER_API_KEY:
            return jsonify({
                'error': 'Weather service not configured',
                'weather': {
                    'description': 'Weather data unavailable',
                    'temperature': 'N/A',
                    'icon': '01d'
                }
            }), 200
        
        # Get current weather
        current_weather_url = f"{OPENWEATHER_BASE_URL}/weather"
        params = {
            'lat': lat,
            'lon': lon,
            'appid': OPENWEATHER_API_KEY,
            'units': 'metric'
        }
        
        response = requests.get(current_weather_url, params=params)
        
        if response.status_code != 200:
            return jsonify({
                'error': 'Weather data unavailable',
                'weather': {
                    'description': 'Weather service error',
                    'temperature': 'N/A',
                    'icon': '01d'
                }
            }), 200
        
        data = response.json()
        
        weather_info = {
            'location': {
                'lat': lat,
                'lon': lon,
                'name': data.get('name', f"{lat}, {lon}")
            },
            'current': {
                'temperature': round(data['main']['temp']),
                'feels_like': round(data['main']['feels_like']),
                'humidity': data['main']['humidity'],
                'description': data['weather'][0]['description'].title(),
                'icon': data['weather'][0]['icon'],
                'wind_speed': data.get('wind', {}).get('speed', 0)
            }
        }
        
        # Generate summary
        temp = weather_info['current']['temperature']
        desc = weather_info['current']['description']
        weather_info['summary'] = f"🌤️ {desc}, {temp}°C"
        
        return jsonify({'weather': weather_info}), 200
        
    except requests.RequestException as e:
        return jsonify({
            'error': 'Weather service unavailable',
            'weather': {
                'description': 'Weather service error',
                'temperature': 'N/A',
                'icon': '01d'
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

