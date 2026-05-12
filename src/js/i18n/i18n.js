/* ---- i18n ---- */

const STORAGE_KEY = 'seedsong-lang';
const SUPPORTED = ['en', 'pt', 'es'];
const DEFAULT_LANG = 'en';

const TRANSLATIONS = {
  en: {
    'sidebar.generator': 'Generator',
    'sidebar.explore': 'Explore',
    'sidebar.compose': 'Compose',
    'sidebar.learn': 'Learn',
    'sidebar.settings': 'Settings',
    'sidebar.badge.new': 'New',
    'sidebar.badge.beta': 'Beta',
    'tagline': 'Infinite piano melodies from a single seed number.',

    'compose.title': 'Compose',
    'compose.sub': 'Arrange sections into a full song. Each block has its own seed and parameters.',
    'compose.play': 'Play composition',
    'compose.stop': 'Stop',
    'compose.add': 'Add section',
    'compose.clear': 'Clear',
    'compose.export_stems': 'Export stems',
    'compose.empty': 'No sections yet — tap + Add section to start arranging.',
    'compose.coming_next': "What's coming next",

    'explore.title': 'Explore',
    'explore.sub': "Swipe through procedural seeds. Like what you love. We'll learn your taste.",
    'explore.liked': 'liked',
    'explore.skipped': 'skipped',
    'explore.wrapped': 'Your Wrapped',
    'explore.hint': 'skip · save · like · play',
    'explore.wrapped_title': 'Your SeedSong Wrapped',
    'explore.share': 'Share',
    'explore.download': 'Download',

    'learn.title': 'Learn',
    'learn.sub': 'Bite-sized music theory grounded in procedural examples you can hear instantly.',
    'learn.continue': 'Continue where you left off',
    'learn.resume': 'Resume',
    'learn.streak': 'day streak',
    'learn.best': 'best',
    'learn.progress': 'Progress',
    'learn.tap_open': 'Tap to open',
    'learn.completed': '✓ Completed',
    'learn.replay': 'Replay →',
    'learn.open': 'Open →',
    'learn.coming_next': "What's coming next",
    'learn.map_btn': 'Lesson map',
    'learn.map_title': 'Lesson map',
    'learn.map_hint': 'Browse modules by group. Click any node to jump in.',

    'exercise.key': 'Key',
    'exercise.octave': 'Octave',
    'exercise.clef': 'Clef',
    'exercise.tempo': 'Tempo',
    'exercise.skip': 'Skip',
    'exercise.back': '← Back',
    'exercise.next': 'Next →',
    'exercise.finish': '✓ Finish',
    'exercise.next_module': 'Done · Next module →',
    'exercise.done': 'Mark done →',
    'exercise.done_already': '✓ Already done — Next →',
    'exercise.record': 'Record',
    'exercise.stop': 'Stop',
    'exercise.you_play': "You're playing",
    'exercise.target': 'Target',
    'exercise.listening': 'listening…',
    'exercise.hold': 'Hold…',
    'exercise.matched': '✓ matched',
    'exercise.nailed': 'Nailed it 🎉',
    'exercise.record_hint': "Tap record to play along live, or capture your attempt — we'll save it locally.",

    'settings.title': 'Settings',
    'settings.sub': 'Personalise SeedSong. Everything is stored locally on your device.',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.theme.dark': 'Dark',
    'settings.theme.light': 'Light',
    'settings.data': 'Your data',
    'settings.data_desc': 'Download everything we keep on this browser (history, projects, learning progress, preferences) as a JSON backup.',
    'settings.download': 'Download my data',
    'settings.danger': 'Danger zone',
    'settings.reset': 'Reset all SeedSong data',
    'settings.reset_desc': 'Wipes saved melodies, compose projects, learning progress and preferences. This cannot be undone.',
  },
  pt: {
    'sidebar.generator': 'Gerador',
    'sidebar.explore': 'Explorar',
    'sidebar.compose': 'Compor',
    'sidebar.learn': 'Aprender',
    'sidebar.settings': 'Configurações',
    'sidebar.badge.new': 'Novo',
    'sidebar.badge.beta': 'Beta',
    'tagline': 'Melodias infinitas de piano a partir de um único número-semente.',

    'compose.title': 'Compor',
    'compose.sub': 'Organize seções em uma música completa. Cada bloco tem sua própria semente e parâmetros.',
    'compose.play': 'Tocar composição',
    'compose.stop': 'Parar',
    'compose.add': 'Adicionar seção',
    'compose.clear': 'Limpar',
    'compose.export_stems': 'Exportar stems',
    'compose.empty': 'Nenhuma seção ainda — toque em + Adicionar seção para começar.',
    'compose.coming_next': 'Em breve',

    'explore.title': 'Explorar',
    'explore.sub': 'Deslize por sementes procedurais. Curta o que gostar. Vamos aprender seu gosto.',
    'explore.liked': 'curtidas',
    'explore.skipped': 'puladas',
    'explore.wrapped': 'Seu Wrapped',
    'explore.hint': 'pular · salvar · curtir · tocar',
    'explore.wrapped_title': 'Seu SeedSong Wrapped',
    'explore.share': 'Compartilhar',
    'explore.download': 'Baixar',

    'learn.title': 'Aprender',
    'learn.sub': 'Teoria musical em pílulas, com exemplos procedurais que você pode ouvir na hora.',
    'learn.continue': 'Continuar de onde parou',
    'learn.resume': 'Continuar',
    'learn.streak': 'dia(s) seguidos',
    'learn.best': 'recorde',
    'learn.progress': 'Progresso',
    'learn.tap_open': 'Toque para abrir',
    'learn.completed': '✓ Concluído',
    'learn.replay': 'Repetir →',
    'learn.open': 'Abrir →',
    'learn.coming_next': 'Em breve',
    'learn.map_btn': 'Mapa de lições',
    'learn.map_title': 'Mapa de lições',
    'learn.map_hint': 'Navegue pelos módulos por grupo. Clique em qualquer item para entrar.',

    'exercise.key': 'Tom',
    'exercise.octave': 'Oitava',
    'exercise.clef': 'Clave',
    'exercise.tempo': 'Tempo',
    'exercise.skip': 'Pular',
    'exercise.back': '← Voltar',
    'exercise.next': 'Próximo →',
    'exercise.finish': '✓ Finalizar',
    'exercise.next_module': 'Feito · Próximo módulo →',
    'exercise.done': 'Marcar como feito →',
    'exercise.done_already': '✓ Já feito — Próximo →',
    'exercise.record': 'Gravar',
    'exercise.stop': 'Parar',
    'exercise.you_play': 'Você está tocando',
    'exercise.target': 'Alvo',
    'exercise.listening': 'ouvindo…',
    'exercise.hold': 'Segura…',
    'exercise.matched': '✓ acertou',
    'exercise.nailed': 'Mandou bem 🎉',
    'exercise.record_hint': 'Toque em gravar para tocar junto ao vivo, ou registre sua tentativa — vamos salvar localmente.',

    'settings.title': 'Configurações',
    'settings.sub': 'Personalize o SeedSong. Tudo fica salvo localmente no seu dispositivo.',
    'settings.language': 'Idioma',
    'settings.theme': 'Tema',
    'settings.theme.dark': 'Escuro',
    'settings.theme.light': 'Claro',
    'settings.data': 'Seus dados',
    'settings.data_desc': 'Baixe tudo o que guardamos neste navegador (histórico, projetos, progresso e preferências) como um backup JSON.',
    'settings.download': 'Baixar meus dados',
    'settings.danger': 'Zona de perigo',
    'settings.reset': 'Apagar todos os dados do SeedSong',
    'settings.reset_desc': 'Limpa melodias salvas, projetos de composição, progresso de aprendizagem e preferências. Não pode ser desfeito.',
  },
  es: {
    'sidebar.generator': 'Generador',
    'sidebar.explore': 'Explorar',
    'sidebar.compose': 'Componer',
    'sidebar.learn': 'Aprender',
    'sidebar.settings': 'Ajustes',
    'sidebar.badge.new': 'Nuevo',
    'sidebar.badge.beta': 'Beta',
    'tagline': 'Melodías de piano infinitas a partir de un único número-semilla.',

    'compose.title': 'Componer',
    'compose.sub': 'Organiza secciones en una canción completa. Cada bloque tiene su propia semilla y parámetros.',
    'compose.play': 'Tocar composición',
    'compose.stop': 'Detener',
    'compose.add': 'Agregar sección',
    'compose.clear': 'Limpiar',
    'compose.export_stems': 'Exportar stems',
    'compose.empty': 'Aún no hay secciones — toca + Agregar sección para empezar.',
    'compose.coming_next': 'Próximamente',

    'explore.title': 'Explorar',
    'explore.sub': 'Desliza por semillas procedurales. Marca las que te gusten. Aprenderemos tu gusto.',
    'explore.liked': 'me gusta',
    'explore.skipped': 'omitidas',
    'explore.wrapped': 'Tu Wrapped',
    'explore.hint': 'saltar · guardar · me gusta · tocar',
    'explore.wrapped_title': 'Tu SeedSong Wrapped',
    'explore.share': 'Compartir',
    'explore.download': 'Descargar',

    'learn.title': 'Aprender',
    'learn.sub': 'Teoría musical en píldoras con ejemplos procedurales que puedes oír al instante.',
    'learn.continue': 'Continúa donde lo dejaste',
    'learn.resume': 'Continuar',
    'learn.streak': 'día(s) seguidos',
    'learn.best': 'récord',
    'learn.progress': 'Progreso',
    'learn.tap_open': 'Toca para abrir',
    'learn.completed': '✓ Completado',
    'learn.replay': 'Repetir →',
    'learn.open': 'Abrir →',
    'learn.coming_next': 'Próximamente',
    'learn.map_btn': 'Mapa de lecciones',
    'learn.map_title': 'Mapa de lecciones',
    'learn.map_hint': 'Navega los módulos por grupo. Toca cualquier nodo para entrar.',

    'exercise.key': 'Tono',
    'exercise.octave': 'Octava',
    'exercise.clef': 'Clave',
    'exercise.tempo': 'Tempo',
    'exercise.skip': 'Saltar',
    'exercise.back': '← Atrás',
    'exercise.next': 'Siguiente →',
    'exercise.finish': '✓ Finalizar',
    'exercise.next_module': 'Hecho · Siguiente módulo →',
    'exercise.done': 'Marcar hecho →',
    'exercise.done_already': '✓ Ya hecho — Siguiente →',
    'exercise.record': 'Grabar',
    'exercise.stop': 'Parar',
    'exercise.you_play': 'Estás tocando',
    'exercise.target': 'Objetivo',
    'exercise.listening': 'escuchando…',
    'exercise.hold': 'Sostén…',
    'exercise.matched': '✓ ¡bien!',
    'exercise.nailed': '¡Lo lograste! 🎉',
    'exercise.record_hint': 'Toca grabar para tocar en vivo o capturar tu intento — lo guardamos localmente.',

    'settings.title': 'Ajustes',
    'settings.sub': 'Personaliza SeedSong. Todo se guarda localmente en tu dispositivo.',
    'settings.language': 'Idioma',
    'settings.theme': 'Tema',
    'settings.theme.dark': 'Oscuro',
    'settings.theme.light': 'Claro',
    'settings.data': 'Tus datos',
    'settings.data_desc': 'Descarga todo lo que guardamos en este navegador (historial, proyectos, progreso y preferencias) como respaldo JSON.',
    'settings.download': 'Descargar mis datos',
    'settings.danger': 'Zona de peligro',
    'settings.reset': 'Borrar todos los datos de SeedSong',
    'settings.reset_desc': 'Borra melodías guardadas, proyectos de composición, progreso y preferencias. No se puede deshacer.',
  },
};

let currentLang = DEFAULT_LANG;
const listeners = [];

function detectInitial() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
  } catch {}
  const nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
  for (const code of SUPPORTED) {
    if (nav.startsWith(code)) return code;
  }
  return DEFAULT_LANG;
}

export function initI18n() {
  currentLang = detectInitial();
  document.documentElement.lang = currentLang;
  applyAll();
}

export function getLang() { return currentLang; }
export function getSupportedLanguages() { return SUPPORTED.slice(); }

export function setLang(lang) {
  if (!SUPPORTED.includes(lang) || lang === currentLang) return;
  currentLang = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
  document.documentElement.lang = lang;
  applyAll();
  for (const cb of listeners) cb(lang);
}

export function onLangChange(cb) { listeners.push(cb); }

export function t(key, fallback) {
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  if (dict[key] != null) return dict[key];
  if (TRANSLATIONS.en[key] != null) return TRANSLATIONS.en[key];
  return fallback != null ? fallback : key;
}

export function applyAll() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-attr]').forEach(el => {
    // format: "title:settings.title;aria-label:settings.title"
    const spec = el.getAttribute('data-i18n-attr');
    if (!spec) return;
    for (const pair of spec.split(';')) {
      const [attr, key] = pair.split(':').map(s => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  });
}
