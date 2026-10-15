// "About her" profile: sections and item helpers. Pure: tested in Node.

export const SECTIONS = [
  { key: 'basics', name: 'Basics', hints: ['Full name', 'Hometown', 'Job', 'School', 'Family', 'Pets'] },
  { key: 'favorites', name: 'Favorites', hints: ['Color', 'Food', 'Restaurant', 'Drink', 'Snack', 'Flower', 'Candy', 'Movie', 'Show', 'Music'] },
  { key: 'sizes', name: 'Sizes', hints: ['Shirt', 'Pants', 'Dress', 'Shoe', 'Ring', 'Bra'] },
  { key: 'likes', name: 'Likes', hints: [] },
  { key: 'dislikes', name: 'Dislikes', hints: [] },
  { key: 'love', name: 'Love language', hints: ['Words of affirmation', 'Quality time', 'Gifts', 'Acts of service', 'Physical touch'] },
  { key: 'allergies', name: 'Allergies', hints: [] },
  { key: 'notes', name: 'Notes', hints: [] },
];

export function sectionName(key) {
  const s = SECTIONS.find((x) => x.key === key);
  return s ? s.name : 'Notes';
}

// {sectionKey: [items]} in SECTIONS order; unknown sections land in notes.
export function groupBySection(items) {
  const out = {};
  for (const s of SECTIONS) out[s.key] = [];
  for (const it of items || []) {
    const key = out[it.section] ? it.section : 'notes';
    out[key].push(it);
  }
  return out;
}

// Insert or replace by id. Returns a new array.
export function upsertItem(items, item) {
  const list = (items || []).slice();
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = { ...list[i], ...item };
  else list.push(item);
  return list;
}

export function removeItem(items, id) {
  return (items || []).filter((x) => x.id !== id);
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
