import os
import re
from io import BytesIO

from flask import Blueprint, jsonify, send_file, request, url_for, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from sqlalchemy.orm import joinedload

from src.models.user import User, Invoice, InvoiceJob, InvoiceLine, db
from src.utils.s3_client import s3_client
from src.pdf.invoice_builder import build_invoice_pdf

invoices_bp = Blueprint('invoices', __name__)

REF_RE = re.compile(r"^INV-\d{6}-\d{4}$")


def _signer():
    secret = current_app.config.get("PDF_SIGNING_SECRET") or current_app.config.get("SECRET_KEY")
    return URLSafeTimedSerializer(secret, salt="invoice-pdf")


def _require_admin():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id)) if user_id is not None else None
    return user if user and user.role == 'admin' else None


def _get_invoice_by_id_or_ref(id_or_ref):
    q = Invoice.query.options(joinedload(Invoice.lines))
    inv = None
    try:
        if isinstance(id_or_ref, int) or (isinstance(id_or_ref, str) and id_or_ref.isdigit()):
            inv = q.filter_by(id=int(id_or_ref)).first()
        else:
            ref = str(id_or_ref).strip()
            if REF_RE.match(ref):
                inv = q.filter_by(invoice_number=ref).first() or q.filter_by(invoice_number=str(ref)).first()
            elif ref.isdigit():
                inv = q.filter_by(id=int(ref)).first()
    except Exception:
        inv = None
    return inv


def _render_invoice_pdf_bytes(inv: Invoice) -> bytes | None:
    try:
        # Prefer detailed per-day invoice lines when available
        lines = (InvoiceLine.query
                 .filter_by(invoice_id=inv.id)
                 .order_by(InvoiceLine.work_date.asc(), InvoiceLine.id.asc())
                 .all())

        jobs_data = []
        if lines:
            invoice_job = InvoiceJob.query.filter_by(invoice_id=inv.id).first()
            linked_job = invoice_job.job if invoice_job else None
            for ln in lines:
                jobs_data.append({
                    'job': linked_job,
                    'date': ln.work_date,
                    'hours': float(ln.hours or 0),
                    'rate': float((ln.rate_net if ln.rate_net is not None else ln.rate_per_hour) or 0),
                    'amount': float((ln.line_net if ln.line_net is not None else ln.line_total) or 0),
                    'job_type': getattr(linked_job, 'job_type', None),
                })
        else:
            # Fallback aggregate
            invoice_jobs = InvoiceJob.query.filter_by(invoice_id=inv.id).all()
            if not invoice_jobs:
                return None
            for ij in invoice_jobs:
                job = ij.job
                if not job:
                    continue
                hours = float(ij.hours_worked or 0)
                rate = float(ij.hourly_rate_at_invoice or getattr(job, 'hourly_rate', 0) or 0)
                amount = hours * rate
                jobs_data.append({'job': job, 'hours': hours, 'rate': rate, 'amount': amount})

        # Totals
        total = sum(float(row.get('amount') or 0) for row in jobs_data)
        vat_rate = float(getattr(inv, 'vat_rate', 0) or 0)
        vat = round(total * vat_rate, 2) if vat_rate else 0.0
        totals = { 'subtotal': total, 'vat': vat, 'total': round(total + vat, 2), 'vat_rate': vat_rate }

        # Resolve agent (owner)
        agent = inv.agent or User.query.get(inv.agent_id)

        # Render into /tmp then read bytes
        folder = os.path.join('/tmp', 'invoices')
        os.makedirs(folder, exist_ok=True)
        tmp_path = os.path.join(folder, f"{inv.invoice_number or inv.id}.pdf")
        build_invoice_pdf(
            file_path=tmp_path,
            agent=agent,
            jobs=jobs_data,
            totals=totals,
            invoice_number=inv.invoice_number,
            invoice_date=getattr(inv, 'issue_date', None),
            agent_invoice_number=getattr(inv, 'agent_invoice_number', None),
            invoice=inv
        )
        with open(tmp_path, 'rb') as f:
            pdf_bytes = f.read()
        try:
            os.remove(tmp_path)
        except Exception:
            pass
        return pdf_bytes
    except Exception as e:
        current_app.logger.error(f"INVOICE RENDER ERROR: {e}")
        return None


@invoices_bp.route('/invoices/<id_or_ref>/pdf_url', methods=['GET'])
@jwt_required()
def get_invoice_pdf_url(id_or_ref):
    user = _require_admin()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 403
    inv = _get_invoice_by_id_or_ref(id_or_ref)
    if not inv:
        return jsonify({'error': 'Invoice not found'}), 404
    token = _signer().dumps({'iid': inv.id})
    return jsonify({'url': url_for('invoices.get_invoice_pdf', id_or_ref=inv.id, st=token)}), 200


@invoices_bp.route('/invoices/<id_or_ref>/pdf', methods=['GET'])
def get_invoice_pdf(id_or_ref):
    token = request.args.get('st')
    if token:
        try:
            data = _signer().loads(token, max_age=300)
            if int(data.get('iid')) <= 0:
                return jsonify({'error': 'Invalid token'}), 403
        except (BadSignature, SignatureExpired):
            return jsonify({'error': 'Invalid/expired token'}), 403
    else:
        # Require admin auth if not using signed token
        try:
            user = _require_admin()
        except Exception:
            user = None
        if not user:
            return jsonify({'error': 'Unauthorized'}), 401

    inv = _get_invoice_by_id_or_ref(id_or_ref)
    if not inv:
        return jsonify({'error': 'Invoice not found'}), 404

    # Try S3 first
    pdf_bytes = None
    if s3_client.is_configured():
        try:
            signed = s3_client.generate_invoice_download_url(inv.agent_id, inv.invoice_number, expiration=300)
            if signed.get('success') and signed.get('download_url'):
                # proxy via redirect would expose URL; instead fetch & stream is heavy. Return direct stream from S3 is not possible here without revealing URL.
                # For iframe we prefer presigned link: let caller use pdf_url endpoint.
                # As a fallback, attempt to read via our credentials (not ideal for big files).
                pass
        except Exception:
            pass

    # If we cannot ensure availability via S3 link, regenerate and upload
    if pdf_bytes is None:
        current_app.logger.info(f"Invoice {inv.id}: PDF not directly available; attempting regeneration")
        pdf_bytes = _render_invoice_pdf_bytes(inv)
        if not pdf_bytes:
            return jsonify({'error': 'Unable to render invoice PDF'}), 500
        # Upload to S3 for durability if configured
        try:
            if s3_client.is_configured():
                _ = s3_client.upload_invoice_pdf(agent_id=inv.agent_id, invoice_number=inv.invoice_number, pdf_data=BytesIO(pdf_bytes), filename=f"{inv.invoice_number}.pdf")
        except Exception as e:
            current_app.logger.warning(f"Invoice {inv.id}: PDF upload failed: {e}")

    resp = send_file(BytesIO(pdf_bytes), mimetype='application/pdf', as_attachment=False, download_name=f"invoice-{inv.id}.pdf")
    try:
        resp.headers['Content-Disposition'] = f'inline; filename="invoice-{inv.id}.pdf"'
    except Exception:
        pass
    return resp


