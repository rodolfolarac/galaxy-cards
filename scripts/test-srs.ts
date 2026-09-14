import {
  schedule,
  describeInterval,
  previewEasy,
  intervalForStreak,
  shuffle,
  STEP_DAYS,
  PERMANENT_AFTER_DAYS,
} from '../server/lib/srs.js';

const now = new Date('2026-09-14T12:00:00Z');
const days = (d: Date) => Math.round((d.getTime() - now.getTime()) / 86400000);
let ok = 0,
  fail = 0;
const check = (name: string, cond: boolean, got?: unknown) => {
  cond ? ok++ : fail++;
  console.log(`${cond ? '  ok  ' : ' FALHA'} ${name}${cond ? '' : ` -> ${JSON.stringify(got)}`}`);
};

console.log(`degrau de ${STEP_DAYS} dias, permanente aos ${PERMANENT_AFTER_DAYS}\n`);

// ── a escada de 15 em 15 ──
let st = { intervalDays: 0, streak: 0 };
const escada: { dias: number; permanente: boolean }[] = [];
for (let i = 0; i < 6; i++) {
  const r = schedule(st, 'easy', now);
  escada.push({ dias: days(r.dueAt), permanente: r.retired });
  st = { intervalDays: r.intervalDays, streak: r.streak };
}
check('1º fácil agenda 15 dias', escada[0].dias === 15, escada[0]);
check('2º fácil agenda 30 dias', escada[1].dias === 30, escada[1]);
check('3º fácil agenda 45 dias', escada[2].dias === 45, escada[2]);
check('4º fácil agenda 60 dias', escada[3].dias === 60, escada[3]);
check('4º fácil torna a carta permanente', escada[3].permanente === true, escada[3]);
check('não passa de 60 dias', escada.every((e) => e.dias <= 60), escada);
check('1º, 2º e 3º fácil NÃO são permanentes', escada.slice(0, 3).every((e) => !e.permanente));
console.log('       escada:', escada.map((e) => `${e.dias}d${e.permanente ? ' (permanente)' : ''}`).join(' → '));

// ── primeiro fácil ──
const um = schedule({ intervalDays: 0, streak: 0 }, 'easy', now);
check('fácil tira a carta do baralho', um.leftDeck === true);
check('fácil marca como memorizada', um.mastered === true);
check('primeiro fácil ainda não é permanente', um.retired === false);

// ── difícil ──
const dif = schedule({ intervalDays: 45, streak: 3 }, 'hard', now);
check('difícil devolve a carta na hora', days(dif.dueAt) === 0, days(dif.dueAt));
check('difícil zera a escada', dif.streak === 0 && dif.intervalDays === 0, dif);
check('difícil não sai do baralho', dif.leftDeck === false);
check('difícil não é permanente', dif.retired === false);
check('difícil desfaz a memorização', dif.mastered === false);

// ── errar no meio recomeça do primeiro degrau ──
let s2 = { intervalDays: 0, streak: 0 };
s2 = (({ intervalDays, streak }) => ({ intervalDays, streak }))(schedule(s2, 'easy', now)); // 15
s2 = (({ intervalDays, streak }) => ({ intervalDays, streak }))(schedule(s2, 'easy', now)); // 30
s2 = (({ intervalDays, streak }) => ({ intervalDays, streak }))(schedule(s2, 'hard', now)); // zera
const volta = schedule(s2, 'easy', now);
check('depois de errar, o próximo fácil volta para 15 dias', days(volta.dueAt) === 15, days(volta.dueAt));

// ── prévia usada no botão ──
check('prévia do 1º fácil: 15 dias', previewEasy(0).days === 15 && !previewEasy(0).permanent);
check('prévia do 4º fácil: 60 dias e permanente', previewEasy(3).days === 60 && previewEasy(3).permanent);
check('intervalForStreak(0) é zero', intervalForStreak(0) === 0);
check('intervalForStreak satura em 60', intervalForStreak(9) === 60, intervalForStreak(9));

// ── textos ──
check('texto 15 dias', describeInterval(15) === '15 dias', describeInterval(15));
check('texto 30 dias', describeInterval(30) === '1 mês', describeInterval(30));
check('texto 45 dias', describeInterval(45) === '2 meses', describeInterval(45));
check('texto 60 dias', describeInterval(60) === '2 meses', describeInterval(60));
check('texto zero', describeInterval(0) === 'agora');

// ── embaralhamento ──
const base = Array.from({ length: 50 }, (_, i) => i);
const mixed = shuffle(base);
check('embaralhar preserva todas as cartas', [...mixed].sort((a, b) => a - b).join() === base.join());
check('embaralhar não altera o original', base.join() === Array.from({ length: 50 }, (_, i) => i).join());
check('embaralhar muda a ordem', mixed.join() !== base.join());

console.log(`\n${ok} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
