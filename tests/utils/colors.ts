export type Rgba = { r: number; g: number; b: number; a: number };

export function parseRgba(value: string): Rgba {
  const normalized = value.replace(/\s+/g, "");
  const isRgba = normalized.toLowerCase().startsWith("rgba(");
  const isRgb = normalized.toLowerCase().startsWith("rgb(");
  if (!isRgb && !isRgba) {
    throw new Error(`Unsupported color format: ${value}`);
  }
  const inner = normalized.slice(
    normalized.indexOf("(") + 1,
    normalized.lastIndexOf(")"),
  );
  const parts = inner.split(",");
  if (parts.length < 3 || parts.length > 4) {
    throw new Error(`Unsupported color format: ${value}`);
  }
  const [rText, gText, bText, aText] = parts;
  return {
    r: Number(rText),
    g: Number(gText),
    b: Number(bText),
    a: aText ? Number(aText) : 1,
  };
}
