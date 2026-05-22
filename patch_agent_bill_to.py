"""
Patch script: adds bill_to support to src/routes/agent.py
Run once from the app root: python patch_agent_bill_to.py
"""
import re, sys, os

TARGET = os.path.join(os.path.dirname(__file__), 'src', 'routes', 'agent.py')

with open(TARGET, 'r', encoding='utf-8') as f:
    src = f.read()

original = src  # keep a copy so we can detect if nothing changed

# ----------------------------------------------------------------
# Patch 1 – generate_invoice_pdf signature: add bill_to parameter
# ----------------------------------------------------------------
OLD_SIG = (
    "def generate_invoice_pdf(agent,\n"
    "                         jobs_data,\n"
    "                         total_amount,\n"
    "                         invoice_number,\n"
    "                         upload_to_s3=True,\n"
    "                         agent_invoice_number=None):"
)
NEW_SIG = (
    "def generate_invoice_pdf(agent,\n"
    "                         jobs_data,\n"
    "                         total_amount,\n"
    "                         invoice_number,\n"
    "                         upload_to_s3=True,\n"
    "                         agent_invoice_number=None,\n"
    "                         bill_to='v3'):"
)
assert OLD_SIG in src, "PATCH 1 FAILED: generate_invoice_pdf signature not found"
src = src.replace(OLD_SIG, NEW_SIG, 1)

# ----------------------------------------------------------------
# Patch 2 – build_invoice_pdf call inside generate_invoice_pdf:
#           add client_key=bill_to
# ----------------------------------------------------------------
OLD_BUILD = (
    "        build_invoice_pdf(\n"
    "            file_path=file_path,\n"
    "            agent=pdf_agent,\n"
    "            jobs=normalized_jobs,\n"
    "            totals=totals,\n"
    "            invoice_number=invoice_number,\n"
    "            invoice_date=invoice_date,\n"
    "            agent_invoice_number=agent_invoice_number,\n"
    "            invoice=invoice\n"
    "        )"
)
NEW_BUILD = (
    "        build_invoice_pdf(\n"
    "            file_path=file_path,\n"
    "            agent=pdf_agent,\n"
    "            jobs=normalized_jobs,\n"
    "            totals=totals,\n"
    "            invoice_number=invoice_number,\n"
    "            invoice_date=invoice_date,\n"
    "            agent_invoice_number=agent_invoice_number,\n"
    "            invoice=invoice,\n"
    "            client_key=bill_to\n"
    "        )"
)
assert OLD_BUILD in src, "PATCH 2 FAILED: build_invoice_pdf call not found"
src = src.replace(OLD_BUILD, NEW_BUILD, 1)

# ----------------------------------------------------------------
# Patch 3 – create_invoice: read bill_to from request payload
#           (insert after the line that reads extras_description)
# ----------------------------------------------------------------
OLD_EXTRAS = "        extras_description = data.get('extras_description')\n"
NEW_EXTRAS = (
    "        extras_description = data.get('extras_description')\n"
    "        # Which client to bill — 'v3' (default) keeps all V3 branding;\n"
    "        # 'lh1_global' swaps BILL TO, hides V3 Ref, shortens tax statement.\n"
    "        # Only Lance Carstairs can currently set this via the frontend dropdown.\n"
    "        bill_to = (data.get('bill_to') or 'v3').strip().lower()\n"
)
assert OLD_EXTRAS in src, "PATCH 3 FAILED: extras_description line not found"
src = src.replace(OLD_EXTRAS, NEW_EXTRAS, 1)

# ----------------------------------------------------------------
# Patch 4 – invoice_kwargs: store bill_to on the invoice record
#           (insert after the 'address': address_snapshot line)
# ----------------------------------------------------------------
OLD_KWARGS_END = (
    "            'status': 'submitted',\n"
    "            'job_type': job_type_snapshot,\n"
    "            'address': address_snapshot\n"
    "        }"
)
NEW_KWARGS_END = (
    "            'status': 'submitted',\n"
    "            'job_type': job_type_snapshot,\n"
    "            'address': address_snapshot\n"
    "        }\n"
    "        # Persist which client the invoice is billed to\n"
    "        if hasattr(Invoice, 'bill_to'):\n"
    "            invoice_kwargs['bill_to'] = bill_to"
)
assert OLD_KWARGS_END in src, "PATCH 4 FAILED: invoice_kwargs closing brace not found"
src = src.replace(OLD_KWARGS_END, NEW_KWARGS_END, 1)

# ----------------------------------------------------------------
# Patch 5 – supplier path: pass bill_to to generate_invoice_pdf
# ----------------------------------------------------------------
OLD_PDF_SUPPLIER = (
    "            pdf_result = generate_invoice_pdf(agent, jobs_pdf, float(grand_total), invoice_number,"
    " upload_to_s3=True, agent_invoice_number=final_agent_invoice_number)"
)
NEW_PDF_SUPPLIER = (
    "            pdf_result = generate_invoice_pdf(agent, jobs_pdf, float(grand_total), invoice_number,"
    " upload_to_s3=True, agent_invoice_number=final_agent_invoice_number, bill_to=bill_to)"
)
assert OLD_PDF_SUPPLIER in src, "PATCH 5 FAILED: supplier generate_invoice_pdf call not found"
src = src.replace(OLD_PDF_SUPPLIER, NEW_PDF_SUPPLIER, 1)

# ----------------------------------------------------------------
# Patch 6 – time_entries path: pass bill_to to generate_invoice_pdf
# ----------------------------------------------------------------
OLD_PDF_TIME = (
    "            pdf_result = generate_invoice_pdf(agent, entries_pdf, total_amount, invoice_number,"
    " upload_to_s3=True, agent_invoice_number=final_agent_invoice_number)"
)
NEW_PDF_TIME = (
    "            pdf_result = generate_invoice_pdf(agent, entries_pdf, total_amount, invoice_number,"
    " upload_to_s3=True, agent_invoice_number=final_agent_invoice_number, bill_to=bill_to)"
)
assert OLD_PDF_TIME in src, "PATCH 6 FAILED: time_entries generate_invoice_pdf call not found"
src = src.replace(OLD_PDF_TIME, NEW_PDF_TIME, 1)

# ----------------------------------------------------------------
# Patch 7 – legacy jobs path: pass bill_to to generate_invoice_pdf
# ----------------------------------------------------------------
OLD_PDF_LEGACY = (
    "            pdf_result = generate_invoice_pdf(agent, jobs_to_invoice, total_amount, invoice_number,"
    " upload_to_s3=True, agent_invoice_number=final_agent_invoice_number)"
)
NEW_PDF_LEGACY = (
    "            pdf_result = generate_invoice_pdf(agent, jobs_to_invoice, total_amount, invoice_number,"
    " upload_to_s3=True, agent_invoice_number=final_agent_invoice_number, bill_to=bill_to)"
)
assert OLD_PDF_LEGACY in src, "PATCH 7 FAILED: legacy generate_invoice_pdf call not found"
src = src.replace(OLD_PDF_LEGACY, NEW_PDF_LEGACY, 1)

# ----------------------------------------------------------------
# Write back
# ----------------------------------------------------------------
if src == original:
    print("WARNING: No changes were made. All patches may have already been applied.")
else:
    with open(TARGET, 'w', encoding='utf-8') as f:
        f.write(src)
    print(f"SUCCESS: {TARGET} patched with {src.count('bill_to')} bill_to references.")
    print("Patches applied:")
    for i in range(1, 8):
        print(f"  Patch {i}: OK")
