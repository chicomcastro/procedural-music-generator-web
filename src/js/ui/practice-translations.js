// Practice studies translations sidecar. The English source lives on each
// study in practice-studies.js; PT/ES overrides are keyed by study id and
// fall back to the English field when no translation exists.

import { getLang } from '../i18n/i18n.js';

export const TR = {
  'two-voice-invention': {
    pt: {
      title: 'Invenção a 2 vozes',
      summary: 'Três movimentos de melodia + contraponto, na tradição das invenções de Bach. Ajuste a dificuldade por ato ou pelo slider mestre.',
      eyebrow: 'Contraponto · 3 atos',
    },
    es: {
      title: 'Invención a 2 voces',
      summary: 'Tres movimientos de melodía + contrapunto, en la tradición de las invenciones de Bach. Ajusta la dificultad por acto o con el deslizador maestro.',
      eyebrow: 'Contrapunto · 3 actos',
    },
  },
  'duet-workshop': {
    pt: {
      title: 'Oficina de Duetos',
      summary: 'Um movimento configurável: escolha a escala, a progressão, o vocabulário rítmico e o estilo de dueto. O modo "parte única" mostra só uma das vozes — gere, imprima, toquem juntos.',
      eyebrow: 'Contraponto · sandbox',
    },
    es: {
      title: 'Taller de Dúos',
      summary: 'Un movimiento configurable: elige la escala, la progresión, el vocabulario rítmico y el estilo de dúo. El modo "vista por parte" muestra solo una voz — genera, imprime, toquen juntos.',
      eyebrow: 'Contrapunto · sandbox',
    },
  },
  'walking-bass-workout': {
    pt: {
      title: 'Treino de Walking-Bass',
      summary: 'Três atos de walking-bass sobre acordes reais — tempo e densidade harmônica progressivos. Mesmo estudo, variações infinitas.',
      eyebrow: 'Baixo · 3 atos',
    },
    es: {
      title: 'Entrenamiento de Walking-Bass',
      summary: 'Tres actos de walking-bass sobre cambios reales — tempo y densidad armónica progresivos. Mismo estudio, variaciones infinitas.',
      eyebrow: 'Bajo · 3 actos',
    },
  },
  'scale-etude': {
    pt: {
      title: 'Estudo de Escala',
      summary: 'Padrões de método (pares e tríades, sub. + desc.) montados como uma peça contínua por ato. Escolha a escala, leve o estudo.',
      eyebrow: 'Técnica · 3 atos',
    },
    es: {
      title: 'Estudio de Escala',
      summary: 'Patrones de método (pares y tríadas, asc. + desc.) montados como una pieza continua por acto. Elige la escala, recibe el estudio.',
      eyebrow: 'Técnica · 3 actos',
    },
  },
  'solo-etude': {
    pt: {
      title: 'Estudo Solo',
      summary: 'Uma voz sobre mudanças reais de acordes — 3 movimentos, cada um uma melodia procedural que você lê sozinho.',
      eyebrow: 'Melodia · 3 atos',
    },
    es: {
      title: 'Estudio Solo',
      summary: 'Una voz sobre cambios reales de acordes — 3 movimientos, cada uno una melodía procedural que lees solo.',
      eyebrow: 'Melodía · 3 actos',
    },
  },
  'modal-vamp': {
    pt: {
      title: 'Vamp Modal',
      summary: 'Um vamp de dois acordes embaixo de uma exploração melódica — um modo por ato. Treina o ouvido pra cor modal.',
      eyebrow: 'Modal · 3 atos',
    },
    es: {
      title: 'Vamp Modal',
      summary: 'Un vamp de dos acordes bajo una exploración melódica — un modo por acto. Entrena el oído para el color modal.',
      eyebrow: 'Modal · 3 actos',
    },
  },
};

// Look up a localized study field with EN fallback.
export function getStudyField(study, field) {
  const lang = getLang();
  if (lang === 'en') return study[field];
  return TR[study.id]?.[lang]?.[field] ?? study[field];
}
