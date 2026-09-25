export const routes = {
  login: '/login',
  registro: '/registro',
  terminos: '/terminos',
  privacidad: '/privacidad',
  characters: '/',
  nuevaHistoria: '/historias/nueva',
  /** Lista y detalle de las historias propias: se editan y se gestionan solo aquí. */
  misHistorias: '/mis-historias',
  misHistoriaDetalle: (id: string) => `/mis-historias/${encodeURIComponent(id)}`,
  story: (storyId: string) => `/historia/${encodeURIComponent(storyId)}`,
  storyArchive: (storyId: string) => `/historia/${encodeURIComponent(storyId)}/archivo`,
  book: (bookId: string) => `/libro/${encodeURIComponent(bookId)}`,
  explorar: '/explorar',
  profile: (handle: string) => `/u/${encodeURIComponent(handle)}`,
  configuracion: '/configuracion',
  /** Donde se listan los incidentes que cuentan para la restricción, con su apelación. */
  incidentes: '/configuracion#incidentes',
  rascaYGana: '/rasca-y-gana',
  dev: '/dev',
  moderacion: '/dev/moderacion',
  notFound: '*',
} as const
