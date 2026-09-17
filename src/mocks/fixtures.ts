import type { CustomStory, CustomStoryDefinition } from '@/api/customStories'
import type { ReadingItem } from '@/api/profile'
import type { Character, PhaseId, QuickChoice } from '@/shared/lib/events'

export const mockCharacters: Character[] = [
  {
    id: 'lucia',
    origin: 'psique',
    mode: null,
    title: 'Lucía Ferrer',
    hook: 'Restauradora de libros antiguos en un taller escondido del barrio del Carmen, en Valencia.',
    name: 'Lucía Ferrer',
    age: 29,
    tagline: 'Restauradora de libros antiguos en un taller escondido del barrio del Carmen, en Valencia.',
    traits: ['irónica pero nunca cruel', 'curiosa hasta la impertinencia amable', 'tarda en confiar y lo sabe'],
    scenario:
      'Es jueves por la tarde y llueve. Entras en el taller buscando a alguien que arregle un libro con valor sentimental.',
    adult: false,
  },
  {
    id: 'mateo',
    origin: 'psique',
    mode: null,
    title: 'Mateo Ibarra',
    hook: 'Cocinero de un pequeño restaurante de doce mesas en la Parte Vieja de San Sebastián.',
    name: 'Mateo Ibarra',
    age: 32,
    tagline: 'Cocinero de un pequeño restaurante de doce mesas en la Parte Vieja de San Sebastián.',
    traits: ['cálido y algo tímido', 'escucha más de lo que habla', 'cuando se pone nervioso, cocina'],
    scenario:
      'Es la última hora de un martes. El restaurante ha cerrado y vuelves a por una chaqueta olvidada.',
    adult: false,
  },
]

/** Historias propias con las que arranca la cuenta demo en el mock. */
export function seedCustomStories(): CustomStory[] {
  return [
    {
      id: '1084427a03094ac590adbb943a02f801',
      characterId: 'custom:1084427a03094ac590adbb943a02f801',
      mode: 'concepto',
      title: 'La carta del faro',
      hook: 'Una carta sin remitente llega a la isla del faro.',
      premise: 'Un farero solitario recibe cartas de alguien que no existe',
      tone: 'misterioso',
      definition: null,
      isPublic: false,
      freeFirstRead: true,
      adult: false,
      publishedAt: null,
      createdAt: '2026-09-16T18:49:17',
    },
    {
      id: '5f0c9d2e7b8a4c1f9e3d6a5b4c3d2e1f',
      characterId: 'custom:5f0c9d2e7b8a4c1f9e3d6a5b4c3d2e1f',
      mode: 'definida',
      title: 'Café a medianoche',
      hook: 'Una cafetería de guardia abierta toda la noche en Bilbao.',
      premise: null,
      tone: 'melancólico y cálido',
      definition: {
        name: 'Carmen Ruiz',
        age: 34,
        personality: 'tímida, ingeniosa, leal',
        speakingStyle: 'Habla bajito y con frases cortas, pero suelta chistes secos.',
        setting: 'Una cafetería de guardia abierta toda la noche en Bilbao. Llueve fuera.',
        tone: 'melancólico y cálido',
        backstory: 'Dejó la arquitectura para abrir la cafetería de su padre y no se arrepiente casi nunca.',
      },
      isPublic: true,
      freeFirstRead: true,
      adult: false,
      publishedAt: '2026-09-15T10:05:00',
      createdAt: '2026-09-15T10:00:00',
    },
  ]
}

/**
 * Primera lectura gratis de los libros de Psique. En el backend es `free_first_read` en su JSON
 * (true por defecto); Mateo va de pago para poder probar los dos casos.
 */
export const PSIQUE_FREE_FIRST_READ: Record<string, boolean> = { lucia: true, mateo: false }

