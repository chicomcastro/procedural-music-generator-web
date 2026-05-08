// Curriculum data — modules grouped, each with multiple steps.
// Step types: 'theory' (text only) or 'exercise' (sheet + audio).

export const MODULES = [
  // ================= SCALES =================
  {
    id: 'major-scale',
    group: 'Scales',
    tag: 'Theory · Scales',
    title: 'The Major Scale',
    summary: 'Build, hear and recognise the major scale family.',
    steps: [
      {
        type: 'theory',
        title: 'Pattern of whole and half steps',
        text: `The major scale is built from a fixed pattern of intervals: <strong>W-W-H-W-W-W-H</strong> (W = whole step / 2 semitones, H = half step / 1 semitone). Starting from C, every white key in order gives you C major: C D E F G A B C. The half steps fall between E–F and B–C. This pattern is what makes the scale sound bright and "resolved".`,
      },
      {
        type: 'exercise',
        title: 'Ascending',
        description: 'Hear the C major scale ascending, one note per beat.',
        notes: [60, 62, 64, 65, 67, 69, 71, 72],
        style: 'melody',
      },
      {
        type: 'exercise',
        title: 'Descending',
        description: 'The same scale played in reverse — feel how it resolves coming back to the tonic.',
        notes: [72, 71, 69, 67, 65, 64, 62, 60],
        style: 'melody',
      },
      {
        type: 'exercise',
        title: 'With rhythm',
        description: 'Major scale fragment with a quarter–eighth–eighth feel. Notice how rhythm reshapes a familiar scale.',
        notes: [60, 64, 67, 64, 65, 69, 67, 72],
        style: 'melody',
      },
    ],
  },
  {
    id: 'natural-minor',
    group: 'Scales',
    tag: 'Theory · Scales',
    title: 'Natural Minor Scale',
    summary: 'The minor counterpart of major. Same notes as A minor played from A.',
    steps: [
      {
        type: 'theory',
        title: 'A minor and the relative key',
        text: `Natural minor uses the same notes as the major scale starting on the 6th degree. C major shares notes with A natural minor: A B C D E F G A. Its interval pattern is <strong>W-H-W-W-H-W-W</strong> — the half steps now fall between B–C and E–F. The lowered 3rd, 6th and 7th compared to major give it that darker, contemplative colour.`,
      },
      {
        type: 'exercise',
        title: 'Ascending in A',
        description: 'Climb A natural minor.',
        notes: [69, 71, 72, 74, 76, 77, 79, 81],
        style: 'melody',
      },
      {
        type: 'exercise',
        title: 'Descending in A',
        description: 'Same scale coming back down. Listen to the lowered 7th (G) instead of G♯.',
        notes: [81, 79, 77, 76, 74, 72, 71, 69],
        style: 'melody',
      },
    ],
  },
  {
    id: 'pentatonic-minor',
    group: 'Scales',
    tag: 'Theory · Scales',
    title: 'Pentatonic Minor',
    summary: 'Five-note scale. The backbone of blues, rock and pop solos.',
    steps: [
      {
        type: 'theory',
        title: 'Why five notes?',
        text: `Pentatonic minor is natural minor with the 2nd and 6th degrees removed: <strong>1 ♭3 4 5 ♭7</strong>. Removing those half steps eliminates the most "dissonant" intervals — every note sounds good against the others, which is why solos built on the pentatonic rarely clash. In A: A C D E G.`,
      },
      {
        type: 'exercise',
        title: 'Ascending',
        description: 'A minor pentatonic up.',
        notes: [69, 72, 74, 76, 79, 81],
        style: 'melody',
      },
      {
        type: 'exercise',
        title: 'Descending',
        description: 'The same on the way back.',
        notes: [81, 79, 76, 74, 72, 69],
        style: 'melody',
      },
      {
        type: 'exercise',
        title: 'Bluesy lick',
        description: 'Pentatonic minor used in a typical lick — short phrase that returns to the root.',
        notes: [76, 79, 81, 79, 76, 74, 72, 69],
        style: 'melody',
      },
    ],
  },
  {
    id: 'greek-modes',
    group: 'Scales',
    tag: 'Theory · Modes',
    title: 'Greek Modes',
    summary: 'Seven modes, one parent scale. Each one has its own colour.',
    steps: [
      {
        type: 'theory',
        title: 'Modes are starting points',
        text: `The seven Greek modes are obtained by playing the major scale starting from each of its degrees. Same notes, different tonic — and therefore a different feel. Ionian (1) is plain major; Aeolian (6) is natural minor. The four below are the most expressive non-diatonic colours.`,
      },
      {
        type: 'exercise',
        title: 'Dorian (D from C major)',
        description: 'Minor with a raised 6th. Jazzy and slightly hopeful.',
        notes: [62, 64, 65, 67, 69, 71, 72, 74],
        style: 'melody',
      },
      {
        type: 'exercise',
        title: 'Phrygian (E from C major)',
        description: 'Minor with a flat 2nd. Dark, Spanish/Middle-Eastern colour.',
        notes: [64, 65, 67, 69, 71, 72, 74, 76],
        style: 'melody',
      },
      {
        type: 'exercise',
        title: 'Lydian (F from C major)',
        description: 'Major with a raised 4th. Floating, dreamy quality.',
        notes: [65, 67, 69, 71, 72, 74, 76, 77],
        style: 'melody',
      },
      {
        type: 'exercise',
        title: 'Mixolydian (G from C major)',
        description: 'Major with a flat 7th. Dominant, bluesy.',
        notes: [67, 69, 71, 72, 74, 76, 77, 79],
        style: 'melody',
      },
    ],
  },
  // ============== CHALLENGE 1 ==============
  {
    id: 'challenge-scales',
    group: 'Challenges',
    tag: 'Challenge · Scales',
    title: 'Scales challenge',
    summary: 'Mix major, natural minor, pentatonic and modes. Identify the colour by ear.',
    steps: [
      {
        type: 'theory',
        title: 'The drill',
        text: `Three short licks below — each one comes from a different scale family covered earlier. Listen, then sing or play it back. By the third one your ear should already be identifying the mode without thinking.`,
      },
      {
        type: 'exercise',
        title: 'Mystery #1',
        description: 'Major or minor? Listen and play back.',
        notes: [60, 64, 67, 72, 67, 64, 60],
        style: 'melody',
      },
      {
        type: 'exercise',
        title: 'Mystery #2',
        description: 'A flavour of one of the modes.',
        notes: [62, 65, 67, 69, 65, 62, 64, 62],
        style: 'melody',
      },
      {
        type: 'exercise',
        title: 'Mystery #3',
        description: 'Pentatonic territory.',
        notes: [69, 76, 79, 76, 72, 74, 72, 69],
        style: 'melody',
      },
    ],
  },
  // ================= CHORDS =================
  {
    id: 'major-triad',
    group: 'Chords',
    tag: 'Theory · Chords',
    title: 'Major Triad & Inversions',
    summary: 'Root, 3rd, 5th — and the same chord stacked three different ways.',
    steps: [
      {
        type: 'theory',
        title: 'The three positions',
        text: `A triad is three notes: root, 3rd, 5th. Reorder them and you get the same chord with a different bottom note. <strong>Root position</strong>: 1-3-5. <strong>1st inversion</strong>: 3-5-1. <strong>2nd inversion</strong>: 5-1-3. The chord is still C major in all three — but the bass shifts the colour and the voice-leading possibilities.`,
      },
      {
        type: 'exercise',
        title: 'Root position — C E G',
        description: 'Bottom-up stacking: the root is in the bass.',
        notes: [60, 64, 67],
        style: 'chord',
      },
      {
        type: 'exercise',
        title: '1st inversion — E G C',
        description: 'Same chord with the 3rd in the bass. Sounds slightly less stable, often used as a passing voicing.',
        notes: [64, 67, 72],
        style: 'chord',
      },
      {
        type: 'exercise',
        title: '2nd inversion — G C E',
        description: '5th in the bass. Common as a cadential 6/4 chord before resolving.',
        notes: [67, 72, 76],
        style: 'chord',
      },
    ],
  },
  {
    id: 'minor-triad',
    group: 'Chords',
    tag: 'Theory · Chords',
    title: 'Minor Triad & Inversions',
    summary: 'Same idea, flatter 3rd. Darker mood.',
    steps: [
      {
        type: 'theory',
        title: 'Flatten the 3rd',
        text: `A minor triad lowers the major's 3rd by a semitone: <strong>1 ♭3 5</strong>. In A minor: A C E. The same three inversions (root / 1st / 2nd) apply. Stacking and rearranging unlocks rich voice-leading without changing the chord's identity.`,
      },
      {
        type: 'exercise',
        title: 'Root position — A C E',
        description: 'The "anchor" voicing.',
        notes: [69, 72, 76],
        style: 'chord',
      },
      {
        type: 'exercise',
        title: '1st inversion — C E A',
        description: '3rd in the bass.',
        notes: [72, 76, 81],
        style: 'chord',
      },
      {
        type: 'exercise',
        title: '2nd inversion — E A C',
        description: '5th in the bass.',
        notes: [76, 81, 84],
        style: 'chord',
      },
    ],
  },
  {
    id: 'arpeggios',
    group: 'Chords',
    tag: 'Theory · Arpeggios',
    title: 'Arpeggios',
    summary: 'A chord, but one note at a time. Bridge between chords and melody.',
    steps: [
      {
        type: 'theory',
        title: 'What is an arpeggio?',
        text: `Take any chord and play its notes one after another instead of together — that's an arpeggio. They're how melodies "imply" the harmony underneath. Singers use them to outline chord changes; bass lines walk through them.`,
      },
      {
        type: 'exercise',
        title: 'C major arpeggio (1-3-5-8)',
        description: 'Outline the major triad note-by-note up to the octave.',
        notes: [60, 64, 67, 72],
        style: 'melody',
      },
      {
        type: 'exercise',
        title: 'A minor arpeggio',
        description: 'Same shape, minor flavour.',
        notes: [69, 72, 76, 81],
        style: 'melody',
      },
      {
        type: 'exercise',
        title: 'C major 7 arpeggio',
        description: 'Add the major 7th (B) for a jazzy colour.',
        notes: [60, 64, 67, 71, 72],
        style: 'melody',
      },
    ],
  },
  // ============== CHALLENGE 2 ==============
  {
    id: 'challenge-chords',
    group: 'Challenges',
    tag: 'Challenge · Chords',
    title: 'Chords challenge',
    summary: 'Triads, inversions and arpeggios from previous modules — mixed.',
    steps: [
      {
        type: 'exercise',
        title: 'Voicing #1',
        description: 'Hear the chord — can you tell major or minor, and which inversion?',
        notes: [64, 67, 72],
        style: 'chord',
      },
      {
        type: 'exercise',
        title: 'Voicing #2',
        description: 'Another voicing. Notice the bass note.',
        notes: [76, 81, 84],
        style: 'chord',
      },
      {
        type: 'exercise',
        title: 'Arpeggio chain',
        description: 'Two arpeggios in a row — major then minor.',
        notes: [60, 64, 67, 72, 69, 72, 76, 81],
        style: 'melody',
      },
    ],
  },
  // ================= HARMONY =================
  {
    id: 'cadence-1546',
    group: 'Harmony',
    tag: 'Harmony · Progressions',
    title: 'I–V–vi–IV',
    summary: 'The most popular progression in modern pop. Instantly familiar.',
    steps: [
      {
        type: 'theory',
        title: 'Why is this everywhere?',
        text: `Each chord drops or lifts the harmonic tension by exactly the right amount: I (home) → V (suspense) → vi (twist into minor) → IV (gentle return). It works in countless pop songs because it never feels stuck and never feels rushed. In C major: C, G, Am, F.`,
      },
      {
        type: 'exercise',
        title: 'Hear the progression',
        description: 'Play and feel each chord land.',
        notes: [
          [60, 64, 67],
          [67, 71, 74],
          [69, 72, 76],
          [65, 69, 72],
        ],
        style: 'progression',
      },
    ],
  },
  // ================= BASS =================
  {
    id: 'walking-bass',
    group: 'Bass',
    tag: 'Bass · Walking',
    title: 'Walking Bass',
    summary: 'A line that connects chords by stepping through the scale on each beat.',
    steps: [
      {
        type: 'theory',
        title: 'The walking principle',
        text: `In a walking bass line each beat gets a note, and the line "walks" between chord roots using scale tones and chromatic passing notes. The basics: land on the chord's root on beat 1, use the 5th or another chord tone on beat 3, and fill beats 2 and 4 with scale steps that lead naturally to the next root.`,
      },
      {
        type: 'exercise',
        title: 'Simple root-walk in C',
        description: 'Quarter notes outlining I → V → I in C: roots and 5ths only.',
        notes: [48, 52, 55, 60, 67, 64, 60, 55],
        style: 'melody',
      },
      {
        type: 'exercise',
        title: 'Scale walk over I–IV–V–I',
        description: 'A short line over four chords — uses scale neighbours to land on each root.',
        notes: [48, 52, 55, 53, 53, 57, 60, 55, 55, 59, 60, 55, 48, 50, 52, 55],
        style: 'melody',
      },
    ],
  },
  // ================= READING =================
  {
    id: 'reading-rhythms',
    group: 'Reading',
    tag: 'Reading',
    title: 'Quarters, eighths and rests',
    summary: 'The smallest building blocks of rhythmic notation.',
    steps: [
      {
        type: 'theory',
        title: 'Pulses and subdivisions',
        text: `A <strong>quarter note</strong> takes one beat. An <strong>eighth note</strong> takes half a beat — two of them per beat. <strong>Rests</strong> are silent: a quarter rest is one silent beat, an eighth rest is half. Combining notes and rests is what gives rhythm its character.`,
      },
      {
        type: 'exercise',
        title: 'Steady quarters',
        description: 'Same note on every beat. Feel the steady pulse.',
        notes: [60, 60, 60, 60],
        style: 'melody',
      },
      {
        type: 'exercise',
        title: 'Adding eighths',
        description: 'Same pulse, faster subdivisions. The eighth notes ride the beats.',
        notes: [60, 60, 62, 64, 60, 64, 67],
        style: 'melody',
      },
    ],
  },
  // ================= DUETS =================
  {
    id: 'duets',
    group: 'Duets',
    tag: 'Duets · Counterpoint',
    title: 'Two-voice basics',
    summary: 'Hear how two melodies move together. The simplest counterpoint patterns.',
    steps: [
      {
        type: 'theory',
        title: 'Two voices, two paths',
        text: `When two melodies play simultaneously, the interesting question is how they relate. <strong>Parallel motion</strong> moves both voices the same way; <strong>contrary motion</strong> sends them in opposite directions; <strong>oblique motion</strong> keeps one voice still while the other moves. Mixing all three is the heart of counterpoint.`,
      },
      {
        type: 'exercise',
        title: 'Parallel thirds',
        description: 'Both voices ascend the C major scale, always a third apart.',
        notes: [
          [60, 64], [62, 65], [64, 67], [65, 69], [67, 71], [69, 72], [71, 74], [72, 76],
        ],
        style: 'progression',
      },
      {
        type: 'exercise',
        title: 'Contrary motion',
        description: 'One voice goes up while the other goes down — they meet and cross.',
        notes: [
          [60, 84], [62, 81], [64, 79], [65, 77], [67, 76], [69, 74], [71, 72], [72, 71],
        ],
        style: 'progression',
      },
    ],
  },
  // ============== FINAL CHALLENGE ==============
  {
    id: 'challenge-mixed',
    group: 'Challenges',
    tag: 'Challenge · Final',
    title: 'Final challenge',
    summary: 'Everything together: scale colour, voicing, rhythm and a hint of bass.',
    steps: [
      {
        type: 'exercise',
        title: 'Scale + arpeggio',
        description: 'A scale fragment that resolves into an arpeggio.',
        notes: [60, 62, 64, 65, 67, 64, 67, 72],
        style: 'melody',
      },
      {
        type: 'exercise',
        title: 'Chord change with passing notes',
        description: 'C → Am → F → G outlined with a melodic line.',
        notes: [60, 64, 65, 64, 69, 72, 69, 65, 60, 65, 65, 67, 67, 71, 72, 67],
        style: 'melody',
      },
      {
        type: 'exercise',
        title: 'Bass + chord finale',
        description: 'A short walking bass against a chord — your final piece.',
        notes: [
          [48, 60, 64, 67],
          [50, 60, 64, 67],
          [52, 60, 64, 67],
          [55, 60, 64, 67],
        ],
        style: 'progression',
      },
    ],
  },
];

export const GROUPS = ['Scales', 'Challenges', 'Chords', 'Harmony', 'Bass', 'Reading', 'Duets'];
