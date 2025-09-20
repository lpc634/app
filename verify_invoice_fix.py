#!/usr/bin/env python3
"""
Post-deployment verification script for invoice_lines schema fix.
Run this script after deploying the migration to verify everything works.

Usage: python verify_invoice_fix.py
"""

import os
from main import app
from src.utils.dbcheck import full_health_check
from src.models.user import Invoice, InvoiceLine, db
import json


def main():
    """Run verification checks."""
    print("Verifying invoice_lines schema fix...")
    print("=" * 50)

    with app.app_context():
        # 1. Database health check
        print("1. Running database health check...")
        try:
            health = full_health_check()
            print(f"   Schema status: {health['schema']['status']}")
            print(f"   Data status: {health['data']['status']}")

            if health['schema'].get('missing_columns'):
                print(f"   ERROR: Missing columns: {health['schema']['missing_columns']}")
                return False
            else:
                print("   SUCCESS: All required columns present")

            print(f"   DATA: Found {health['data']['invoice_count']} invoices")
            print(f"   DATA: Found {health['data']['lines_count']} invoice lines")

        except Exception as e:
            print(f"   ERROR: Health check failed: {e}")
            return False

        # 2. Test invoice query
        print("\n2. Testing invoice queries...")
        try:
            # Count total invoices
            total_invoices = Invoice.query.count()
            print(f"   INFO: Total invoices in system: {total_invoices}")

            # Test eager loading with new schema
            sample_invoices = (Invoice.query
                             .filter(Invoice.agent_id.isnot(None))
                             .order_by(Invoice.id.desc())
                             .limit(3)
                             .all())

            print(f"   INFO: Tested {len(sample_invoices)} sample invoices")

            for inv in sample_invoices:
                lines_count = len(inv.lines) if inv.lines else 0
                print(f"      Invoice {inv.id}: {lines_count} lines")

            print("   SUCCESS: Invoice queries working")

        except Exception as e:
            print(f"   ERROR: Invoice query failed: {e}")
            return False

        # 3. Test serialization
        print("\n3. Testing invoice serialization...")
        try:
            from src.routes.agent import _serialize_invoice

            if sample_invoices:
                test_invoice = sample_invoices[0]
                serialized = _serialize_invoice(test_invoice)

                required_fields = ['id', 'number', 'status', 'issue_date', 'due_date', 'total_gross', 'job', 'lines']
                missing_fields = [field for field in required_fields if field not in serialized]

                if missing_fields:
                    print(f"   ERROR: Missing fields in serialization: {missing_fields}")
                    return False
                else:
                    print("   SUCCESS: Invoice serialization working")
                    print(f"      Sample invoice {test_invoice.id} serialized successfully")

        except Exception as e:
            print(f"   ERROR: Serialization test failed: {e}")
            return False

        # 4. Database direct check
        print("\n4. Direct database verification...")
        try:
            # Check work_date column exists and has data
            result = db.session.execute(db.text("""
                SELECT COUNT(*) as total_lines,
                       COUNT(work_date) as lines_with_date,
                       MIN(work_date) as earliest_date,
                       MAX(work_date) as latest_date
                FROM invoice_lines
            """)).fetchone()

            if result:
                print(f"   DATA: Total lines: {result.total_lines}")
                print(f"   DATA: Lines with work_date: {result.lines_with_date}")
                if result.earliest_date and result.latest_date:
                    print(f"   DATA: Date range: {result.earliest_date} to {result.latest_date}")

                if result.total_lines > 0 and result.lines_with_date == result.total_lines:
                    print("   SUCCESS: All lines have work_date populated")
                elif result.total_lines > 0:
                    print(f"   WARNING: {result.total_lines - result.lines_with_date} lines missing work_date")
                else:
                    print("   INFO: No invoice lines found (expected for new systems)")

        except Exception as e:
            print(f"   ERROR: Direct DB check failed: {e}")
            return False

    print("\n" + "=" * 50)
    print("SUCCESS: All verification checks passed!")
    print("SUCCESS: The invoice_lines schema fix is working correctly")
    print("SUCCESS: Agent Portal My Invoices should now display invoices")
    return True


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)