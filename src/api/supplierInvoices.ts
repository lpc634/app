import { apiCall } from '../useAuth';

export async function getMyPendingAssignments() {
  return apiCall('/me/supplier/pending-assignments');
}

export async function createMySupplierInvoice(items: Array<{ job_assignment_id: number; hours: number; rate_per_hour: number }>) {
  return apiCall('/me/supplier/invoices', {
    method: 'POST',
    body: JSON.stringify({ items })
  });
}

export async function getSupplierPendingAssignments(email: string) {
  return apiCall(`/suppliers/${encodeURIComponent(email)}/pending-assignments`);
}

export async function createSupplierInvoiceFor(email: string, items: Array<{ job_assignment_id: number; hours: number; rate_per_hour: number }>) {
  return apiCall(`/suppliers/${encodeURIComponent(email)}/invoices`, {
    method: 'POST',
    body: JSON.stringify({ items })
  });
}


