import secrets

print("🔐 Generating secure secret keys...\n")

# Generate SECRET_KEY (64 characters)
secret_key = secrets.token_hex(32)

# Generate VAPID keys (for push notifications)
vapid_private = secrets.token_urlsafe(32)
vapid_public = secrets.token_urlsafe(32)

print("✅ Secrets generated!\n")
print("=" * 60)
print("COPY THESE - YOU'LL NEED THEM!\n")
print(f"SECRET_KEY={secret_key}")
print(f"VAPID_PRIVATE_KEY={vapid_private}")
print(f"VAPID_PUBLIC_KEY={vapid_public}")
print("=" * 60)

# Save to .env.local for local development
with open('.env.local', 'w') as f:
    f.write("# Local Development Environment Variables\n")
    f.write("# ⚠️ NEVER commit this file to Git!\n\n")
    f.write(f"SECRET_KEY={secret_key}\n")
    f.write(f"VAPID_PRIVATE_KEY={vapid_private}\n")
    f.write(f"VAPID_PUBLIC_KEY={vapid_public}\n")
    f.write("VITE_API_BASE_URL=http://localhost:5001/api\n")

print("\n✅ Saved to .env.local for local development")
print("\n📝 NEXT: Set these on Heroku (I'll show you how)")