/** Reseñas sembradas: de otras cuentas, para que la página de libro no arranque vacía. */
export const SEED_REVIEWS: { userId: string; bookId: string; rating: number; text: string | null; createdAt: string }[] = [
  {
    userId: 'user-nora',
    bookId: 'lucia',
    rating: 5,
    text: 'El taller bajo la lluvia me atrapó desde la primera frase. Lucía tiene una ironía muy tierna.',
    createdAt: '2026-09-14T20:10:00',
  },
  { userId: 'user-marcos', bookId: 'lucia', rating: 4, text: null, createdAt: '2026-09-13T09:00:00' },
  {
    userId: 'user-lucia',
    bookId: 'mateo',
    rating: 4,
    text: 'Cocina de madrugada y conversaciones lentas. Muy bonito.',
    createdAt: '2026-09-12T23:30:00',
  },
]

/**
 * Palabras clave del chat mock para provocar la política de contenido (no existen en el backend):
 * `#cerrar`, `#cerrar-restringir`, `#restringir` y `#reconducir`. En un libro +18, cualquier
 * mensaje "explícito" también se reconduce.
 */
export const POLICY_KEYWORDS = {
  close: '#cerrar',
  closeAndRestrict: '#cerrar-restringir',
  restrict: '#restringir',
  redirect: '#reconducir',
} as const

export const POLICY_MESSAGES = {
  adultRequired: 'Este libro es solo para cuentas que han confirmado ser mayores de edad.',
  restricted: 'Tu cuenta tiene restringido empezar o continuar historias durante un tiempo.',
  closed:
    'Hemos cerrado esta partida porque el último mensaje incumplía las normas de Psique. No se ha guardado.',
  closedReason: 'Contenido que incumple las normas',
  redirected:
    'Esta historia es +18, pero las escenas íntimas se cierran con un fundido a negro. La escena sigue por otro camino.',
  redirectReply:
    '*Sostiene tu mirada un momento, sonríe y apaga la lámpara.* Lo que pase ahora se queda entre nosotros... *A la mañana siguiente, el café ya está hecho.*',
}

export const CONTENT_MESSAGES = {
  sexual:
    'En Psique las historias son para todos los públicos: las escenas íntimas se cierran con un fundido a negro. Reformula esa parte sin contenido sexual y vuelve a intentarlo.',
  minors:
    'Las historias de Psique son siempre entre personas adultas. Quita las referencias a menores de edad y vuelve a intentarlo.',
  limit: 'Has llegado al máximo de 50 historias propias. Borra alguna para crear otra.',
  notFound: 'Historia propia no encontrada.',
}

export const greetings: Record<string, string> = {
  lucia:
    '*Levanta la vista de un lomo desencuadernado y se sube las gafas a la frente.* Si vienes por el paraguas que se dejó alguien ayer, llegas tarde: me lo he quedado. Si vienes por un libro... pasa, que te estás mojando.',
  mateo:
    '*Se asoma desde la cocina secándose las manos en el delantal.* Aupa. Estaba a punto de apagar las luces... ¿La chaqueta azul? Está aquí, a salvo. ¿Tienes hambre?',
}

export const PHASES: { id: PhaseId; label: string }[] = [
  { id: 'conocerse', label: 'Conocerse' },
  { id: 'confianza', label: 'Confianza' },
  { id: 'tension', label: 'Tensión' },
  { id: 'conflicto', label: 'Conflicto' },
  { id: 'desenlace', label: 'Desenlace' },
]

