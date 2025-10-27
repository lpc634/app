from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Tuple

from flask import current_app
from sqlalchemy import and_, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.models.user import db, Invoice, InvoiceLine, JobAssignment, SupplierProfile, InvoiceSequence


def _quantize_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _next_supplier_invoice_number(session: Session, supplier: SupplierProfile) -> str:
    """Generate supplier invoice number with prefix and year, sequential per supplier/year.
    Format: PREFIX-YYYY-####. We increment the max #### for that prefix+year.
    """
    today = date.today()
    prefix = supplier.invoice_prefix
    year = today.year
    # Get or create the sequence row for (prefix, year) with row-level lock
    seq = (
        session.query(InvoiceSequence)
        .filter(InvoiceSequence.prefix == prefix, InvoiceSequence.year == year)
        .with_for_update()
        .first()
    )
    if not seq:
        seq = InvoiceSequence(prefix=prefix, year=year, next_seq=1)
        session.add(seq)
        session.flush()
    current = seq.next_seq or 1
    seq.next_seq = current + 1
    base_prefix = f"{prefix}{year}-"
    return f"{base_prefix}{current:04d}"


def build_supplier_invoice(
    supplier: SupplierProfile,
    items: List[Dict],
    acting_user_id: int,
) -> Tuple[Invoice, list]:
    """Create a supplier invoice transactionally.

    items: [{ 'job_assignment_id': int, 'hours': Decimal|str|float, 'rate_per_hour': Decimal|str|float }]
    Returns (invoice, conflicts) where conflicts is a list of conflicting job_assignment_ids if any.
    """
    vat_default = Decimal(str(current_app.config.get('VAT_DEFAULT_RATE', 0.20)))

    conflicts: list = []
    with db.session.begin():
        session: Session = db.session

        # Lock assignments to avoid races
        assignment_ids = [int(it['job_assignment_id']) for it in items]
        if not assignment_ids:
            raise ValueError("No items to invoice")

        locked = (
            session.query(JobAssignment)
            .filter(JobAssignment.id.in_(assignment_ids))
            .with_for_update()
            .all()
        )
        id_to_assignment = {a.id: a for a in locked}

        # Validate supplier ownership and headcount
        lines: list = []
        subtotal = Decimal('0')
        for it in items:
            ja_id = int(it['job_assignment_id'])
            hours = Decimal(str(it.get('hours', '0')))
            rate = Decimal(str(it.get('rate_per_hour', '0')))
            if hours <= 0 or rate <= 0:
                raise ValueError("Hours and rate_per_hour must be greater than 0")
            assignment = id_to_assignment.get(ja_id)
            if not assignment:
                raise ValueError(f"Assignment {ja_id} not found or not lockable")
            if (assignment.supplied_by_email or '').lower() != (supplier.email or '').lower():
                raise PermissionError(f"Assignment {ja_id} is not supplied by {supplier.email}")
            headcount = int(getattr(assignment, 'supplier_headcount', 0) or 0)
            if headcount < 1:
                raise ValueError(f"Assignment {ja_id} missing headcount")
            line_total = _quantize_money(hours * rate * Decimal(str(headcount)))
            subtotal += line_total
            lines.append((assignment, hours, rate, headcount, line_total))

        vat_rate = vat_default if supplier.vat_registered else Decimal('0')
        vat_amount = _quantize_money(subtotal * vat_rate)
        grand_total = _quantize_money(subtotal + vat_amount)

        # Create invoice
        invoice_number = _next_supplier_invoice_number(session, supplier)
        inv = Invoice(
            agent_id=acting_user_id,  # creator for reference
            invoice_number=invoice_number,
            issue_date=date.today(),
            due_date=date.today(),
            total_amount=grand_total,
            status='submitted',
            supplier_id=supplier.id,
            vat_rate=vat_rate,
        )
        session.add(inv)
        session.flush()

        # Insert lines (unique constraint protects from duplicates)
        for assignment, hours, rate, headcount, line_total in lines:
            session.add(InvoiceLine(
                invoice_id=inv.id,
                job_assignment_id=assignment.id,
                work_date=date.today(),
                hours=hours,
                rate_net=rate,
                line_net=line_total,
                headcount=headcount,
            ))

        try:
            session.flush()
        except IntegrityError as ie:  # duplicate job_assignment_id attempted
            session.rollback()
            # Identify conflicting IDs by probing which exist now
            existing = (
                session.query(InvoiceLine.job_assignment_id)
                .filter(InvoiceLine.job_assignment_id.in_(assignment_ids))
                .all()
            )
            conflicts = [row[0] for row in existing]
            raise ie

        return inv, conflicts


