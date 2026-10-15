// Her > Cycle (period tracker). Placeholder (title only) until its builder fills it in.
// Contract: see the top of js/app.js. Styles go in css/cycle.css.
import { topbar, banner } from '../ui.js';

export default {
  key: 'cycle',
  title: 'Cycle',
  group: 'her',
  render({ S, subtabs }) {
    return `${topbar('Her')}${subtabs}${banner(S.info)}<div class="pane"></div>`;
  },
};
