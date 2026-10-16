import { test, eq, ok } from './harness.mjs';
import { tomorrowYMD, checkCapture, giftIdeaRow, followUpRow, profileItem, dueFollowUp, KINDS } from '../js/logic/capture.js';
import { parseYMD } from '../js/logic/dates.js';
import { ideasOf, profileHint } from '../js/logic/gifts.js';
import { groupBySection } from '../js/logic/profile.js';

const T = (s) => parseYMD(s);
const TODAY = T('2026-10-15');

test('capture: three choices; tomorrow handles month and year ends', () => {
  eq(KINDS.map((k) => k[1]), ['Gift idea', 'Follow up', 'About her']);
  eq(tomorrowYMD(TODAY), '2026-10-16');
  eq(tomorrowYMD(T('2026-10-31')), '2026-11-01');
  eq(tomorrowYMD(T('2026-12-31')), '2027-01-01');
  eq(tomorrowYMD(T('2028-02-28')), '2028-02-29');
});

test('capture: checks text, the follow-up date and the section', () => {
  eq(checkCapture('gift', '   '), 'Add a gift.');
  eq(checkCapture('gift', 'Blue scarf from Target'), '');
  eq(checkCapture('gift', 'x'.repeat(201)), 'Keep it under 200 characters.');
  eq(checkCapture('follow', 'Ask how her interview went', ''), 'Pick a date.');
  eq(checkCapture('follow', 'Ask how her interview went', '2026-10-16'), '');
  eq(checkCapture('about', 'Flower: tulips', 'nope'), 'Pick a section.');
  eq(checkCapture('about', 'Flower: tulips', 'favorites'), '');
});

// Saving "About her" rewrites the whole profile doc ([...S.profile, item]); before the profile
// has loaded S.profile is [], so saving then would wipe every existing item.
test('capture: About her waits until her profile has loaded', () => {
  eq(checkCapture('about', 'Flower: tulips', 'favorites', false), 'Still loading. Try again in a second.');
  eq(checkCapture('about', 'Flower: tulips', 'favorites', true), '');
  eq(checkCapture('gift', 'Blue scarf', '', false), '', 'gift ideas are their own rows');
  eq(checkCapture('follow', 'Ask how it went', '2026-10-16', false), '', 'follow-ups are their own rows');
});

test('capture: gift idea row has the shape Gifts uses, and shows up as an idea', () => {
  const now = new Date('2026-10-15T18:30:00Z');
  const row = giftIdeaRow('g9', '  Blue   scarf from Target ', now);
  eq(row, { id: 'g9', title: 'Blue scarf from Target', added: '2026-10-15T18:30:00.000Z' });
  const existing = [{ id: 'g1', title: 'Necklace', added: '2026-10-01T00:00:00.000Z' }, { id: 'g2', title: 'Book', date: '2026-09-01', reaction: 3 }];
  eq(ideasOf([...existing, row]).map((g) => g.id).sort(), ['g1', 'g9']);
});

test('capture: follow-up row matches the contract', () => {
  eq(followUpRow('f1', 'Ask how her interview went', '2026-10-16'), { id: 'f1', text: 'Ask how her interview went', date: '2026-10-16', done: false });
  eq(followUpRow('f2', 'y'.repeat(250), '2026-10-16').text.length, 200);
});

test('capture: about-her item; "Label: value" splits so gift hints find it', () => {
  eq(profileItem('p9', 'favorites', 'Flower: tulips'), { id: 'p9', section: 'favorites', label: 'Flower', value: 'tulips' });
  eq(profileItem('p8', 'likes', 'Thai food'), { id: 'p8', section: 'likes', label: 'Thai food', value: '' });
  eq(profileItem('p7', 'notes', 'Time: '), { id: 'p7', section: 'notes', label: 'Time:', value: '' }, 'no value after colon');
  const long = 'She said she really wants to go back to the little bakery in Provo where we had the lemon tart last spring ok';
  const it = profileItem('p6', 'notes', long);
  ok(it.label.length <= 100, 'label fits');
  eq(it.value, long);
  const profile = [{ id: 'p1', section: 'sizes', label: 'Shoe', value: '7' }, profileItem('p9', 'favorites', 'Flower: tulips')];
  eq(profileHint('Flowers', profile), 'tulips');
  eq(groupBySection(profile).favorites.length, 1);
});

test('capture: due follow-up = oldest not-done one dated today or earlier', () => {
  const list = [
    { id: 'a', text: 'Ask about her trip', date: '2026-10-20', done: false },
    { id: 'b', text: 'Ask how her interview went', date: '2026-10-15', done: false },
    { id: 'c', text: 'Ask how the exam went', date: '2026-10-12' },
    { id: 'd', text: 'Done already', date: '2026-10-10', done: true },
    { id: 'e', text: '   ', date: '2026-10-09' },
    { id: 'f', text: 'Bad date', date: '10/09/2026' },
  ];
  const f = dueFollowUp(list, TODAY);
  eq([f.id, f.late], ['c', 3]);
  eq(dueFollowUp(list.filter((x) => x.id !== 'c'), TODAY).id, 'b');
  eq(dueFollowUp(list.filter((x) => x.id !== 'c'), TODAY).late, 0);
  eq(dueFollowUp([list[0]], TODAY), null, 'future only');
  eq(dueFollowUp(undefined, TODAY), null);
});
