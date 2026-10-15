// Home suggestion content: small everyday gestures, and a weekly check-in question.
// Pure: tested in Node. Keep each line short (the Home card shows two lines).

export const LITTLE_THINGS = [
  'Text her one thing you noticed about her today.',
  'Leave a note where she\'ll find it in the morning.',
  'Bring her favorite drink, no reason.',
  'Ask about her day, then just listen.',
  'Make dinner tonight and do the dishes.',
  'Send a photo of a favorite memory together.',
  'Take care of a chore she\'s been dreading.',
  'Pick up her favorite snack on the way over.',
  'Tell her something you\'re proud of her for.',
  'Put your phone away for your next hour together.',
  'Ask how the thing she was worried about went.',
  'Make a playlist of songs that remind you of her.',
  'Write down three things you love about her.',
  'Offer a back rub without being asked.',
  'Fill her car with gas or clean it out.',
  'Thank her for something small she does a lot.',
  'Send a good-morning text before she\'s up.',
  'Compliment her in front of someone else.',
  'Let her pick the movie, and don\'t complain.',
  'Remember a detail she told you and ask about it.',
  'Hold her hand on your next walk.',
  'Text her a song that made you think of her.',
  'Plan a sunset walk and bring a snack.',
  'Ask what would make her week easier.',
  'Bring her lunch at work or class.',
  'Say "I love you" at a random moment.',
  'Have her favorite treat ready when she\'s stressed.',
  'Tell her what you liked about your last date.',
  'Cheer her on before something big today.',
  'Hug her a little longer than usual.',
  'Learn her coffee or drink order by heart.',
  'Share a memory of when you first met.',
  'Make her bed or tidy up her space.',
  'Leave a sticky note on her mirror.',
  'Ask her opinion on something and use it.',
  'Bring a blanket for her when it\'s cold.',
  'Send a "thinking of you" text midday.',
  'Laugh at her joke, even the bad one.',
  'Ask about a friend or family member she loves.',
  'Notice a new thing she\'s wearing and say so.',
];

export const CHECK_INS = [
  'What was the best part of your week?',
  'Is anything stressing you out lately?',
  'What\'s something I did this week that you liked?',
  'Is there anything I could do more of?',
  'What are you looking forward to right now?',
  'How are you feeling about us lately?',
  'What would a perfect Saturday look like for you?',
  'Is there something you\'ve wanted to talk about?',
  'What made you laugh this week?',
  'What\'s one thing I could help with this week?',
  'What\'s a date you\'d love to go on soon?',
  'Who have you been wanting to see more of?',
  'What\'s been on your mind the most lately?',
  'What\'s a small thing that made your day better?',
  'Do you feel like we\'ve had enough time together?',
  'What\'s something new you\'d like to try together?',
  'How did you sleep this week?',
  'Is there anything you need more space for?',
  'What\'s a goal you\'re working toward right now?',
  'What\'s a memory of us you think about a lot?',
  'Anything I could have done better this week?',
  'What should we celebrate this week?',
  'How can I support you at work or school?',
  'What\'s something you\'re proud of lately?',
  'Is there a habit of mine that bugs you?',
  'What made you feel most loved this month?',
  'What\'s one thing you want more of in life?',
  'How are your friends and family doing?',
  'What would make next week easier for you?',
  'Anything you\'ve been wanting to do but haven\'t?',
];

const dayNum = ({ y, m, d }) => Math.round(Date.UTC(y, m - 1, d) / 86400000);
const at = (list, i) => list[((i % list.length) + list.length) % list.length];

// Sunday is check-in day; any other day gets a little thing.
export const isCheckInDay = (today) => new Date(dayNum(today) * 86400000).getUTCDay() === 0;

// The nudge for a day. Changes once a day (check-ins once a week); `offset` = taps on "next".
export function nudgeFor(today, offset = 0) {
  const n = dayNum(today);
  if (isCheckInDay(today)) return { kind: 'checkin', text: at(CHECK_INS, Math.floor(n / 7) + offset) };
  return { kind: 'little', text: at(LITTLE_THINGS, n + offset) };
}