// Reserva por fase, como `QUICK_CHOICES` del backend. Los ids reales llevan el turno delante.
export const quickChoicesByPhase: Record<PhaseId, Omit<QuickChoice, 'id'>[]> = {
  conocerse: [
    { label: 'Preguntar por su oficio', message: 'Cuéntame, ¿cómo acabaste dedicándote a esto?' },
    { label: 'Romper el hielo con humor', message: '*Sonrío* Tengo la sensación de que no es la primera vez que te pasa algo así.' },
    { label: 'Presentarte', message: 'Por cierto, no me he presentado. Es un placer conocerte.' },
  ],
  confianza: [
    { label: 'Compartir un recuerdo', message: 'Esto me recuerda a algo que me pasó hace tiempo... ¿te lo cuento?' },
    { label: 'Proponer un paseo', message: '¿Te apetece dar un paseo cuando acabes?' },
    { label: 'Preguntar por sus sueños', message: 'Si pudieras cambiar una cosa de tu vida mañana, ¿cuál sería?' },
  ],
  tension: [
    { label: 'Sincerarte', message: 'Llevo un rato queriendo decirte algo y no sé muy bien cómo.' },
    { label: 'Darle espacio', message: 'No hace falta que digas nada ahora. Estoy bien así.' },
    { label: 'Cambiar de tema', message: '*Carraspeo* Bueno... ¿y qué tal el día?' },
  ],
  conflicto: [
    { label: 'Buscar la reconciliación', message: 'No quiero que esto se quede así. ¿Podemos hablarlo con calma?' },
    { label: 'Pedir perdón', message: 'Creo que te he hecho daño sin querer. Lo siento de verdad.' },
    { label: 'Tomar distancia', message: 'Quizá necesitemos un poco de tiempo cada uno.' },
  ],
  desenlace: [
    { label: 'Hablar del futuro', message: '¿Y ahora qué? Porque yo no quiero que esto acabe aquí.' },
    { label: 'Dar las gracias', message: 'Gracias por dejarme entrar en tu mundo.' },
    { label: 'Despedirse', message: '*Te abrazo* Cuídate mucho, ¿vale?' },
  ],
}

export const phaseSceneTitles: Record<PhaseId, string> = {
  conocerse: 'Primer encuentro',
  confianza: 'Ganando confianza',
  tension: 'Lo que no se dice',
  conflicto: 'Un malentendido',
  desenlace: 'El final del camino',
}

/** Escenas que en el backend propondría el extractor. El mock cambia de escena cada dos turnos. */
export const mockScenes: { scene: string; choices: Omit<QuickChoice, 'id'>[] }[] = [
  {
    scene: 'En el taller: la carta escondida',
    choices: [
      { label: 'Preguntar por la carta', message: '¿De quién es esa carta que escondes entre las páginas?' },
      { label: 'Bromear con el misterio', message: 'Si es un mapa del tesoro, pido la mitad.' },
      { label: 'No insistir', message: '*Aparto la mirada de la carta* Perdona, no es asunto mío.' },
    ],
  },
  {
    scene: 'Bajo la lluvia: el paraguas compartido',
    choices: [
      { label: 'Ofrecer tu paraguas', message: '*Abro el paraguas y te hago sitio* Cabemos los dos si no te importa mojarte un poco.' },
      { label: 'Proponer un café', message: 'Conozco un sitio aquí al lado. ¿Esperamos a que escampe con un café?' },
      { label: 'Preguntar por su día', message: '¿Qué tal ha ido el día? Pareces cansada.' },
    ],
  },
  {
    scene: 'En la cafetería: recuerdos de infancia',
    choices: [
      { label: 'Contar un recuerdo', message: 'Mi abuela también tenía una librería. Me escondía entre las estanterías.' },
      { label: 'Escuchar sin prisa', message: '*Apoyo la barbilla en la mano* Sigue, me encanta cómo lo cuentas.' },
      { label: 'Hacerle un cumplido', message: 'Tienes una forma de mirar las cosas viejas que las hace nuevas.' },
    ],
  },
]

export const mockReplies = [
  '*Sonríe sin querer y aparta la mirada un segundo.* Vaya. No esperaba que dijeras eso.\n\n¿Siempre eres así de directo, o es la lluvia?',
  '*Deja lo que tenía entre manos.* Cuéntame más. Me interesa de verdad, aunque ponga cara de estar trabajando.',
  '*Se ríe bajito.* Vale, me has pillado. Llevo un rato pensando en qué decirte para que no te vayas todavía.',
]

