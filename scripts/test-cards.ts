import { duplicateMessage, findDuplicate, normalizeWord } from '../server/lib/duplicates.js';

let ok = 0,
  fail = 0;
const check = (name: string, cond: boolean, got?: unknown) => {
  cond ? ok++ : fail++;
  console.log(`${cond ? '  ok  ' : ' FALHA'} ${name}${cond ? '' : ` -> ${JSON.stringify(got)}`}`);
};

const same = (a: string, b: string) => normalizeWord(a) === normalizeWord(b);

console.log('palavras repetidas\n');

// ── o que conta como a mesma palavra ──
check('maiúsculas: Reliable = reliable', same('Reliable', 'reliable'));
check('maiúsculas: RELIABLE = reliable', same('RELIABLE', 'reliable'));
check('espaços nas pontas', same('  reliable  ', 'reliable'));
check('espaços repetidos no meio', same('big    deal', 'big deal'));
check('tab e quebra de linha viram espaço', same('big\tdeal\n', 'big deal'));
check('acento: café = cafe', same('café', 'cafe'));
check('hífen: well-known = well known', same('well-known', 'well known'));
check('ponto final numa frase', same('It is not a big deal.', 'it is not a big deal'));
check('interrogação e vírgula', same('Well, are you ready?', 'well are you ready'));
check('apóstrofo curvo = reto', same('it’s late', "it's late"));

// ── o que continua sendo diferente ──
check("apóstrofo mantido: it's ≠ its", !same("it's", 'its'));
check('palavras distintas continuam distintas', !same('reliable', 'reliably'));
check('só pontuação não vira chave vazia', normalizeWord('?!') !== '', normalizeWord('?!'));
check('pontuações diferentes não colidem', !same('?!', '...'));

// ── busca entre os cards existentes ──
const existing = [
  { id: 1, word: 'Reliable', archived: false },
  { id: 2, word: 'It is not a big deal.', archived: false },
  { id: 3, word: 'thorough', archived: true },
];

check('encontra repetido com caixa diferente', findDuplicate('RELIABLE', existing)?.id === 1);
check('encontra frase sem o ponto final', findDuplicate('it is not a big deal', existing)?.id === 2);
check('encontra repetido arquivado', findDuplicate('Thorough', existing)?.id === 3);
check('palavra nova não é repetida', findDuplicate('dependable', existing) === undefined);
check(
  'na edição, o próprio card não conta',
  findDuplicate('reliable', existing, 1) === undefined,
);
check('na edição, outro card com a mesma palavra conta', findDuplicate('reliable', existing, 2)?.id === 1);

// ── mensagem ──
check(
  'mensagem cita a palavra já cadastrada',
  duplicateMessage(existing[0]) === '“Reliable” já está cadastrada.',
  duplicateMessage(existing[0]),
);
check(
  'mensagem avisa quando está arquivada',
  duplicateMessage(existing[2]) === '“thorough” já está cadastrada (arquivada).',
  duplicateMessage(existing[2]),
);

console.log(`\n${ok} ok, ${fail} falha(s)`);
if (fail) process.exit(1);
