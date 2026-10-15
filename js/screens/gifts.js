// Gift ideas, given gifts and reminders. Placeholder (title only) until its builder fills it in.
// Contract: see the top of js/app.js. Styles go in css/gifts.css.
import { topbar, banner } from '../ui.js';

export default {
  key: 'gifts',
  title: 'Gifts',
  render({ S }) {
    return `${topbar('Gifts')}${banner(S.info)}<div class="pane"></div>`;
  },
};