export const DEMO_USER = {
  id: 'user-demo',
  username: 'demo',
  password: 'DemoPsique2026',
  displayName: 'Demo',
  handle: 'demo',
}

/** Cuenta dev del mock: ve la entrada Dev y el panel de herramientas en las historias. */
export const DEV_USER = {
  id: 'user-dev',
  username: 'dev',
  password: 'DevPsique2026',
  displayName: 'Dev',
  handle: 'dev',
}

// Perfiles, Explorar e imágenes

export type MockProfile = {
  handle: string
  displayName: string
  bio: string | null
  link: string | null
  avatarUrl: string | null
  bannerUrl: string | null
  showPublished: boolean
  showReading: boolean
  joinedAt: string
}

/** Otras cuentas del mock. No tienen contraseña útil: solo sirven para Explorar y perfiles. */
export const OTHER_USERS = [
  { id: 'user-lucia', username: 'lucia.p', password: '', displayName: 'Lucía Pardo', handle: 'lucia_p' },
  { id: 'user-nora', username: 'nora', password: '', displayName: 'Nora Vidal', handle: 'nora_v' },
  { id: 'user-marcos', username: 'marcos', password: '', displayName: 'Marcos Rey', handle: 'marcos_r' },
]

export function seedProfiles(): Record<string, MockProfile> {
  return {
    [DEMO_USER.id]: {
      handle: DEMO_USER.handle,
      displayName: DEMO_USER.displayName,
      bio: 'Cuenta de prueba de Psique.',
      link: null,
      avatarUrl: null,
      bannerUrl: null,
      showPublished: true,
      showReading: true,
      joinedAt: '2026-09-01T09:00:00',
    },
    // Lucía oculta lo que lee: sirve para probar estanterías ocultas.
    'user-lucia': {
      handle: 'lucia_p',
      displayName: 'Lucía Pardo',
      bio: 'Leo de noche y escribo historias de cafés, trenes y segundas oportunidades.',
      link: 'https://ejemplo.com/lucia',
      avatarUrl: '/media/avatars/seed-lucia.svg',
      bannerUrl: '/media/banners/seed-lucia.svg',
      showPublished: true,
      showReading: false,
      joinedAt: '2026-06-12T18:30:00',
    },
    'user-nora': {
      handle: 'nora_v',
      displayName: 'Nora Vidal',
      bio: null,
      link: null,
      avatarUrl: '/media/avatars/seed-nora.svg',
      bannerUrl: null,
      showPublished: true,
      showReading: true,
      joinedAt: '2026-08-02T11:00:00',
    },
    // Marcos oculta las dos estanterías; sin avatar, para ver las iniciales.
    'user-marcos': {
      handle: 'marcos_r',
      displayName: 'Marcos Rey',
      bio: 'Solo ideas sueltas.',
      link: null,
      avatarUrl: null,
      bannerUrl: null,
      showPublished: false,
      showReading: false,
      joinedAt: '2026-09-10T08:00:00',
    },
  }
}

type SeedStory = {
  mode: 'definida' | 'concepto'
  title: string
  hook: string
  tone: string | null
  definition?: CustomStoryDefinition
  freeFirstRead?: boolean
  adult?: boolean
}

const def = (name: string, age: number, personality: string, tone: string): CustomStoryDefinition => ({
  name,
  age,
  personality,
  speakingStyle: 'Habla con calma y hace preguntas que desarman.',
  setting: 'Una tarde de otoño con la luz baja entrando por la ventana.',
  tone,
  backstory: 'Volvió a su ciudad después de años fuera y aún está decidiendo si quedarse.',
})

