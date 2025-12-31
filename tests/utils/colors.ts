export type Rgba = { r: number; g: number; b: number; a: number };

export function parseRgba(value: string): Rgba {
  const match = value
    .replace(/\s+/g, '')
    .match(/^rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)$/i);
  if (!match) throw new Error(`Unsupported color format: ${value}`);
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] ? Number(match[4]) : 1,
  };
}

