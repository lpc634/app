# src/utils/finance.py - CORRECTED VERSION
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy import and_
from src.models.user import db, JobBilling, Invoice, InvoiceJob, Expense, Job, JobAssignment
import logging
from datetime import date, datetime

logger = logging.getLogger(__name__)


def update_job_hours(job_id):
    """
    Aggregate hours from invoices and update JobBilling rollups.
    INCLUDES AGENT COUNT VALIDATION
    
    Args:
        job_id (int): Job ID to update
        
    Returns:
        dict: Updated hours data with validation warnings
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
        
        # VALIDATION: Check if actual working agents match planned agent count
        planned_agent_count = billing.agent_count or 0
        actual_working_agents = int(first_hour_units)
        
        validation_warnings = []
        if planned_agent_count != actual_working_agents:
            warning = f"Job {job_id}: Planned {planned_agent_count} agents, but {actual_working_agents} actually worked"
            validation_warnings.append(warning)
            logger.warning(warning)
        
        # Update billing rollups
        billing.billable_hours_calculated = total_hours
        billing.first_hour_units = first_hour_units
        
        db.session.commit()
        
        logger.info(f"Updated job {job_id} hours: {float(total_hours)} total, {float(first_hour_units)} first-hour units")
        
        return {
            'job_id': job_id,
            'billable_hours_calculated': float(total_hours),
            'first_hour_units': float(first_hour_units),
            'agent_count': len(agent_hours),
            'planned_agent_count': planned_agent_count,
            'actual_working_agents': actual_working_agents,
            'validation_warnings': validation_warnings
        }
        
    except Exception as e:
        logger.error(f"Error updating job hours for job {job_id}: {e}")
        db.session.rollback()
        return None


def calculate_job_revenue(billing):
    """
    Calculate revenue for a job based on billing configuration.
    Uses ACTUAL working agents (first_hour_units) for accurate calculation.
    
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
        F = billing.first_hour_units  # Use ACTUAL working agents (not planned)
        R = billing.hourly_rate_net
        R1 = billing.first_hour_rate_net if billing.first_hour_rate_net else R
        NF = billing.notice_fee_net if billing.notice_fee_net else Decimal('0')
        V = billing.vat_rate
        
        # Revenue calculation based on ACTUAL agents who worked
        base = H * R
        uplift = F * max(Decimal('0'), R1 - R)
        revenue_net = base + uplift + NF
        revenue_vat = (revenue_net * V).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        revenue_gross = revenue_net + revenue_vat
        
        return {
            'revenue_net': float(revenue_net),
            'revenue_vat': float(revenue_vat),
            'revenue_gross': float(revenue_gross),
            'breakdown': {
                'base_hours_revenue': float(base),
                'first_hour_uplift': float(uplift),
                'notice_fee': float(NF),
                'hours_used': float(H),
                'agents_used': float(F)
            }
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
    CORRECTED PROFIT CALCULATION
    Calculate profit for a job with proper cost accounting.
    
    Args:
        job_id (int): Job ID
        
    Returns:
        dict: Profit calculation with margins and validation
    """
    try:
        billing = JobBilling.query.filter_by(job_id=job_id).first()
        if not billing:
            return {
                'profit_net': 0.0, 
                'profit_gross': 0.0,
                'margin_net': 0.0,
                'margin_gross': 0.0,
                'warnings': ['No billing configuration found']
            }
        
        # Get revenue (includes VAT)
        revenue = calculate_job_revenue(billing)
        
        # Get expenses (includes VAT)
        expenses = get_job_expense_totals(job_id)
        
        # Get agent invoices (NO VAT - agents aren't VAT registered)
        agent_invoices = get_job_agent_invoice_totals(job_id)
        
        # CORRECTED PROFIT CALCULATION:
        # Agent costs have no VAT, so they're treated as net costs
        total_costs_net = agent_invoices['total'] + expenses['net']
        total_costs_gross = agent_invoices['total'] + expenses['gross']
        
        profit_net = revenue['revenue_net'] - total_costs_net
        profit_gross = revenue['revenue_gross'] - total_costs_gross
        
        # Calculate margins
        margin_net = (profit_net / revenue['revenue_net'] * 100) if revenue['revenue_net'] > 0 else 0
        margin_gross = (profit_gross / revenue['revenue_gross'] * 100) if revenue['revenue_gross'] > 0 else 0
        
        # Validation warnings
        warnings = []
        if margin_net < 5:
            warnings.append(f"Very low net profit margin: {margin_net:.1f}%")
        elif margin_net < 15:
            warnings.append(f"Low net profit margin: {margin_net:.1f}%")
            
        if profit_net < 0:
            warnings.append("Job is making a loss!")
            
        return {
            'profit_net': profit_net,
            'profit_gross': profit_gross,
            'margin_net': margin_net,
            'margin_gross': margin_gross,
            'revenue_net': revenue['revenue_net'],
            'revenue_gross': revenue['revenue_gross'],
            'costs_net': total_costs_net,
            'costs_gross': total_costs_gross,
            'agent_costs': agent_invoices['total'],
            'expense_costs_net': expenses['net'],
            'expense_costs_gross': expenses['gross'],
            'warnings': warnings
        }
        
    except Exception as e:
        logger.error(f"Error calculating profit for job {job_id}: {e}")
        return {
            'profit_net': 0.0, 
            'profit_gross': 0.0,
            'margin_net': 0.0,
            'margin_gross': 0.0,
            'warnings': [f'Calculation error: {str(e)}']
        }


def validate_job_finances(job_id):
    """
    Comprehensive financial validation for a job.
    
    Args:
        job_id (int): Job ID to validate
        
    Returns:
        dict: Validation results with issues and recommendations
    """
    try:
        issues = []
        warnings = []
        recommendations = []
        
        job = Job.query.get(job_id)
        if not job:
            issues.append("Job not found")
            return {'issues': issues, 'warnings': warnings, 'recommendations': recommendations}
            
        billing = JobBilling.query.filter_by(job_id=job_id).first()
        if not billing:
            issues.append("No billing configuration found")
            return {'issues': issues, 'warnings': warnings, 'recommendations': recommendations}
        
        # Check agent count consistency
        assigned_count = JobAssignment.query.filter_by(job_id=job_id).count()
        planned_count = billing.agent_count or 0
        
        if planned_count != assigned_count:
            issues.append(f"Agent count mismatch: {planned_count} planned, {assigned_count} assigned")
            
        # Check for working agents vs assigned
        hours_data = update_job_hours(job_id)
        if hours_data and hours_data['validation_warnings']:
            warnings.extend(hours_data['validation_warnings'])
            
        # Check profit margins
        profit = calculate_job_profit(job_id)
        if profit['warnings']:
            warnings.extend(profit['warnings'])
            
        # Check for excessive expenses
        expenses = get_job_expense_totals(job_id)
        if expenses['gross'] > profit['revenue_gross'] * 0.5:  # Expenses > 50% of revenue
            warnings.append(f"High expense ratio: £{expenses['gross']:.2f} expenses vs £{profit['revenue_gross']:.2f} revenue")
            
        # Business recommendations
        if profit['margin_net'] < 20:
            recommendations.append("Consider increasing hourly rates for better margins")
            
        if expenses['count'] == 0 and job.status == 'completed':
            recommendations.append("Check if any expenses were missed for this completed job")
            
        return {
            'job_id': job_id,
            'issues': issues,
            'warnings': warnings,
            'recommendations': recommendations,
            'profit_summary': profit,
            'validation_passed': len(issues) == 0
        }
        
    except Exception as e:
        logger.error(f"Error validating job finances for {job_id}: {e}")
        return {
            'issues': [f'Validation error: {str(e)}'],
            'warnings': [],
            'recommendations': [],
            'validation_passed': False
        }


def get_financial_summary_corrected(from_date=None, to_date=None):
    """
    CORRECTED financial summary with proper VAT handling.
    
    Returns:
        dict: Complete financial breakdown
    """
    try:
        if not from_date:
            from_date = date.today().replace(day=1)  # Start of current month
        if not to_date:
            to_date = date.today()
            
        # Revenue (includes VAT output)
        revenue = calculate_revenue_for_period(from_date, to_date)
        
        # Agent invoices (no VAT - agents not VAT registered)
        agent_invoices_total = calculate_agent_invoices_for_period(from_date, to_date)
        
        # Expenses (includes VAT input)
        expenses = calculate_expenses_for_period(from_date, to_date)
        
        # Calculate totals
        money_in_net = revenue['net']
        money_in_gross = revenue['gross']
        
        # Money out: Agent costs (no VAT) + Expense costs
        money_out_net = agent_invoices_total + expenses['net']
        money_out_gross = agent_invoices_total + expenses['gross']
        
        # Profit
        profit_net = money_in_net - money_out_net
        profit_gross = money_in_gross - money_out_gross
        
        # VAT summary
        vat_output = revenue['vat']  # VAT we charge customers
        vat_input = expenses['vat']  # VAT we can reclaim
        vat_net_due = vat_output - vat_input  # VAT we owe HMRC
        
        return {
            'period': {
                'from': from_date.isoformat(),
                'to': to_date.isoformat()
            },
            'revenue': {
                'net': round(revenue['net'], 2),
                'vat': round(revenue['vat'], 2),
                'gross': round(revenue['gross'], 2)
            },
            'costs': {
                'agent_invoices': round(agent_invoices_total, 2),
                'expenses_net': round(expenses['net'], 2),
                'expenses_vat': round(expenses['vat'], 2),
                'expenses_gross': round(expenses['gross'], 2),
                'total_net': round(money_out_net, 2),
                'total_gross': round(money_out_gross, 2)
            },
            'profit': {
                'net': round(profit_net, 2),
                'gross': round(profit_gross, 2),
                'margin_net': round((profit_net / money_in_net * 100) if money_in_net > 0 else 0, 1),
                'margin_gross': round((profit_gross / money_in_gross * 100) if money_in_gross > 0 else 0, 1)
            },
            'vat': {
                'output': round(vat_output, 2),
                'input': round(vat_input, 2),
                'net_due': round(vat_net_due, 2)
            }
        }
        
    except Exception as e:
        logger.error(f"Error generating financial summary: {e}")
        return {
            'revenue': {'net': 0, 'vat': 0, 'gross': 0},
            'costs': {'agent_invoices': 0, 'expenses_net': 0, 'expenses_vat': 0, 'expenses_gross': 0, 'total_net': 0, 'total_gross': 0},
            'profit': {'net': 0, 'gross': 0, 'margin_net': 0, 'margin_gross': 0},
            'vat': {'output': 0, 'input': 0, 'net_due': 0}
        }


def calculate_revenue_for_period(from_date, to_date, job_id=None):
    """Calculate revenue for a date period."""
    try:
        revenue = {'net': 0.0, 'vat': 0.0, 'gross': 0.0}
        
        # Get all jobs with billing config
        query = db.session.query(Job, JobBilling).join(JobBilling)
        
        if job_id:
            query = query.filter(Job.id == job_id)
        
        # Filter by completion date or creation date
        query = query.filter(
            and_(
                Job.created_at >= datetime.combine(from_date, datetime.min.time()),
                Job.created_at <= datetime.combine(to_date, datetime.max.time())
            )
        )
        
        jobs_with_billing = query.all()
        
        for job, billing in jobs_with_billing:
            # Use snapshot if available (job completed), otherwise calculate live
            if (billing.revenue_net_snapshot and 
                billing.revenue_vat_snapshot and 
                billing