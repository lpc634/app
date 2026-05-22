"""
Patch script: makes invoices.py pass bill_to → client_key when regenerating PDFs
Run once from the app root: python patch_invoices_bill_to.py
"""
import os

TARGET = os.path.join(os.path.dirname(__file__), 'src', 'routes', 'invoices.py')

with open(TARGET, 'r', encoding='utf-8') as f:
    src = f.read()

original = src

# ----------------------------------------------------------------
# Patch 1 – _render_invoice_pdf_bytes: pass client_key to build_invoice_pdf
# ----------------------------------------------------------------
OLD_BUILD = (
    "        build_invoice_pdf(\n"
    "            file_path=tmp_path,\n"
    "            agent=agent,\n"
    "            jobs=jobs_data,\n"
    "            totals=totals,\n"
    "            invoice_number=inv.invoice_number,\n"
    "            invoice_date=getattr(inv, 'issue_date', None),\n"
    "            agent_invoice_number=getattr(inv, 'agent_invoice_number', None),\n"
    "            invoice=inv\n"
    "        )"
)
NEW_BUILD = (
    "        build_invoice_pdf(\n"
    "            file_path=tmp_path,\n"
    "            agent=agent,\n"
    "            jobs=jobs_data,\n"
    "            totals=totals,\n"
    "            invoice_number=inv.invoice_number,\n"
    "            invoice_date=getattr(inv, 'issue_date', None),\n"
    "            agent_invoice_number=getattr(inv, 'agent_invoice_number', None),\n"
    "            invoice=inv,\n"
    "            client_key=getattr(inv, 'bill_to', None) or 'v3'\n"
    "        )"
)
assert OLD_BUILD in src, "PATCH 1 FAILED: build_invoice_pdf call not found in invoices.py"
src = src.replace(OLD_BUILD, NEW_BUILD, 1)

if src == original:
    print("WARNING: No changes were made.")
else:
    with open(TARGET, 'w', encoding='utf-8') as f:
        f.write(src)
    print(f"SUCCESS: {TARGET} patched.")
