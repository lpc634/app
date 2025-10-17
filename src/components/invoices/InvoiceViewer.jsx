import React from "react";

export default function InvoiceViewer({ open, onClose, blobUrl, fileName }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center">
      <div className="relative bg-[#0b0d12] rounded-xl shadow-2xl w-[92vw] h-[88vh] overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 rounded-md px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white"
        >
          Close
        </button>
        <iframe
          title={fileName || "Invoice"}
          src={blobUrl}
          className="w-full h-full bg-[#0b0d12]"
        />
        <div className="absolute bottom-3 left-3 flex gap-2">
          <a
            href={blobUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded bg-white/10 text-white hover:bg-white/20"
          >
            Open in new tab
          </a>
          <a
            href={blobUrl}
            download={fileName || "invoice.pdf"}
            className="px-3 py-1.5 rounded bg-white/10 text-white hover:bg-white/20"
          >
            Download
          </a>
        </div>
      </div>
    </div>
  );
}
