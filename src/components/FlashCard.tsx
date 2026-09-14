import { Volume2 } from 'lucide-react';
import type { Card } from '../lib/types';

/**
 * O card serve tanto para uma palavra solta quanto para uma frase inteira.
 * O tamanho do texto principal acompanha o comprimento, para uma frase de
 * oito palavras não sair do mesmo corpo de uma palavra de seis letras.
 */
function mainSize(text: string): string {
  const n = text.trim().length;
  if (n <= 14) return 'clamp(2.4rem, 7vw, 4rem)';
  if (n <= 28) return 'clamp(1.9rem, 5.4vw, 3rem)';
  if (n <= 55) return 'clamp(1.5rem, 4.2vw, 2.25rem)';
  return 'clamp(1.25rem, 3.4vw, 1.75rem)';
}

/** Uma entrada com espaço e pontuação final é tratada como frase. */
function isPhrase(text: string): boolean {
  return /\s/.test(text.trim()) && text.trim().length > 14;
}

/**
 * A carta. Frente: só o inglês. Verso: só o português.
 * O clique em qualquer lugar da carta vira; o botão de som não vira.
 */
export function FlashCard({
  card,
  flipped,
  onFlip,
  onReplay,
  speaking,
}: {
  card: Card;
  flipped: boolean;
  onFlip: () => void;
  onReplay: () => void;
  speaking: boolean;
}) {
  return (
    <div className="flip-scene w-full">
      <div
        role="button"
        tabIndex={0}
        aria-label={flipped ? 'Ver a frente da carta' : 'Virar a carta e ver a tradução'}
        onClick={onFlip}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onFlip();
          }
        }}
        className={`flip-inner relative w-full cursor-pointer select-none ${
          flipped ? 'is-flipped' : ''
        }`}
        style={{ minHeight: 'clamp(20rem, 46vh, 27rem)' }}
      >
        {/* ── Frente ── */}
        <Face side="front" hidden={flipped}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReplay();
            }}
            aria-label="Ouvir de novo"
            className={`absolute right-5 top-5 rounded-full border border-ridge p-2.5 transition-colors ${
              speaking ? 'border-cyan/50 bg-cyan/15 text-cyan' : 'text-dust hover:text-starlight'
            }`}
          >
            <Volume2 aria-hidden className={`size-4 ${speaking ? 'animate-pulse' : ''}`} />
          </button>

          <p
            className="max-w-[22ch] font-reader leading-[1.12] tracking-tight text-starlight"
            style={{ fontSize: mainSize(card.word) }}
          >
            {card.word}
          </p>

          {card.phrase && (
            <p className="mt-6 max-w-[38ch] font-reader text-[clamp(1.05rem,2.4vw,1.35rem)] leading-relaxed text-nebula-soft italic">
              {card.phrase}
            </p>
          )}

          <p className="absolute bottom-5 text-xs text-faint">
            {isPhrase(card.word) ? 'Traduza mentalmente e toque' : 'Toque para ver a tradução'}
          </p>
        </Face>

        {/* ── Verso ── */}
        <Face side="back" hidden={!flipped}>
          <p
            className="max-w-[24ch] font-reader leading-[1.15] tracking-tight text-starlight"
            style={{ fontSize: mainSize(card.translation) }}
          >
            {card.translation}
          </p>

          {card.phraseTranslation && (
            <p className="mt-6 max-w-[38ch] font-reader text-[clamp(1rem,2.3vw,1.3rem)] leading-relaxed text-amber/85">
              {card.phraseTranslation}
            </p>
          )}

          {card.notes && (
            <p className="mt-5 max-w-[42ch] text-sm leading-relaxed text-dust">{card.notes}</p>
          )}

          <p className="absolute bottom-5 max-w-[80%] truncate text-xs text-faint">
            {card.word}
            {card.reviewCount > 0 && ` · revisada ${card.reviewCount}×`}
          </p>
        </Face>
      </div>
    </div>
  );
}

function Face({
  side,
  hidden,
  children,
}: {
  side: 'front' | 'back';
  hidden: boolean;
  children: React.ReactNode;
}) {
  const front = side === 'front';
  return (
    <div
      aria-hidden={hidden}
      className={`flip-face glass-strong absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-[1.75rem] px-7 py-14 text-center ${
        front ? '' : 'flip-back'
      }`}
      style={{
        boxShadow: front
          ? '0 30px 90px -40px #7c3aed, inset 0 1px 0 #ffffff1a'
          : '0 30px 90px -40px #e8489f, inset 0 1px 0 #ffffff1a',
      }}
    >
      {/* Faixa de luz no topo, diferente em cada face — dá orientação sem texto. */}
      <span
        aria-hidden
        className="absolute inset-x-10 top-0 h-px"
        style={{
          background: front
            ? 'linear-gradient(90deg, transparent, #a678ff, transparent)'
            : 'linear-gradient(90deg, transparent, #e8489f, transparent)',
        }}
      />
      {children}
    </div>
  );
}
