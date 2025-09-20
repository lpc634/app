#!/usr/bin/env python3
"""
Verification script for invoices.agent_id backfill migration.
Run this after deploying the backfill migration to verify historical invoices reappear.

Usage: python verify_agent_id_backfill.py
"""

import os
from main import app
from src.models.user import Invoice, InvoiceLine, JobAssignment, InvoiceJob, User, db
import json


def main():
    """Run verification checks for agent_id backfill."""
    print("Verifying invoices.agent_id backfill migration...")
    print("=" * 60)

    with app.app_context():
        # 1. Check invoice agent_id status
        print("1. Invoice agent_id status check...")
        try:
            total_invoices = Invoice.query.count()
            null_agent_invoices = Invoice.query.filter(Invoice.agent_id.is_(None)).count()
            populated_agent_invoices = total_invoices - null_agent_invoices

            print(f"   Total invoices: {total_invoices}")
            print(f"   With agent_id: {populated_agent_invoices}")
            print(f"   NULL agent_id: {null_agent_invoices}")

            if null_agent_invoices == 0:
                print("   SUCCESS: All invoices have agent_id populated")
            else:
                print(f"   WARNING: {null_agent_invoices} invoices still have NULL agent_id")

        except Exception as e:
            print(f"   ERROR: Invoice count check failed: {e}")
            return False

        # 2. Test agent invoice retrieval
        print("\n2. Testing agent invoice retrieval...")
        try:
            # Find agents who have invoices
            agent_invoice_counts = {}
            agents_with_invoices = db.session.execute(db.text("""
                SELECT agent_id, COUNT(*) as invoice_count
                FROM invoices
                WHERE agent_id IS NOT NULL
                GROUP BY agent_id
                ORDER BY invoice_count DESC
                LIMIT 5
            """)).fetchall()

            if not agents_with_invoices:
                print("   INFO: No invoices found with agent_id set")
                return True

            print(f"   Found {len(agents_with_invoices)} agents with invoices:")
            for row in agents_with_invoices:
                agent_id = row.agent_id
                count = row.invoice_count
                agent_invoice_counts[agent_id] = count

                # Get agent name
                agent = User.query.get(agent_id)
                agent_name = f"{agent.first_name} {agent.last_name}" if agent else f"Agent {agent_id}"
                print(f"      {agent_name} (ID: {agent_id}): {count} invoices")

        except Exception as e:
            print(f"   ERROR: Agent invoice count check failed: {e}")
            return False

        # 3. Test invoice endpoint for a sample agent
        print("\n3. Testing invoice list endpoint...")
        try:
            if agent_invoice_counts:
                # Test with the agent who has the most invoices
                test_agent_id = max(agent_invoice_counts.keys(), key=lambda k: agent_invoice_counts[k])
                test_agent = User.query.get(test_agent_id)

                if test_agent:
                    # Simulate the invoice list query from the route
                    from sqlalchemy.orm import selectinload
                    invoices_query = (db.session.query(Invoice)
                                    .filter(Invoice.agent_id == test_agent_id)
                                    .options(
                                        selectinload(Invoice.lines),
                                        selectinload(Invoice.jobs).selectinload(InvoiceJob.job)
                                    )
                                    .order_by(Invoice.issue_date.desc())
                                    .limit(10))

                    invoices = invoices_query.all()
                    print(f"   Agent {test_agent.first_name} {test_agent.last_name} (ID: {test_agent_id}):")
                    print(f"      Query returned {len(invoices)} invoices")

                    if invoices:
                        sample_invoice = invoices[0]
                        print(f"      Sample invoice {sample_invoice.id}: #{sample_invoice.invoice_number}")
                        print(f"         Status: {sample_invoice.status}")
                        print(f"         Date: {sample_invoice.issue_date}")
                        print(f"         Lines: {len(sample_invoice.lines) if sample_invoice.lines else 0}")
                        print("   SUCCESS: Invoice list endpoint working")
                    else:
                        print("   WARNING: Query returned empty result despite invoices existing")

            else:
                print("   INFO: No agents with invoices to test")

        except Exception as e:
            print(f"   ERROR: Endpoint test failed: {e}")
            return False

        # 4. Relationship integrity check
        print("\n4. Data relationship integrity check...")
        try:
            # Check for invoices that should have been backfilled but weren't
            orphaned_invoices = db.session.execute(db.text("""
                SELECT i.id, i.invoice_number, i.issue_date
                FROM invoices i
                WHERE i.agent_id IS NULL
                AND (
                    EXISTS (
                        SELECT 1 FROM invoice_lines il
                        JOIN job_assignments ja ON ja.id = il.job_assignment_id
                        WHERE il.invoice_id = i.id
                    )
                    OR EXISTS (
                        SELECT 1 FROM invoice_jobs ij
                        JOIN job_assignments ja ON ja.job_id = ij.job_id
                        WHERE ij.invoice_id = i.id
                    )
                )
                LIMIT 5
            """)).fetchall()

            if orphaned_invoices:
                print(f"   WARNING: Found {len(orphaned_invoices)} orphaned invoices that should have been backfilled:")
                for invoice in orphaned_invoices:
                    print(f"      Invoice {invoice.id}: {invoice.invoice_number} ({invoice.issue_date})")
            else:
                print("   SUCCESS: No orphaned invoices found")

        except Exception as e:
            print(f"   ERROR: Relationship check failed: {e}")
            return False

        # 5. Migration effectiveness summary
        print("\n5. Migration effectiveness summary...")
        try:
            # Count invoices by status
            status_counts = db.session.execute(db.text("""
                SELECT
                    CASE WHEN agent_id IS NULL THEN 'NULL' ELSE 'POPULATED' END as status,
                    COUNT(*) as count
                FROM invoices
                GROUP BY CASE WHEN agent_id IS NULL THEN 'NULL' ELSE 'POPULATED' END
            """)).fetchall()

            for row in status_counts:
                print(f"   {row.status} agent_id: {row.count} invoices")

        except Exception as e:
            print(f"   ERROR: Summary generation failed: {e}")
            return False

    print("\n" + "=" * 60)
    if null_agent_invoices == 0:
        print("SUCCESS: agent_id backfill migration completed successfully!")
        print("SUCCESS: Historical invoices should now appear in Agent Portal")
    else:
        print("PARTIAL: Migration completed but some invoices still have NULL agent_id")
        print("INFO: Check logs above for orphaned invoice details")

    return True


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)