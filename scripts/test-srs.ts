import { schedule, describeInterval, shuffle } from '../server/lib/srs.js';

const now = new Date('2026-09-14T12:00:00Z');
const days = (d: Date) => Math.round((d.getTime() - now.getTime()) / 86400000);
let ok = 0, fail = 0;
const check = (name: string, cond: boolean, got?: unknown) => {
  cond ? ok++ : fail++;
  console.log(`${cond ? '  ok  ' : ' FALHA'} ${name}${cond ? '' : ` -> ${JSON.stringify(got)}`}`);
};

// Carta nova marcada como fácil -> 1 semana, sai do baralho, vira memorizada
let s = schedule({ ease: 2.5, intervalDays: 0, streak: 0 }, 'easy', now);
check('facil na 1a vez agenda 7 dias', days(s.dueAt) === 7, days(s.dueAt));
check('facil tira do baralho', s.leftDeck === true);
check('facil marca como memorizada', s.mastered === true);

// Difícil -> volta agora, continua no baralho, perde facilidade
let h = schedule({ ease: 2.5, intervalDays: 0, streak: 3 }, 'hard', now);
check('dificil fica disponivel agora', days(h.dueAt) === 0);
check('dificil nao sai do baralho', h.leftDeck === false);
check('dificil zera a sequencia', h.streak === 0);
check('dificil reduz a facilidade', h.ease < 2.5, h.ease);
check('dificil nao conta como memorizada', h.mastered === false);

// Difícil numa carta já memorizada devolve ela ao baralho
let back = schedule({ ease: 2.8, intervalDays: 48, streak: 4 }, 'hard', now);
check('dificil devolve carta memorizada ao baralho', days(back.dueAt) === 0 && back.intervalDays === 0);

// Crescimento ao longo de vários "fácil"
let st = { ease: 2.5, intervalDays: 0, streak: 0 };
const prog: number[] = [];
for (let i = 0; i < 6; i++) {
  const r = schedule(st, 'easy', now);
  prog.push(r.intervalDays);
  st = { ease: r.ease, intervalDays: r.intervalDays, streak: r.streak };
}
check('intervalos crescem ate o teto', prog.every((v, i) => i === 0 || v >= prog[i - 1]) && prog[1] > prog[0], prog);
check('intervalo respeita o teto de 1 ano', prog.every((v) => v <= 365), prog);
console.log('       progressao de intervalos (dias):', prog.join(' -> '));

// Limites da facilidade
let low = { ease: 1.3, intervalDays: 0, streak: 0 };
for (let i = 0; i < 10; i++) { const r = schedule(low, 'hard', now); low = { ease: r.ease, intervalDays: r.intervalDays, streak: r.streak }; }
check('facilidade nunca cai de 1.3', low.ease === 1.3, low.ease);

// Texto dos intervalos
check('texto 7 dias', describeInterval(7) === '1 semana', describeInterval(7));
check('texto 1 dia', describeInterval(1) === '1 dia');
check('texto 48 dias', describeInterval(48) === '2 meses', describeInterval(48));
check('texto 365 dias', describeInterval(365) === '1 ano', describeInterval(365));

// Embaralhamento preserva o conjunto e muda a ordem
const base = Array.from({ length: 50 }, (_, i) => i);
const mixed = shuffle(base);
check('embaralhar preserva todas as cartas', [...mixed].sort((a, b) => a - b).join() === base.join());
check('embaralhar nao altera o original', base.join() === Array.from({ length: 50 }, (_, i) => i).join());
check('embaralhar muda a ordem', mixed.join() !== base.join());

console.log(`\n${ok} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
