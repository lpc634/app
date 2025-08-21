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


def summarize_business_finances(from_date=None, to_date=None, job_id=None):
    """
    Generate business-level financial summary for admin dashboard.
    
    Args:
        from_date (date): Start date for filtering
        to_date (date): End date for filtering  
        job_id (int): Optional job filter
        
    Returns:
        dict: Complete financial summary with revenue, costs, profit, VAT
    """
    try:
        from datetime import date, timedelta
        
        # Default to current month if no dates provided
        if not from_date or not to_date:
            today = date.today()
            from_date = date(today.year, today.month, 1)
            # Get last day of current month
            if today.month == 12:
                to_date = date(today.year + 1, 1, 1) - timedelta(days=1)
            else:
                to_date = date(today.year, today.month + 1, 1) - timedelta(days=1)
        
        # Initialize summary structure
        summary = {
            'filters': {
                'from': from_date.isoformat(),
                'to': to_date.isoformat(),
                'job_id': job_id
            },
            'revenue': {'net': 0.0, 'vat': 0.0, 'gross': 0.0},
            'costs': {
                'agent_invoices_total': 0.0,
                'expenses': {'net': 0.0, 'vat': 0.0, 'gross': 0.0},
                'gross': 0.0
            },
            'profit': {'net': 0.0, 'gross': 0.0},
            'vat': {'output': 0.0, 'input': 0.0, 'net_due': 0.0}
        }
        
        # Calculate revenue from jobs within date range
        revenue_total = calculate_revenue_for_period(from_date, to_date, job_id)
        summary['revenue'] = revenue_total
        
        # Calculate agent invoice costs within date range
        agent_invoice_total = calculate_agent_invoices_for_period(from_date, to_date, job_id)
        summary['costs']['agent_invoices_total'] = agent_invoice_total
        
        # Calculate expense costs within date range
        expense_totals = calculate_expenses_for_period(from_date, to_date, job_id)
        summary['costs']['expenses'] = expense_totals
        
        # Calculate total costs
        summary['costs']['gross'] = agent_invoice_total + expense_totals['gross']
        
        # Calculate profit
        summary['profit']['net'] = revenue_total['net'] - (agent_invoice_total + expense_totals['net'])
        summary['profit']['gross'] = revenue_total['gross'] - summary['costs']['gross']
        
        # Calculate VAT
        summary['vat']['output'] = revenue_total['vat']
        summary['vat']['input'] = expense_totals['vat']
        summary['vat']['net_due'] = revenue_total['vat'] - expense_totals['vat']
        
        # Round all values to 2 decimal places
        summary = round_financial_summary(summary)
        
        return summary
        
    except Exception as e:
        logger.error(f"Error summarizing business finances: {e}")
        return None


def calculate_revenue_for_period(from_date, to_date, job_id=None):
    """Calculate total revenue for a date period."""
    try:
        revenue = {'net': 0.0, 'vat': 0.0, 'gross': 0.0}
        
        # Get all jobs with billing config
        query = db.session.query(Job, JobBilling).join(JobBilling)
        
        if job_id:
            query = query.filter(Job.id == job_id)
        
        jobs_with_billing = query.all()
        
        for job, billing in jobs_with_billing:
            # Determine revenue date for filtering
            revenue_date = get_revenue_date_for_job(job, billing)
            
            if revenue_date and from_date <= revenue_date <= to_date:
                # Use snapshot if available, otherwise calculate live
                if (billing.revenue_net_snapshot and 
                    billing.revenue_vat_snapshot and 
                    billing.revenue_gross_snapshot):
                    revenue['net'] += float(billing.revenue_net_snapshot)
                    revenue['vat'] += float(billing.revenue_vat_snapshot)
                    revenue['gross'] += float(billing.revenue_gross_snapshot)
                else:
                    # Calculate live revenue
                    job_revenue = calculate_job_revenue(billing)
                    revenue['net'] += job_revenue['revenue_net']
                    revenue['vat'] += job_revenue['revenue_vat']
                    revenue['gross'] += job_revenue['revenue_gross']
        
        return revenue
        
    except Exception as e:
        logger.error(f"Error calculating revenue for period: {e}")
        return {'net': 0.0, 'vat': 0.0, 'gross': 0.0}


def calculate_agent_invoices_for_period(from_date, to_date, job_id=None):
    """Calculate total agent invoice costs for a date period."""
    try:
        query = db.session.query(Invoice).filter(
            Invoice.status.in_(['submitted', 'sent', 'paid']),
            Invoice.issue_date >= from_date,
            Invoice.issue_date <= to_date
        )
        
        if job_id:
            # Filter by job through InvoiceJob relationship
            query = query.join(InvoiceJob).filter(InvoiceJob.job_id == job_id)
        
        invoices = query.all()
        total = sum(float(invoice.total_amount) for invoice in invoices if invoice.total_amount)
        
        return total
        
    except Exception as e:
        logger.error(f"Error calculating agent invoices for period: {e}")
        return 0.0


def calculate_expenses_for_period(from_date, to_date, job_id=None):
    """Calculate total expenses for a date period."""
    try:
        query = db.session.query(Expense).filter(
            Expense.date >= from_date,
            Expense.date <= to_date
        )
        
        if job_id:
            query = query.filter(Expense.job_id == job_id)
        
        expenses = query.all()
        
        totals = {
            'net': sum(float(exp.amount_net) for exp in expenses if exp.amount_net),
            'vat': sum(float(exp.vat_amount) for exp in expenses if exp.vat_amount),
            'gross': sum(float(exp.amount_gross) for exp in expenses if exp.amount_gross)
        }
        
        return totals
        
    except Exception as e:
        logger.error(f"Error calculating expenses for period: {e}")
        return {'net': 0.0, 'vat': 0.0, 'gross': 0.0}


