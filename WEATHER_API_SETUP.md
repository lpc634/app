# Weather API Setup Guide

The V3 Services app includes weather forecast functionality for job details. This guide explains how to set up the OpenWeatherMap API integration.

## Current Status

✅ **Geocoding**: Working - Converts addresses to coordinates  
❌ **Weather API**: Not configured - Missing API key  

## Setup Instructions

### 1. Get OpenWeatherMap API Key

1. Visit [OpenWeatherMap API](https://openweathermap.org/api)
2. Sign up for a free account
3. Navigate to "My API keys" section
4. Copy your API key

### 2. Configure Environment Variable

**For Heroku Production:**
```bash
heroku config:set OPENWEATHER_API_KEY=your_actual_api_key_here --app v3-app
heroku restart --app v3-app
```

**For Local Development:**
```bash
# Add to your .env file
OPENWEATHER_API_KEY=your_actual_api_key_here
```

### 3. Test Configuration

After setting up the API key, test it using the debug endpoint:

**GET** `/api/debug/weather-test` (Admin only)

This endpoint will:
- Check API key configuration status
- Test weather API with sample coordinates (Camberley, Surrey: 51.349, -0.727)
- Provide detailed error information if something fails
- Show setup instructions

## How It Works

1. **Job Creation**: When admins create jobs with addresses
2. **Geocoding**: Address is converted to coordinates using OpenStreetMap
3. **Weather Fetch**: Coordinates are used to get weather forecast from OpenWeatherMap
4. **Display**: Agents see weather conditions and clothing recommendations

## Weather Features

- 🌤️ **Current Conditions**: Weather description and temperature
- 👕 **Clothing Advice**: Temperature-based clothing recommendations
- 📍 **Location Specific**: Uses exact job coordinates
- 🕒 **Time Accurate**: Finds forecast closest to job arrival time
- 🔄 **Fallback Handling**: Shows seasonal recommendations when API unavailable

## Error Messages Explained

| Message | Cause | Solution |
|---------|-------|----------|
| "Weather API key not configured" | OPENWEATHER_API_KEY not set | Follow setup instructions above |
| "Weather API error - Invalid API key" | Wrong/expired API key | Check API key is correct and active |
| "Weather API error - Rate limit exceeded" | Too many requests | Wait or upgrade API plan |
| "Weather API error - Request timeout" | Network issues | Usually temporary, will resolve |

## Sample Weather Display

When working properly, agents will see:

```
🌤️ Weather Forecast
Partly cloudy, 12°C

👕 Clothing Recommendation  
Light jacket or sweater recommended.
```

## Free API Limits

OpenWeatherMap free tier includes:
- 1,000 API calls per day
- 60 calls per minute
- 5 day weather forecast
- No setup cost

This is sufficient for typical V3 Services usage.