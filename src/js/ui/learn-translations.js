// Curriculum translations sidecar. The English source-of-truth lives in
// learn-modules.js; this file holds PT/ES overrides keyed by module id.
// Returning helpers fall back to the English module field when no override
// exists for the current language, so the curriculum stays usable even if a
// translation is missing.

import { getLang } from '../i18n/i18n.js';

export const TR = {
  'major-scale': {
    pt: {
      title: 'A Escala Maior',
      summary: 'Construa, ouça e reconheça a família da escala maior.',
      tag: 'Teoria · Escalas',
      steps: [
        { title: 'Padrão de tons e semitons', text: `A escala maior é construída a partir de um padrão fixo de intervalos: <strong>T-T-S-T-T-T-S</strong> (T = tom / 2 semitons, S = semitom / 1 semitom). Começando em Dó, todas as teclas brancas em ordem dão Dó maior: C D E F G A B C. Os semitons caem entre E–F e B–C. É esse padrão que dá à escala o som brilhante e "resolvido".` },
        { title: 'Ascendente', description: 'Ouça a escala de Dó maior subindo, uma nota por tempo.' },
        { title: 'Descendente', description: 'A mesma escala tocada ao contrário — sinta como ela resolve voltando à tônica.' },
        { title: 'Com pausas', description: 'A mesma escala, mas cada segundo tempo é silencioso. Repare como a pausa reformula uma linha familiar.' },
        { title: 'Melodia cantável', description: 'Uma melodia curta e marcante usando só notas da escala maior — o tipo de frase que gruda na cabeça.' },
        { title: 'Terças quebradas', description: 'Estudo clássico de escala: cada grau é seguido pela nota uma terça acima (1-3, 2-4, 3-5, …) — pares de colcheias subindo até o topo.' },
      ],
    },
    es: {
      title: 'La Escala Mayor',
      summary: 'Construye, escucha y reconoce la familia de la escala mayor.',
      tag: 'Teoría · Escalas',
      steps: [
        { title: 'Patrón de tonos y semitonos', text: `La escala mayor se construye con un patrón fijo de intervalos: <strong>T-T-S-T-T-T-S</strong> (T = tono / 2 semitonos, S = semitono / 1 semitono). Empezando en Do, todas las teclas blancas en orden dan Do mayor: C D E F G A B C. Los semitonos caen entre E–F y B–C. Ese patrón es lo que hace que la escala suene brillante y "resuelta".` },
        { title: 'Ascendente', description: 'Escucha la escala de Do mayor subiendo, una nota por pulso.' },
        { title: 'Descendente', description: 'La misma escala al revés — siente cómo resuelve al volver a la tónica.' },
        { title: 'Con pausas', description: 'La misma escala, pero cada segundo pulso queda en silencio. Mira cómo la pausa transforma una línea familiar.' },
        { title: 'Melodía cantable', description: 'Una melodía corta y pegadiza usando solo notas de la escala mayor — el tipo de frase que se queda en la cabeza.' },
        { title: 'Terceras quebradas', description: 'Estudio clásico de escala: cada grado va seguido de la nota una tercera arriba (1-3, 2-4, 3-5, …) — pares de corcheas subiendo hasta arriba.' },
      ],
    },
  },
  'natural-minor': {
    pt: {
      title: 'Escala Menor Natural',
      summary: 'O par menor da maior. As mesmas notas de Lá menor tocadas a partir de Lá.',
      tag: 'Teoria · Escalas',
      steps: [
        { title: 'Lá menor e o tom relativo', text: `A menor natural usa as mesmas notas da escala maior começando no 6º grau. Dó maior compartilha notas com Lá menor natural: A B C D E F G A. Seu padrão de intervalos é <strong>T-S-T-T-S-T-T</strong> — os semitons agora caem entre B–C e E–F. A 3ª, 6ª e 7ª abaixadas em relação à maior dão essa cor mais escura e contemplativa.` },
        { title: 'Ascendente em Lá', description: 'Suba pela escala de Lá menor natural.' },
        { title: 'Descendente em Lá', description: 'A mesma escala descendo. Repare na 7ª abaixada (Sol) em vez de Sol#.' },
        { title: 'Melodia triste', description: 'Frase melódica curta com a 6ª e 7ª abaixadas — aquela melancolia típica da menor natural.' },
        { title: 'Linha ascendente', description: 'Uma frase que ergue o ouvido pela escala, retornando à nota anterior antes de cada novo passo para cima.' },
      ],
    },
    es: {
      title: 'Escala Menor Natural',
      summary: 'La pareja menor de la mayor. Las mismas notas de La menor tocadas desde La.',
      tag: 'Teoría · Escalas',
      steps: [
        { title: 'La menor y el tono relativo', text: `La menor natural usa las mismas notas que la escala mayor pero empezando en el 6º grado. Do mayor comparte notas con La menor natural: A B C D E F G A. Su patrón de intervalos es <strong>T-S-T-T-S-T-T</strong> — los semitonos caen ahora entre B–C y E–F. La 3ª, 6ª y 7ª rebajadas respecto a la mayor le dan ese color más oscuro y contemplativo.` },
        { title: 'Ascendente en La', description: 'Sube por la escala de La menor natural.' },
        { title: 'Descendente en La', description: 'La misma escala bajando. Fíjate en la 7ª rebajada (Sol) en lugar de Sol#.' },
        { title: 'Melodía triste', description: 'Frase melódica corta usando 6ª y 7ª rebajadas — esa nostalgia típica de la menor natural.' },
        { title: 'Línea ascendente', description: 'Una frase que sube por la escala, volviendo a la nota anterior antes de cada nuevo paso hacia arriba.' },
      ],
    },
  },
  'pentatonic-minor': {
    pt: {
      title: 'Pentatônica Menor',
      summary: 'Escala de cinco notas. A base de blues, rock e solos de pop.',
      tag: 'Teoria · Escalas',
      steps: [
        { title: 'Por que cinco notas?', text: `A pentatônica menor é a menor natural com a 2ª e a 6ª removidas: A C D E G A. Cinco notas, todas elas soando bem sobre uma harmonia menor — é por isso que ela é tão "à prova de falhas" para solos.` },
        { title: 'Ascendente', description: 'Pentatônica de Lá menor subindo.' },
        { title: 'Descendente', description: 'A mesma escala descendo. Repare em quão "vocal" ela soa.' },
        { title: 'Lick bluesy', description: 'Pentatônica menor num lick típico — pickup em colcheias e resolução sustentada na fundamental.' },
        { title: 'Frase de solo', description: 'Frase melódica de solo de rock usando a pentatônica menor.' },
      ],
    },
    es: {
      title: 'Pentatónica Menor',
      summary: 'Escala de cinco notas. La base de blues, rock y solos de pop.',
      tag: 'Teoría · Escalas',
      steps: [
        { title: '¿Por qué cinco notas?', text: `La pentatónica menor es la menor natural sin la 2ª ni la 6ª: A C D E G A. Cinco notas, todas suenan bien sobre una armonía menor — por eso es tan "a prueba de fallos" para solear.` },
        { title: 'Ascendente', description: 'Pentatónica de La menor subiendo.' },
        { title: 'Descendente', description: 'La misma escala bajando. Mira lo "vocal" que suena.' },
        { title: 'Lick bluesy', description: 'Pentatónica menor en un lick típico — pickup en corcheas y resolución sostenida en la fundamental.' },
        { title: 'Frase solista', description: 'Frase melódica de solo de rock usando la pentatónica menor.' },
      ],
    },
  },
  'pentatonic-major': {
    pt: {
      title: 'Pentatônica Maior',
      summary: 'A prima de cinco notas da maior. Pilar de country, gospel e MPB.',
      tag: 'Teoria · Escalas',
      steps: [
        { title: 'Tire os semitons', text: `A pentatônica maior é a escala maior sem a 4ª e a 7ª: C D E G A. Sem os semitons, ela soa otimista, "campestre" e nada dissonante.` },
        { title: 'Ascendente', description: 'Pentatônica de Dó maior subindo.' },
        { title: 'Descendente', description: 'A mesma escala descendo.' },
        { title: 'Lick country', description: 'Frase típica de country/folk com colcheias-ornamento e fundamental longa no final.' },
        { title: 'Frase com sabor brasileiro', description: 'Pequena frase à brasileira (samba/bossa) usando a pentatônica maior.' },
      ],
    },
    es: {
      title: 'Pentatónica Mayor',
      summary: 'La prima de cinco notas de la mayor. Pilar del country, gospel y folk brasileño.',
      tag: 'Teoría · Escalas',
      steps: [
        { title: 'Quita los semitonos', text: `La pentatónica mayor es la escala mayor sin 4ª ni 7ª: C D E G A. Sin semitonos, suena optimista, "campestre" y nada disonante.` },
        { title: 'Ascendente', description: 'Pentatónica de Do mayor subiendo.' },
        { title: 'Descendente', description: 'La misma escala bajando.' },
        { title: 'Lick country', description: 'Frase típica de country/folk con corcheas de adorno y una fundamental larga al final.' },
        { title: 'Frase con sabor brasileño', description: 'Frase cortita estilo brasileño (samba/bossa) usando la pentatónica mayor.' },
      ],
    },
  },
  'blues-scale': {
    pt: {
      title: 'Escala de Blues',
      summary: 'Pentatônica menor mais a "blue note" — a alma do blues, jazz e rock.',
      tag: 'Teoria · Escalas',
      steps: [
        { title: 'A blue note', text: `A escala de blues adiciona uma nota cromática à pentatônica menor — a 5ª diminuta (♭5). Em Lá: A C D E♭ E G A. Esse semitom extra é a "blue note", responsável pela tensão característica da escala.` },
        { title: 'Ascendente', description: 'Escala de blues em Lá subindo.' },
        { title: 'Descendente', description: 'A mesma escala descendo. Repare na tensão que a blue note adiciona.' },
        { title: 'Lick clássico de blues', description: 'Frase clássica de blues usando a escala de blues.' },
        { title: 'Frase de pergunta e resposta', description: 'Dois compassos: uma pergunta tensa, uma resposta resolvida.' },
      ],
    },
    es: {
      title: 'Escala de Blues',
      summary: 'Pentatónica menor más la "blue note" — el alma del blues, jazz y rock.',
      tag: 'Teoría · Escalas',
      steps: [
        { title: 'La blue note', text: `La escala de blues añade una nota cromática a la pentatónica menor — la 5ª disminuida (♭5). En La: A C D E♭ E G A. Ese semitono extra es la "blue note", responsable de la tensión característica de la escala.` },
        { title: 'Ascendente', description: 'Escala de blues en La subiendo.' },
        { title: 'Descendente', description: 'La misma escala bajando. Fíjate en la tensión que añade la blue note.' },
        { title: 'Lick clásico de blues', description: 'Frase clásica de blues usando la escala de blues.' },
        { title: 'Frase pregunta y respuesta', description: 'Dos compases: una pregunta tensa, una respuesta resuelta.' },
      ],
    },
  },
  'harmonic-minor': {
    pt: {
      title: 'Menor Harmônica',
      summary: 'Menor natural com a 7ª aumentada. Exótica, dramática — coração do flamenco e do metal.',
      tag: 'Teoria · Escalas',
      steps: [
        { title: 'Sensível elevada', text: `A menor harmônica é a menor natural com a 7ª subida em um semitom. Em Lá: A B C D E F G# A. Esse pulo de tom e meio entre a ♭6 (F) e a 7ª maior (G#) é o que dá o tempero árabe/flamenco à escala.` },
        { title: 'Ascendente em Lá', description: 'Menor harmônica de Lá subindo. Ouça o salto F → G#.' },
        { title: 'Descendente em Lá', description: 'A mesma escala descendo. O salto continua perceptível.' },
        { title: 'Frase em estilo flamenco', description: 'Frase curta que destaca o intervalo aumentado característico.' },
        { title: 'Mini-frase clássica', description: 'Pequeno trecho à moda barroca/clássica usando a menor harmônica.' },
      ],
    },
    es: {
      title: 'Menor Armónica',
      summary: 'Menor natural con la 7ª aumentada. Exótica, dramática — corazón del flamenco y el metal.',
      tag: 'Teoría · Escalas',
      steps: [
        { title: 'Sensible elevada', text: `La menor armónica es la menor natural con la 7ª subida un semitono. En La: A B C D E F G# A. Ese salto de tono y medio entre la ♭6 (F) y la 7ª mayor (G#) es lo que da el sabor árabe/flamenco a la escala.` },
        { title: 'Ascendente en La', description: 'Menor armónica de La subiendo. Escucha el salto F → G#.' },
        { title: 'Descendente en La', description: 'La misma escala bajando. El salto sigue siendo perceptible.' },
        { title: 'Frase estilo flamenco', description: 'Frase corta que destaca el intervalo aumentado característico.' },
        { title: 'Mini-frase clásica', description: 'Pequeño fragmento a la barroca/clásica usando la menor armónica.' },
      ],
    },
  },
  'greek-modes': {
    pt: {
      title: 'Modos Gregos',
      summary: 'Sete modos, uma escala-mãe. Cada um tem sua cor.',
      tag: 'Teoria · Modos',
      steps: [
        { title: 'Modos são pontos de partida', text: `Os sete modos da escala maior são obtidos começando em cada grau diferente: Jônio (1º) é a própria escala maior; Dórico (2º), Frígio (3º), Lídio (4º), Mixolídio (5º), Eólio (6º — a menor natural) e Lócrio (7º). Mesmo conjunto de notas, "ponto de partida" diferente — e portanto cor sonora diferente.` },
        { title: 'Dórico (D a partir de Dó maior)', description: 'D dórico: D E F G A B C D. Soa "menor mas otimista".' },
        { title: 'Frígio (E a partir de Dó maior)', description: 'E frígio: E F G A B C D E. Cor escura, com sabor espanhol.' },
        { title: 'Lídio (F a partir de Dó maior)', description: 'F lídio: F G A B C D E F. Soa "etéreo", "voador" pela 4ª aumentada.' },
        { title: 'Mixolídio (G a partir de Dó maior)', description: 'G mixolídio: G A B C D E F G. Maior com 7ª abaixada — sabor de rock/blues.' },
        { title: 'Melodia em dórico', description: 'Uma frase que se apoia em B — a 6ª aumentada que distingue D Dórico de D menor natural.' },
        { title: 'Melodia em lídio', description: 'Pequena frase em F lídio.' },
      ],
    },
    es: {
      title: 'Modos Griegos',
      summary: 'Siete modos, una escala madre. Cada uno con su color.',
      tag: 'Teoría · Modos',
      steps: [
        { title: 'Los modos son puntos de partida', text: `Los siete modos de la escala mayor se obtienen empezando en cada grado distinto: Jónico (1º) es la propia escala mayor; Dórico (2º), Frigio (3º), Lidio (4º), Mixolidio (5º), Eolio (6º — la menor natural) y Locrio (7º). Mismo conjunto de notas, distinto "punto de partida" — y por tanto distinto color sonoro.` },
        { title: 'Dórico (D desde Do mayor)', description: 'D dórico: D E F G A B C D. Suena "menor pero optimista".' },
        { title: 'Frigio (E desde Do mayor)', description: 'E frigio: E F G A B C D E. Color oscuro, sabor español.' },
        { title: 'Lidio (F desde Do mayor)', description: 'F lidio: F G A B C D E F. Suena "etéreo", "volátil" por la 4ª aumentada.' },
        { title: 'Mixolidio (G desde Do mayor)', description: 'G mixolidio: G A B C D E F G. Mayor con 7ª rebajada — sabor de rock/blues.' },
        { title: 'Melodía en dórico', description: 'Una frase que se apoya en B — la 6ª aumentada que distingue D Dórico de D menor natural.' },
        { title: 'Melodía en lidio', description: 'Pequeña frase en F lidio.' },
      ],
    },
  },
  'challenge-scales': {
    pt: {
      title: 'Desafio das escalas',
      summary: 'Misture maior, menor natural, pentatônica e modos. Identifique a cor de ouvido.',
      tag: 'Desafio · Escalas',
      steps: [
        { title: 'O exercício', text: `Você ouvirá três frases curtas, cada uma usando uma escala diferente entre as que estudou. Tente identificar a escala antes de ler a resposta.` },
        { title: 'Mistério #1', description: 'Escute. Maior, menor natural, pentatônica menor ou dórico?' },
        { title: 'Mistério #2', description: 'Mais uma frase para identificar.' },
        { title: 'Mistério #3', description: 'Última frase do desafio.' },
        { title: 'Mistério #4', description: 'Algo mais exótico — ouça o salto de 2ª aumentada.' },
      ],
    },
    es: {
      title: 'Reto de escalas',
      summary: 'Mezcla mayor, menor natural, pentatónica y modos. Identifica el color de oído.',
      tag: 'Reto · Escalas',
      steps: [
        { title: 'El ejercicio', text: `Vas a oír tres frases cortas, cada una usando una escala distinta de las que has estudiado. Intenta identificar la escala antes de leer la respuesta.` },
        { title: 'Misterio #1', description: 'Escucha. ¿Mayor, menor natural, pentatónica menor o dórico?' },
        { title: 'Misterio #2', description: 'Otra frase para identificar.' },
        { title: 'Misterio #3', description: 'Última frase del reto.' },
        { title: 'Misterio #4', description: 'Algo más exótico — escucha el salto de 2ª aumentada.' },
      ],
    },
  },
  'major-triad': {
    pt: {
      title: 'Tríade Maior & Inversões',
      summary: 'Fundamental, 3ª, 5ª — e o mesmo acorde empilhado de três jeitos.',
      tag: 'Teoria · Acordes',
      steps: [
        { title: 'As três posições', text: `Uma tríade maior tem três notas: 1 (fundamental), 3 (terça maior), 5 (quinta justa). Em Dó maior: C E G. Mude qual nota está embaixo e você tem uma inversão: posição fundamental (C-E-G), 1ª inversão (E-G-C), 2ª inversão (G-C-E). Soam diferente, mas é o mesmo acorde.` },
        { title: 'Posição fundamental — C E G', description: 'Tríade de Dó maior na posição fundamental.' },
        { title: '1ª inversão — E G C', description: 'A 3ª (E) na voz mais grave.' },
        { title: '2ª inversão — G C E', description: 'A 5ª (G) na voz mais grave.' },
        { title: 'Melodia da tríade', description: 'Melodia construída só com as notas do acorde de Dó maior.' },
        { title: 'Tríade com notas de passagem', description: 'A tríade com notas de passagem da escala maior conectando.' },
      ],
    },
    es: {
      title: 'Tríada Mayor e Inversiones',
      summary: 'Fundamental, 3ª, 5ª — y el mismo acorde apilado de tres maneras.',
      tag: 'Teoría · Acordes',
      steps: [
        { title: 'Las tres posiciones', text: `Una tríada mayor tiene tres notas: 1 (fundamental), 3 (tercera mayor), 5 (quinta justa). En Do mayor: C E G. Cambia qué nota está abajo y tienes una inversión: posición fundamental (C-E-G), 1ª inversión (E-G-C), 2ª inversión (G-C-E). Suenan distinto, pero es el mismo acorde.` },
        { title: 'Posición fundamental — C E G', description: 'Tríada de Do mayor en posición fundamental.' },
        { title: '1ª inversión — E G C', description: 'La 3ª (E) en la voz más grave.' },
        { title: '2ª inversión — G C E', description: 'La 5ª (G) en la voz más grave.' },
        { title: 'Melodía de la tríada', description: 'Melodía construida solo con las notas del acorde de Do mayor.' },
        { title: 'Tríada con notas de paso', description: 'La tríada con notas de paso de la escala mayor conectando.' },
      ],
    },
  },
  'minor-triad': {
    pt: {
      title: 'Tríade Menor & Inversões',
      summary: 'Mesma ideia, 3ª abaixada. Cor mais escura.',
      tag: 'Teoria · Acordes',
      steps: [
        { title: 'Abaixe a 3ª', text: `A tríade menor é 1-♭3-5: a 3ª menor em vez da maior. Em Lá menor: A C E. As inversões funcionam igual: fundamental (A-C-E), 1ª (C-E-A), 2ª (E-A-C).` },
        { title: 'Posição fundamental — A C E', description: 'Tríade de Lá menor na posição fundamental.' },
        { title: '1ª inversão — C E A', description: 'A ♭3 (C) na voz mais grave.' },
        { title: '2ª inversão — E A C', description: 'A 5ª (E) na voz mais grave.' },
        { title: 'Melodia da tríade menor', description: 'Melodia construída com notas da tríade de Lá menor.' },
        { title: 'Tríade com notas vizinhas', description: 'Notas da tríade ornamentadas por notas vizinhas cromáticas curtas — as vizinhas tocam como colcheias para decorar, não interromper.' },
      ],
    },
    es: {
      title: 'Tríada Menor e Inversiones',
      summary: 'La misma idea, 3ª rebajada. Color más oscuro.',
      tag: 'Teoría · Acordes',
      steps: [
        { title: 'Rebaja la 3ª', text: `La tríada menor es 1-♭3-5: la 3ª menor en lugar de la mayor. En La menor: A C E. Las inversiones funcionan igual: fundamental (A-C-E), 1ª (C-E-A), 2ª (E-A-C).` },
        { title: 'Posición fundamental — A C E', description: 'Tríada de La menor en posición fundamental.' },
        { title: '1ª inversión — C E A', description: 'La ♭3 (C) en la voz más grave.' },
        { title: '2ª inversión — E A C', description: 'La 5ª (E) en la voz más grave.' },
        { title: 'Melodía de la tríada menor', description: 'Melodía construida con notas de la tríada de La menor.' },
        { title: 'Tríada con vecinas', description: 'Notas de la tríada ornamentadas con vecinas cromáticas cortas — las vecinas suenan como corcheas para decorar, no interrumpir.' },
      ],
    },
  },
  'tetrads': {
    pt: {
      title: 'Tétrades (acordes com 7ª)',
      summary: 'Adicione uma quarta nota no topo da tríade — porta de entrada para a harmonia jazz.',
      tag: 'Teoria · Tétrades',
      steps: [
        { title: 'Adicionando a 7ª', text: `Empilhar mais uma terça sobre a tríade dá uma tétrade: 1-3-5-7. Há quatro famílias principais: maj7 (3 maior + 7 maior), 7 dominante (3 maior + 7 menor), m7 (3 menor + 7 menor) e m7♭5 (3 menor + 5 diminuta + 7 menor). Cada um tem uma "cor" inconfundível.` },
        { title: 'Acorde Cmaj7', description: 'C E G B — som sereno, "flutuante", típico de jazz e bossa.' },
        { title: 'C7 dominante', description: 'C E G B♭ — som tenso que quer resolver, motor da harmonia tonal.' },
        { title: 'Cm7', description: 'C E♭ G B♭ — menor com 7ª menor, som suave.' },
        { title: 'Melodia de arpejo Cmaj7', description: 'Melodia tocando o arpejo de Cmaj7.' },
        { title: 'Linha bebop com 7ª', description: 'Linha em colcheias que traça um arpejo de G7, desce meio tom (F→E) e cai na 3ª de Cmaj7.' },
        { title: 'ii–V–I com 7ªs', description: 'A clássica cadência ii–V–I tocada com tétrades: Dm7 – G7 – Cmaj7.' },
      ],
    },
    es: {
      title: 'Tétradas (acordes de 7ª)',
      summary: 'Añade una cuarta nota encima de la tríada — la puerta a la armonía jazz.',
      tag: 'Teoría · Tétradas',
      steps: [
        { title: 'Añadiendo la 7ª', text: `Apilar otra tercera sobre la tríada da una tétrada: 1-3-5-7. Hay cuatro familias principales: maj7 (3 mayor + 7 mayor), 7 dominante (3 mayor + 7 menor), m7 (3 menor + 7 menor) y m7♭5 (3 menor + 5 disminuida + 7 menor). Cada una tiene un "color" inconfundible.` },
        { title: 'Acorde Cmaj7', description: 'C E G B — sonido sereno, "flotante", típico de jazz y bossa.' },
        { title: 'C7 dominante', description: 'C E G B♭ — sonido tenso que quiere resolver, motor de la armonía tonal.' },
        { title: 'Cm7', description: 'C E♭ G B♭ — menor con 7ª menor, sonido suave.' },
        { title: 'Melodía de arpegio Cmaj7', description: 'Melodía tocando el arpegio de Cmaj7.' },
        { title: 'Línea bebop con 7ª', description: 'Línea en corcheas que traza un arpegio de G7, baja un semitono (F→E) y aterriza en la 3ª de Cmaj7.' },
        { title: 'ii–V–I con 7ªs', description: 'La cadencia clásica ii–V–I tocada con tétradas: Dm7 – G7 – Cmaj7.' },
      ],
    },
  },
  'arpeggios': {
    pt: {
      title: 'Arpejos',
      summary: 'Um acorde, uma nota de cada vez. Ponte entre acordes e melodia.',
      tag: 'Teoria · Arpejos',
      steps: [
        { title: 'O que é um arpejo?', text: `Arpejo é tocar as notas de um acorde uma a uma, em sequência, em vez de simultaneamente. Funciona como um acorde "espalhado no tempo" — o ouvinte ainda percebe a harmonia, mas com fluxo melódico.` },
        { title: 'Arpejo de Dó maior (1-3-5-8)', description: 'C E G C — o arpejo mais clássico da harmonia ocidental.' },
        { title: 'Arpejo de Lá menor', description: 'A C E A — o equivalente menor.' },
        { title: 'Arpejo Cmaj7', description: 'C E G B C — arpejo de tétrade, ouça a cor da 7ª maior.' },
        { title: 'Melodia em arpejos', description: 'Pequena frase construída encadeando arpejos.' },
      ],
    },
    es: {
      title: 'Arpegios',
      summary: 'Un acorde, una nota por vez. Puente entre acordes y melodía.',
      tag: 'Teoría · Arpegios',
      steps: [
        { title: '¿Qué es un arpegio?', text: `Un arpegio es tocar las notas de un acorde una a una, en secuencia, en vez de simultáneamente. Funciona como un acorde "extendido en el tiempo" — el oyente sigue percibiendo la armonía, pero con flujo melódico.` },
        { title: 'Arpegio de Do mayor (1-3-5-8)', description: 'C E G C — el arpegio más clásico de la armonía occidental.' },
        { title: 'Arpegio de La menor', description: 'A C E A — el equivalente menor.' },
        { title: 'Arpegio Cmaj7', description: 'C E G B C — arpegio de tétrada, escucha el color de la 7ª mayor.' },
        { title: 'Melodía en arpegios', description: 'Pequeña frase construida encadenando arpegios.' },
      ],
    },
  },
  'challenge-chords': {
    pt: {
      title: 'Desafio de acordes',
      summary: 'Tríades, inversões e arpejos dos módulos anteriores — misturados.',
      tag: 'Desafio · Acordes',
      steps: [
        { title: 'Voicing #1', description: 'Identifique: posição fundamental, 1ª ou 2ª inversão?' },
        { title: 'Voicing #2', description: 'Outra inversão para identificar.' },
        { title: 'Cadeia de arpejos', description: 'Sequência de arpejos — qual é a progressão de acordes implícita?' },
      ],
    },
    es: {
      title: 'Reto de acordes',
      summary: 'Tríadas, inversiones y arpegios de módulos anteriores — mezclados.',
      tag: 'Reto · Acordes',
      steps: [
        { title: 'Voicing #1', description: '¿Identifica: posición fundamental, 1ª o 2ª inversión?' },
        { title: 'Voicing #2', description: 'Otra inversión para identificar.' },
        { title: 'Cadena de arpegios', description: 'Secuencia de arpegios — ¿cuál es la progresión de acordes implícita?' },
      ],
    },
  },
  'prog-i-v-vi-iv': {
    pt: {
      title: 'I–V–vi–IV (Eixo pop)',
      summary: 'A progressão mais popular do pop moderno. Familiar na hora.',
      tag: 'Progressões · Pop',
      steps: [
        { title: 'O "axis of awesome"', text: `Em Dó maior: C – G – Am – F. Quatro acordes que aparecem em centenas de hits — "Let It Be", "Don't Stop Believin'", "With or Without You", "Someone Like You" e dezenas mais. Funciona porque vai do I forte ao IV calmo passando pelo V (tensão) e vi (cor menor).` },
        { title: 'Ouça os acordes', description: 'A progressão I–V–vi–IV em bloco.' },
        { title: 'Melodia traçando os acordes', description: 'Melodia que destaca as notas-chave de cada acorde.' },
        { title: 'Riff que se adapta a cada acorde', description: 'Quatro compassos com uma figura rítmica recorrente, cada um remirado nas notas do acorde da vez.' },
      ],
    },
    es: {
      title: 'I–V–vi–IV (Eje pop)',
      summary: 'La progresión más popular del pop moderno. Familiar al instante.',
      tag: 'Progresiones · Pop',
      steps: [
        { title: 'El "axis of awesome"', text: `En Do mayor: C – G – Am – F. Cuatro acordes que aparecen en cientos de hits — "Let It Be", "Don't Stop Believin'", "With or Without You", "Someone Like You" y decenas más. Funciona porque va del I fuerte al IV tranquilo pasando por el V (tensión) y vi (color menor).` },
        { title: 'Escucha los acordes', description: 'La progresión I–V–vi–IV en bloque.' },
        { title: 'Melodía marcando los acordes', description: 'Melodía que destaca las notas clave de cada acorde.' },
        { title: 'Riff que se adapta a cada acorde', description: 'Cuatro compases con una figura rítmica recurrente, cada uno reapuntado a las notas del acorde de turno.' },
      ],
    },
  },
  'prog-50s': {
    pt: {
      title: 'I–vi–IV–V (Doo-wop dos anos 50)',
      summary: 'O loop de "Stand by Me". Define toda uma era do pop.',
      tag: 'Progressões · Anos 50',
      steps: [
        { title: 'O círculo doo-wop', text: `Em Dó: C – Am – F – G. Foi a progressão padrão do pop dos anos 50: "Stand by Me", "Earth Angel", "Heart and Soul". Suave, otimista e inconfundível.` },
        { title: 'Ouça os acordes', description: 'A progressão I–vi–IV–V em bloco.' },
        { title: 'Melodia sobre o loop', description: 'Melodia típica de balada dos anos 50.' },
        { title: 'Baixo caminhando entre os acordes', description: 'Linha de baixo que desenha cada acorde — fundamental e 3ª ou 5ª — com uma nota de ligação por grau levando à próxima fundamental.' },
      ],
    },
    es: {
      title: 'I–vi–IV–V (Doo-wop años 50)',
      summary: 'El loop de "Stand by Me". Define toda una era del pop.',
      tag: 'Progresiones · Años 50',
      steps: [
        { title: 'El círculo doo-wop', text: `En Do: C – Am – F – G. Fue la progresión estándar del pop de los 50: "Stand by Me", "Earth Angel", "Heart and Soul". Suave, optimista e inconfundible.` },
        { title: 'Escucha los acordes', description: 'La progresión I–vi–IV–V en bloque.' },
        { title: 'Melodía sobre el loop', description: 'Melodía típica de balada de los 50.' },
        { title: 'Bajo caminando entre los acordes', description: 'Línea de bajo que dibuja cada acorde — fundamental y 3ª o 5ª — con una nota de paso por grado que cae en la siguiente fundamental.' },
      ],
    },
  },
  'prog-12-bar-blues': {
    pt: {
      title: 'Blues de 12 compassos',
      summary: 'I, IV, V — o esqueleto universal do blues, R&B, rock e jazz.',
      tag: 'Progressões · Blues',
      steps: [
        { title: 'Doze compassos, três acordes', text: `O blues padrão de 12 compassos é: 4 compassos no I, 2 no IV, 2 no I, 1 no V, 1 no IV, 2 no I (último compasso pode ser uma "turnaround"). Em Dó: 4xC, 2xF, 2xC, 1xG, 1xF, 2xC.` },
        { title: 'Ouça o blues básico (condensado)', description: 'Um blues de 12 compassos em versão reduzida para ouvir a estrutura.' },
        { title: 'Linha de solo de blues', description: 'Frase melódica sobre o esqueleto do blues.' },
        { title: 'Walking bass de blues', description: 'Walking sobre a forma condensada de 6 compassos (a mesma do exercício de acordes acima): I, IV, I, V, IV, I.' },
      ],
    },
    es: {
      title: 'Blues de 12 compases',
      summary: 'I, IV, V — el esqueleto universal del blues, R&B, rock y jazz.',
      tag: 'Progresiones · Blues',
      steps: [
        { title: 'Doce compases, tres acordes', text: `El blues estándar de 12 compases es: 4 compases en I, 2 en IV, 2 en I, 1 en V, 1 en IV, 2 en I (el último compás puede ser una "turnaround"). En Do: 4xC, 2xF, 2xC, 1xG, 1xF, 2xC.` },
        { title: 'Escucha el blues básico (condensado)', description: 'Un blues de 12 compases en versión reducida para oír la estructura.' },
        { title: 'Línea solista de blues', description: 'Frase melódica sobre el esqueleto del blues.' },
        { title: 'Walking bass de blues', description: 'Walking sobre la forma condensada de 6 compases (la misma del ejercicio de acordes de arriba): I, IV, I, V, IV, I.' },
      ],
    },
  },
  'prog-ii-v-i': {
    pt: {
      title: 'ii–V–I (cadência jazz)',
      summary: 'A progressão mais importante do jazz. Resolve em casa por duas 5as justas.',
      tag: 'Progressões · Jazz',
      steps: [
        { title: 'Duas quintas descendo', text: `Em Dó maior: Dm7 – G7 – Cmaj7. O ii (menor) cede para o V (dominante), que cede para o I (tônica) — cada passo é uma 5ª descendente, o movimento mais forte da harmonia tonal.` },
        { title: 'Ouça ii–V–I em 7ªs', description: 'A cadência jazz padrão tocada com tétrades.' },
        { title: 'Melodia bebop', description: 'Linha em colcheias: arpejo de Dm7 subindo, linha descendente em G7, e arpejo limpo de Cmaj7. Três compassos, um acorde por compasso.' },
        { title: 'Linha de guide tones', description: 'Apenas a 3ª e a 7ª de cada acorde — sustentadas como mínimas, do jeito que um sopro de fato vozearia a linha.' },
      ],
    },
    es: {
      title: 'ii–V–I (cadencia jazz)',
      summary: 'La progresión más importante del jazz. Resuelve en casa por dos 5as justas.',
      tag: 'Progresiones · Jazz',
      steps: [
        { title: 'Dos quintas bajando', text: `En Do mayor: Dm7 – G7 – Cmaj7. El ii (menor) cede al V (dominante), que cede al I (tónica) — cada paso es una 5ª descendente, el movimiento más fuerte de la armonía tonal.` },
        { title: 'Escucha ii–V–I en 7ªs', description: 'La cadencia jazz estándar tocada con tétradas.' },
        { title: 'Melodía bebop', description: 'Línea en corcheas: arpegio de Dm7 subiendo, línea descendente en G7, y arpegio limpio de Cmaj7. Tres compases, un acorde por compás.' },
        { title: 'Línea de guide tones', description: 'Solo la 3ª y la 7ª de cada acorde — sostenidas como blancas, como una sección de vientos vozearía realmente la línea.' },
      ],
    },
  },
  'prog-andalusian': {
    pt: {
      title: 'Cadência andaluza (i–VII–VI–V)',
      summary: 'Linha de baixo descendente em menor que define o flamenco e a música espanhola.',
      tag: 'Progressões · Espanhol',
      steps: [
        { title: 'A descida frígia', text: `Em Lá menor: Am – G – F – E. Os acordes maiores nos dois últimos passos (F – E) criam o sabor espanhol clássico. A linha de baixo desce de tom em tom: A → G → F → E.` },
        { title: 'Ouça a cadência', description: 'A progressão andaluza em bloco.' },
        { title: 'Melodia com tempero espanhol', description: 'Frase melódica usando a menor harmônica sobre a cadência.' },
        { title: 'Linha de baixo descendente', description: 'Mínimas — cada fundamental segura dois tempos para a descida soar inevitável.' },
      ],
    },
    es: {
      title: 'Cadencia andaluza (i–VII–VI–V)',
      summary: 'Línea de bajo descendente en menor que define el flamenco y la música española.',
      tag: 'Progresiones · Español',
      steps: [
        { title: 'El descenso frigio', text: `En La menor: Am – G – F – E. Los acordes mayores en los dos últimos pasos (F – E) crean el sabor español clásico. La línea de bajo baja de tono en tono: A → G → F → E.` },
        { title: 'Escucha la cadencia', description: 'La progresión andaluza en bloque.' },
        { title: 'Melodía con sabor español', description: 'Frase melódica usando la menor armónica sobre la cadencia.' },
        { title: 'Línea de bajo descendente', description: 'Blancas — cada fundamental dura dos pulsos para que el descenso suene inevitable.' },
      ],
    },
  },
  'prog-pachelbel': {
    pt: {
      title: 'Pachelbel (I–V–vi–iii–IV–I–IV–V)',
      summary: 'Cânon em Ré. Oito acordes que serviram de base de hits de Bach a Coolio.',
      tag: 'Progressões · Clássico',
      steps: [
        { title: 'Oito acordes, infinitas canções', text: `Em Dó: C – G – Am – Em – F – C – F – G. A progressão do Cânon de Pachelbel inspirou tudo, de "Let It Be" a "Basket Case", "C U When U Get There" (Coolio) e milhares de outras. A descida do baixo (C-B-A-G-F-E-F-G) é o segredo.` },
        { title: 'Ouça a progressão do cânon', description: 'Os oito acordes em bloco.' },
        { title: 'Melodia em estilo cânon', description: 'Pequena linha melódica imitando o cânon.' },
        { title: 'Baixo de Pachelbel', description: 'A linha de baixo assinatura — oito fundamentais que percorrem a forma: C G A E F C F G.' },
      ],
    },
    es: {
      title: 'Pachelbel (I–V–vi–iii–IV–I–IV–V)',
      summary: 'Canon en Re. Ocho acordes que han alimentado hits de Bach a Coolio.',
      tag: 'Progresiones · Clásico',
      steps: [
        { title: 'Ocho acordes, infinitas canciones', text: `En Do: C – G – Am – Em – F – C – F – G. La progresión del Canon de Pachelbel inspiró todo, desde "Let It Be" hasta "Basket Case", "C U When U Get There" (Coolio) y miles más. El descenso del bajo (C-B-A-G-F-E-F-G) es el secreto.` },
        { title: 'Escucha la progresión del canon', description: 'Los ocho acordes en bloque.' },
        { title: 'Melodía estilo canon', description: 'Pequeña línea melódica imitando el canon.' },
        { title: 'Bajo de Pachelbel', description: 'La línea de bajo característica — ocho fundamentales que recorren la forma: C G A E F C F G.' },
      ],
    },
  },
  'prog-vi-iv-i-v': {
    pt: {
      title: 'vi–IV–I–V (Pop triste)',
      summary: 'O "eixo" rodado para começar na menor relativa — pop emocional moderno.',
      tag: 'Progressões · Pop moderno',
      steps: [
        { title: 'Mesmos acordes, gravidade diferente', text: `Em Dó: Am – F – C – G. São as mesmas notas de I–V–vi–IV, mas a sensação muda totalmente porque começamos no acorde menor. Som de pop melancólico moderno: "Apologize", "Numb", "Hello".` },
        { title: 'Ouça os acordes', description: 'A progressão vi–IV–I–V em bloco.' },
        { title: 'Linha melódica cantável', description: 'Topline melódica típica do pop emocional.' },
        { title: 'Contramelodia', description: 'Linha contramelódica que se entrelaça com a topline.' },
      ],
    },
    es: {
      title: 'vi–IV–I–V (Pop triste)',
      summary: 'El "eje" rotado para empezar en la menor relativa — pop emocional moderno.',
      tag: 'Progresiones · Pop moderno',
      steps: [
        { title: 'Mismos acordes, gravedad distinta', text: `En Do: Am – F – C – G. Son las mismas notas que I–V–vi–IV, pero la sensación cambia totalmente porque empezamos en el acorde menor. Sonido de pop melancólico moderno: "Apologize", "Numb", "Hello".` },
        { title: 'Escucha los acordes', description: 'La progresión vi–IV–I–V en bloque.' },
        { title: 'Línea melódica cantable', description: 'Topline melódica típica del pop emocional.' },
        { title: 'Contramelodía', description: 'Línea contramelódica que se entrelaza con la topline.' },
      ],
    },
  },
  'prog-minor-loop': {
    pt: {
      title: 'i–VII–VI–VII (Loop rock menor)',
      summary: 'Pesado, modal — o motor de incontáveis hinos do rock e do metal.',
      tag: 'Progressões · Menor',
      steps: [
        { title: 'Rock menor modal', text: `Em Lá menor: Am – G – F – G. A presença do VII (G) em vez de V (E) cria um sabor modal (eólio). Som dos clássicos do rock e metal: "Stairway to Heaven", "Wish You Were Here", "Smoke on the Water".` },
        { title: 'Ouça o loop', description: 'A progressão i–VII–VI–VII em bloco.' },
        { title: 'Riff sobre o loop', description: 'Riff de rock pesado encaixado no loop.' },
        { title: 'Contramelodia', description: 'Linha melódica secundária por cima do loop.' },
      ],
    },
    es: {
      title: 'i–VII–VI–VII (Loop rock menor)',
      summary: 'Pesado, modal — el motor de incontables himnos del rock y el metal.',
      tag: 'Progresiones · Menor',
      steps: [
        { title: 'Rock menor modal', text: `En La menor: Am – G – F – G. La presencia del VII (G) en lugar del V (E) crea un sabor modal (eolio). Sonido de los clásicos del rock y metal: "Stairway to Heaven", "Wish You Were Here", "Smoke on the Water".` },
        { title: 'Escucha el loop', description: 'La progresión i–VII–VI–VII en bloque.' },
        { title: 'Riff sobre el loop', description: 'Riff de rock pesado encajado en el loop.' },
        { title: 'Contramelodía', description: 'Línea melódica secundaria sobre el loop.' },
      ],
    },
  },
  'prog-royal-road': {
    pt: {
      title: 'Royal Road (IV–V–iii–vi)',
      summary: 'O som das aberturas de anime e do J-pop moderno.',
      tag: 'Progressões · J-Pop',
      steps: [
        { title: 'Sobe e resolve', text: `Em Dó: F – G – Em – Am. Conhecida no Japão como 王道進行 ("oudou shinkou", a progressão "do caminho real"). Aparece em mais de 50% dos hits J-pop modernos e em quase toda abertura de anime.` },
        { title: 'Ouça o loop', description: 'A progressão Royal Road em bloco.' },
        { title: 'Topline J-pop', description: 'Linha melódica típica de pop japonês sobre o loop.' },
        { title: 'Contramelodia estilo anime', description: 'Contramelodia épica encaixada sobre o loop.' },
      ],
    },
    es: {
      title: 'Royal Road (IV–V–iii–vi)',
      summary: 'El sonido de las aperturas de anime y del J-pop moderno.',
      tag: 'Progresiones · J-Pop',
      steps: [
        { title: 'Sube y resuelve', text: `En Do: F – G – Em – Am. Conocida en Japón como 王道進行 ("oudou shinkou", la progresión del "camino real"). Aparece en más del 50% de los hits J-pop modernos y en casi toda apertura de anime.` },
        { title: 'Escucha el loop', description: 'La progresión Royal Road en bloque.' },
        { title: 'Topline J-pop', description: 'Línea melódica típica del pop japonés sobre el loop.' },
        { title: 'Contramelodía estilo anime', description: 'Contramelodía épica encajada sobre el loop.' },
      ],
    },
  },
  'prog-circle-fifths': {
    pt: {
      title: 'Caminhada do círculo de 5as',
      summary: 'Quintas descendendo em sequência — a engrenagem que move os standards de jazz.',
      tag: 'Progressões · Ciclo de 5as',
      steps: [
        { title: 'Descer uma 5ª, em todo acorde', text: `Cada acorde está uma 5ª justa abaixo do anterior: Em7 – Am7 – Dm7 – G7 – Cmaj7. É o "motor" oculto por trás de incontáveis standards de jazz ("Autumn Leaves", "All The Things You Are").` },
        { title: 'Ouça cinco 5as descendendo', description: 'A sequência completa do ciclo em tétrades.' },
        { title: 'Melodia sobre o ciclo', description: 'Linha melódica destacando as fundamentais que caem.' },
        { title: 'Walking bass no ciclo', description: 'Linha de baixo caminhando pelas cinco 5as descendentes, quatro semínimas por acorde.' },
      ],
    },
    es: {
      title: 'Marcha del círculo de 5as',
      summary: 'Quintas descendiendo en secuencia — el engranaje que mueve los estándares de jazz.',
      tag: 'Progresiones · Ciclo de 5as',
      steps: [
        { title: 'Bajar una 5ª, en cada acorde', text: `Cada acorde está una 5ª justa por debajo del anterior: Em7 – Am7 – Dm7 – G7 – Cmaj7. Es el "motor" oculto detrás de incontables estándares de jazz ("Autumn Leaves", "All The Things You Are").` },
        { title: 'Escucha cinco 5as bajando', description: 'La secuencia completa del ciclo en tétradas.' },
        { title: 'Melodía sobre el ciclo', description: 'Línea melódica destacando las fundamentales que caen.' },
        { title: 'Walking bass en el ciclo', description: 'Línea de bajo caminando por las cinco 5as descendentes, cuatro negras por acorde.' },
      ],
    },
  },
  'prog-blues-turnaround': {
    pt: {
      title: 'Turnaround de blues',
      summary: 'A frase de 4 compassos que prepara o próximo chorus do blues. DNA puro da forma.',
      tag: 'Progressões · Blues',
      steps: [
        { title: 'Os últimos quatro compassos', text: `Os 4 compassos finais de cada blues de 12 compassos formam a turnaround: V – IV – I – V (ou variações). Em Dó: G – F – C – G. É o "rabo de cavalo" que reinicia o ciclo.` },
        { title: 'Ouça a turnaround', description: 'A progressão de turnaround em bloco.' },
        { title: 'Walking bass na turnaround', description: 'Linha de baixo caminhando sob a turnaround.' },
        { title: 'Lick que resolve em casa', description: 'Frase melódica que aterrissa na tônica.' },
      ],
    },
    es: {
      title: 'Turnaround de blues',
      summary: 'La frase de 4 compases que prepara el próximo chorus del blues. ADN puro de la forma.',
      tag: 'Progresiones · Blues',
      steps: [
        { title: 'Los últimos cuatro compases', text: `Los 4 compases finales de cada blues de 12 compases forman el turnaround: V – IV – I – V (o variantes). En Do: G – F – C – G. Es la "coleta" que reinicia el ciclo.` },
        { title: 'Escucha el turnaround', description: 'La progresión turnaround en bloque.' },
        { title: 'Walking bass en el turnaround', description: 'Línea de bajo caminando bajo el turnaround.' },
        { title: 'Lick que resuelve en casa', description: 'Frase melódica que aterriza en la tónica.' },
      ],
    },
  },
  'walking-bass': {
    pt: {
      title: 'Walking Bass — Fundamentos',
      summary: 'Semínimas por tempo, pousando na fundamental do acorde. O ponto de partida.',
      tag: 'Baixo · Walking',
      steps: [
        { title: 'O princípio do walking', text: `Walking bass toca uma nota por tempo, em semínimas, sempre marcando a harmonia. A regra de ouro: a fundamental do acorde cai no tempo 1 de cada compasso. O resto pode ser qualquer nota do acorde ou de aproximação.` },
        { title: 'Só fundamentais', description: 'O esqueleto: só fundamentais, uma por tempo.' },
        { title: 'Fundamentais + 5as', description: 'Adicione a 5ª entre as fundamentais.' },
        { title: 'Adicionando a 3ª', description: 'Cada compasso caminha 1 – 3 – 5 – 3 sobre o acorde. A 3ª nos tempos 2 e 4 dá cor.' },
        { title: 'Juntando tudo', description: 'Quatro compassos sobre I, IV, V, I. Cada compasso começa na fundamental e usa notas do acorde — mesma ideia, direções variadas para que a linha não pareça mecânica.' },
      ],
    },
    es: {
      title: 'Walking Bass — Fundamentos',
      summary: 'Negras por pulso, aterrizando en la fundamental del acorde. El punto de partida.',
      tag: 'Bajo · Walking',
      steps: [
        { title: 'El principio del walking', text: `El walking bass toca una nota por pulso, en negras, siempre marcando la armonía. Regla de oro: la fundamental del acorde cae en el tiempo 1 de cada compás. El resto puede ser cualquier nota del acorde o de aproximación.` },
        { title: 'Solo fundamentales', description: 'El esqueleto: solo fundamentales, una por pulso.' },
        { title: 'Fundamentales + 5as', description: 'Añade la 5ª entre las fundamentales.' },
        { title: 'Añadiendo la 3ª', description: 'Cada compás camina 1 – 3 – 5 – 3 sobre el acorde. La 3ª en los pulsos 2 y 4 aporta color.' },
        { title: 'Juntándolo todo', description: 'Cuatro compases sobre I, IV, V, I. Cada compás empieza en la fundamental y usa notas del acorde — la misma idea con direcciones variadas para que la línea no suene mecánica.' },
      ],
    },
  },
  'walking-bass-diatonic': {
    pt: {
      title: 'Caminhadas diatônicas',
      summary: 'Use os graus da escala para conectar fundamentais — base do walking de jazz mainstream.',
      tag: 'Baixo · Walking',
      steps: [
        { title: 'Conexão por graus conjuntos', text: `Em vez de saltar entre fundamentais, conecte-as andando pela escala. Se vai de Cmaj7 a Fmaj7, passe por D-E-F. Caminhada suave, sempre dentro da harmonia.` },
        { title: 'Subindo', description: 'Linha de baixo conectando os acordes para cima.' },
        { title: 'Descendo', description: 'A mesma ideia, mas indo para baixo.' },
        { title: 'Mistura caminhada + arpejo', description: 'Combine graus conjuntos com saltos de arpejo.' },
      ],
    },
    es: {
      title: 'Caminatas diatónicas',
      summary: 'Usa los grados de la escala para conectar fundamentales — base del walking de jazz mainstream.',
      tag: 'Bajo · Walking',
      steps: [
        { title: 'Conexión por grados conjuntos', text: `En lugar de saltar entre fundamentales, conéctalas andando por la escala. Si vas de Cmaj7 a Fmaj7, pasa por D-E-F. Caminata suave, siempre dentro de la armonía.` },
        { title: 'Subiendo', description: 'Línea de bajo conectando los acordes hacia arriba.' },
        { title: 'Bajando', description: 'La misma idea, pero hacia abajo.' },
        { title: 'Mezcla caminata + arpegio', description: 'Combina grados conjuntos con saltos de arpegio.' },
      ],
    },
  },
  'walking-bass-chromatic': {
    pt: {
      title: 'Notas de aproximação cromática',
      summary: 'Um semitom antes da próxima fundamental faz qualquer walking soar a jazz.',
      tag: 'Baixo · Walking',
      steps: [
        { title: 'Pouse a um semitom de distância', text: `Em vez de chegar à fundamental por uma nota da escala, chegue por um semitom acima ou abaixo. Ex.: chegando em C, use B (de baixo) ou C# (de cima). Cria a tensão característica do jazz.` },
        { title: 'Aproximação por baixo', description: 'Chegando a cada fundamental por um semitom abaixo.' },
        { title: 'Aproximação por cima', description: 'Chegando a cada fundamental por um semitom acima.' },
        { title: 'Aproximação mista (acima e abaixo)', description: 'Alternando entre os dois tipos de aproximação.' },
      ],
    },
    es: {
      title: 'Notas de aproximación cromática',
      summary: 'Un semitono antes de la próxima fundamental hace que cualquier walking suene a jazz.',
      tag: 'Bajo · Walking',
      steps: [
        { title: 'Aterriza a un semitono de distancia', text: `En vez de llegar a la fundamental por una nota de la escala, llega por un semitono arriba o abajo. Ej.: llegando a C, usa B (desde abajo) o C# (desde arriba). Crea la tensión característica del jazz.` },
        { title: 'Aproximación por abajo', description: 'Llegando a cada fundamental por un semitono abajo.' },
        { title: 'Aproximación por arriba', description: 'Llegando a cada fundamental por un semitono arriba.' },
        { title: 'Aproximación mixta (arriba y abajo)', description: 'Alternando entre los dos tipos de aproximación.' },
      ],
    },
  },
  'walking-bass-fifths': {
    pt: {
      title: 'Walking pelo ciclo de 5as',
      summary: 'Padrões icônicos sobre standards de jazz movidos por 5as descendentes.',
      tag: 'Baixo · Walking',
      steps: [
        { title: 'Ciclo no baixo', text: `Walking pelo ciclo de 5as: cada acorde está uma 5ª abaixo do anterior, e a linha de baixo enfatiza esse movimento natural — Em7 → Am7 → Dm7 → G7 → Cmaj7.` },
        { title: 'Cinco acordes descendo uma 5ª cada', description: 'A linha de baixo isolada sobre o ciclo.' },
        { title: 'Ciclo com aproximação cromática', description: 'O ciclo com aproximação cromática em cada mudança.' },
      ],
    },
    es: {
      title: 'Walking por el ciclo de 5as',
      summary: 'Patrones icónicos sobre estándares de jazz movidos por 5as descendentes.',
      tag: 'Bajo · Walking',
      steps: [
        { title: 'Ciclo en el bajo', text: `Walking por el ciclo de 5as: cada acorde está una 5ª por debajo del anterior, y la línea de bajo enfatiza ese movimiento natural — Em7 → Am7 → Dm7 → G7 → Cmaj7.` },
        { title: 'Cinco acordes bajando una 5ª cada', description: 'La línea de bajo aislada sobre el ciclo.' },
        { title: 'Ciclo con aproximación cromática', description: 'El ciclo con aproximación cromática en cada cambio.' },
      ],
    },
  },
  'walking-bass-inversions': {
    pt: {
      title: 'Inversões — 3ª e 5ª no baixo',
      summary: 'Pouse em outras notas do acorde além da fundamental para condução de voz mais rica.',
      tag: 'Baixo · Walking',
      steps: [
        { title: 'Você não precisa começar na fundamental', text: `Variar pondo a 3ª ou a 5ª como nota mais grave no tempo 1 cria movimentos mais melódicos. Ex.: Cmaj7 com E no baixo = 1ª inversão.` },
        { title: '3ª no baixo', description: 'Linha de walking com a 3ª de cada acorde no tempo 1.' },
        { title: '5ª no baixo', description: 'Linha de walking com a 5ª no tempo 1.' },
        { title: 'Mesclando posições', description: 'Variando entre fundamental, 3ª e 5ª no tempo 1.' },
      ],
    },
    es: {
      title: 'Inversiones — 3ª y 5ª en el bajo',
      summary: 'Aterriza en otras notas del acorde además de la fundamental para conducción de voces más rica.',
      tag: 'Bajo · Walking',
      steps: [
        { title: 'No tienes que empezar en la fundamental', text: `Variar poniendo la 3ª o la 5ª como nota más grave en el tiempo 1 crea movimientos más melódicos. Ej.: Cmaj7 con E en el bajo = 1ª inversión.` },
        { title: '3ª en el bajo', description: 'Línea de walking con la 3ª de cada acorde en el tiempo 1.' },
        { title: '5ª en el bajo', description: 'Línea de walking con la 5ª en el tiempo 1.' },
        { title: 'Mezclando posiciones', description: 'Variando entre fundamental, 3ª y 5ª en el tiempo 1.' },
      ],
    },
  },
  'walking-bass-doubletime': {
    pt: {
      title: 'Densidade & Pausas',
      summary: 'Duas ferramentas opostas: linhas mais densas e silêncios estratégicos.',
      tag: 'Baixo · Walking',
      steps: [
        { title: 'Mais movimento ou mais espaço', text: `Quando você já tem o pulso de quatro semínimas por compasso, pode esculpir a linha em duas direções opostas. <strong>Mais densa</strong> — encha cada tempo com notas do acorde e de aproximação para o baixo nunca parar. <strong>Mais esparsa</strong> — deixe um tempo em pausa para a harmonia respirar. As duas moldam o fraseado; você escolhe conforme a seção.` },
        { title: 'Walking denso', description: 'Linha cheia de notas de acorde e de escala — cada tempo cai em uma nota com função clara.' },
        { title: 'Walking com pausa no tempo 2', description: 'O tempo 2 de cada compasso é silencioso — a linha respira, e os tempos 1, 3 e 4 ganham peso.' },
        { title: 'Walking com pausa no tempo 4', description: 'Silêncio no tempo 4 deixa um espaço antes da mudança de acorde — um truque de fraseado bem comum.' },
      ],
    },
    es: {
      title: 'Densidad y Silencios',
      summary: 'Dos herramientas opuestas: líneas más densas y silencios estratégicos.',
      tag: 'Bajo · Walking',
      steps: [
        { title: 'Más movimiento o más espacio', text: `Cuando ya tienes el pulso de cuatro negras por compás, puedes esculpir la línea en dos direcciones opuestas. <strong>Más densa</strong> — llena cada pulso con notas del acorde y de aproximación para que el bajo no pare. <strong>Más espaciada</strong> — deja un pulso en silencio para que la armonía respire. Las dos moldean el fraseo; eliges según la sección.` },
        { title: 'Walking denso', description: 'Una línea cargada de notas del acorde y de la escala — cada pulso cae en una nota con función clara.' },
        { title: 'Walking con silencio en el pulso 2', description: 'El pulso 2 de cada compás queda silencioso — la línea respira, y los pulsos 1, 3 y 4 ganan peso.' },
        { title: 'Walking con silencio en el pulso 4', description: 'Silencio en el pulso 4 deja un espacio antes de cada cambio — un truco de fraseo muy usado.' },
      ],
    },
  },
  'walking-bass-triplets': {
    pt: {
      title: 'Padrões de Boogie',
      summary: 'O baixo boogie-shuffle: um padrão repetido sobre notas do acorde que define o estilo.',
      tag: 'Baixo · Walking',
      steps: [
        { title: 'Um padrão, não um walking', text: `O boogie e o blues shuffled se apoiam em um <strong>padrão repetido sobre notas do acorde</strong>, e não em um walking improvisado. A figura clássica em cada acorde é <strong>1 – 3 – 5 – 6 – ♭7 – 6 – 5 – 3</strong> — sobe pelo acorde, toca as cores 6 e ♭7, e volta. Mude a figura inteira para a fundamental de cada acorde.` },
        { title: 'Nota de conexão no tempo 4', description: 'Os tempos 1–3 desenham o acorde; o tempo 4 é uma passagem cromática que leva à fundamental do próximo acorde.' },
        { title: 'Padrão de baixo boogie', description: 'A figura clássica do boogie em cada acorde: fundamental, 3ª, 5ª, 6ª, ♭7, 6ª, 5ª, 3ª.' },
      ],
    },
    es: {
      title: 'Patrones de Boogie',
      summary: 'El bajo boogie-shuffle: un patrón repetido sobre notas del acorde que define el estilo.',
      tag: 'Bajo · Walking',
      steps: [
        { title: 'Un patrón, no un walking', text: `El boogie y el blues shuffled se apoyan en un <strong>patrón repetido sobre notas del acorde</strong>, y no en un walking improvisado. La figura clásica por acorde es <strong>1 – 3 – 5 – 6 – ♭7 – 6 – 5 – 3</strong> — sube por el acorde, toca los colores 6 y ♭7, y vuelve. Mueve la figura entera a la fundamental de cada acorde.` },
        { title: 'Nota de conexión en el pulso 4', description: 'Los pulsos 1–3 dibujan el acorde; el pulso 4 es un paso cromático que lleva a la fundamental del próximo acorde.' },
        { title: 'Patrón de bajo boogie', description: 'La figura clásica del boogie en cada acorde: fundamental, 3ª, 5ª, 6ª, ♭7, 6ª, 5ª, 3ª.' },
      ],
    },
  },
  'walking-bass-blues': {
    pt: {
      title: 'Walking no blues de 12 compassos',
      summary: 'Um chorus inteiro de walking bass sobre o blues. Som de noite de sábado.',
      tag: 'Baixo · Walking',
      steps: [
        { title: 'Juntando tudo', text: `Toda a forma do blues de 12 compassos coberta por walking bass: I (4 compassos), IV (2), I (2), V (1), IV (1), I + turnaround (2). Use tudo que aprendeu: fundamentais, 3as, 5as, aproximação cromática.` },
        { title: 'Compassos 1-4 (acorde I)', description: 'Os primeiros 4 compassos sobre o I.' },
        { title: 'Compassos 5-8 (IV → I)', description: 'A mudança do IV de volta para o I.' },
        { title: 'Compassos 9-12 (V IV I V — turnaround)', description: 'O final com a turnaround.' },
      ],
    },
    es: {
      title: 'Walking en el blues de 12 compases',
      summary: 'Un chorus entero de walking bass sobre el blues. Sonido de sábado por la noche.',
      tag: 'Bajo · Walking',
      steps: [
        { title: 'Juntándolo todo', text: `Toda la forma del blues de 12 compases cubierta por walking bass: I (4 compases), IV (2), I (2), V (1), IV (1), I + turnaround (2). Usa todo lo aprendido: fundamentales, 3as, 5as, aproximación cromática.` },
        { title: 'Compases 1-4 (acorde I)', description: 'Los primeros 4 compases sobre el I.' },
        { title: 'Compases 5-8 (IV → I)', description: 'El cambio del IV de vuelta al I.' },
        { title: 'Compases 9-12 (V IV I V — turnaround)', description: 'El final con el turnaround.' },
      ],
    },
  },
  'walking-bass-iivi': {
    pt: {
      title: 'Walking ii–V–I (Jazz)',
      summary: 'A progressão de baixo mais tocada do jazz. Domine isso e você toca em qualquer jam.',
      tag: 'Baixo · Walking',
      steps: [
        { title: 'A cadência jazz central', text: `Walking sobre ii–V–I em Dó: Dm7 – G7 – Cmaj7. Cada compasso tem 4 notas — domine os padrões de aproximação para chegar nas mudanças.` },
        { title: 'Walking básico ii–V–I', description: 'A versão simples — fundamentais e graus conjuntos.' },
        { title: 'Com preenchimentos em colcheias', description: 'O mesmo walking ii–V–I em colcheias — oito notas por compasso em vez de quatro. Pura propulsão.' },
        { title: 'Com substituições', description: 'Trocas harmônicas: usando o trítono ou aproximações elaboradas.' },
      ],
    },
    es: {
      title: 'Walking ii–V–I (Jazz)',
      summary: 'La progresión de bajo más tocada del jazz. Domínala y tocas en cualquier jam.',
      tag: 'Bajo · Walking',
      steps: [
        { title: 'La cadencia jazz central', text: `Walking sobre ii–V–I en Do: Dm7 – G7 – Cmaj7. Cada compás tiene 4 notas — domina los patrones de aproximación para llegar a los cambios.` },
        { title: 'Walking básico ii–V–I', description: 'La versión simple — fundamentales y grados conjuntos.' },
        { title: 'Con rellenos en corcheas', description: 'El mismo walking ii–V–I en corcheas — ocho notas por compás en vez de cuatro. Pura propulsión.' },
        { title: 'Con sustituciones', description: 'Trueques armónicos: usando el tritono o aproximaciones elaboradas.' },
      ],
    },
  },
  'reading-rhythms': {
    pt: {
      title: 'Semínimas, colcheias e pausas',
      summary: 'Três primitivas rítmicas — um tempo, meio tempo e silêncio.',
      tag: 'Leitura',
      steps: [
        { title: 'Tempo a tempo', text: `Uma <strong>semínima</strong> vale um tempo — em 4/4, quatro delas preenchem o compasso. Uma <strong>colcheia</strong> vale meio tempo, ou seja, duas cabem em um tempo. Uma <strong>pausa de semínima</strong> é um tempo em silêncio. Juntar essas três primitivas é a forma mais simples do ritmo ganhar caráter: onde você coloca o silêncio ou uma nota mais rápida é tão expressivo quanto onde coloca o som.` },
        { title: 'Semínimas constantes', description: 'Uma nota em cada tempo. Sinta o pulso constante.' },
        { title: 'Pausa no tempo 3', description: 'O terceiro tempo é silencioso. Repare como a pausa muda o fraseado.' },
        { title: 'Adicionando colcheias', description: 'Cada segundo tempo é dividido em duas colcheias — o dobro da velocidade. Sinta o balanço da subdivisão.' },
      ],
    },
    es: {
      title: 'Negras, corcheas y silencios',
      summary: 'Tres primitivas rítmicas — un pulso, medio pulso y silencio.',
      tag: 'Lectura',
      steps: [
        { title: 'Pulso a pulso', text: `Una <strong>negra</strong> vale un pulso — en 4/4, cuatro de ellas llenan un compás. Una <strong>corchea</strong> vale medio pulso, así que dos caben en un pulso. Un <strong>silencio de negra</strong> es un pulso en silencio. Juntar estas tres primitivas es la forma más simple de que el ritmo gane carácter: dónde colocas el silencio o una nota más rápida es tan expresivo como dónde colocas el sonido.` },
        { title: 'Negras constantes', description: 'Una nota en cada pulso. Siente el pulso constante.' },
        { title: 'Silencio en el pulso 3', description: 'El tercer pulso queda en silencio. Mira cómo el silencio cambia el fraseo.' },
        { title: 'Añadiendo corcheas', description: 'Cada segundo pulso se divide en dos corcheas — el doble de velocidad. Siente el balanceo de la subdivisión.' },
      ],
    },
  },
  'duets': {
    pt: {
      title: 'Duo a duas vozes — básico',
      summary: 'Ouça como duas melodias se movem juntas. Os padrões mais simples de contraponto.',
      tag: 'Duos · Contraponto',
      steps: [
        { title: 'Duas vozes, dois caminhos', text: `Quando duas melodias soam ao mesmo tempo, elas podem se mover em paralelo (na mesma direção), em contrário (em direções opostas) ou em pergunta-resposta. Cada combinação cria uma textura diferente.` },
        { title: 'Terças paralelas', description: 'As duas vozes a uma 3ª de distância, sempre na mesma direção.' },
        { title: 'Movimento contrário', description: 'Uma voz sobe enquanto a outra desce.' },
        { title: 'Pergunta & resposta', description: 'Uma voz "pergunta", a outra "responde".' },
        { title: 'Voz superior sozinha', description: 'A linha de cima isolada.' },
        { title: 'Voz inferior sozinha', description: 'A linha de baixo isolada.' },
      ],
    },
    es: {
      title: 'Dúo a dos voces — básico',
      summary: 'Escucha cómo dos melodías se mueven juntas. Los patrones más simples de contrapunto.',
      tag: 'Dúos · Contrapunto',
      steps: [
        { title: 'Dos voces, dos caminos', text: `Cuando dos melodías suenan a la vez, pueden moverse en paralelo (en la misma dirección), en contrario (en direcciones opuestas) o en pregunta-respuesta. Cada combinación crea una textura distinta.` },
        { title: 'Terceras paralelas', description: 'Las dos voces a una 3ª de distancia, siempre en la misma dirección.' },
        { title: 'Movimiento contrario', description: 'Una voz sube mientras la otra baja.' },
        { title: 'Pregunta y respuesta', description: 'Una voz "pregunta", la otra "responde".' },
        { title: 'Voz superior sola', description: 'La línea de arriba aislada.' },
        { title: 'Voz inferior sola', description: 'La línea de abajo aislada.' },
      ],
    },
  },
  'challenge-mixed': {
    pt: {
      title: 'Desafio final',
      summary: 'Tudo junto: cor de escala, voicing, ritmo e um pouco de baixo.',
      tag: 'Desafio · Final',
      steps: [
        { title: 'Escala + arpejo', description: 'Identifique a escala e o arpejo usados.' },
        { title: 'Mudança de acorde com notas de passagem', description: 'Identifique a progressão e as notas de passagem.' },
        { title: 'Acorde sobre baixo caminhando', description: 'Quatro voicings de Dó maior com a nota grave subindo de grau em grau — o acorde fica, o baixo caminha.' },
      ],
    },
    es: {
      title: 'Reto final',
      summary: 'Todo junto: color de escala, voicing, ritmo y un poco de bajo.',
      tag: 'Reto · Final',
      steps: [
        { title: 'Escala + arpegio', description: 'Identifica la escala y el arpegio usados.' },
        { title: 'Cambio de acorde con notas de paso', description: 'Identifica la progresión y las notas de paso.' },
        { title: 'Acorde sobre bajo que camina', description: 'Cuatro voicings de Do mayor con la nota grave subiendo por grados — el acorde se mantiene, el bajo camina.' },
      ],
    },
  },
};

// Look up a localized module field. Falls back to the English source field
// when no translation exists for the current language.
export function getModuleField(mod, field) {
  const lang = getLang();
  if (lang === 'en') return mod[field];
  return TR[mod.id]?.[lang]?.[field] ?? mod[field];
}

// Look up a localized step field by step index.
export function getStepField(mod, stepIdx, field) {
  const en = mod.steps[stepIdx]?.[field];
  const lang = getLang();
  if (lang === 'en') return en;
  return TR[mod.id]?.[lang]?.steps?.[stepIdx]?.[field] ?? en;
}

// Look up a step array field (references) with the same fallback logic.
export function getStepArray(mod, stepIdx, field) {
  const en = mod.steps[stepIdx]?.[field];
  const lang = getLang();
  if (lang === 'en') return en;
  const tr = TR[mod.id]?.[lang]?.steps?.[stepIdx]?.[field];
  return Array.isArray(tr) ? tr : en;
}
