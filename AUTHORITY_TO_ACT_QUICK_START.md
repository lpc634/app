# Authority to Act Form - Quick Start Guide

## ✅ What's Already Done

All backend infrastructure is complete and ready:
- ✅ Database model created
- ✅ API endpoints created (both admin and public)
- ✅ Telegram notification integration
- ✅ Admin UI for generating links
- ✅ Public form page with token validation
- ✅ Routes registered in App.jsx
- ✅ Blueprint registered in main.py

## 🎯 What You Need to Do

### Step 1: Run Database Migration

```bash
python add_authority_to_act_table.py
```

This creates the `authority_to_act_tokens` table in your database.

### Step 2: Add Your Form Code

Edit this file:
```
src/components/forms/ClientInstructionFormAuthorityToActSquatterEviction.tsx
```

Your form should look something like this:

```typescript
import React from 'react';

interface FormData {
  client_name?: string;
  client_email?: string;
  property_address?: string;
}

interface Props {
  prefillData?: FormData;
  onSubmit: (data: any) => void;
}

export default function ClientInstructionFormAuthorityToActSquatterEviction({
  prefillData,
  onSubmit
}: Props) {
  const [formData, setFormData] = React.useState({
    client_name: prefillData?.client_name || '',
    client_email: prefillData?.client_email || '',
    property_address: prefillData?.property_address || '',
    // Add your other fields here
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Add your form fields here */}
      <div>
        <label className="block text-sm font-medium mb-1">Client Name</label>
        <input
          type="text"
          value={formData.client_name}
          onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg"
          required
        />
      </div>

      {/* Add more fields... */}

      <button
        type="submit"
        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Submit Authority to Act
      </button>
    </form>
  );
}
```

### Step 3: Connect Form to Public Page

Edit this file:
```
src/Pages/PublicAuthorityToActPage.jsx
```

Replace the placeholder section with:

```jsx
import ClientInstructionForm from '@/components/forms/ClientInstructionFormAuthorityToActSquatterEviction';

// ... inside the component, replace the placeholder div with:

<ClientInstructionForm
  prefillData={formData}
  onSubmit={handleSubmit}
/>
```

### Step 4: Test the System

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Login as admin and navigate to:**
   - Look for the **"Authority to Act"** tab in the main admin sidebar navigation
   - Or go directly to: `http://localhost:5173/admin/authority-to-act`

3. **Generate a test link:**
   - Click "Generate New Link"
   - Optionally fill in client details
   - Click "Generate & Copy Link"

4. **Test the public form:**
   - Open the copied link in a private/incognito window
   - Fill out the form
   - Submit it

5. **Verify success:**
   - Check your Telegram admin group for notification
   - Go back to admin dashboard and see the submission marked as "Submitted"

## 📋 API Endpoints Reference

### Admin Endpoints (require auth token)

**Generate Link:**
```bash
POST /api/admin/authority-to-act/generate-link
Authorization: Bearer <token>
Content-Type: application/json

{
  "client_name": "John Smith",
  "client_email": "john@example.com",
  "property_address": "123 Main St, London",
  "expires_in_days": 30
}
```

**List All Links:**
```bash
GET /api/admin/authority-to-act/links
Authorization: Bearer <token>
```

**Get Submission Details:**
```bash
GET /api/admin/authority-to-act/<link_id>
Authorization: Bearer <token>
```

### Public Endpoints (no auth required)

**Get Form Data:**
```bash
GET /api/public/authority-to-act/<token>
```

**Submit Form:**
```bash
POST /api/public/authority-to-act/<token>/submit
Content-Type: application/json

{
  "client_name": "John Smith",
  "client_email": "john@example.com",
  "property_address": "123 Main St",
  // ... all your form fields
}
```

## 🔧 Environment Variables

Make sure these are in your `.env` file:

```bash
# Telegram (required for notifications)
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ADMIN_CHAT_ID=your_admin_group_chat_id
TELEGRAM_ADMIN_THREAD_ID=your_thread_id  # optional

# Public URL (for generating links)
PUBLIC_BASE_URL=https://v3-app.herokuapp.com
```

## 🚀 Deployment Checklist

Before deploying to production:

1. ✅ Run migration on production database
2. ✅ Set all required environment variables
3. ✅ Test link generation in production
4. ✅ Test form submission in production
5. ✅ Verify Telegram notifications work
6. ✅ Test link expiration behavior
7. ✅ Test with already-submitted links (should show error)

## 🎨 Styling Notes

- Admin UI uses Tailwind CSS with clean, professional styling
- Public form page has minimal styling (white background, centered layout)
- Form component can use any styling you want (Tailwind, custom CSS, etc.)
- The page is responsive and works on mobile

## 🔐 Security Features

- **Secure Tokens:** 64-character cryptographically secure tokens
- **Expiration:** Links can expire after X days (configurable)
- **One-Time Use:** Links are marked as submitted and cannot be reused
- **Validation:** Every request validates token and checks expiration
- **No Authentication Required:** Public links work without login
- **Protected Admin Routes:** Only admins can generate/view links

## 📞 Support

If you encounter issues:

1. Check browser console for errors
2. Check backend logs for API errors
3. Verify database migration ran successfully
4. Verify Telegram environment variables are set correctly
5. Test in incognito mode to ensure no auth conflicts

## 🎉 You're All Set!

Once you complete Steps 1-3 above, the entire system will be fully functional. The infrastructure is rock-solid and production-ready!
