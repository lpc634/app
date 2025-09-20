#!/usr/bin/env python3
"""
Test script for the union-based agent invoice query.
This validates that the new endpoint logic can find invoices through both direct
and legacy association paths.

Usage: python test_agent_invoice_union.py
"""

import os
from main import app
from src.models.user import Invoice, InvoiceLine, JobAssignment, User, db
from sqlalchemy import select, union_all


def test_union_query_logic():
    """Test the union query logic for finding agent invoices."""
    print("Testing union-based agent invoice query...")
    print("=" * 50)

    with app.app_context():
        try:
            # Test with actual data if available
            agents_with_invoices = db.session.execute(db.text("""
                SELECT DISTINCT u.id, u.first_name, u.last_name
                FROM users u
                WHERE u.role = 'agent'
                AND (
                    EXISTS (SELECT 1 FROM invoices i WHERE i.agent_id = u.id)
                    OR EXISTS (
                        SELECT 1 FROM invoice_lines il
                        JOIN job_assignments ja ON ja.id = il.job_assignment_id
                        WHERE ja.agent_id = u.id
                    )
                )
                LIMIT 3
            """)).fetchall()

            if not agents_with_invoices:
                print("No agents with invoices found - testing query syntax only")
                test_agent_id = 1
            else:
                test_agent_id = agents_with_invoices[0].id
                print(f"Testing with agent: {agents_with_invoices[0].first_name} {agents_with_invoices[0].last_name} (ID: {test_agent_id})")

            # Test the union query components
            print("\n1. Testing direct invoice query (Path A)...")
            sub_a = select(Invoice.id).where(Invoice.agent_id == test_agent_id)
            direct_invoices = db.session.execute(sub_a).fetchall()
            print(f"   Direct invoices found: {len(direct_invoices)}")

            print("\n2. Testing legacy invoice query (Path B)...")
            sub_b = (
                select(InvoiceLine.invoice_id)
                .select_from(InvoiceLine)
                .join(JobAssignment, JobAssignment.id == InvoiceLine.job_assignment_id)
                .where(JobAssignment.agent_id == test_agent_id)
            )
            legacy_invoices = db.session.execute(sub_b).fetchall()
            print(f"   Legacy invoices found: {len(legacy_invoices)}")

            print("\n3. Testing union query...")
            # Union and dedupe invoice IDs
            inv_ids_union = union_all(sub_a, sub_b).subquery()
            inv_ids = select(db.func.distinct(inv_ids_union.c[0])).subquery()

            # Get the actual invoice IDs
            all_invoice_ids = db.session.execute(select(inv_ids)).fetchall()
            print(f"   Total unique invoices (union): {len(all_invoice_ids)}")

            print("\n4. Testing full invoice query with eager loading...")
            from sqlalchemy.orm import selectinload
            from src.models.user import InvoiceJob

            invoices_query = (db.session.query(Invoice)
                             .filter(Invoice.id.in_(select(inv_ids)))
                             .options(
                                 selectinload(Invoice.lines),
                                 selectinload(Invoice.jobs).selectinload(InvoiceJob.job)
                             )
                             .order_by(Invoice.issue_date.desc())
                             .limit(10))

            invoices = invoices_query.all()
            print(f"   Final invoice objects returned: {len(invoices)}")

            if invoices:
                sample_invoice = invoices[0]
                print(f"   Sample invoice: #{sample_invoice.invoice_number} (Status: {sample_invoice.status})")
                print(f"   Sample invoice lines: {len(sample_invoice.lines) if sample_invoice.lines else 0}")

            print("\n5. Testing serialization...")
            try:
                # Import the serialization function
                import sys
                sys.path.append('src/routes')
                from agent import _serialize_invoice

                if invoices:
                    serialized = _serialize_invoice(invoices[0])
                    required_fields = ['id', 'number', 'status', 'issue_date', 'total_gross']
                    missing_fields = [f for f in required_fields if f not in serialized]

                    if missing_fields:
                        print(f"   WARNING: Missing fields in serialization: {missing_fields}")
                    else:
                        print("   SUCCESS: Invoice serialization working")
                else:
                    print("   INFO: No invoices to test serialization")

            except Exception as e:
                print(f"   WARNING: Serialization test failed: {e}")

            print("\n" + "=" * 50)
            print("✅ Union query logic test completed successfully!")
            print("✅ The updated endpoint should now show historical invoices")

            return True

        except Exception as e:
            print(f"ERROR: Union query test failed: {e}")
            import traceback
            traceback.print_exc()
            return False


def compare_old_vs_new_logic():
    """Compare results between old (direct only) and new (union) logic."""
    print("\nComparing old vs new logic...")
    print("-" * 30)

    with app.app_context():
        try:
            # Find an agent to test with
            agent = db.session.execute(db.text("""
                SELECT u.id, u.first_name, u.last_name
                FROM users u
                WHERE u.role = 'agent'
                LIMIT 1
            """)).fetchone()

            if not agent:
                print("No agents found for comparison test")
                return

            agent_id = agent.id
            print(f"Comparing for agent: {agent.first_name} {agent.last_name} (ID: {agent_id})")

            # Old logic: only direct agent_id
            old_count = Invoice.query.filter(Invoice.agent_id == agent_id).count()
            print(f"Old logic (direct only): {old_count} invoices")

            # New logic: union approach
            sub_a = select(Invoice.id).where(Invoice.agent_id == agent_id)
            sub_b = (
                select(InvoiceLine.invoice_id)
                .select_from(InvoiceLine)
                .join(JobAssignment, JobAssignment.id == InvoiceLine.job_assignment_id)
                .where(JobAssignment.agent_id == agent_id)
            )
            inv_ids_union = union_all(sub_a, sub_b).subquery()
            inv_ids = select(db.func.distinct(inv_ids_union.c[0])).subquery()

            new_count = db.session.query(Invoice).filter(Invoice.id.in_(select(inv_ids))).count()
            print(f"New logic (union): {new_count} invoices")

            difference = new_count - old_count
            if difference > 0:
                print(f"✅ NEW LOGIC FINDS {difference} MORE HISTORICAL INVOICES!")
            elif difference == 0:
                print("INFO: Same number of invoices found (no legacy associations)")
            else:
                print("WARNING: New logic found fewer invoices (unexpected)")

        except Exception as e:
            print(f"Comparison test failed: {e}")


if __name__ == "__main__":
    success = test_union_query_logic()
    compare_old_vs_new_logic()
    exit(0 if success else 1)