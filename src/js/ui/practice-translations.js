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
};

// Look up a localized study field with EN fallback.
export function getStudyField(study, field) {
  const lang = getLang();
  if (lang === 'en') return study[field];
  return TR[study.id]?.[lang]?.[field] ?? study[field];
}
