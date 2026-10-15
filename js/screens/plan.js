// Orem date planner. Placeholder (title only) until its builder fills it in.
// Contract: see the top of js/app.js. Styles go in css/plan.css.
import { topbar, banner } from '../ui.js';

export default {
  key: 'plan',
  title: 'Plan',
  render({ S }) {
    return `${topbar('Plan')}${banner(S.info)}<div class="pane"></div>`;
  },
};
