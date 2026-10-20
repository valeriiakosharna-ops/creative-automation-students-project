import { eventDate } from "./copy.js";
import { BRAND_POLICY } from "./brand.js";
export const decodeImage = (blob) =>
  createImageBitmap(blob, { imageOrientation: "from-image" });
function readable(color, minimum) {
  let rgb = color
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16));
  const contrast = () => {
    const l = rgb.map((n) => {
      const v = n / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 1.05 / (l[0] * 0.2126 + l[1] * 0.7152 + l[2] * 0.0722 + 0.05);
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
function contain(c, img, x, y, w, h) {
  const scale = Math.min(w / img.width, h / img.height),
    iw = img.width * scale,
    ih = img.height * scale;
  c.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  return { x: x + (w - iw) / 2, y: y + (h - ih) / 2, width: iw, height: ih };
}
function cover(c, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height),
    sw = w / scale,
    sh = h / scale;
  c.drawImage(
    img,
    (img.width - sw) / 2,
    (img.height - sh) / 2,
    sw,
    sh,
    x,
    y,
    w,
    h,
  );
}
function wrap(c, value, width) {
  const result = [];
  for (const p of value.split("\n")) {
    let line = "";
    for (const word of p.split(/\s+/).filter(Boolean)) {
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
function text(c, value, x, y, w, h, type, weight, color, label) {
  let size = type.preferred,
    lines = [];
  for (; size >= type.min; size--) {
    c.font = `${weight} ${size}px ${BRAND_POLICY.typography.family}`;
    lines = wrap(c, value, w);
    if (lines.length * size * 1.16 <= h) break;
  }
  if (size < type.min)
    throw Error(
      `${label} cannot fit the brand guide's minimum ${type.min}px type size. Shorten the ${label.toLowerCase()} and try a new run.`,
    );
  c.fillStyle = color;
  c.textBaseline = "top";
  lines.forEach((line, i) => c.fillText(line, x, y + i * size * 1.16));
  return {
    fontSize: size,
    color,
    family: BRAND_POLICY.typography.family,
    lineCount: lines.length,
    x,
    y,
    width: w,
    height: lines.length * size * 1.16,
  };
}
export async function renderVisual(b, o, copy, assets) {
  const spec = BRAND_POLICY.formats[o.format];
  if (!spec || o.width !== spec.width || o.height !== spec.height)
    throw Error("Output does not match the style guide format.");
  const canvas = document.createElement("canvas");
  canvas.width = o.width;
  canvas.height = o.height;
  const c = canvas.getContext("2d");
  if (!c) throw Error("Canvas rendering is not available.");
  const w = o.width,
    h = o.height,
    story = o.format === "instagram_story",
    safe = spec.safeArea,
    x = safe.left,
    y = safe.top,
    cw = w - safe.left - safe.right,
    ch = h - safe.top - safe.bottom;
  const primary = b.colors[(o.variant - 1) % 2],
    accent = b.colors[o.variant % 2],
    ink = b.colors[2],
    bitmaps = [];
  const style = {
    version: BRAND_POLICY.version,
    safeArea: structuredClone(safe),
    contentRect: { x, y, width: cw, height: ch },
    logoRects: [],
    text: {},
  };
  try {
    const photoAsset = assets.photos.find((a) => a.id === o.photoId),
      photo = photoAsset ? await decodeImage(photoAsset.blob) : null;
    if (photo) bitmaps.push(photo);
    const logos = [];
    for (const asset of assets.logos) {
      const image = await decodeImage(asset.blob);
      bitmaps.push(image);
      logos.push(image);
    }
    if (!logos.length) throw Error("Every visual requires at least one logo.");
    const gradient = c.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(1, "#edf7fc");
    c.fillStyle = gradient;
    c.fillRect(0, 0, w, h);
    c.globalAlpha = 0.1;
    c.fillStyle = primary;
    c.beginPath();
    c.arc(w * (0.9 + o.variant * 0.02), h * 0.22, w * 0.32, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = accent;
    c.beginPath();
    c.arc(w * 0.96, h * 0.6, w * 0.2, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
    const cols = Math.min(BRAND_POLICY.logos.maxColumns, logos.length),
      rows = Math.ceil(logos.length / cols),
      shelfH = rows * spec.logoRowHeight + 32,
      gap = story ? 30 : 22,
      shelfY = y + ch - shelfH,
      bodyH = ch - shelfH - gap;
    let tx = x,
      ty = y + 20,
      tw = photo && !story ? cw * 0.49 : cw,
      th = bodyH - 20;
    if (photo && story) {
      const ph = bodyH * 0.32,
        py = y + bodyH - ph;
      th = bodyH - ph - gap - 20;
      style.photoRect = { x, y: py, width: cw, height: ph };
      c.save();
      c.beginPath();
      c.moveTo(x, py + 25);
      c.lineTo(x + cw, py);
      c.lineTo(x + cw, py + ph);
      c.lineTo(x, py + ph);
      c.closePath();
      c.clip();
      cover(c, photo, x, py, cw, ph);
      c.restore();
    } else if (photo) {
      const px = x + cw * 0.56;
      style.photoRect = { x: px - 20, y, width: cw * 0.44 + 20, height: bodyH };
      c.save();
      c.beginPath();
      c.moveTo(px + 35, y);
      c.lineTo(x + cw, y);
      c.lineTo(x + cw, y + bodyH);
      c.lineTo(px + 25, y + bodyH);
      c.lineTo(px - 20, y + bodyH * 0.5);
      c.closePath();
      c.clip();
      cover(c, photo, px - 20, y, cw * 0.44 + 20, bodyH);
      c.restore();
      c.strokeStyle = primary;
      c.lineWidth = 9;
      c.beginPath();
      c.moveTo(px + 25, y);
      c.lineTo(px - 30, y + bodyH * 0.5);
      c.lineTo(px + 15, y + bodyH);
      c.stroke();
    }
    rounded(c, x, y, Math.min(75, cw * 0.1), 7, 4, accent);
    const titleH = th * 0.44,
      summaryY = ty + titleH + 8,
      summaryH = th * 0.24,
      detailsY = ty + th * 0.73,
      detailsH = th * 0.27;
    style.text.headline = text(
      c,
      copy.headline,
      tx,
      ty,
      tw,
      titleH,
      spec.headline,
      BRAND_POLICY.typography.headlineWeight,
      readable(primary, BRAND_POLICY.typography.minimumLargeTextContrast),
      "Headline",
    );
    if (copy.subheading)
      style.text.subheading = text(
        c,
        copy.subheading,
        tx,
        summaryY,
        tw,
        summaryH,
        spec.subheading,
        BRAND_POLICY.typography.bodyWeight,
        readable(ink, BRAND_POLICY.typography.minimumTextContrast),
        "Visual summary",
      );
    rounded(c, tx, detailsY, tw, detailsH, 12, "#ffffff");
    c.fillStyle = accent;
    c.fillRect(tx, detailsY + 5, 5, detailsH - 10);
    const date = [
      eventDate(b, o.language),
      b.time ? `${b.time} (${b.timeZone})` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    style.text.details = text(
      c,
      [date, b.location].filter(Boolean).join("\n"),
      tx + 14,
      detailsY + 8,
      tw - 28,
      detailsH - 16,
      spec.details,
      700,
      readable(ink, BRAND_POLICY.typography.minimumTextContrast),
      "Date and location",
    );
    rounded(c, x, shelfY, cw, shelfH, 20, "#ffffff");
    style.logoShelf = { x, y: shelfY, width: cw, height: shelfH };
    const cellW = (cw - 24) / cols,
      cellH = (shelfH - 24) / rows,
      clear = BRAND_POLICY.logos.clearSpaceFraction;
    logos.forEach((logo, i) => {
      const padY = (cellH * clear) / (1 + 2 * clear),
        padX = Math.max(12, padY);
      const rect = contain(
        c,
        logo,
        x + 12 + (i % cols) * cellW + padX,
        shelfY + 12 + Math.floor(i / cols) * cellH + padY,
        cellW - padX * 2,
        cellH - padY * 2,
      );
      style.logoRects.push({ id: assets.logos[i].id, ...rect });
    });
    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(Error("Could not encode the PNG.")),
        "image/png",
      ),
    );
    return { blob, style };
  } finally {
    bitmaps.forEach((b) => b.close());
    canvas.width = 1;
    canvas.height = 1;
  }
}
