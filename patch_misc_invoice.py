"""
Patch: make create_invoice handle misc items (negative jobIds).
Misc invoices come from the Review Invoice page for non-job work (e.g. LH1 Global).
Run once: python patch_misc_invoice.py
"""
import os, sys

TARGET = os.path.join(os.path.dirname(__file__), 'src', 'routes', 'agent.py')

with open(TARGET, 'r', encoding='utf-8') as f:
    src = f.read()

original = src

# ----------------------------------------------------------------
# Patch: in the legacy items loop, skip job lookup for negative IDs
# and treat them as misc line items (no InvoiceJob record needed).
# ----------------------------------------------------------------
OLD_ITEMS_LOOP = """\
        else:
            # Legacy single-day job_items format
            for item in job_items:
                job = Job.query.get(item['jobId'])
                if not job:
                    return jsonify({'error': f"Job with ID {item['jobId']} not found."}), 404
                hours = Decimal(item.get('hours', 0))
                if hours <= 0:
                    return jsonify({'error': f"Invalid hours for job at {job.address}."}), 400

                # CRITICAL FIX: Use rate from request if provided, otherwise fall back to job.hourly_rate
                # This handles cases where job.hourly_rate might be NULL/0 (e.g., ROUGH_SLEEPER jobs)
                item_rate = item.get('rate') or item.get('hourly_rate')
                if item_rate is not None and item_rate > 0:
                    rate = Decimal(item_rate)
                elif job.hourly_rate and job.hourly_rate > 0:
                    rate = Decimal(job.hourly_rate)
                else:
                    return jsonify({'error': f"Rate must be specified for job at {job.address}. Job hourly_rate is not set."}), 400

                # Use agent-provided work_date if given, otherwise fall back to job arrival_time
                work_date = None
                work_date_str = item.get('work_date')
                if work_date_str:
                    try:
                        work_date = datetime.strptime(work_date_str, '%Y-%m-%d').date()
                    except (ValueError, TypeError):
                        work_date = job.arrival_time.date() if job.arrival_time else date.today()
                else:
                    work_date = job.arrival_time.date() if job.arrival_time else date.today()

                amount = hours * rate
                total_amount += amount
                jobs_to_invoice.append({'job': job, 'hours': hours, 'rate': rate, 'amount': amount, 'work_date': work_date})"""

NEW_ITEMS_LOOP = """\
        else:
            # Legacy single-day job_items format.
            # Negative jobIds are MISC items (no V3 job — e.g. LH1 Global invoices).
            for item in job_items:
                raw_job_id = item.get('jobId', 0)
                is_misc = int(raw_job_id) < 0  # negative = misc / non-job line item

                if is_misc:
                    # Misc item — no job lookup needed
                    job = None
                    hours = Decimal(str(item.get('hours', 1) or 1))
                    item_rate = item.get('rate') or item.get('hourly_rate') or 0
                    rate = Decimal(str(item_rate)) if item_rate else Decimal('0')
                    if rate <= 0:
                        return jsonify({'error': 'Rate must be > 0 for each line item.'}), 400
                    work_date_str = item.get('work_date') or item.get('date')
                    try:
                        work_date = datetime.strptime(work_date_str, '%Y-%m-%d').date() if work_date_str else date.today()
                    except (ValueError, TypeError):
                        work_date = date.today()
                    amount = hours * rate
                    total_amount += amount
                    desc = item.get('title') or item.get('description') or 'Service'
                    jobs_to_invoice.append({
                        'job': None,
                        'hours': hours,
                        'rate': rate,
                        'amount': amount,
                        'work_date': work_date,
                        'description': desc,
                    })
                    continue  # skip the normal job path below

                job = Job.query.get(raw_job_id)
                if not job:
                    return jsonify({'error': f"Job with ID {raw_job_id} not found."}), 404
                hours = Decimal(item.get('hours', 0))
                if hours <= 0:
                    return jsonify({'error': f"Invalid hours for job at {job.address}."}), 400

                # CRITICAL FIX: Use rate from request if provided, otherwise fall back to job.hourly_rate
                # This handles cases where job.hourly_rate might be NULL/0 (e.g., ROUGH_SLEEPER jobs)
                item_rate = item.get('rate') or item.get('hourly_rate')
                if item_rate is not None and item_rate > 0:
                    rate = Decimal(item_rate)
                elif job.hourly_rate and job.hourly_rate > 0:
                    rate = Decimal(job.hourly_rate)
                else:
                    return jsonify({'error': f"Rate must be specified for job at {job.address}. Job hourly_rate is not set."}), 400

                # Use agent-provided work_date if given, otherwise fall back to job arrival_time
                work_date = None
                work_date_str = item.get('work_date')
                if work_date_str:
                    try:
                        work_date = datetime.strptime(work_date_str, '%Y-%m-%d').date()
                    except (ValueError, TypeError):
                        work_date = job.arrival_time.date() if job.arrival_time else date.today()
                else:
                    work_date = job.arrival_time.date() if job.arrival_time else date.today()

                amount = hours * rate
                total_amount += amount
                jobs_to_invoice.append({'job': job, 'hours': hours, 'rate': rate, 'amount': amount, 'work_date': work_date})"""

assert OLD_ITEMS_LOOP in src, "PATCH FAILED: legacy items loop not found — may already be patched"
src = src.replace(OLD_ITEMS_LOOP, NEW_ITEMS_LOOP, 1)

# ----------------------------------------------------------------
# Patch: in the InvoiceJob creation loop, skip None jobs (misc items)
# ----------------------------------------------------------------
OLD_INVOICE_JOB = """\
        else:
            # Legacy job_items format - keep InvoiceJob for backward compatibility
            for item in jobs_to_invoice:
                job = item['job']
                hours = item['hours']
                rate = job.hourly_rate
                db.session.add(InvoiceJob(
                    invoice_id=new_invoice.id,
                    job_id=job.id,
                    hours_worked=hours,
                    hourly_rate_at_invoice=rate
                ))"""

NEW_INVOICE_JOB = """\
        else:
            # Legacy job_items format - keep InvoiceJob for backward compatibility.
            # Skip None jobs (misc items that have no V3 job association).
            for item in jobs_to_invoice:
                job = item.get('job')
                if job is None:
                    continue  # misc item — no InvoiceJob record needed
                hours = item['hours']
                rate = job.hourly_rate
                db.session.add(InvoiceJob(
                    invoice_id=new_invoice.id,
                    job_id=job.id,
                    hours_worked=hours,
                    hourly_rate_at_invoice=rate
                ))"""

assert OLD_INVOICE_JOB in src, "PATCH 2 FAILED: InvoiceJob creation loop not found"
src = src.replace(OLD_INVOICE_JOB, NEW_INVOICE_JOB, 1)

if src == original:
    print("WARNING: No changes made — already patched?")
else:
    with open(TARGET, 'w', encoding='utf-8') as f:
        f.write(src)
    print(f"SUCCESS: {TARGET} patched for misc invoice support.")
    print("  Patch 1: Misc items (negative jobIds) handled in items loop")
    print("  Patch 2: InvoiceJob skipped for misc items")
