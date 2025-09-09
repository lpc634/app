export default function ResponsiveList({ data, columns, renderCard, renderRow }) {
  return (
    <div className="w-full">
      <div className="md:hidden grid gap-3">
        {data.map((item) => renderCard(item))}
      </div>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b">
              {columns.map((col) => (
                <th key={col.key} className="text-left p-2 text-sm font-medium">{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => renderRow(item))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


