import React from "react";

export function formatBoolean(val: any): React.ReactNode {
  const v = !!val;
  const cls = v
    ? "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900/30 text-green-300 border border-green-700/50"
    : "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-900/30 text-gray-300 border border-gray-700/50";
  return <span className={cls}>{v ? "Yes" : "No"}</span>;
}

export function formatAddress(val: any): React.ReactNode {
  try {
    const obj = typeof val === "string" ? JSON.parse(val) : val;
    if (!obj || typeof obj !== "object") return <span>{String(val || "-")}</span>;
    const junk = /^(please select|select\.*|n\/a)$/i;
    const parts = [obj.line1, obj.line2, obj.city, obj.region, obj.postcode, obj.country]
      .filter(Boolean)
      .map((p: string) => String(p).trim())
      .filter((p: string) => p && p !== '-' && p.toLowerCase() !== 'undefined' && !junk.test(p));
    return (
      <div className="whitespace-pre-wrap leading-5">
        {parts.map((p: string, i: number) => (
          <div key={i}>{p}</div>
        ))}
      </div>
    );
  } catch {
    return <span>{String(val || "-")}</span>;
  }
}

export function formatEmail(val: any): React.ReactNode {
  if (!val) return <span>-</span>;
  return (
    <a href={`mailto:${val}`} className="text-blue-400 hover:underline">
      {String(val)}
    </a>
  );
}

export function formatPhone(val: any): React.ReactNode {
  if (!val) return <span>-</span>;
  const s = String(val);
  const tel = s.replace(/\s+/g, "");
  return (
    <a href={`tel:${tel}`} className="text-blue-400 hover:underline">
      {s}
    </a>
  );
}

export function formatDateUK(d: any): string {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(d);
  }
}

export function formatAny(key: string, value: any): React.ReactNode {
  if (value === undefined || value === null || value === "") return <span>-</span>;
  const lower = key.toLowerCase();
  if (typeof value === "boolean") return formatBoolean(value);
  if (lower.includes("email")) return formatEmail(value);
  if (lower.includes("phone")) return formatPhone(value);
  if (lower.includes("address")) return formatAddress(value);
  if (lower.includes("date")) return <span>{formatDateUK(value)}</span>;

  // Handle signature fields (base64 encoded images)
  if (lower.includes("signature") && typeof value === "string" && value.startsWith("data:image")) {
    return (
      <div className="border border-[#2A2A2E] rounded-md p-2 bg-white inline-block">
        <img src={value} alt="Signature" className="max-w-[300px] max-h-[120px] object-contain" />
      </div>
    );
  }

  if (typeof value === "object") {
    try { return <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>; } catch {}
  }
  return <span>{String(value)}</span>;
}
