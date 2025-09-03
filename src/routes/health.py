from flask import Blueprint, jsonify
from sqlalchemy import inspect

from src.models.user import db, SupplierProfile, InvoiceLine

health_bp = Blueprint('health', __name__)


@health_bp.route('/health/invoicing', methods=['GET'])
def invoicing_health():
    try:
        supplier_count = db.session.query(SupplierProfile).count()
        insp = inspect(db.engine)
        # Check unique index on invoice_lines.job_assignment_id exists
        has_unique = False
        try:
            indexes = insp.get_indexes('invoice_lines')
            for ix in indexes:
                if 'job_assignment_id' in ix.get('column_names', []) and ix.get('unique'):
                    has_unique = True
                    break
        except Exception:
            has_unique = False
        from decimal import Decimal
        from flask import current_app
        vat_rate = current_app.config.get('VAT_DEFAULT_RATE', 0.20)
        return jsonify({
            'supplier_profiles': supplier_count,
            'has_unique_index': has_unique,
            'vat_default_rate': f"{Decimal(str(vat_rate)):.2f}"
        }), 200
    except Exception as e:
        return jsonify({'error': 'health_check_failed', 'details': str(e)}), 500


