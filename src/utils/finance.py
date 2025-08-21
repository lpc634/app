# src/utils/finance.py
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy import and_
from src.models.user import db, JobBilling, Invoice, InvoiceJob, Expense
import logging

logger = logging.getLogger(__name__)


def update_job_hours(job_id):
    """
    Aggregate hours from invoices and update JobBilling rollups.
    
    Args:
        job_id (int): Job ID to update
        
    Returns:
        dict: Updated hours data or None if no billing config
    """
    try:
        # Get or create JobBilling for this job
        billing = JobBilling.query.filter_by(job_id=job_id).first()
        if not billing:
            logger.info(f"No JobBilling config found for job {job_id}, skipping hours update")
            return None
        
        # Include invoices with status in {'submitted','sent','paid'}; exclude {'draft','void','deleted'}
        valid_statuses = ['submitted', 'sent', 'paid']
        
        # Get all invoice jobs for this job with valid invoice statuses
        invoice_jobs = db.session.query(InvoiceJob).join(Invoice).filter(
            and_(
                InvoiceJob.job_id == job_id,
                Invoice.status.in_(valid_statuses)
            )
        ).all()
        
        # Calculate total hours H
        total_hours = Decimal('0')
        for ij in invoice_jobs:
            if ij.hours_worked:
                total_hours += Decimal(str(ij.hours_worked))
        
        # Calculate first-hour units F (all-or-nothing per agent)
        # Group by agent_id, count agents with hours > 0
        agent_hours = {}
        for ij in invoice_jobs:
            agent_id = ij.invoice.agent_id
            if agent_id not in agent_hours:
                agent_hours[agent_id] = Decimal('0')
            if ij.hours_worked:
                agent_hours[agent_id] += Decimal(str(ij.hours_worked))
        
        # Count agents with hours > 0
        first_hour_units = Decimal(str(len([aid for aid, hours in agent_hours.items() if hours > 0])))
        
        # Update billing rollups
        billing.billable_hours_calculated = total_hours
        billing.first_hour_units = first_hour_units
        
        db.session.commit()
        
        logger.info(f"Updated job {job_id} hours: {float(total_hours)} total, {float(first_hour_units)} first-hour units")
        
        return {
            'job_id': job_id,
            'billable_hours_calculated': float(total_hours),
            'first_hour_units': float(first_hour_units),
            'agent_count': len(agent_hours)
        }
        
    except Exception as e:
        logger.error(f"Error updating job hours for job {job_id}: {e}")
        db.session.rollback()
        return None


def calculate_job_revenue(billing):
    """
    Calculate revenue for a job based on billing configuration.
    
    Args:
        billing (JobBilling): Job billing configuration
        
    Returns:
        dict: Revenue breakdown (net, vat, gross)
    """
    if not billing:
        return {'revenue_net': 0, 'revenue_vat': 0, 'revenue_gross': 0}
    
    try:
        # Use override hours if set, otherwise calculated hours
        H = Decimal(str(billing.billable_hours_override)) if billing.billable_hours_override else billing.billable_hours_calculated
        F = billing.first_hour_units
        R = billing.hourly_rate_net
        R1 = billing.first_hour_rate_net if billing.first_hour_rate_net else R
        NF = billing.notice_fee_net if billing.notice_fee_net else Decimal('0')
        V = billing.vat_rate
        
        # Revenue calculation
        base = H * R
        uplift = F * max(Decimal('0'), R1 - R)
        revenue_net = base + uplift + NF
        revenue_vat = (revenue_net * V).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        revenue_gross = revenue_net + revenue_vat
        
        return {
            'revenue_net': float(revenue_net),
            'revenue_vat': float(revenue_vat),
            'revenue_gross': float(revenue_gross)
        }
        
    except Exception as e:
        logger.error(f"Error calculating revenue for billing {billing.id}: {e}")
        return {'revenue_net': 0, 'revenue_vat': 0, 'revenue_gross': 0}


