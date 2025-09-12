import os
from decimal import Decimal

# --- App bootstrap: support both app and create_app patterns ---
app = None
db = None
Job = None
JobBilling = None

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
    "from src.models import db, Job, JobBilling",
    "from src.models.user import db, Job, JobBilling",
    "from src.database import db; from src.models import Job, JobBilling",
):
    try:
        ns = {}
        exec(attempt, ns, ns)
        db = ns["db"]; Job = ns["Job"]; JobBilling = ns["JobBilling"]
        _resolved = True
        break
    except Exception as e:
        _errors.append(f"{attempt} -> {e}")

if not _resolved:
    raise RuntimeError("Failed to import db/Job/JobBilling via known paths:\n" + "\n".join(_errors))

# Finance helpers
try:
    from src.utils.finance import update_job_hours, lock_job_revenue_snapshot
except Exception as e:
    raise RuntimeError(f"Failed to import finance helpers: {e}")

def _is_zero_or_none(x):
    if x is None:
        return True
    try:
        return Decimal(str(x)) == 0
    except Exception:
        return False

def _needs_snapshot(billing):
    return (
        _is_zero_or_none(getattr(billing, "revenue_net_snapshot", None)) and
        _is_zero_or_none(getattr(billing, "revenue_vat_snapshot", None)) and
        _is_zero_or_none(getattr(billing, "revenue_gross_snapshot", None))
    )

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

    with app.app_context():
        q = db.session.query(Job)
        if job_ids:
            q = q.filter(Job.id.in_(job_ids))
        else:
            # Only consider historically finished jobs by status
            q = q.filter(Job.status.in_(["completed", "closed", "archived"]))

        jobs = q.all()
        print(f"Considering {len(jobs)} job(s)")

        fixed = []
        skipped = []  # (job_id, reason)

        for job in jobs:
            try:
                billing = db.session.query(JobBilling).filter_by(job_id=job.id).first()
                if not billing:
                    skipped.append((job.id, "no billing row"))
                    continue

                # 1) recompute hours into billing using current logic
                update_job_hours(job.id)

                # 2) lock snapshots if all missing/zero
                if _needs_snapshot(billing):
                    ok = lock_job_revenue_snapshot(job.id)
                    if ok:
                        fixed.append(job.id)
                    else:
                        skipped.append((job.id, "lock returned False"))
                else:
                    skipped.append((job.id, "snapshots already present"))

                db.session.commit()
            except Exception as e:
                db.session.rollback()
                skipped.append((job.id, f"error: {e}"))

        print("\n=== Backfill complete ===")
        print(f"Fixed (snapshots locked) [{len(fixed)}]: {fixed}")
        print(f"Skipped [{len(skipped)}]: {skipped}")

if __name__ == "__main__":
    main()