def get_revenue_date_for_job(job, billing):
    """Get the appropriate date for revenue recognition."""
    try:
        # If locked snapshot exists, use job completion/updated date
        if (billing.revenue_net_snapshot and 
            billing.revenue_vat_snapshot and 
            billing.revenue_gross_snapshot):
            return job.updated_at.date() if job.updated_at else job.created_at.date()
        
        # For live calculation, use latest invoice date or job created date
        latest_invoice = db.session.query(Invoice).join(InvoiceJob).filter(
            InvoiceJob.job_id == job.id,
            Invoice.status.in_(['submitted', 'sent', 'paid'])
        ).order_by(Invoice.issue_date.desc()).first()
        
        if latest_invoice and latest_invoice.issue_date:
            return latest_invoice.issue_date
        
        return job.created_at.date() if job.created_at else None
        
    except Exception as e:
        logger.error(f"Error getting revenue date for job {job.id}: {e}")
        return None


def round_financial_summary(summary):
    """Round all financial values in summary to 2 decimal places."""
    try:
        summary['revenue']['net'] = round(summary['revenue']['net'], 2)
        summary['revenue']['vat'] = round(summary['revenue']['vat'], 2)
        summary['revenue']['gross'] = round(summary['revenue']['gross'], 2)
        
        summary['costs']['agent_invoices_total'] = round(summary['costs']['agent_invoices_total'], 2)
        summary['costs']['expenses']['net'] = round(summary['costs']['expenses']['net'], 2)
        summary['costs']['expenses']['vat'] = round(summary['costs']['expenses']['vat'], 2)
        summary['costs']['expenses']['gross'] = round(summary['costs']['expenses']['gross'], 2)
        summary['costs']['gross'] = round(summary['costs']['gross'], 2)
        
        summary['profit']['net'] = round(summary['profit']['net'], 2)
        summary['profit']['gross'] = round(summary['profit']['gross'], 2)
        
        summary['vat']['output'] = round(summary['vat']['output'], 2)
        summary['vat']['input'] = round(summary['vat']['input'], 2)
        summary['vat']['net_due'] = round(summary['vat']['net_due'], 2)
        
        return summary
        
    except Exception as e:
        logger.error(f"Error rounding financial summary: {e}")
        return summary


def get_financial_summary(from_date=None, to_date=None):
    """
    Normalize summarize_business_finances output to the API response schema.
    Returns floats and required keys.
    """
    try:
        summary = summarize_business_finances(from_date=from_date, to_date=to_date)
        if not summary:
            return {
                'revenue': {'net': 0.0, 'vat': 0.0, 'gross': 0.0},
                'agent_invoices': {'net': 0.0, 'gross': 0.0},
                'expenses': {'net': 0.0, 'vat': 0.0, 'gross': 0.0},
                'money_in': {'net': 0.0, 'gross': 0.0},
                'money_out': {'net': 0.0, 'gross': 0.0},
                'profit': {'net': 0.0, 'gross': 0.0},
                'vat': {'output': 0.0, 'input': 0.0, 'net_due': 0.0},
            }

        revenue = {
            'net': float(summary.get('revenue', {}).get('net', 0.0) or 0.0),
            'vat': float(summary.get('revenue', {}).get('vat', 0.0) or 0.0),
            'gross': float(summary.get('revenue', {}).get('gross', 0.0) or 0.0),
        }

        expenses_src = summary.get('costs', {}).get('expenses', {}) or {}
        expenses = {
            'net': float(expenses_src.get('net', 0.0) or 0.0),
            'vat': float(expenses_src.get('vat', 0.0) or 0.0),
            'gross': float(expenses_src.get('gross', 0.0) or 0.0),
        }

        agent_total = float(summary.get('costs', {}).get('agent_invoices_total', 0.0) or 0.0)
        agent_invoices = {'net': agent_total, 'gross': agent_total}

        money_in = {'net': revenue['net'], 'gross': revenue['gross']}
        money_out = {
            'net': agent_total + expenses['net'],
            'gross': agent_total + expenses['gross'],
        }

        profit_src = summary.get('profit', {}) or {}
        profit = {
            'net': float(profit_src.get('net', money_in['net'] - money_out['net']) or 0.0),
            'gross': float(profit_src.get('gross', money_in['gross'] - money_out['gross']) or 0.0),
        }

        vat_src = summary.get('vat', {}) or {}
        vat = {
            'output': float(vat_src.get('output', revenue['vat']) or 0.0),
            'input': float(vat_src.get('input', expenses['vat']) or 0.0),
            'net_due': float(vat_src.get('net_due', (revenue['vat'] - expenses['vat'])) or 0.0),
        }

        return {
            'revenue': revenue,
            'agent_invoices': agent_invoices,
            'expenses': expenses,
            'money_in': money_in,
            'money_out': money_out,
            'profit': profit,
            'vat': vat,
        }

    except Exception as e:
        logger.error(f"Error normalizing financial summary: {e}")
        return {
            'revenue': {'net': 0.0, 'vat': 0.0, 'gross': 0.0},
            'agent_invoices': {'net': 0.0, 'gross': 0.0},
            'expenses': {'net': 0.0, 'vat': 0.0, 'gross': 0.0},
            'money_in': {'net': 0.0, 'gross': 0.0},
            'money_out': {'net': 0.0, 'gross': 0.0},
            'profit': {'net': 0.0, 'gross': 0.0},
            'vat': {'output': 0.0, 'input': 0.0, 'net_due': 0.0},
        }