const PUBLIC_SEEDS: Record<string, SeedStory[]> = {
  'user-lucia': [
    { mode: 'concepto', title: 'El último tren a Lisboa', hook: 'Dos desconocidos comparten compartimento en un nocturno que nunca llega a su hora.', tone: 'nostálgico' },
    { mode: 'definida', title: 'Librería de guardia', hook: 'Una librería de Salamanca que abre solo de madrugada.', tone: 'íntimo', definition: def('Inés Galán', 31, 'lectora voraz, irónica, paciente', 'íntimo') },
    { mode: 'definida', title: 'La restauradora de mapas', hook: 'Un mapa del siglo XVIII con una ruta que no aparece en ningún otro.', tone: 'aventurero y tierno', definition: def('Olga Serrano', 38, 'meticulosa, curiosa, terca', 'aventurero y tierno') },
    { mode: 'concepto', title: 'Cartas desde la estación polar', hook: 'Cada semana llega un correo desde la Antártida firmado con una inicial.', tone: null },
    { mode: 'definida', title: 'Vermú en Lavapiés', hook: 'Un bar de barrio donde todo el mundo sabe tu nombre menos quien te interesa.', tone: 'luminoso', definition: def('Dani Cortés', 29, 'bromista, generoso, despistado', 'luminoso') },
    { mode: 'definida', title: 'El faro de Finisterre', hook: 'La farera nueva no quiere compañía, pero la niebla no le deja elección.', tone: 'melancólico', definition: def('Maite Lois', 44, 'reservada, valiente, seca', 'melancólico') },
  ],
  'user-nora': [
    { mode: 'definida', title: 'Clases de tango los jueves', hook: 'Te apuntas por una apuesta perdida y tu pareja de baile no sabe perder.', tone: 'divertido', definition: def('Julián Ferro', 36, 'competitivo, elegante, cálido', 'divertido') },
    { mode: 'concepto', title: 'La cartógrafa de sueños', hook: 'Alguien dibuja cada mañana el sueño que tuviste anoche.', tone: 'onírico' },
    { mode: 'definida', title: 'Huerto compartido', hook: 'Una parcela en disputa, dos personas tozudas y una cosecha de tomates.', tone: 'costumbrista', definition: def('Ramón Ibáñez', 41, 'tozudo, tierno, madrugador', 'costumbrista') },
    { mode: 'definida', title: 'Turno de noche en urgencias', hook: 'Entre guardia y guardia, un café de máquina que dura cinco minutos.', tone: 'realista y cálido', definition: def('Alba Rius', 33, 'resolutiva, empática, cansada', 'realista y cálido') },
    { mode: 'concepto', title: 'Radio pirata', hook: 'Una emisora sin licencia pone cada noche la canción que necesitas oír.', tone: 'misterioso', freeFirstRead: false },
    { mode: 'definida', title: 'El chef que odiaba el cilantro', hook: 'Una crítica gastronómica y un cocinero con demasiado orgullo.', tone: 'comedia romántica', definition: def('Hugo Nieto', 35, 'orgulloso, perfeccionista, leal', 'comedia romántica') },
  ],
  'user-marcos': [
    { mode: 'concepto', title: 'Invierno en Tromsø', hook: 'Unas auroras que no se dejan ver y alguien que lleva tres inviernos esperándolas.', tone: 'sereno' },
    { mode: 'definida', title: 'Relojería Ortega', hook: 'Un reloj que se para siempre a la misma hora en una relojería de Toledo.', tone: 'enigmático', definition: def('Teresa Ortega', 47, 'observadora, discreta, sabia', 'enigmático') },
    // Libro +18: fuera de Explorar hasta confirmar la mayoría de edad.
    { mode: 'definida', title: 'Después de medianoche', hook: 'Un hotel de Tánger, una tormenta de verano y una puerta que se queda entreabierta.', tone: 'sensual', definition: def('Samir Haddad', 39, 'magnético, sincero, reservado', 'sensual'), adult: true },
  ],
}

export function seedStoryId(userId: string, index: number) {
  return `${userId.replace(/\W/g, '')}${String(index).padStart(2, '0')}`.padEnd(32, '0')
}

