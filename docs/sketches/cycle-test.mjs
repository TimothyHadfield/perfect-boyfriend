import { predict } from './cycle.mjs';
const show = (n, x) => console.log(n, JSON.stringify(x));
show('one period', predict({ starts: ['2026-09-20'], today: '2026-10-01' }));
show('one + usual 32', predict({ starts: ['2026-09-20'], usualLength: 32, today: '2026-10-01' }));
show('regular 28', predict({ starts: ['2026-05-01','2026-05-29','2026-06-26','2026-07-24','2026-08-21','2026-09-18'], periodLengths:[4,5,4,5,4], today: '2026-10-01' }));
show('skipped log', predict({ starts: ['2026-03-01','2026-03-30','2026-04-28','2026-06-25','2026-07-24','2026-08-22'], today: '2026-09-01' }));
show('irregular', predict({ starts: ['2026-01-01','2026-01-25','2026-03-05','2026-04-01','2026-05-12','2026-06-08','2026-07-20'], today: '2026-08-01' }));
show('late', predict({ starts: ['2026-05-01','2026-05-29','2026-06-26','2026-07-24','2026-08-21'], today: '2026-09-25' }));
show('pill', predict({ starts: ['2026-05-01'], mode: 'hormonal_bc' }));
