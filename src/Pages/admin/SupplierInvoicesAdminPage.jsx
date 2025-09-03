import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { getSupplierPendingAssignments, createSupplierInvoiceFor } from '../../api/supplierInvoices';

export default function SupplierInvoicesAdminPage() {
  const [email, setEmail] = useState('hermes@pavli.group');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hoursAll, setHoursAll] = useState('');
  const [rateAll, setRateAll] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const data = await getSupplierPendingAssignments(email);
      setRows((data.assignments || []).map(a => ({...a, hours: '', rate_per_hour: ''})));
    } catch (e) {
      toast.error('Failed to load assignments', { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const applyHoursAll = () => setRows(prev => prev.map(r => ({...r, hours: hoursAll})));
  const applyRateAll = () => setRows(prev => prev.map(r => ({...r, rate_per_hour: rateAll})));

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
      await createSupplierInvoiceFor(email, items);
      toast.success('Invoice created');
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

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-bold">Supplier Invoices (Admin)</h1>
      <div className="flex gap-2 items-center">
        <input className="bg-transparent border px-2 py-1" placeholder="Supplier email" value={email} onChange={e => setEmail(e.target.value)} />
        <button className="button-refresh" onClick={load} disabled={loading}>Load</button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Job/Date</th>
              <th className="p-2">Headcount</th>
              <th className="p-2">Hours</th>
              <th className="p-2">Rate/hour</th>
              <th className="p-2 text-right">Line total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const h = parseFloat(r.hours || '0') || 0;
              const rate = parseFloat(r.rate_per_hour || '0') || 0;
              const hc = parseInt(r.headcount || 0, 10) || 0;
              const line = h * rate * hc;
              return (
                <tr key={r.job_assignment_id} className="border-b">
                  <td className="p-2">
                    <div className="font-medium">{r.address || `Job #${r.job_id}`}</div>
                    <div className="text-xs text-gray-400">{r.date ? new Date(r.date).toLocaleDateString('en-GB') : ''}</div>
                  </td>
                  <td className="p-2">{r.headcount}</td>
                  <td className="p-2">
                    <input className="w-24 bg-transparent border px-2 py-1" value={r.hours}
                           onChange={(e) => setRows(prev => prev.map(x => x.job_assignment_id === r.job_assignment_id ? {...x, hours: e.target.value} : x))}
                           placeholder="0" />
                  </td>
                  <td className="p-2">
                    <input className="w-24 bg-transparent border px-2 py-1" value={r.rate_per_hour}
                           onChange={(e) => setRows(prev => prev.map(x => x.job_assignment_id === r.job_assignment_id ? {...x, rate_per_hour: e.target.value} : x))}
                           placeholder="0" />
                  </td>
                  <td className="p-2 text-right">£{line.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <input className="w-24 bg-transparent border px-2 py-1" value={hoursAll} onChange={e => setHoursAll(e.target.value)} placeholder="Hours" />
        <button className="button-refresh" onClick={applyHoursAll}>Apply hours to all</button>
        <input className="w-24 bg-transparent border px-2 py-1" value={rateAll} onChange={e => setRateAll(e.target.value)} placeholder="Rate" />
        <button className="button-refresh" onClick={applyRateAll}>Apply rate to all</button>
      </div>

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


