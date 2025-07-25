# Firebase Cloud Messaging (FCM) Setup Guide

This guide will help you set up Firebase Cloud Messaging for the V3 Services mobile app push notification system.

## Prerequisites

- Google/Firebase account
- Access to Firebase Console (https://console.firebase.google.com)

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project" or "Add project"
3. Enter project name: `v3-services-app` (or your preferred name)
4. Enable Google Analytics (optional but recommended)
5. Choose or create a Google Analytics account
6. Click "Create project"

## Step 2: Enable Cloud Messaging

1. In your Firebase project dashboard, click on "Cloud Messaging" in the left sidebar
2. If not already enabled, click "Enable" to activate Cloud Messaging

## Step 3: Generate Service Account Key (Server-side)

1. Go to Project Settings (gear icon) → "Service accounts" tab
2. Click "Generate new private key"
3. Download the JSON file - this contains your service account credentials
4. **Important**: Keep this file secure - it provides admin access to your Firebase project

## Step 4: Get Web App Configuration

1. In Project Settings → "General" tab
2. Scroll down to "Your apps" section
3. Click "Add app" → Web app (</> icon)
4. Enter app nickname: `v3-services-web`
5. Check "Also set up Firebase Hosting" (optional)
6. Click "Register app"
7. Copy the Firebase config object - you'll need these values

## Step 5: Generate VAPID Keys

1. Go to Project Settings → "Cloud Messaging" tab
2. Scroll down to "Web configuration"
3. Click "Generate key pair" under "Web push certificates"
4. Copy the generated VAPID key

## Step 6: Configure Environment Variables

Create a `.env` file in your project root (copy from `.env.example`) and fill in these values:

### Firebase Service Account (from Step 3)
```bash
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"your-project-id",...}
```
**Note**: This should be the entire JSON content as a single line string.

### Firebase Web Configuration (from Step 4)
```bash
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

### Firebase VAPID Key (from Step 5)
```bash
VITE_FIREBASE_VAPID_KEY=your-vapid-key-here
```

## Step 7: Update Service Worker Configuration

Edit `public/firebase-messaging-sw.js` and replace the placeholder Firebase config with your actual values:

```javascript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

## Step 8: Run Database Migration

Create the FCM tokens table:

```bash
# Create migration
flask db revision -m "Add FCM tokens table"

# Run migration
flask db upgrade
```

## Step 9: Test the Setup

1. Start your application
2. Navigate to the Notifications page as an agent user
3. Click "Enable Notifications" in the FCM setup component
4. Grant browser notification permission
5. Check that the token registration works
6. Test sending notifications via the admin debug endpoint

## Step 10: Mobile App Configuration (Future)

When wrapping this into a native mobile app:

### Android
1. Add your Android app to the Firebase project
2. Download `google-services.json`
3. Configure FCM in your Android app

### iOS  
1. Add your iOS app to the Firebase project
2. Download `GoogleService-Info.plist`
3. Configure FCM in your iOS app
4. Set up APNs authentication

## Testing Push Notifications

### Web Browser Testing
1. Open browser developer tools → Application tab → Service Workers
2. Verify the Firebase service worker is registered
3. Use the `/api/notifications/fcm/test` endpoint to send test notifications

### Debug Endpoints
- `GET /api/debug/fcm/status` - Check FCM service status
- `POST /api/notifications/fcm/test` - Send test notification
- `GET /api/notifications/fcm/tokens` - View user's FCM tokens

## Troubleshooting

### Common Issues

1. **Service Worker Not Loading**
   - Check that `firebase-messaging-sw.js` is in the `public` folder
   - Verify the Firebase config is correct
   - Check browser console for errors

2. **Token Registration Fails**
   - Verify VAPID key is correct
   - Check that notification permission is granted
   - Ensure Firebase project has Cloud Messaging enabled

3. **Notifications Not Received**
   - Check FCM token is valid and active
   - Verify service account JSON is correct
   - Test with debug endpoint first

4. **CORS Issues**
   - Make sure your domain is added to Firebase authorized domains
   - Check CORS configuration in Flask app

### Security Notes

- Never commit the service account JSON to version control
- Use environment variables for all sensitive configuration
- Regularly rotate your service account keys
- Monitor FCM usage in Firebase Console

## Production Deployment

### Heroku
Add all environment variables to your Heroku app:
```bash
heroku config:set FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
heroku config:set VITE_FIREBASE_API_KEY=your-api-key
# ... add all other Firebase environment variables
```

### Other Platforms
Ensure all Firebase environment variables are properly configured in your deployment environment.

## Mobile App Future Considerations

This FCM implementation is designed to work seamlessly when the web app is wrapped into a native mobile app using frameworks like:

- React Native with WebView
- Apache Cordova/PhoneGap  
- Ionic with Capacitor
- Flutter with WebView

The same notification infrastructure will power both web and mobile notifications.

## Support

If you encounter issues:
1. Check Firebase Console for error logs
2. Review browser console for client-side errors
3. Check server logs for FCM send failures
4. Test with the debug endpoints to isolate issues