def calculate_expense_vat(amount_net, vat_rate):
    """
    Calculate VAT amount and gross total for an expense.
    
    Args:
        amount_net (Decimal): Net amount
        vat_rate (Decimal): VAT rate (e.g., 0.20 for 20%)
        
    Returns:
        tuple: (vat_amount, amount_gross)
    """
    try:
        net = Decimal(str(amount_net))
        rate = Decimal(str(vat_rate))
        
        vat_amount = (net * rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        amount_gross = net + vat_amount
        
        return vat_amount, amount_gross
        
    except Exception as e:
        logger.error(f"Error calculating VAT: {e}")
        return Decimal('0'), amount_net


def get_job_expense_totals(job_id):
    """
    Get expense totals for a specific job.
    
    Args:
        job_id (int): Job ID
        
    Returns:
        dict: Expense totals (count, net, vat, gross)
    """
    try:
        expenses = Expense.query.filter_by(job_id=job_id).all()
        
        count = len(expenses)
        net_total = sum(expense.amount_net for expense in expenses)
        vat_total = sum(expense.vat_amount for expense in expenses)
        gross_total = sum(expense.amount_gross for expense in expenses)
        
        return {
            'count': count,
            'net': float(net_total) if net_total else 0.0,
            'vat': float(vat_total) if vat_total else 0.0,
            'gross': float(gross_total) if gross_total else 0.0
        }
        
    except Exception as e:
        logger.error(f"Error calculating expense totals for job {job_id}: {e}")
        return {'count': 0, 'net': 0.0, 'vat': 0.0, 'gross': 0.0}


def get_job_agent_invoice_totals(job_id):
    """
    Get agent invoice totals for a specific job.
    
    Args:
        job_id (int): Job ID
        
    Returns:
        dict: Agent invoice totals (count, total)
    """
    try:
        # Get all invoices linked to this job
        invoice_jobs = InvoiceJob.query.filter_by(job_id=job_id).all()
        invoice_ids = [ij.invoice_id for ij in invoice_jobs]
        
        if not invoice_ids:
            return {'count': 0, 'total': 0.0}
        
        # Include only valid status invoices
        valid_statuses = ['submitted', 'sent', 'paid']
        invoices = Invoice.query.filter(
            and_(
                Invoice.id.in_(invoice_ids),
                Invoice.status.in_(valid_statuses)
            )
        ).all()
        
        count = len(invoices)
        total = sum(invoice.total_amount for invoice in invoices)
        
        return {
            'count': count,
            'total': float(total) if total else 0.0
        }
        
    except Exception as e:
        logger.error(f"Error calculating agent invoice totals for job {job_id}: {e}")
        return {'count': 0, 'total': 0.0}


def calculate_job_profit(job_id):
    """
    Calculate profit for a job.
    
    Args:
        job_id (int): Job ID
        
    Returns:
        dict: Profit calculation (net, gross)
    """
    try:
        billing = JobBilling.query.filter_by(job_id=job_id).first()
        if not billing:
            return {'profit_net': 0.0, 'profit_gross': 0.0}
        
        # Get revenue
        revenue = calculate_job_revenue(billing)
        
        # Get expenses
        expenses = get_job_expense_totals(job_id)
        
        # Get agent invoices (no VAT)
        agent_invoices = get_job_agent_invoice_totals(job_id)
        
        # Calculate profit
        profit_net = revenue['revenue_net'] - (expenses['net'] + agent_invoices['total'])
        profit_gross = revenue['revenue_gross'] - (expenses['gross'] + agent_invoices['total'])
        
        return {
            'profit_net': profit_net,
            'profit_gross': profit_gross
        }
        
    except Exception as e:
        logger.error(f"Error calculating profit for job {job_id}: {e}")
        return {'profit_net': 0.0, 'profit_gross': 0.0}


def lock_job_revenue_snapshot(job_id):
    """
    Lock revenue snapshot for a completed job.
    
    Args:
        job_id (int): Job ID
        
    Returns:
        bool: Success status
    """
    try:
        billing = JobBilling.query.filter_by(job_id=job_id).first()
        if not billing:
            logger.error(f"No billing config found for job {job_id}")
            return False
        
        # Calculate current revenue
        revenue = calculate_job_revenue(billing)
        
        # Save snapshots
        billing.revenue_net_snapshot = Decimal(str(revenue['revenue_net']))
        billing.revenue_vat_snapshot = Decimal(str(revenue['revenue_vat']))
        billing.revenue_gross_snapshot = Decimal(str(revenue['revenue_gross']))
        
        db.session.commit()
        
        logger.info(f"Locked revenue snapshot for job {job_id}: £{revenue['revenue_gross']}")
        return True
        
    except Exception as e:
        logger.error(f"Error locking revenue snapshot for job {job_id}: {e}")
        db.session.rollback()
        return False