/**
 * Fetch invoice PDF as a Blob for inline viewing
 * @param invoiceId - The invoice ID or reference number
 * @returns Promise<Blob> - The PDF as a Blob
 */
export async function getInvoicePdf(invoiceId: string): Promise<Blob> {
  const token = localStorage.getItem('token');

  const res = await fetch(`/api/invoices/${invoiceId}/pdf`, {
    method: 'GET',
    headers: {
      'Accept': 'application/pdf',
      'Authorization': `Bearer ${token}`,
    },
    credentials: 'include'
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch invoice PDF: ${res.status} ${res.statusText}`);
  }

  return await res.blob();
}
