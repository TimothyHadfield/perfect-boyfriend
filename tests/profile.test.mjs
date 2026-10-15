import { test, eq } from './harness.mjs';
import { SECTIONS, groupBySection, upsertItem, removeItem } from '../js/logic/profile.js';

test('has the eight sections in order', () => {
  eq(SECTIONS.map((s) => s.key), ['basics', 'favorites', 'sizes', 'likes', 'dislikes', 'love', 'allergies', 'notes']);
});

test('groups items by section; unknown sections go to notes', () => {
  const g = groupBySection([
    { id: '1', section: 'sizes', label: 'Shoe', value: '7' },
    { id: '2', section: 'weird', label: 'X', value: 'y' },
    { id: '3', section: 'sizes', label: 'Ring', value: '6' },
  ]);
  eq(g.sizes.map((x) => x.id), ['1', '3']);
  eq(g.notes.map((x) => x.id), ['2']);
  eq(g.basics, []);
});

test('upsert adds new and replaces existing without mutating', () => {
  const a = [{ id: '1', label: 'Shoe', value: '7' }];
  const b = upsertItem(a, { id: '1', value: '7.5' });
  eq(a[0].value, '7', 'original untouched');
  eq(b, [{ id: '1', label: 'Shoe', value: '7.5' }]);
  eq(upsertItem(b, { id: '2', label: 'Ring', value: '6' }).length, 2);
});

test('remove drops by id', () => {
  eq(removeItem([{ id: '1' }, { id: '2' }], '1'), [{ id: '2' }]);
});
