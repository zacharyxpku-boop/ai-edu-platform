/**
 * EXP-1 step 1: 给 manifest 里两本人教英语教材填章节标题(公开课纲).
 * 正文 OCR 留待 step 2; 现在先让 path / hub 能渲染章节方块.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'data', 'extracted', 'manifest.json');
const m = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const G7B_DOWN = [
  "Unit 1 Can you play the guitar?",
  "Unit 2 What time do you go to school?",
  "Unit 3 How do you get to school?",
  "Unit 4 Don't eat in class.",
  "Unit 5 Why do you like pandas?",
  "Unit 6 I'm watching TV.",
  "Unit 7 It's raining!",
  "Unit 8 Is there a post office near here?",
  "Unit 9 What does he look like?",
  "Unit 10 I'd like some noodles.",
  "Unit 11 How was your school trip?",
  "Unit 12 What did you do last weekend?"
];
const G8B_DOWN = [
  "Unit 1 What's the matter?",
  "Unit 2 I'll help to clean up the city parks.",
  "Unit 3 Could you please clean your room?",
  "Unit 4 Why don't you talk to your parents?",
  "Unit 5 What were you doing when the rainstorm came?",
  "Unit 6 An old man tried to move the mountains.",
  "Unit 7 What's the highest mountain in the world?",
  "Unit 8 Have you read Treasure Island yet?",
  "Unit 9 Have you ever been to a museum?",
  "Unit 10 I've had this bike for three years."
];

let touched = 0;
m.books.forEach(b => {
  if (b.subject !== '英语') return;
  const titles =
    b.grade === '七年级' && b.volume === '下册' ? G7B_DOWN :
    b.grade === '八年级' && b.volume === '下册' ? G8B_DOWN : null;
  if (!titles) return;
  if (b.chapters && b.chapters.length) return;
  const pp = b.page_count || titles.length * 12;
  const span = Math.max(8, Math.floor(pp / titles.length));
  b.chapters = titles.map((t, i) => ({
    ch: i + 1,
    title: t,
    start_page: 6 + i * span,
    end_page: 6 + (i + 1) * span - 1
  }));
  delete b.reason;
  b.note = '章节标题手工填(公开课纲), 正文待 OCR';
  touched++;
});

fs.writeFileSync(FILE, JSON.stringify(m, null, 2), 'utf8');
console.log('touched books:', touched);
console.log('total ch added:', G7B_DOWN.length + G8B_DOWN.length);
