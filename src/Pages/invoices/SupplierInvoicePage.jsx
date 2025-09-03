import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { getMyPendingAssignments, createMySupplierInvoice } from '../../api/supplierInvoices';
import SupplierInvoiceTable from './SupplierInvoiceTable';

const numberOrEmpty = (v) => (v === 0 ? '' : v);

export default function SupplierInvoicePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoursAll, setHoursAll] = useState('');
  const [rateAll, setRateAll] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getMyPendingAssignments();
        setRows((data.assignments || []).map(a => ({...a, hours: '', rate_per_hour: ''})));
      } catch (e) {
        toast.error('Failed to load pending assignments', { description: e.message });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const applyHoursAll = () => {
    setRows(prev => prev.map(r => ({...r, hours: hoursAll})));
  };
  const applyRateAll = () => {
    setRows(prev => prev.map(r => ({...r, rate_per_hour: rateAll})));
  };

  const computed = useMemo(() => {
    const subtotal = rows.reduce((acc, r) => {
      const h = parseFloat(r.hours || '0') || 0;
      const rate = parseFloat(r.rate_per_hour || '0') || 0;
      const hc = parseInt(r.headcount || 0, 10) || 0;
      return acc + (h * rate * hc);
    }, 0);
    const vat = subtotal * 0.20;
    const total = subtotal + vat;
    return { subtotal, vat, total };
  }, [rows]);

  const submit = async () => {
    try {
      const items = rows
        .filter(r => parseFloat(r.hours || '0') > 0 && parseFloat(r.rate_per_hour || '0') > 0)
        .map(r => ({ job_assignment_id: r.job_assignment_id, hours: parseFloat(r.hours), rate_per_hour: parseFloat(r.rate_per_hour) }));
      if (items.length === 0) {
        toast.error('Add at least one line with hours and rate');
        return;
      }
      await createMySupplierInvoice(items);
      toast.success('Invoice created');
      // Remove submitted rows
      setRows(prev => prev.filter(r => !items.find(i => i.job_assignment_id === r.job_assignment_id)));
    } catch (e) {
      const body = e?.responseJSON || {};
      if (body.error === 'duplicate_assignments') {
        const ids = body.conflicts || [];
        toast.error('Some assignments already invoiced', { description: `Conflicts: ${ids.join(', ')}`});
        setRows(prev => prev.filter(r => !ids.includes(r.job_assignment_id)));
        return;
      }
      toast.error('Failed to create supplier invoice', { description: e.message });
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-bold">Create Supplier Invoice</h1>
      <SupplierInvoiceTable
        rows={rows}
        setRows={setRows}
        hoursAll={hoursAll}
        setHoursAll={setHoursAll}
        rateAll={rateAll}
        setRateAll={setRateAll}
        onApplyHoursAll={applyHoursAll}
        onApplyRateAll={applyRateAll}
      />

      <div className="sticky bottom-0 bg-black/50 backdrop-blur p-4 rounded-md">
        <div className="flex justify-between"><span>Subtotal</span><span>£{computed.subtotal.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>VAT 20%</span><span>£{computed.vat.toFixed(2)}</span></div>
        <div className="flex justify-between font-bold text-v3-orange"><span>Grand total</span><span>£{computed.total.toFixed(2)}</span></div>
        <div className="mt-3 flex justify-end">
          <button className="button-refresh" onClick={submit}>Submit Invoice</button>
        </div>
      </div>
    </div>
  );
}


