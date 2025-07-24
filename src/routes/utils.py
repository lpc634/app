import os
import what3words
from flask import Blueprint, jsonify, request, current_app

# --- Blueprint Setup ---
utils_bp = Blueprint('utils_bp', __name__)

# --- what3words API Key ---
# Make sure to add your WHAT3WORDS_API_KEY to your .env file
W3W_API_KEY = os.environ.get('WHAT3WORDS_API_KEY')
geocoder = what3words.Geocoder(W3W_API_KEY) if W3W_API_KEY else None

# --- API Routes ---
@utils_bp.route('/what3words/convert-to-3wa', methods=['POST'])
def convert_to_3wa():
    """
    Converts latitude and longitude coordinates to a what3words address.
    Expects JSON payload with "lat" and "lng".
    """
    if not geocoder:
        return jsonify({"error": "what3words API key is not configured on the server"}), 500

    data = request.get_json()
    if not data or 'lat' not in data or 'lng' not in data:
        return jsonify({"error": "Latitude (lat) and Longitude (lng) are required"}), 400

    try:
        lat = float(data['lat'])
        lng = float(data['lng'])
        
        # Fixed: Use the correct what3words API call format
        # The convert_to_3wa method expects direct lat, lng parameters
        res = geocoder.convert_to_3wa(lat, lng)
        
        if 'words' in res:
            return jsonify({"three_word_address": res['words']})
        else:
            return jsonify({"error": "Could not convert coordinates to a 3-word address"}), 500
            
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid latitude or longitude format"}), 400
    except Exception as e:
        # Log the error for debugging
        current_app.logger.error(f"what3words API error: {e}")
        return jsonify({"error": "An unexpected error occurred with the what3words service"}), 500