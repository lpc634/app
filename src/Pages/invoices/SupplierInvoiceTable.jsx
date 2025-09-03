import React from 'react';

export default function SupplierInvoiceTable({ rows, setRows, hoursAll, setHoursAll, rateAll, setRateAll, onApplyHoursAll, onApplyRateAll }) {
  return (
    <>
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
        <button className="button-refresh" onClick={onApplyHoursAll}>Apply hours to all</button>
        <input className="w-24 bg-transparent border px-2 py-1" value={rateAll} onChange={e => setRateAll(e.target.value)} placeholder="Rate" />
        <button className="button-refresh" onClick={onApplyRateAll}>Apply rate to all</button>
      </div>
    </>
  );
}


