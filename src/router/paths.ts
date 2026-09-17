export const routes = {
  login: '/login',
  registro: '/registro',
  characters: '/',
  nuevaHistoria: '/historias/nueva',
  story: (storyId: string) => `/historia/${encodeURIComponent(storyId)}`,
  storyArchive: (storyId: string) => `/historia/${encodeURIComponent(storyId)}/archivo`,
  book: (bookId: string) => `/libro/${encodeURIComponent(bookId)}`,
  explorar: '/explorar',
  profile: (handle: string) => `/u/${encodeURIComponent(handle)}`,
  configuracion: '/configuracion',
  rascaYGana: '/rasca-y-gana',
  notFound: '*',
} as const