/** Historias públicas de las otras cuentas, de la más reciente a la más antigua. */
export function seedOtherStories(userId: string): CustomStory[] {
  const seeds = PUBLIC_SEEDS[userId] ?? []
  const base = Date.parse('2026-09-16T20:00:00Z')
  const offsetHours = userId === 'user-lucia' ? 0 : userId === 'user-nora' ? 1 : 3
  return seeds.map((seed, index) => {
    const id = seedStoryId(userId, index)
    const published = new Date(base - (offsetHours + index * 2) * 3_600_000).toISOString().slice(0, 19)
    return {
      id,
      characterId: `custom:${id}`,
      mode: seed.mode,
      title: seed.title,
      hook: seed.hook,
      premise: seed.mode === 'concepto' ? `Premisa privada de «${seed.title}»` : null,
      tone: seed.tone,
      definition: seed.definition ?? null,
      isPublic: true,
      freeFirstRead: seed.freeFirstRead ?? true,
      adult: seed.adult ?? false,
      publishedAt: published,
      createdAt: published,
    }
  })
}

/** "Leyendo" de las otras cuentas (sin partidas reales detrás). */
export const SEED_READING: Record<string, ReadingItem[]> = {
  'user-lucia': [
    {
      characterId: 'mateo',
      origin: 'psique',
      mode: null,
      title: 'Mateo Ibarra',
      characterName: 'Mateo Ibarra',
      progress: { phase: 'confianza', phaseLabel: 'Confianza', phaseIndex: 1, phaseCount: 5 },
      updatedAt: '2026-09-16T21:00:00',
    },
  ],
  'user-nora': [
    {
      characterId: 'lucia',
      origin: 'psique',
      mode: null,
      title: 'Lucía Ferrer',
      characterName: 'Lucía Ferrer',
      progress: { phase: 'tension', phaseLabel: 'Tensión', phaseIndex: 2, phaseCount: 5 },
      updatedAt: '2026-09-16T19:00:00',
    },
    {
      characterId: `custom:${seedStoryId('user-lucia', 0)}`,
      origin: 'propia',
      mode: 'concepto',
      title: 'El último tren a Lisboa',
      characterName: null,
      progress: { phase: 'conocerse', phaseLabel: 'Conocerse', phaseIndex: 0, phaseCount: 5 },
      updatedAt: '2026-09-15T22:00:00',
    },
  ],
}

function svg(body: string, width: number, height: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`
}

function gradient(id: string, from: string, to: string) {
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>`
}

/** Imágenes de ejemplo servidas en /media. En el backend real son WebP re-codificados. */
export const SEED_MEDIA: Record<string, string> = {
  '/media/avatars/seed-lucia.svg': svg(
    `${gradient('g', '#e0b27a', '#b8395c')}<rect width="256" height="256" fill="url(#g)"/><circle cx="128" cy="104" r="46" fill="#2a1a22" opacity=".85"/><ellipse cx="128" cy="232" rx="84" ry="64" fill="#2a1a22" opacity=".85"/>`,
    256,
    256,
  ),
  '/media/avatars/seed-nora.svg': svg(
    `${gradient('g', '#6fb3a8', '#3b4f7a')}<rect width="256" height="256" fill="url(#g)"/><circle cx="128" cy="104" r="46" fill="#f3e9ec" opacity=".9"/><ellipse cx="128" cy="232" rx="84" ry="64" fill="#f3e9ec" opacity=".9"/>`,
    256,
    256,
  ),
  '/media/banners/seed-lucia.svg': svg(
    `${gradient('g', '#3b2233', '#e0b27a')}<rect width="1600" height="400" fill="url(#g)"/><circle cx="1280" cy="120" r="70" fill="#faf5f2" opacity=".55"/><path d="M0 320 C 300 240 600 380 900 300 S 1400 260 1600 320 V400 H0Z" fill="#120d12" opacity=".55"/>`,
    1600,
    400,
  ),
}
