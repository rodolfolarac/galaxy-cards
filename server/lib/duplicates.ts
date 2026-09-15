/**
 * Detecção de cards repetidos.
 *
 * Dois cards são o mesmo quando a palavra ou frase em inglês é igual depois
 * de normalizada. A comparação ignora:
 *
 *   maiúsculas e minúsculas   Reliable = reliable = RELIABLE
 *   espaços sobrando          "  big   deal " = "big deal"
 *   acentos                   café = cafe
 *   pontuação e hífen         well-known = well known · "It is." = "it is"
 *   apóstrofo curvo ou reto   it’s = it's
 *
 * O apóstrofo em si é mantido, porque it's e its são palavras diferentes.
 */

export interface ExistingCard {
  id: number;
  word: string;
  archived: boolean;
}

/** Chave de comparação de uma palavra ou frase. */
export function normalizeWord(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[’‘`´]/g, "'")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}']+/gu, ' ')
    .trim();

  // Um card só de pontuação ("?!") não pode virar chave vazia e colidir com outro.
  return normalized || value.trim().toLowerCase();
}

/**
 * Procura, entre os cards existentes, um com a mesma palavra normalizada.
 * Na edição, `ignoreId` evita que o próprio card seja apontado como repetido.
 */
export function findDuplicate<T extends ExistingCard>(
  word: string,
  existing: T[],
  ignoreId?: number,
): T | undefined {
  const key = normalizeWord(word);
  return existing.find((card) => card.id !== ignoreId && normalizeWord(card.word) === key);
}

/** Mensagem única para cadastro, importação e edição. */
export function duplicateMessage(card: ExistingCard): string {
  return `“${card.word}” já está cadastrada${card.archived ? ' (arquivada)' : ''}.`;
}
