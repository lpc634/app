"""
Database health check utility for verifying column presence and schema integrity.
"""
import sqlalchemy as sa
from src.extensions import db
from flask import current_app


def check_invoice_lines_schema():
    """Check if invoice_lines table has all required columns."""
    try:
        bind = db.engine
        insp = sa.inspect(bind)

        # Check if table exists
        tables = insp.get_table_names()
        if 'invoice_lines' not in tables:
            return {
                'status': 'error',
                'message': 'invoice_lines table does not exist',
                'missing_table': True
            }

        # Get current columns
        columns = [c["name"] for c in insp.get_columns('invoice_lines')]

        # Required columns based on model
        required_columns = [
            'id', 'invoice_id', 'work_date', 'hours',
            'rate_net', 'line_net', 'notes', 'job_assignment_id', 'headcount'
        ]

        missing_columns = [col for col in required_columns if col not in columns]
        extra_columns = [col for col in columns if col not in required_columns and col not in ['rate_per_hour', 'line_total']]
        legacy_columns = [col for col in ['rate_per_hour', 'line_total'] if col in columns]

        # Get indexes
        try:
            indexes = [idx["name"] for idx in insp.get_indexes('invoice_lines')]
        except:
            indexes = []

        result = {
            'status': 'ok' if not missing_columns else 'warning',
            'table_exists': True,
            'columns_found': columns,
            'missing_columns': missing_columns,
            'legacy_columns': legacy_columns,
            'extra_columns': extra_columns,
            'indexes': indexes,
            'message': 'Schema check complete'
        }

        if missing_columns:
            result['message'] = f"Missing columns: {', '.join(missing_columns)}"

        return result

    except Exception as e:
        current_app.logger.error(f"Database schema check failed: {e}")
        return {
            'status': 'error',
            'message': f"Schema check failed: {str(e)}"
        }


def check_invoice_data_sample():
    """Get a sample of invoice and invoice_lines data for verification."""
    try:
        # Check invoices count
        invoice_count = db.session.execute(sa.text("SELECT COUNT(*) FROM invoices")).scalar()

        # Check invoice_lines count
        lines_count = db.session.execute(sa.text("SELECT COUNT(*) FROM invoice_lines")).scalar()

        # Get sample invoice data
        sample_invoices = db.session.execute(sa.text("""
            SELECT id, agent_id, invoice_number, status, issue_date, total_amount
            FROM invoices
            ORDER BY id DESC
            LIMIT 3
        """)).fetchall()

        # Get sample lines data (if any)
        sample_lines = []
        if lines_count > 0:
            sample_lines = db.session.execute(sa.text("""
                SELECT id, invoice_id, work_date, hours, rate_net, line_net
                FROM invoice_lines
                ORDER BY id DESC
                LIMIT 3
            """)).fetchall()

        return {
            'status': 'ok',
            'invoice_count': invoice_count,
            'lines_count': lines_count,
            'sample_invoices': [dict(row._mapping) for row in sample_invoices],
            'sample_lines': [dict(row._mapping) for row in sample_lines]
        }

    except Exception as e:
        current_app.logger.error(f"Data sample check failed: {e}")
        return {
            'status': 'error',
            'message': f"Data check failed: {str(e)}"
        }


def full_health_check():
    """Perform complete database health check."""
    schema_result = check_invoice_lines_schema()
    data_result = check_invoice_data_sample()

    return {
        'schema': schema_result,
        'data': data_result,
        'overall_status': 'ok' if schema_result['status'] == 'ok' and data_result['status'] == 'ok' else 'warning'
    }