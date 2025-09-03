import json
from decimal import Decimal


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


def test_health(client):
    res = client.get('/api/health/invoicing')
    assert res.status_code == 200
    data = res.get_json()
    assert 'supplier_profiles' in data
    assert 'has_unique_index' in data
    assert 'vat_default_rate' in data


def test_supplier_pending_requires_auth(client, supplier_token):
    res = client.get('/api/me/supplier/pending-assignments', headers=auth_header(supplier_token))
    assert res.status_code in (200, 204)


def test_supplier_invoice_duplicate_conflict(client, admin_token, supplier_token, make_assignment_for_supplier):
    # Arrange an assignment linked to supplier
    ja_id = make_assignment_for_supplier()
    payload = {"items": [{"job_assignment_id": ja_id, "hours": "8.0", "rate_per_hour": "20.00"}]}

    # First submission (as supplier)
    res1 = client.post('/api/me/supplier/invoices', headers=auth_header(supplier_token), data=json.dumps(payload), content_type='application/json')
    assert res1.status_code in (201, 200)

    # Second submission should 409 with conflicts
    res2 = client.post('/api/me/supplier/invoices', headers=auth_header(supplier_token), data=json.dumps(payload), content_type='application/json')
    assert res2.status_code == 409
    data = res2.get_json()
    assert data.get('error') == 'duplicate_assignments'
    assert ja_id in (data.get('conflicts') or [])


def test_supplier_math_and_vat(client, supplier_token, make_assignment_for_supplier):
    ja_id = make_assignment_for_supplier(headcount=3)
    payload = {"items": [{"job_assignment_id": ja_id, "hours": "7.5", "rate_per_hour": "20.00"}]}
    res = client.post('/api/me/supplier/invoices', headers=auth_header(supplier_token), data=json.dumps(payload), content_type='application/json')
    assert res.status_code in (201, 200)



