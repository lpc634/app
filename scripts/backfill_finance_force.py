import os
from decimal import Decimal

# --- App bootstrap: support both app and create_app patterns ---
app = None
db = None
Job = None
JobBilling = None
Invoice = None
InvoiceJob = None

# Resolve app
try:
    from main import app as _app  # common pattern
    app = _app
except Exception:
    try:
        from main import create_app  # factory pattern
        app = create_app()
    except Exception as e:
        raise RuntimeError(f"Could not initialize Flask app from main.py: {e}")

# Resolve db/models (try a few known layouts)
_resolved = False
_errors = []

for attempt in (
    "from src.models import db, Job, JobBilling, Invoice, InvoiceJob",
    "from src.models.user import db, Job, JobBilling, Invoice, InvoiceJob",
    "from src.database import db; from src.models import Job, JobBilling, Invoice, InvoiceJob",
):
    try:
        ns = {}
        exec(attempt, ns, ns)
        db = ns["db"]; Job = ns["Job"]; JobBilling = ns["JobBilling"]; Invoice = ns["Invoice"]; InvoiceJob = ns["InvoiceJob"]
        _resolved = True
        break
    except Exception as e:
        _errors.append(f"{attempt} -> {e}")

if not _resolved:
    raise RuntimeError("Failed to import db/Job/JobBilling/Invoice/InvoiceJob via known paths:\n" + "\n".join(_errors))

# Finance helpers
try:
    from src.utils.finance import update_job_hours, lock_job_revenue_snapshot
except Exception as e:
    raise RuntimeError(f"Failed to import finance helpers: {e}")


def _parse_job_ids_from_env():
    s = os.getenv("JOB_IDS")
    if not s:
        return None
    ids = []
    for part in s.split(","):
        part = part.strip()
        if not part:
            continue
        ids.append(int(part))
    return ids or None


def main():
    job_ids = _parse_job_ids_from_env()

    valid_statuses = ["submitted", "sent", "paid"]

    fixed = []
    skipped = []  # (job_id, reason)
    errors = []   # (job_id, error)

    with app.app_context():
        if job_ids:
            q = db.session.query(Job).filter(Job.id.in_(job_ids))
        else:
            # Jobs with at least one qualifying invoice, regardless of job status
            q = (
                db.session.query(Job)
                .join(InvoiceJob, InvoiceJob.job_id == Job.id)
                .join(Invoice, Invoice.id == InvoiceJob.invoice_id)
                .filter(Invoice.status.in_(valid_statuses))
                .distinct()
            )

        jobs = q.all()
        print(f"Considering {len(jobs)} job(s)")

        for job in jobs:
            try:
                billing = db.session.query(JobBilling).filter_by(job_id=job.id).first()
                if not billing:
                    skipped.append((job.id, "no billing row"))
                    continue

                # 1) recompute hours into billing using current logic
                update_job_hours(job.id)

                # 2) lock snapshots (force/overwrite): lock_job_revenue_snapshot overwrites snapshot fields
                ok = lock_job_revenue_snapshot(job.id)
                if ok:
                    fixed.append(job.id)
                else:
                    skipped.append((job.id, "lock returned False"))

                db.session.commit()
            except Exception as e:
                db.session.rollback()
                errors.append((job.id, str(e)))

    print("\n=== Force Backfill complete ===")
    print(f"Fixed (snapshots locked) [{len(fixed)}]: {fixed}")
    print(f"Skipped [{len(skipped)}]: {skipped}")
    print(f"Errors  [{len(errors)}]: {errors}")


if __name__ == "__main__":
    main()


