# Static Files Directory

This directory contains static files served by the Flask backend.

## Current Files

### V3-E-flyer.pdf
The V3 Services E-Flyer marketing PDF.

**Action Required**: Please place the `V3 E-flyer.pdf` file in this directory and rename it to `V3-E-flyer.pdf` (no spaces).

The PDF will be accessible at:
- Public URL: `/eflyer` (opens in browser)
- Direct PDF: `/static/V3-E-flyer.pdf`
- Admin dashboard: `/admin/eflyer`

## Usage

Files in this directory are served via the `/static/<filename>` route defined in `main.py`.
