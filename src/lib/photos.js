// Phone photos are several MB each. These helpers shrink them in the browser: a smaller copy to
// upload, and a tiny one to show in a list without holding dozens of full-size images in memory.

// Draw an image file onto a canvas no bigger than maxEdge on its longer side.
async function drawScaled(file, maxEdge) {
  const source = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = source;
    await img.decode();
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(source);
  }
}

const toJpeg = (canvas, quality) => new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

// A copy of a large JPEG that is quick to upload; anything else comes back unchanged.
export async function shrinkPhoto(file, maxEdge = 2400, quality = 0.85) {
  if (file.type !== "image/jpeg" || file.size < 1.5 * 1024 * 1024) return file;
  try {
    const blob = await toJpeg(await drawScaled(file, maxEdge), quality);
    return blob && blob.size < file.size ? new File([blob], file.name, { type: "image/jpeg" }) : file;
  } catch {
    return file; // send the original rather than lose the photo
  }
}

// A URL for a small preview of an image file.
export async function thumbnailUrl(file, edge = 360) {
  try {
    const blob = await toJpeg(await drawScaled(file, edge), 0.7);
    if (blob) return URL.createObjectURL(blob);
  } catch {
    // fall through: some formats can't be drawn, but the browser may still show them
  }
  return URL.createObjectURL(file);
}
