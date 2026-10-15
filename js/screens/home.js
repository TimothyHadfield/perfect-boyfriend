// Home: next date (big), what's coming up (+ anniversary milestones), last date, last gift,
// and one smart suggestion that links to the right screen (js/logic/suggest.js).
import { esc, svg, topbar, banner } from '../ui.js';
import { todayLocal, upcoming, shortDate, parseYMD } from '../logic/dates.js';
import { holidayPrefs, upcomingHolidays } from '../logic/holidays.js';
import { latestEntry, milestones } from '../logic/home.js';
import { suggest } from '../logic/suggest.js';
import { dateRow, typeName, addDateBtn, bindDateTaps } from './dates.js';

let ideaOffset = 0;

// One-line summary of a logged gift or date (their screens come later).
function entryLine(e) {
  if (!e) return '<span class="card-empty">None yet</span>';
  const name = e.title || e.name || e.what || e.place || 'Untitled';
  return `<span class="card-value">${esc(name)}</span><span class="card-sub">${esc(shortDate(parseYMD(e.day), true))}</span>`;
}

// The one suggestion: taps open its screen, or show the next nudge.
function suggestCard(S, today) {
  const s = suggest({ today, dates: S.dates, giftReminders: S.giftReminders, dateLog: S.dateLog, cycles: S.cycles, profile: S.profile }, ideaOffset);
  const inner = `<span class="card-label">${esc(s.label)}</span><span class="card-idea">${esc(s.text)}</span>`;
  const main = s.go
    ? `<a class="sugg-main" href="#/${esc(s.go)}">${inner}</a>`
    : `<button class="sugg-main" data-next-idea aria-label="${esc(s.label)}: next">${inner}</button>`;
  const link = s.link ? `<a class="sugg-link" href="#/${esc(s.link[0])}">${esc(s.link[1])}</a>` : '';
  return `<div class="card card-wide sugg${link ? ' has-link' : ''}">${main}${link}</div>`;
}

function render({ S }) {
  const today = todayLocal();
  const holidays = upcomingHolidays(today, holidayPrefs(S.settings.holidays))
    .map((h) => ({ ...h, next: parseYMD(h.date) }));
  const list = [...upcoming(S.dates, today), ...milestones(S.dates, today), ...holidays]
    .sort((a, b) => a.days - b.days || String(a.title).localeCompare(String(b.title)));
  const head = `${topbar('Home', addDateBtn)}${banner(S.info)}`;
  if (!list.length) {
    return `${head}<div class="pane"><div class="empty-block"><p class="empty">No dates yet.</p>
      <button class="btn btn-primary" data-new-date>${svg('plus')}Add a date</button></div></div>`;
  }
  const [next, ...rest] = list;
  const big = next.days === 0 ? 'Today!' : String(next.days);
  const heroTag = next.holiday ? 'div' : 'button';
  return `${head}<div class="pane"><section class="home-grid">
      <${heroTag} class="hero${next.holiday ? ' is-holiday' : ''}"${next.holiday ? '' : ` data-edit-date="${esc(next.id)}"`}>
        <span class="hero-text">
          <span class="hero-label">Next up</span>
          <span class="hero-title">${esc(next.title || 'Untitled')}</span>
          <span class="hero-sub">${esc(shortDate(next.next, true))} · ${esc(typeName(next.type))}</span>
        </span>
        <span class="hero-num${next.days === 0 ? ' is-today' : ''}">${esc(big)}${next.days === 0 ? '' : `<small>${next.days === 1 ? 'day' : 'days'}</small>`}</span>
      </${heroTag}>
      <div class="home-list">
        <h2 class="sec-head">Coming up</h2>
        <div class="list">${rest.slice(0, 8).map(dateRow).join('')}</div>
        ${S.datesLoaded && !S.dates.length ? `<button class="btn btn-add" data-new-date>${svg('plus')}Add her birthday</button>` : ''}
      </div>
      <div class="home-cards">
        <div class="card"><span class="card-label">Last date</span>${entryLine(latestEntry(S.dateLog, today))}</div>
        <div class="card"><span class="card-label">Last gift</span>${entryLine(latestEntry(S.gifts, today))}</div>
        ${suggestCard(S, today)}
      </div>
    </section></div>`;
}

export default {
  key: 'home',
  title: 'Home',
  render,
  bind(root, ctx) {
    bindDateTaps(root, ctx);
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-next-idea]')) { ideaOffset++; ctx.render(); }
    });
  },
};
