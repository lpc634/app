import { useEffect, useState } from "react";
import { thumbnailUrl } from "@/lib/photos";

// Previews are made once per file, and one at a time: decoding thirty phone photos at once can crash a phone
const previews = new WeakMap(); // File -> preview URL
let line = Promise.resolve();

function Preview({ file }) {
  const [url, setUrl] = useState(() => previews.get(file) || null);

  useEffect(() => {
    let live = true;
    if (!previews.has(file)) {
      line = line.then(async () => {
        if (!previews.has(file)) previews.set(file, await thumbnailUrl(file));
      });
    }
    line.then(() => { if (live) setUrl(previews.get(file)); });
    return () => { live = false; };
  }, [file]);

  return url
    ? <img src={url} alt={file.name} className="photo-thumb" />
    : <div className="sub" style={{ textAlign: "center" }}>Loading…</div>;
}

/**
 * Any number of photos: choose several at once, see them, remove any.
 * Styled by the host form's .photo-tile / .photo-thumb / .photo-remove rules.
 */
export default function PhotoPicker({ photos, onChange }) {
  const add = (e) => {
    onChange([...photos, ...Array.from(e.target.files || [])]);
    e.target.value = ""; // so the same file can be chosen again after being removed
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 14 }}>
        {photos.map((file, i) => (
          <div key={`${file.name}-${file.size}-${file.lastModified}-${i}`} className="photo-tile" style={{ cursor: "default" }}>
            <Preview file={file} />
            <button
              type="button"
              className="photo-remove"
              aria-label={`Remove ${file.name}`}
              onClick={() => onChange(photos.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        ))}
        <label className="photo-tile">
          <div className="sub" style={{ textAlign: "center" }}>+ Add photos</div>
          <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={add} />
        </label>
      </div>
      <div className="sub" style={{ marginTop: 8 }}>
        {photos.length === 0
          ? "Add as many as you need. You can select several at once."
          : `${photos.length} photo${photos.length === 1 ? "" : "s"} added`}
      </div>
    </div>
  );
}
