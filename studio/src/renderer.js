import { eventDate } from "./copy.js";
export const decodeImage = (blob) =>
  createImageBitmap(blob, { imageOrientation: "from-image" });
function readable(color, minimum) {
  let rgb = color
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16));
  const contrast = () => {
    const linear = rgb.map((n) => {
      const v = n / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return (
      1.05 /
      (linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722 + 0.05)
    );
  };
  while (contrast() < minimum) rgb = rgb.map((n) => Math.floor(n * 0.93));
  return "#" + rgb.map((n) => n.toString(16).padStart(2, "0")).join("");
}
function rounded(c, x, y, w, h, r, fill) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fillStyle = fill;
  c.fill();
}
function contain(c, image, x, y, w, h) {
  const s = Math.min(w / image.width, h / image.height),
    iw = image.width * s,
    ih = image.height * s;
  c.drawImage(image, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}
function cover(c, image, x, y, w, h) {
  const s = Math.max(w / image.width, h / image.height),
    sw = w / s,
    sh = h / s;
  c.drawImage(
    image,
    (image.width - sw) / 2,
    (image.height - sh) / 2,
    sw,
    sh,
    x,
    y,
    w,
    h,
  );
}
function wrap(c, text, width) {
  const result = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (c.measureText(word).width > width) {
        if (line) {
          result.push(line);
          line = "";
        }
        for (const char of word) {
          if (c.measureText(line + char).width > width && line) {
            result.push(line);
            line = "";
          }
          line += char;
        }
      } else if (line && c.measureText(`${line} ${word}`).width > width) {
        result.push(line);
        line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    if (line) result.push(line);
  }
  return result;
}
function text(c, value, x, y, w, h, maxSize, weight, color) {
  let size = maxSize,
    lines = [];
  for (; size >= 12; size--) {
    c.font = `${weight} ${size}px Arial, sans-serif`;
    lines = wrap(c, value, w);
    if (lines.length * size * 1.16 <= h) break;
  }
  if (size < 12)
    throw Error(
      "Text is too long for this visual. Shorten the visual headline or summary.",
    );
  c.fillStyle = color;
  c.textBaseline = "top";
  lines.forEach((line, i) => c.fillText(line, x, y + i * size * 1.16));
}
export async function renderVisual(b, o, copy, assets) {
  const canvas = document.createElement("canvas");
  canvas.width = o.width;
  canvas.height = o.height;
  const c = canvas.getContext("2d");
  if (!c) throw Error("Canvas rendering is not available.");
  const w = o.width,
    h = o.height,
    story = h / w > 1.5,
    m = w * 0.055,
    primary = b.colors[(o.variant - 1) % 2],
    accent = b.colors[o.variant % 2],
    ink = b.colors[2];
  const bitmaps = [];
  try {
    const photoAsset = assets.photos.find((p) => p.id === o.photoId),
      photo = photoAsset ? await decodeImage(photoAsset.blob) : null;
    if (photo) bitmaps.push(photo);
    const logos = [];
    for (const a of assets.logos) {
      const image = await decodeImage(a.blob);
      bitmaps.push(image);
      logos.push(image);
    }
    if (!logos.length) throw Error("Every visual requires at least one logo.");
    const gradient = c.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(1, "#edf7fc");
    c.fillStyle = gradient;
    c.fillRect(0, 0, w, h);
    const cols = Math.min(4, logos.length),
      rows = Math.ceil(logos.length / cols),
      shelfH = Math.max(
        h * (story ? 0.15 : 0.2),
        rows * (story ? 95 : 65) + m * 0.7,
      ),
      shelfY = h - m - shelfH,
      bodyBottom = shelfY - m * 0.55;
    let textW = w - m * 2,
      textY = m * 1.8,
      textH = bodyBottom - textY;
    if (photo && story) {
      const py = h * 0.38,
        ph = bodyBottom - py;
      c.save();
      c.beginPath();
      c.moveTo(m, py);
      c.lineTo(w - m * 0.25, py - m * 0.5);
      c.lineTo(w - m, bodyBottom);
      c.lineTo(m, bodyBottom);
      c.closePath();
      c.clip();
      cover(c, photo, m, py - m * 0.5, w - m * 1.25, ph + m * 0.5);
      c.restore();
      textH = h * 0.27;
    } else if (photo) {
      const split = w * 0.57;
      c.save();
      c.beginPath();
      c.moveTo(split + m, 0);
      c.lineTo(w, 0);
      c.lineTo(w, bodyBottom);
      c.lineTo(split - m * 0.5, bodyBottom);
      c.lineTo(split - m * 1.4, h * 0.46);
      c.closePath();
      c.clip();
      cover(c, photo, split - m * 1.4, 0, w - split + m * 1.4, bodyBottom);
      c.restore();
      c.strokeStyle = primary;
      c.lineWidth = m * 0.22;
      c.beginPath();
      c.moveTo(split + m * 0.68, 0);
      c.lineTo(split - m * 1.7, h * 0.46);
      c.lineTo(split - m * 0.8, bodyBottom);
      c.stroke();
      textW = w * 0.49;
    } else {
      c.globalAlpha = 0.1;
      c.fillStyle = primary;
      c.beginPath();
      c.arc(
        w * (0.9 + o.variant * 0.02),
        h * (0.12 + o.variant * 0.06),
        w * 0.34,
        0,
        Math.PI * 2,
      );
      c.fill();
      c.fillStyle = accent;
      c.beginPath();
      c.arc(
        w * (0.8 + o.variant * 0.04),
        h * (0.5 + o.variant * 0.08),
        w * 0.24,
        0,
        Math.PI * 2,
      );
      c.fill();
      c.globalAlpha = 1;
      c.strokeStyle = primary;
      c.globalAlpha = 0.2;
      c.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        c.beginPath();
        c.moveTo(w * 0.65 + i * 45, 0);
        c.lineTo(w, h * 0.3 + i * 45);
        c.stroke();
      }
      c.globalAlpha = 1;
    }
    rounded(c, m, m, m * 1.25, Math.max(7, h * 0.007), 8, accent);
    const titleH = textH * 0.45,
      subH = textH * 0.21,
      dy = textY + textH * 0.7,
      dh = textH * 0.26;
    text(
      c,
      copy.headline,
      m,
      textY,
      textW,
      titleH,
      story ? 77 : w / h > 1.6 ? 52 : 76,
      800,
      readable(primary, 3),
    );
    if (copy.subheading)
      text(
        c,
        copy.subheading,
        m,
        textY + titleH + m * 0.18,
        textW,
        subH,
        story ? 35 : w / h > 1.6 ? 25 : 34,
        500,
        readable(ink, 4.5),
      );
    rounded(c, m, dy, textW, dh, 15, "#ffffff");
    c.fillStyle = accent;
    c.fillRect(m, dy + 8, 6, dh - 16);
    const date = [
      eventDate(b, o.language),
      b.time ? `${b.time} (${b.timeZone})` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    text(
      c,
      [date, b.location].filter(Boolean).join("\n"),
      m + 18,
      dy + 13,
      textW - 34,
      dh - 26,
      story ? 29 : w / h > 1.6 ? 22 : 29,
      700,
      readable(ink, 4.5),
    );
    if (photo && story) {
      rounded(c, m + 18, bodyBottom - 62, w - m * 2 - 36, 44, 9, "#ffffff");
      text(
        c,
        copy.cta,
        m + 35,
        bodyBottom - 52,
        w - m * 2 - 70,
        27,
        22,
        700,
        readable(ink, 4.5),
      );
    }
    rounded(c, m, shelfY, w - m * 2, shelfH, Math.min(26, m * 0.5), "#ffffff");
    const cw = (w - m * 2 - 30) / cols,
      ch = (shelfH - 28) / rows;
    logos.forEach((logo, i) =>
      contain(
        c,
        logo,
        m + 15 + (i % cols) * cw + 12,
        shelfY + 14 + Math.floor(i / cols) * ch + 10,
        cw - 24,
        ch - 20,
      ),
    );
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(Error("Could not encode the PNG.")),
        "image/png",
      ),
    );
  } finally {
    bitmaps.forEach((b) => b.close());
    canvas.width = 1;
    canvas.height = 1;
  }
}
