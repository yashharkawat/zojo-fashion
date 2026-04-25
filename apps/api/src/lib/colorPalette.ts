/**
 * Zojo supplier color palette.
 * Used by both seed.ts and the admin quick-create flow.
 */
export const ALL_COLORS: { name: string; hex: string }[] = [
  { name: 'White',           hex: '#ffffff' },
  { name: 'Black',           hex: '#151515' },
  { name: 'Navy Blue',       hex: '#000b17' },
  { name: 'Grey Melange',    hex: '#C3C3C3' },
  { name: 'Bottle Green',    hex: '#083717' },
  { name: 'Royal Blue',      hex: '#141c4f' },
  { name: 'Red',             hex: '#900001' },
  { name: 'Maroon',          hex: '#290005' },
  { name: 'Purple',          hex: '#271033' },
  { name: 'Golden Yellow',   hex: '#ffa200' },
  { name: 'Petrol Blue',     hex: '#0a2b30' },
  { name: 'Olive Green',     hex: '#26260a' },
  { name: 'Mustard Yellow',  hex: '#B6840D' },
  { name: 'Light Baby Pink', hex: '#ffd4e9' },
  { name: 'Lavender',        hex: '#e0d2fc' },
  { name: 'Coral',           hex: '#b34946' },
  { name: 'Mint',            hex: '#adfff0' },
  { name: 'Baby Blue',       hex: '#abebff' },
  { name: 'Off White',       hex: '#fffae7' },
];

export function colorNameToSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'color'
  );
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
