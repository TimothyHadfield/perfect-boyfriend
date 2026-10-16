// Card: browse every Starving Student Card deal, with uses left. Opened from Plan.
import { topbar, banner } from '../ui.js';

export default {
  key: 'card',
  title: 'Card',
  sub: true,
  render({ S }) {
    return `${topbar('Card', '', true)}${banner(S.info)}<div class="pane"></div>`;
  },
};
