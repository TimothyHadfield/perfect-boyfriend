import { test, eq, ok } from './harness.mjs';
import { profileSuggestions, conflictOf, splitValues, reminderSeed } from '../js/logic/gifts.js';

// A realistic About-her profile (made-up data), same shape as S.profile: {id, section, label, value}.
const PROFILE = [
  { id: 'b1', section: 'basics', label: 'Job', value: 'Nurse' },
  { id: 'f1', section: 'favorites', label: 'Flower', value: 'Tulips, peonies' },
  { id: 'f2', section: 'favorites', label: 'Candy', value: 'Peanut butter cups; Sour Patch Kids' },
  { id: 'f3', section: 'favorites', label: 'Color', value: 'Sage green' },
  { id: 'f4', section: 'favorites', label: 'Drink', value: 'Dirty Dr Pepper' },
  { id: 'f5', section: 'favorites', label: 'Snack', value: 'Takis' },
  { id: 'f6', section: 'favorites', label: 'Food', value: 'Pad thai' },
  { id: 'f7', section: 'favorites', label: 'Restaurant', value: 'Cubby\'s' },
  { id: 'f8', section: 'favorites', label: 'Movie', value: '' },
  { id: 'f9', section: 'favorites', label: 'Flower', value: 'Lilies' },
  { id: 's1', section: 'sizes', label: 'Shoe', value: '7.5' },
  { id: 'l1', section: 'likes', label: 'Hiking', value: '' },
  { id: 'd1', section: 'dislikes', label: 'Lilies', value: 'smell too strong' },
  { id: 'd2', section: 'dislikes', label: 'Food', value: 'Pad thai' },
  { id: 'a1', section: 'allergies', label: 'Peanuts', value: 'Severe' },
  { id: 'n1', section: 'notes', label: 'Tulips', value: 'not a favorite row' },
];

test('profile favorites become gift ideas; allergies, dislikes and colors never do', () => {
  const s = profileSuggestions(PROFILE, []);
  eq(s.map((x) => x.title), ['Tulips', 'Peonies', 'Sour Patch Kids', 'Dirty Dr Pepper', 'Takis', 'Cubby\'s']);
  eq(s[0], { title: 'Tulips', label: 'Flower', preset: 'flowers' });
  eq(s[2].preset, 'candy');
  eq(s[3].preset, '');
  for (const x of s) {
    ok(!/peanut|lil|pad thai|sage/i.test(x.title), 'excluded leaked: ' + x.title);
    eq(conflictOf(x.title, PROFILE), null);
  }
});

test('suggestions already in ideas are hidden; given gifts are not ideas', () => {
  const gifts = [
    { id: 'g1', title: 'Red tulips', added: '2026-10-01' },             // idea: hides Tulips
    { id: 'g2', title: 'Takis', date: '2026-09-01', reaction: 3 },     // given: still suggested
  ];
  const s = profileSuggestions(PROFILE, gifts).map((x) => x.title);
  ok(!s.includes('Tulips'), 'tulips hidden');
  ok(s.includes('Takis'), 'given gift still suggested');
  ok(s.includes('Peonies'));
});

test('conflict check: allergies first, plurals, category labels', () => {
  eq(conflictOf('Peanut butter cups', PROFILE), { kind: 'allergy', term: 'Peanuts' });
  eq(conflictOf('Lily bouquet', PROFILE), { kind: 'dislike', term: 'Lilies' }, 'lily = lilies');
  eq(conflictOf('Rose bouquet', PROFILE), null, 'no false match');
  eq(conflictOf('White lilies', PROFILE), { kind: 'dislike', term: 'Lilies' });
  eq(conflictOf('Pad thai takeout', PROFILE), { kind: 'dislike', term: 'Pad thai' });
  eq(conflictOf('Food truck dinner', PROFILE), null, 'generic label "Food" with details is not a term');
  eq(conflictOf('Roses', [{ section: 'dislikes', label: 'Flowers', value: '' }]), null);
  eq(conflictOf('Flowers', [{ section: 'dislikes', label: 'Flowers', value: '' }]), { kind: 'dislike', term: 'Flowers' });
  eq(conflictOf('', PROFILE), null);
  eq(conflictOf('Tulips', undefined), null);
});

test('values split on commas, semicolons, slashes and new lines', () => {
  eq(splitValues('Tulips, peonies;lilies / roses\ndaisies.'), ['Tulips', 'peonies', 'lilies', 'roses', 'daisies']);
  eq(splitValues('Mac and cheese'), ['Mac and cheese']);
  eq(splitValues(''), []);
  eq(splitValues(undefined), []);
});

test('reminder seed uses the preset repeat, else monthly', () => {
  eq(reminderSeed({ title: 'Tulips', preset: 'flowers' }), { what: 'Tulips', every: 2, unit: 'week' });
  eq(reminderSeed({ title: 'Sour Patch Kids', preset: 'candy' }), { what: 'Sour Patch Kids', every: 1, unit: 'month' });
  eq(reminderSeed({ title: 'Takis', preset: '' }), { what: 'Takis', every: 1, unit: 'month' });
});

test('empty profile gives no suggestions', () => {
  eq(profileSuggestions([], []), []);
  eq(profileSuggestions(undefined, undefined), []);
});
