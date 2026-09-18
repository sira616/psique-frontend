/**
 * API simulada para desarrollar sin backend (`npm run dev:mock`) y para los tests.
 *
 * La lógica de fase y afinidad de aquí es un apaño visual, NO la del backend: allí la
 * calcula `app/story/state_machine.py` a partir de eventos. No copiar reglas de este fichero.
 */
import { delay, http, HttpResponse } from 'msw'
import type { BookCard, BookOut, HistoryItem, ReviewOut } from '@/api/books'
import type { CreateCustomStory, CustomStory } from '@/api/customStories'
import type { MovementReason, Wallet } from '@/api/economy'
import type { StoryCard } from '@/api/explore'
import type { MyProfile, PublicProfile, ReadingItem } from '@/api/profile'
import { HANDLE_PATTERN, linkProblem, normalizeDisplayName, PROFILE_LIMITS } from '@/features/profile/limits'
import { validateConcepto, validateDefinida, type FieldErrors } from '@/features/customStories/limits'
import type { Character, PhaseId, Story, StorySummary, StoryStreamEvent } from '@/shared/lib/events'
import {
  CONTENT_MESSAGES,
  DEMO_USER,
  DEV_USER,
  OTHER_USERS,
  PHASES,
  POLICY_KEYWORDS,
  POLICY_MESSAGES,
  PSIQUE_FREE_FIRST_READ,
  SEED_MEDIA,
  SEED_READING,
  SEED_REVIEWS,
  greetings,
  mockCharacters,
  mockReplies,
  mockScenes,
  phaseSceneTitles,
  quickChoicesByPhase,
  seedCustomStories,
  seedOtherStories,
  seedProfiles,
  type MockProfile,
} from '@/mocks/fixtures'
import { chunkText, createStorySseStream } from '@/mocks/sse'
import { MONEDA } from '@/shared/economy/moneda'
import { LEGAL_VERSION, MIN_AGE } from '@/content/legal/version'

type MockUser = typeof DEMO_USER
type MockStory = Story & { userId: string; updatedAt: string }

const users = new Map<string, MockUser>([DEMO_USER, DEV_USER, ...OTHER_USERS].map((u) => [u.username, u]))
const DEV_USER_IDS = new Set([DEV_USER.id])
const sessions = new Map<string, { userId: string; refreshToken: string }>()
// Imita la cookie httpOnly del backend. En Node (vitest) fetch no guarda cookies, así que
// si la petición no trae ninguna se usa la última emitida, como haría el navegador.
let lastRefreshToken: string | null = null
const REFRESH_COOKIE = 'psique_refresh'
const COOKIE_ATTRS = 'Path=/api/auth; HttpOnly; SameSite=Strict'
const stories = new Map<string, MockStory>()

let refreshFailOnce = false

// Política de contenido por cuenta. Todas arrancan sin confirmar y sin restricción.
// termsVersion: la última versión de términos aceptada (null = ninguna).
type AccountFlags = { adultConfirmed: boolean; restrictedUntil: string | null; termsVersion: string | null }
const accountFlags = new Map<string, AccountFlags>()

function flagsOf(userId: string): AccountFlags {
  let flags = accountFlags.get(userId)
  if (!flags) {
    flags = { adultConfirmed: false, restrictedUntil: null, termsVersion: LEGAL_VERSION }
    accountFlags.set(userId, flags)
  }
  return flags
}

function restrictionOf(userId: string): string | null {
  const until = flagsOf(userId).restrictedUntil
  return until && Date.parse(`${until}Z`) > Date.now() ? until : null
}

function restrictFor(userId: string, days: number) {
  const until = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 19)
  flagsOf(userId).restrictedUntil = until
  return until
}

function authUserOut(user: MockUser) {
  return {
    id: user.id,
    username: user.username,
    displayName: profileOf(user).displayName,
    handle: profileOf(user).handle,
    isDev: DEV_USER_IDS.has(user.id),
    adultConfirmed: flagsOf(user.id).adultConfirmed,
    restrictedUntil: restrictionOf(user.id),
    termsVersion: LEGAL_VERSION,
    termsAccepted: flagsOf(user.id).termsVersion === LEGAL_VERSION,
  }
}

function adultRequired() {
  return HttpResponse.json({ detail: POLICY_MESSAGES.adultRequired, code: 'adult_required' }, { status: 403 })
}

function accountRestricted(restrictedUntil: string) {
  return HttpResponse.json(
    { detail: POLICY_MESSAGES.restricted, code: 'account_restricted', restrictedUntil },
    { status: 403 },
  )
}

/** Mismo orden para crear, releer, chatear y desbloquear: primero la edad, luego la restricción. */
function policyBlock(userId: string, adultBook: boolean) {
  if (adultBook && !flagsOf(userId).adultConfirmed) return adultRequired()
  const until = restrictionOf(userId)
  return until ? accountRestricted(until) : null
}

// Solo con `npm run dev:mock`: una sesión sembrada para revisar la interfaz sin pasar por el
// formulario de login. Se activa poniendo la cookie `psique_refresh=refresh-dev-demo`.
if (import.meta.env.MODE === 'mock') {
  sessions.set('access-dev-demo', { userId: DEMO_USER.id, refreshToken: 'refresh-dev-demo' })
}

// Historias propias por usuario, de la más reciente a la más antigua.
const customStories = new Map<string, CustomStory[]>()
const MAX_CUSTOM_STORIES = 50
// En el backend el nombre del concepto lo inventa el LLM y no se expone hasta jugar.
const CONCEPT_NAME = 'Aitana'

function customStoriesOf(userId: string): CustomStory[] {
  let list = customStories.get(userId)
  if (!list) {
    list = userId === DEMO_USER.id ? seedCustomStories() : seedOtherStories(userId)
    customStories.set(userId, list)
  }
  return list
}

// Perfiles e imágenes

let profiles: Record<string, MockProfile> | null = null
const uploadedMedia = new Map<string, { bytes: ArrayBuffer; type: string }>()

function profileOf(user: MockUser): MockProfile {
  profiles ??= seedProfiles()
  let profile = profiles[user.id]
  if (!profile) {
    profile = {
      handle: user.username.replace(/[.-]/g, '_'),
      displayName: user.displayName,
      bio: null,
      link: null,
      avatarUrl: null,
      bannerUrl: null,
      showPublished: true,
      showReading: true,
      joinedAt: nowIso(),
    }
    profiles[user.id] = profile
  }
  return profile
}

function userByHandle(handle: string): MockUser | null {
  const wanted = handle.toLowerCase()
  return [...users.values()].find((u) => profileOf(u).handle === wanted) ?? null
}

function myProfileOut(profile: MockProfile): MyProfile {
  const { joinedAt: _joinedAt, ...out } = profile
  return out
}

function authorOf(userId: string) {
  const user = [...users.values()].find((u) => u.id === userId)!
  const { displayName, handle, avatarUrl } = profileOf(user)
  return { displayName, handle, avatarUrl }
}

function toCard(story: CustomStory, ownerId: string, viewerId: string): StoryCard {
  return {
    id: story.id,
    characterId: story.characterId,
    mode: story.mode,
    title: story.title,
    hook: story.hook,
    tone: story.tone,
    // En concepto nunca sale nada que haya inventado el LLM.
    definition: story.mode === 'definida' ? story.definition : null,
    author: authorOf(ownerId),
    isMine: ownerId === viewerId,
    adult: story.adult,
    publishedAt: story.publishedAt,
  }
}

function allPublicStories(): { story: CustomStory; ownerId: string }[] {
  return [...users.values()]
    .flatMap((u) => customStoriesOf(u.id).map((story) => ({ story, ownerId: u.id })))
    .filter(({ story }) => story.isPublic)
    .sort((a, b) => (b.story.publishedAt ?? '').localeCompare(a.story.publishedAt ?? ''))
}

function findCustomStory(characterId: string) {
  for (const u of users.values()) {
    const story = customStoriesOf(u.id).find((s) => s.characterId === characterId)
    if (story) return { story, ownerId: u.id }
  }
  return null
}

function readingOf(userId: string): ReadingItem[] {
  const seeded = SEED_READING[userId] ?? []
  // "Leyendo" solo enseña partidas activas: las archivadas viven en el historial del libro.
  const live = [...storyStore().values()]
    .filter((s) => s.userId === userId && s.status === 'activa')
    .map((s): ReadingItem => {
      const custom = findCustomStory(s.characterId)
      return {
        characterId: s.characterId,
        origin: custom ? 'propia' : 'psique',
        mode: custom?.story.mode ?? null,
        title: custom?.story.title ?? s.characterName,
        characterName: custom?.story.mode === 'concepto' ? null : s.characterName,
        progress: {
          phase: s.state.phase,
          phaseLabel: s.state.phaseLabel,
          phaseIndex: s.state.phaseIndex,
          phaseCount: s.state.phaseCount,
        },
        updatedAt: s.updatedAt,
      }
    })
    .reverse()
  return [...live, ...seeded]
}

function fieldError(status: number, field: string, type: string, msg: string) {
  return HttpResponse.json({ detail: [{ type, loc: ['body', field], msg }] }, { status })
}

const PROFILE_FIELDS = new Set(['displayName', 'handle', 'bio', 'link', 'showPublished', 'showReading'])

function splitTraits(personality: string) {
  return personality
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8)
}

function customToCharacter(story: CustomStory): Character {
  const def = story.definition
  return {
    id: story.characterId,
    origin: 'propia',
    mode: story.mode,
    title: story.title,
    hook: story.hook,
    name: def?.name ?? null,
    age: def?.age ?? null,
    tagline: def ? story.hook : null,
    traits: def ? splitTraits(def.personality) : null,
    scenario: def?.setting ?? null,
    adult: story.adult,
  }
}

function hex32() {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

function schemaErrors(mode: string, errors: FieldErrors) {
  return HttpResponse.json(
    {
      detail: Object.entries(errors).map(([field, msg]) => ({
        type: 'value_error',
        loc: ['body', mode, field],
        msg: `Value error, ${msg}`,
      })),
    },
    { status: 422 },
  )
}

// Filtro por patrones, como el del backend: el trasfondo de un adulto ("de niña") pasa.
const SEXUAL_PATTERN = /\bsexo\b|sexual|expl[ií]cit/i
const MINORS_PATTERN = /(una niña|un niño|adolescentes?|menor(es)? de edad|tiene 1[0-7] años)/i

function contentProblem(body: Record<string, unknown>): string | null {
  const text = Object.values(body)
    .filter((v) => typeof v === 'string')
    .join('\n')
  if (SEXUAL_PATTERN.test(text)) return CONTENT_MESSAGES.sexual
  if (MINORS_PATTERN.test(text)) return CONTENT_MESSAGES.minors
  return null
}

function asText(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function nowIso() {
  return new Date().toISOString().slice(0, 19)
}

function unauthorized() {
  return HttpResponse.json({ detail: 'No se pudo validar la credencial' }, { status: 401 })
}

function bearerUser(request: Request): MockUser | null {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const session = sessions.get(header.slice(7))
  if (!session) return null
  return [...users.values()].find((u) => u.id === session.userId) ?? null
}

function issue(user: MockUser) {
  const accessToken = `access-${user.id}-${Math.random().toString(36).slice(2)}`
  const refreshToken = `refresh-${user.id}-${Math.random().toString(36).slice(2)}`
  sessions.set(accessToken, { userId: user.id, refreshToken })
  lastRefreshToken = refreshToken
  return {
    body: { access_token: accessToken, user: authUserOut(user) },
    headers: { 'Set-Cookie': `${REFRESH_COOKIE}=${refreshToken}; ${COOKIE_ATTRS}` },
  }
}

function cookieRefresh(request: Request): string | null {
  // La sesión sembrada no rota: tras recargar, la cookie rotada de la sesión anterior ya no
  // existe en memoria y dejaría la revisión visual atascada en el login.
  if (import.meta.env.MODE === 'mock' && request.headers.get('Cookie')?.includes('psique_refresh=refresh-dev-demo')) {
    if (![...sessions.values()].some((s) => s.refreshToken === 'refresh-dev-demo')) {
      sessions.set('access-dev-demo', { userId: DEMO_USER.id, refreshToken: 'refresh-dev-demo' })
    }
    return 'refresh-dev-demo'
  }
  const match = request.headers.get('Cookie')?.match(/(?:^|;\s*)psique_refresh=([^;]+)/)
  return match?.[1] ?? lastRefreshToken
}

/**
 * Escena y sugerencias como las da el backend: en el turno 0 (o recién desbloqueado un
 * capítulo) la reserva de la fase; después, una escena de `mockScenes` que cambia cada dos
 * turnos. Los ids llevan el turno, así una sugerencia vieja da 422.
 */
function sceneFor(phaseId: PhaseId, turnCount: number, fromPhase: boolean) {
  const picked = mockScenes[Math.floor((turnCount - 1) / 2) % mockScenes.length]
  const useScene = !fromPhase && turnCount > 0 && picked
  const choices = useScene ? picked.choices : quickChoicesByPhase[phaseId]
  return {
    scene: useScene ? picked.scene : phaseSceneTitles[phaseId],
    quickChoices: choices.map((c, i) => ({ id: `t${turnCount}s${i + 1}`, ...c })),
  }
}

function stateFor(phaseIndex: number, affinity: number, turnCount: number, locked = false, fromPhase = false) {
  const phase = PHASES[phaseIndex] ?? PHASES[0]!
  return {
    phase: phase.id,
    phaseLabel: phase.label,
    phaseIndex,
    phaseCount: PHASES.length,
    affinity,
    turnCount,
    ...sceneFor(phase.id, turnCount, fromPhase),
    chapter_locked: locked,
    next_phase: locked ? (PHASES[phaseIndex + 1]?.id ?? null) : null,
    chapter_cost: CHAPTER_COST,
  }
}

// Cupo diario de turnos (como CHAT_TURNS_PER_DAY). El día es el local de quien usa el mock.
const MOCK_TURNS_PER_DAY = 60
const turnUsage = new Map<string, { day: string; turns: number }>()

function localDay(date = new Date()) {
  return date.toLocaleDateString('sv-SE')
}

function nextMidnightIso() {
  const next = new Date()
  next.setHours(24, 0, 0, 0)
  return next.toISOString()
}

function turnsUsedToday(userId: string) {
  const entry = turnUsage.get(userId)
  return entry && entry.day === localDay() ? entry.turns : 0
}

function usageOut(userId: string) {
  const unlimited = DEV_USER_IDS.has(userId)
  const used = turnsUsedToday(userId)
  return {
    turnsUsed: used,
    turnsLimit: unlimited ? null : MOCK_TURNS_PER_DAY,
    turnsRemaining: unlimited ? null : Math.max(0, MOCK_TURNS_PER_DAY - used),
    unlimited,
    resetsAt: nextMidnightIso(),
  }
}

function devOnly(request: Request): { user: MockUser; error: null } | { user: null; error: Response } {
  const user = bearerUser(request)
  if (!user) return { user: null, error: unauthorized() }
  if (!DEV_USER_IDS.has(user.id)) {
    return { user: null, error: HttpResponse.json({ detail: 'Solo para cuentas de desarrollo.' }, { status: 403 }) }
  }
  return { user, error: null }
}

// Economía simulada. Las cifras son de juguete: las reales las decide el backend.

const INITIAL_BALANCE = 5
const CHAPTER_COST = 2
const SCRATCH_DAILY_LIMIT = 3
const SCRATCH_PRIZE = 5
const SCRATCH_WINNING_NUMBER = 7
/** Historia sembrada con el capítulo bloqueado: /historia/story-bloqueada. */
export const LOCKED_DEMO_STORY_ID = 'story-bloqueada'

type MockCard = { id: number; userId: string; createdAt: string; number: number; revealed: boolean }

const wallets = new Map<string, Wallet>()
// Ids numéricos, como el autoincremental del backend.
let scratchCardSeq = 0
const scratchCards = new Map<number, MockCard>()

function walletOf(userId: string): Wallet {
  let wallet = wallets.get(userId)
  if (!wallet) {
    wallet = {
      balance: INITIAL_BALANCE,
      movements: [{ id: hex32(), amount: INITIAL_BALANCE, reason: 'bienvenida', reference: null, created_at: nowIso() }],
    }
    wallets.set(userId, wallet)
  }
  return wallet
}

function addMovement(userId: string, amount: number, reason: MovementReason, reference: string | null) {
  const wallet = walletOf(userId)
  wallet.balance += amount
  wallet.movements.unshift({ id: hex32(), amount, reason, reference, created_at: nowIso() })
  return wallet
}

function cardsToday(userId: string) {
  const today = nowIso().slice(0, 10)
  return [...scratchCards.values()].filter((c) => c.userId === userId && c.createdAt.slice(0, 10) === today)
}

function remainingCards(userId: string) {
  return Math.max(0, SCRATCH_DAILY_LIMIT - cardsToday(userId).length)
}

const READ_COST = 3
const READ_SHORT = `Te faltan ${MONEDA.plural} para empezar este libro. Puedes ganar más en Rasca y gana.`
/** Lectura archivada sembrada de la cuenta demo: /historia/story-archivada/archivo. */
export const ARCHIVED_DEMO_STORY_ID = 'story-archivada'
/** Partida cerrada por incumplir las normas, en «Café a medianoche» de la demo: /historia/story-cerrada. */
export const CLOSED_DEMO_STORY_ID = 'story-cerrada'

let demoSeeded = false

/**
 * Partidas, con las de la cuenta demo sembradas al primer uso: Mateo con el capítulo bloqueado y
 * una lectura suya archivada. Van con Mateo para que Lucía quede sin empezar y gratis.
 */
function storyStore() {
  if (!demoSeeded) {
    demoSeeded = true
    const mateo = mockCharacters.find((c) => c.id === 'mateo')!
    const base = {
      userId: DEMO_USER.id,
      characterId: mateo.id,
      characterName: mateo.name ?? mateo.title,
      facts: [],
      closedAt: null,
      closedReason: null,
    }
    stories.set(ARCHIVED_DEMO_STORY_ID, {
      ...base,
      id: ARCHIVED_DEMO_STORY_ID,
      state: stateFor(2, 61, 14),
      messages: [
        { id: 1, role: 'assistant', content: greetings[mateo.id] ?? '' },
        { id: 2, role: 'user', content: 'Si todavía queda algo de cena, me quedo.' },
        { id: 3, role: 'assistant', content: mockReplies[1]! },
      ],
      status: 'archivada',
      archivedAt: '2026-09-10T22:00:00',
      createdAt: '2026-09-08T21:00:00',
      updatedAt: '2026-09-10T22:00:00',
    })
    stories.set(LOCKED_DEMO_STORY_ID, {
      ...base,
      id: LOCKED_DEMO_STORY_ID,
      state: stateFor(0, 34, 4, true),
      messages: [{ id: 1, role: 'assistant', content: greetings[mateo.id] ?? '' }],
      status: 'activa',
      archivedAt: null,
      createdAt: '2026-09-15T20:00:00',
      updatedAt: '2026-09-16T20:00:00',
    })
    // Va en un libro propio de la demo para no tocar el historial de Mateo ni dejar a Lucía empezada.
    const cafe = seedCustomStories().find((c) => c.title === 'Café a medianoche')!
    stories.set(CLOSED_DEMO_STORY_ID, {
      ...base,
      id: CLOSED_DEMO_STORY_ID,
      characterId: cafe.characterId,
      characterName: cafe.definition?.name ?? cafe.title,
      state: { ...stateFor(1, 42, 7), quickChoices: [] },
      messages: [
        { id: 1, role: 'assistant', content: `*${cafe.definition?.setting ?? cafe.hook}*` },
        { id: 2, role: 'user', content: 'Un cortado, por favor. Y lo que tú recomiendes para una noche larga.' },
        { id: 3, role: 'assistant', content: mockReplies[2]! },
      ],
      status: 'cerrada',
      archivedAt: null,
      closedAt: '2026-09-14T23:40:00',
      closedReason: POLICY_MESSAGES.closedReason,
      createdAt: '2026-09-14T22:00:00',
      updatedAt: '2026-09-14T23:40:00',
    })
  }
  return stories
}

function storyOut({ userId: _userId, updatedAt: _updatedAt, ...out }: MockStory): Story {
  return out
}

function ownStory(userId: string, id: string): MockStory | null {
  const story = storyStore().get(id)
  return story && story.userId === userId ? story : null
}

function userStoriesFor(userId: string, bookId: string) {
  return [...storyStore().values()].filter((s) => s.userId === userId && s.characterId === bookId)
}

// Libros

type MockBook =
  | { id: string; origin: 'psique'; character: Character; custom: null; ownerId: null }
  | { id: string; origin: 'propia'; character: null; custom: CustomStory; ownerId: string }

/** Visible = predefinido, o propio, o público de otra cuenta. */
function findBook(bookId: string, viewerId: string): MockBook | null {
  const character = mockCharacters.find((c) => c.id === bookId)
  if (character) return { id: bookId, origin: 'psique', character, custom: null, ownerId: null }
  const found = findCustomStory(bookId)
  if (!found || (found.ownerId !== viewerId && !found.story.isPublic)) return null
  return { id: bookId, origin: 'propia', character: null, custom: found.story, ownerId: found.ownerId }
}

function bookNotFound() {
  return HttpResponse.json({ detail: 'No encontramos este libro.' }, { status: 404 })
}

function bookIdParam(value: unknown) {
  const raw = String(value)
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function isAdultBook(book: MockBook | null) {
  return Boolean(book?.custom?.adult ?? book?.character?.adult)
}

function freeFirstReadOf(book: MockBook) {
  return book.custom ? book.custom.freeFirstRead : (PSIQUE_FREE_FIRST_READ[book.id] ?? true)
}

type MockReview = {
  id: number
  userId: string
  bookId: string
  rating: number
  text: string | null
  createdAt: string
  updatedAt: string
}

let reviewSeq = 0
let reviews: MockReview[] | null = null

function reviewStore(): MockReview[] {
  reviews ??= SEED_REVIEWS.map((r) => ({ ...r, id: ++reviewSeq, updatedAt: r.createdAt }))
  return reviews
}

function reviewOut(review: MockReview, viewerId: string): ReviewOut {
  return {
    id: review.id,
    rating: review.rating,
    text: review.text,
    author: authorOf(review.userId),
    isMine: review.userId === viewerId,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  }
}

/** Usuarios distintos con partida. En el mock cuentan también las estanterías y reseñas sembradas. */
function readersOf(bookId: string) {
  const ids = new Set<string>()
  for (const s of storyStore().values()) if (s.characterId === bookId) ids.add(s.userId)
  for (const [userId, items] of Object.entries(SEED_READING)) {
    if (items.some((i) => i.characterId === bookId)) ids.add(userId)
  }
  for (const r of reviewStore()) if (r.bookId === bookId) ids.add(r.userId)
  return ids.size
}

function bookOut(book: MockBook, viewerId: string): BookOut {
  const own = userStoriesFor(viewerId, book.id)
  const active = own.find((s) => s.status === 'activa') ?? null
  const atEnd = active && active.state.phaseIndex === active.state.phaseCount - 1 && !active.state.chapter_locked
  const bookReviews = reviewStore().filter((r) => r.bookId === book.id)
  const average = bookReviews.length
    ? Math.round((bookReviews.reduce((sum, r) => sum + r.rating, 0) / bookReviews.length) * 10) / 10
    : null
  const mine = bookReviews.find((r) => r.userId === viewerId)
  const isMine = book.ownerId === viewerId
  const free = freeFirstReadOf(book)
  const custom = book.custom
  return {
    id: book.id,
    origin: book.origin,
    mode: custom?.mode ?? null,
    title: custom?.title ?? book.character!.title,
    hook: custom?.hook ?? book.character!.hook,
    characterName: custom ? (custom.definition?.name ?? null) : book.character!.name,
    tone: custom?.tone ?? null,
    author: book.ownerId ? authorOf(book.ownerId) : null,
    isMine,
    isPublic: custom?.isPublic ?? true,
    chapterCount: PHASES.length,
    freeFirstRead: free,
    adult: isAdultBook(book),
    readCost: READ_COST,
    publishedAt: custom?.publishedAt ?? null,
    createdAt: custom?.createdAt ?? null,
    stats: { readers: readersOf(book.id), ratingAverage: average, reviewCount: bookReviews.length },
    viewer: {
      status: !active ? 'sin_empezar' : atEnd ? 'leido' : 'leyendo',
      activeStoryId: active?.id ?? null,
      progress: active
        ? {
            phase: active.state.phase,
            phaseLabel: active.state.phaseLabel,
            phaseIndex: active.state.phaseIndex,
            phaseCount: active.state.phaseCount,
            affinity: active.state.affinity,
            chapterLocked: Boolean(active.state.chapter_locked),
          }
        : null,
      primaryAction: active
        ? { kind: 'continuar', cost: 0 }
        : { kind: 'leer', cost: free && own.length === 0 ? 0 : READ_COST },
      adultRequired: isAdultBook(book) && !flagsOf(viewerId).adultConfirmed,
      canReread: own.length > 0,
      rereadCost: READ_COST,
      canReview: own.length > 0 && !isMine,
      myReview: mine ? reviewOut(mine, viewerId) : null,
    },
  }
}

function newStory(userId: string, book: MockBook): MockStory {
  let characterName: string
  let greeting: string
  if (book.custom) {
    const custom = book.custom
    characterName = custom.definition?.name ?? CONCEPT_NAME
    greeting = custom.definition
      ? `*${custom.definition.setting}*`
      : `*Levanta la vista, como si llevara rato esperándote.* Me llamo ${CONCEPT_NAME}. ${custom.hook}`
  } else {
    characterName = book.character.name ?? book.character.title
    greeting = greetings[book.character.id] ?? ''
  }
  const story: MockStory = {
    id: `story-${Math.random().toString(36).slice(2, 10)}`,
    userId,
    characterId: book.id,
    characterName,
    state: stateFor(0, 20, 0),
    messages: [{ id: 1, role: 'assistant', content: greeting }],
    facts: [],
    status: 'activa',
    archivedAt: null,
    closedAt: null,
    closedReason: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  storyStore().set(story.id, story)
  return story
}

function normalizeTone(tone: string | null) {
  return (tone ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()
}

function bookCard(book: MockBook): BookCard {
  const custom = book.custom
  return {
    id: book.id,
    origin: book.origin,
    mode: custom?.mode ?? null,
    title: custom?.title ?? book.character!.title,
    hook: custom?.hook ?? book.character!.hook,
    tone: custom?.tone ?? null,
    author: book.ownerId ? authorOf(book.ownerId) : null,
    readers: readersOf(book.id),
    adult: isAdultBook(book),
  }
}

function closeStory(story: MockStory) {
  Object.assign(story, {
    status: 'cerrada',
    closedAt: nowIso(),
    closedReason: POLICY_MESSAGES.closedReason,
    updatedAt: nowIso(),
    state: { ...story.state, quickChoices: [] },
  })
}

function storyClosed(story: MockStory, restrictedUntil: string | null, detail = 'Esta partida está cerrada por incumplir las normas.') {
  return HttpResponse.json(
    { detail, code: 'story_closed', closedAt: story.closedAt, closedReason: story.closedReason, restrictedUntil },
    { status: 403 },
  )
}

// Términos e incidentes de conducta

type MockIncidentReview = { status: 'aceptada' | 'rechazada'; reviewedAt: string; reviewedBy: string | null; note: string | null }
type MockIncident = {
  id: number
  userId: string
  storyId: string
  /** Partida ficticia de otra cuenta (no está en el store): sus datos van fijos aquí. */
  fakeStory: { characterId: string; bookTitle: string; status: string } | null
  createdAt: string
  level: string
  rule: string | null
  appealText: string | null
  appealedAt: string | null
  review: MockIncidentReview | null
  excerpt: string | null
}

const EXCERPT_SAMPLE = '[Extracto simulado del mock: aquí iría el mensaje que cerró la partida, recortado a 300 caracteres.]'
let incidentSeq = 0
let incidents: MockIncident[] | null = null

/**
 * Incidentes sembrados: el de la partida cerrada de la demo (sin apelar), uno apelado de Lucía,
 * uno propio de la cuenta dev (no lo puede revisar ella) y uno ya resuelto de Nora.
 */
function incidentStore(): MockIncident[] {
  if (!incidents) {
    const titleOf = (id: string) => mockCharacters.find((c) => c.id === id)?.title ?? id
    incidents = [
      {
        id: 1,
        userId: DEMO_USER.id,
        storyId: CLOSED_DEMO_STORY_ID,
        fakeStory: null,
        createdAt: '2026-09-14T23:40:00',
        level: 'explicito',
        rule: 'llm:explicito',
        appealText: null,
        appealedAt: null,
        review: null,
        excerpt: EXCERPT_SAMPLE,
      },
      {
        id: 2,
        userId: 'user-lucia',
        storyId: 'story-lucia-cerrada',
        fakeStory: { characterId: 'mateo', bookTitle: titleOf('mateo'), status: 'cerrada' },
        createdAt: '2026-09-16T19:05:00',
        level: 'prohibido',
        rule: 'patron:menores',
        appealText: 'Hablaba de cuando los dos éramos pequeños y nos conocimos en el colegio. No había nada más.',
        appealedAt: '2026-09-16T20:00:00',
        review: null,
        excerpt: EXCERPT_SAMPLE,
      },
      {
        id: 3,
        userId: DEV_USER.id,
        storyId: 'story-dev-cerrada',
        fakeStory: { characterId: 'lucia', bookTitle: titleOf('lucia'), status: 'cerrada' },
        createdAt: '2026-09-17T10:00:00',
        level: 'explicito',
        rule: 'patron:explicito',
        appealText: 'Probando la cola desde la cuenta dev.',
        appealedAt: '2026-09-17T10:30:00',
        review: null,
        excerpt: EXCERPT_SAMPLE,
      },
      {
        id: 4,
        userId: 'user-nora',
        storyId: 'story-nora-cerrada',
        fakeStory: { characterId: 'mateo', bookTitle: titleOf('mateo'), status: 'activa' },
        createdAt: '2026-09-01T18:00:00',
        level: 'explicito',
        rule: 'llm:explicito',
        appealText: null,
        appealedAt: '2026-09-01T19:00:00',
        review: { status: 'aceptada', reviewedAt: '2026-09-02T09:00:00', reviewedBy: DEV_USER.handle, note: 'Falso positivo del filtro.' },
        excerpt: null,
      },
    ]
    incidentSeq = incidents.length
  }
  return incidents
}

function recordIncident(story: MockStory, level: string, text: string) {
  incidentStore().unshift({
    id: ++incidentSeq,
    userId: story.userId,
    storyId: story.id,
    fakeStory: null,
    createdAt: nowIso(),
    level,
    rule: 'mock:palabra-clave',
    appealText: null,
    appealedAt: null,
    review: null,
    excerpt: text.slice(0, 300),
  })
}

function bookTitleOf(characterId: string) {
  return mockCharacters.find((c) => c.id === characterId)?.title ?? findCustomStory(characterId)?.story.title ?? 'Libro borrado'
}

function incidentStory(incident: MockIncident) {
  if (incident.fakeStory) return { id: incident.storyId, ...incident.fakeStory }
  const story = storyStore().get(incident.storyId)
  return story ? { id: story.id, characterId: story.characterId, bookTitle: bookTitleOf(story.characterId), status: story.status } : null
}

function appealStatusOf(incident: MockIncident) {
  return incident.review?.status ?? (incident.appealedAt ? 'pendiente' : null)
}

function myIncidentOut(incident: MockIncident) {
  return {
    id: incident.id,
    storyId: incident.storyId,
    bookTitle: incidentStory(incident)?.bookTitle ?? 'Libro borrado',
    level: incident.level,
    createdAt: incident.createdAt,
    appealStatus: appealStatusOf(incident),
    appealText: incident.appealText,
    appealedAt: incident.appealedAt,
    reviewedAt: incident.review?.reviewedAt ?? null,
    reviewNote: incident.review?.note ?? null,
    counts: incident.review?.status !== 'aceptada',
  }
}

function devIncidentOut(incident: MockIncident, viewer: MockUser, detail: boolean) {
  const owner = [...users.values()].find((u) => u.id === incident.userId) ?? null
  return {
    id: incident.id,
    createdAt: incident.createdAt,
    level: incident.level,
    rule: incident.rule,
    user: owner
      ? { id: owner.id, handle: profileOf(owner).handle, username: owner.username, restrictedUntil: restrictionOf(owner.id) }
      : null,
    story: incidentStory(incident),
    appealStatus: appealStatusOf(incident),
    appealText: incident.appealText,
    appealedAt: incident.appealedAt,
    review: incident.review,
    hasExcerpt: incident.excerpt !== null,
    excerpt: detail ? incident.excerpt : null,
    canReview: incident.review === null && incident.userId !== viewer.id,
  }
}

const APPEAL_REJECTED_TEXT =
  'No podemos enviar la apelación con ese texto. Cuéntanos qué pasó sin contenido explícito y la revisaremos igual.'

/** Como en el backend: con menos de 3 cierres que cuentan en 30 días, sin restricción. */
function recomputeRestriction(userId: string) {
  const since = Date.now() - 30 * 86_400_000
  const counting = incidentStore().filter(
    (i) => i.userId === userId && i.review?.status !== 'aceptada' && Date.parse(`${i.createdAt}Z`) >= since,
  )
  if (counting.length < 3) flagsOf(userId).restrictedUntil = null
}

/** No reabre si ya no está cerrada o si hay otra partida activa del mismo libro. */
function reopenAfterReview(incident: MockIncident) {
  if (incident.fakeStory) {
    if (incident.fakeStory.status !== 'cerrada') return false
    incident.fakeStory.status = 'activa'
    return true
  }
  const story = storyStore().get(incident.storyId)
  if (!story || story.status !== 'cerrada') return false
  if (userStoriesFor(story.userId, story.characterId).some((s) => s.status === 'activa')) return false
  Object.assign(story, {
    status: 'activa',
    closedAt: null,
    closedReason: null,
    state: stateFor(story.state.phaseIndex, story.state.affinity, story.state.turnCount),
    updatedAt: nowIso(),
  })
  return true
}

const incidentHandlers = [
  http.post('/api/me/accept-terms', async ({ request }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const body = (await request.json().catch(() => null)) as { version?: string; confirm?: unknown } | null
    if (body?.confirm !== true) return fieldError(422, 'confirm', 'literal_error', 'Input should be True')
    if (body.version !== LEGAL_VERSION) {
      return HttpResponse.json(
        {
          detail: 'Los términos han cambiado mientras los leías. Recarga para ver la versión vigente.',
          code: 'terms_outdated',
          termsVersion: LEGAL_VERSION,
        },
        { status: 409 },
      )
    }
    flagsOf(user.id).termsVersion = LEGAL_VERSION
    return HttpResponse.json(authUserOut(user))
  }),

  http.get('/api/me/incidents', ({ request }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const own = incidentStore()
      .filter((i) => i.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    return HttpResponse.json(own.map(myIncidentOut))
  }),

  http.post('/api/me/incidents/:id/appeal', async ({ request, params }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const incident = incidentStore().find((i) => i.id === Number(params.id) && i.userId === user.id)
    if (!incident) return HttpResponse.json({ detail: 'Ese incidente no existe.', code: 'not_found' }, { status: 404 })
    const body = (await request.json().catch(() => null)) as { text?: string | null } | null
    const text = (body?.text ?? '').trim()
    if (text.length > 500) return fieldError(422, 'text', 'string_too_long', 'String should have at most 500 characters')
    // Mismo filtro de entrada que el resto del mock: sirve para probar el 422 amable.
    if (text && (SEXUAL_PATTERN.test(text) || MINORS_PATTERN.test(text))) {
      return HttpResponse.json({ detail: APPEAL_REJECTED_TEXT, code: 'appeal_text_rejected' }, { status: 422 })
    }
    if (incident.review) {
      return HttpResponse.json({ detail: 'Este incidente ya está revisado.', code: 'already_resolved' }, { status: 409 })
    }
    if (incident.appealedAt) {
      return HttpResponse.json({ detail: 'Ya apelaste este incidente.', code: 'already_appealed' }, { status: 409 })
    }
    incident.appealedAt = nowIso()
    incident.appealText = text || null
    return HttpResponse.json(myIncidentOut(incident))
  }),

  http.get('/api/dev/incidents', ({ request }) => {
    const { user, error } = devOnly(request)
    if (!user) return error
    const url = new URL(request.url)
    const filter = url.searchParams.get('filter') ?? 'pendientes'
    const level = url.searchParams.get('level')
    const rule = url.searchParams.get('rule')
    const limit = Math.min(200, Number(url.searchParams.get('limit') ?? 50) || 50)
    const offset = Number(url.searchParams.get('offset') ?? 0) || 0
    const since = Date.now() - 30 * 86_400_000
    const list = incidentStore().filter((i) => {
      if (filter === 'pendientes' && (!i.appealedAt || i.review)) return false
      if (filter === 'sin_resolver' && i.review) return false
      if (filter === 'recientes' && Date.parse(`${i.createdAt}Z`) < since) return false
      if (filter === 'resueltos' && !i.review) return false
      if (level && i.level !== level) return false
      if (rule && !(i.rule ?? '').startsWith(rule)) return false
      return true
    })
    // Las apeladas, la que más espera arriba; el resto, de la más reciente a la más antigua.
    list.sort((a, b) =>
      filter === 'pendientes'
        ? a.appealedAt!.localeCompare(b.appealedAt!) || a.id - b.id
        : b.createdAt.localeCompare(a.createdAt) || b.id - a.id,
    )
    return HttpResponse.json({
      items: list.slice(offset, offset + limit).map((i) => devIncidentOut(i, user, false)),
      total: list.length,
    })
  }),

  http.get('/api/dev/incidents/:id', ({ request, params }) => {
    const { user, error } = devOnly(request)
    if (!user) return error
    const incident = incidentStore().find((i) => i.id === Number(params.id))
    if (!incident) return HttpResponse.json({ detail: 'Ese incidente no existe.' }, { status: 404 })
    return HttpResponse.json(devIncidentOut(incident, user, true))
  }),

  http.post('/api/dev/incidents/:id/:decision', async ({ request, params }) => {
    const { user, error } = devOnly(request)
    if (!user) return error
    const decision = String(params.decision)
    if (decision !== 'accept' && decision !== 'reject') return HttpResponse.json({ detail: 'Not Found' }, { status: 404 })
    const incident = incidentStore().find((i) => i.id === Number(params.id))
    if (!incident) return HttpResponse.json({ detail: 'Ese incidente no existe.', code: 'not_found' }, { status: 404 })
    if (incident.userId === user.id) {
      return HttpResponse.json({ detail: 'No puedes revisar un incidente tuyo.', code: 'own_incident' }, { status: 403 })
    }
    if (incident.review) {
      return HttpResponse.json({ detail: 'Este incidente ya está revisado.', code: 'already_resolved' }, { status: 409 })
    }
    const body = (await request.json().catch(() => null)) as { note?: string | null } | null
    const note = (body?.note ?? '').trim()
    if (note.length > 300) return fieldError(422, 'note', 'string_too_long', 'String should have at most 300 characters')
    const accept = decision === 'accept'
    incident.review = { status: accept ? 'aceptada' : 'rechazada', reviewedAt: nowIso(), reviewedBy: profileOf(user).handle, note: note || null }
    // Resuelto: el extracto ya no hace falta.
    incident.excerpt = null
    const storyReopened = accept ? reopenAfterReview(incident) : false
    if (accept) recomputeRestriction(incident.userId)
    return HttpResponse.json({ incident: devIncidentOut(incident, user, true), storyReopened })
  }),
]

export const handlers = [
  ...incidentHandlers,

  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { login?: string; password?: string }
    const user = users.get((body.login ?? '').trim().toLowerCase())
    if (!user || user.password !== body.password) {
      return HttpResponse.json({ detail: 'Usuario o contraseña incorrectos.' }, { status: 401 })
    }
    const { body: session, headers } = issue(user)
    return HttpResponse.json(session, { headers })
  }),

  http.post('/api/auth/register', async ({ request }) => {
    const body = (await request.json()) as {
      username?: string
      password?: string
      display_name?: string
      accept_terms?: boolean
      min_age_confirmed?: boolean
    }
    if (body.accept_terms !== true || body.min_age_confirmed !== true) {
      return HttpResponse.json(
        { detail: `Para crear la cuenta tienes que aceptar los términos y la política de privacidad y confirmar que tienes al menos ${MIN_AGE} años.` },
        { status: 422 },
      )
    }
    const username = (body.username ?? '').trim().toLowerCase()
    if (!/^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/.test(username)) {
      return HttpResponse.json({ detail: 'Nombre de usuario no válido.' }, { status: 422 })
    }
    if (users.has(username)) {
      return HttpResponse.json({ detail: 'Ese nombre de usuario ya está cogido.' }, { status: 409 })
    }
    const user = {
      id: `user-${username}`,
      username,
      password: body.password ?? '',
      displayName: body.display_name?.trim() || username,
      handle: username.replace(/[.-]/g, '_'),
    }
    users.set(username, user)
    const { body: session, headers } = issue(user)
    return HttpResponse.json(session, { status: 201, headers })
  }),

  http.post('/api/auth/refresh', ({ request }) => {
    const token = cookieRefresh(request)
    const entry = [...sessions.entries()].find(([, s]) => s.refreshToken === token)
    if (refreshFailOnce || !entry) {
      refreshFailOnce = false
      return HttpResponse.json({ detail: 'Sesión caducada o revocada.' }, { status: 401 })
    }
    sessions.delete(entry[0])
    const user = [...users.values()].find((u) => u.id === entry[1].userId)!
    const { body: session, headers } = issue(user)
    return HttpResponse.json(session, { headers })
  }),

  http.post('/api/auth/logout', ({ request }) => {
    const token = cookieRefresh(request)
    for (const [access, s] of sessions) if (s.refreshToken === token) sessions.delete(access)
    lastRefreshToken = null
    return new HttpResponse(null, {
      status: 204,
      headers: { 'Set-Cookie': `${REFRESH_COOKIE}=; Max-Age=0; ${COOKIE_ATTRS}` },
    })
  }),

  http.get('/api/me', ({ request }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    return HttpResponse.json(authUserOut(user))
  }),

  http.get('/api/me/usage', ({ request }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    return HttpResponse.json(usageOut(user.id))
  }),

  http.get('/api/me/export', ({ request }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const own = [...storyStore().values()].filter((s) => s.userId === user.id)
    return HttpResponse.json(
      {
        format: 'psique-export-1',
        exportedAt: nowIso(),
        account: { ...authUserOut(user), ...profileOf(user) },
        customStories: customStoriesOf(user.id),
        stories: own.map(storyOut),
        reviews: [],
        oboloMovements: walletOf(user.id).movements,
        scratchCards: [],
        conductIncidents: [],
        chatUsage: [{ day: localDay(), turns: turnsUsedToday(user.id) }],
      },
      { headers: { 'Content-Disposition': `attachment; filename="psique-datos-${profileOf(user).handle}.json"` } },
    )
  }),

  http.delete('/api/me', async ({ request }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const body = (await request.json().catch(() => null)) as { password?: string; confirmation?: string } | null
    if (body?.confirmation !== 'BORRAR' || !body.password) {
      return fieldError(422, 'confirmation', 'literal_error', "Input should be 'BORRAR'")
    }
    if (body.password !== user.password) {
      return HttpResponse.json({ detail: 'La contraseña no es correcta.', code: 'invalid_password' }, { status: 403 })
    }
    users.delete(user.username)
    for (const [access, s] of sessions) if (s.userId === user.id) sessions.delete(access)
    for (const [id, s] of storyStore()) if (s.userId === user.id) stories.delete(id)
    lastRefreshToken = null
    return new HttpResponse(null, {
      status: 204,
      headers: { 'Set-Cookie': `${REFRESH_COOKIE}=; Max-Age=0; ${COOKIE_ATTRS}` },
    })
  }),

  http.post('/api/dev/stories/:id/phase', async ({ request, params }) => {
    const { user, error } = devOnly(request)
    if (!user) return error
    const story = ownStory(user.id, String(params.id))
    if (!story) return HttpResponse.json({ detail: 'Historia no encontrada.' }, { status: 404 })
    const body = (await request.json()) as { phase?: string }
    const index = PHASES.findIndex((p) => p.id === body.phase)
    if (index < 0) return fieldError(422, 'phase', 'literal_error', 'Fase no válida')
    const from = story.state.phase
    story.state = stateFor(index, story.state.affinity, story.state.turnCount, false, true)
    return HttpResponse.json({ ...story.state, transition: { from, to: story.state.phase, reason: 'Forzada desde dev.' }, signals: [] })
  }),

  http.post('/api/dev/stories/:id/affinity', async ({ request, params }) => {
    const { user, error } = devOnly(request)
    if (!user) return error
    const story = ownStory(user.id, String(params.id))
    if (!story) return HttpResponse.json({ detail: 'Historia no encontrada.' }, { status: 404 })
    const body = (await request.json()) as { delta?: number; value?: number }
    const next = body.value ?? story.state.affinity + (body.delta ?? 0)
    story.state = { ...story.state, affinity: Math.max(0, Math.min(100, next)) }
    return HttpResponse.json({ ...story.state, transition: null, signals: [] })
  }),

  http.post('/api/dev/stories/:id/unlock-chapter', ({ request, params }) => {
    const { user, error } = devOnly(request)
    if (!user) return error
    const story = ownStory(user.id, String(params.id))
    if (!story) return HttpResponse.json({ detail: 'Historia no encontrada.' }, { status: 404 })
    if (!story.state.chapter_locked) {
      return HttpResponse.json({ detail: 'No hay ningún capítulo por desbloquear.' }, { status: 409 })
    }
    const from = story.state.phase
    story.state = stateFor(story.state.phaseIndex + 1, story.state.affinity, story.state.turnCount, false, true)
    return HttpResponse.json({ ...story.state, transition: { from, to: story.state.phase, reason: 'Desbloqueado desde dev.' }, signals: [] })
  }),

  http.get('/api/dev/stories/:id/context', ({ request, params }) => {
    const { user, error } = devOnly(request)
    if (!user) return error
    const story = ownStory(user.id, String(params.id))
    if (!story) return HttpResponse.json({ detail: 'Historia no encontrada.' }, { status: 404 })
    return HttpResponse.json({
      storyId: story.id,
      status: story.status,
      phase: story.state.phase,
      pendingPhase: story.state.next_phase ?? null,
      affinity: story.state.affinity,
      turnCount: story.state.turnCount,
      systemPrompt: `Eres ${story.characterName}. (Prompt simulado del mock.)`,
      window: story.messages.slice(-20).map((m) => ({ role: m.role, content: m.content })),
      summary: '',
      summaryUptoMessageId: null,
      sceneTitle: story.state.scene ?? null,
      suggestions: { origin: 'mock', items: story.state.quickChoices },
      suggestionsTurn: story.state.turnCount,
    })
  }),

  http.post('/api/dev/stories/:id/reopen', ({ request, params }) => {
    const { user, error } = devOnly(request)
    if (!user) return error
    const story = ownStory(user.id, String(params.id))
    if (!story) return HttpResponse.json({ detail: 'Historia no encontrada.' }, { status: 404 })
    if (story.status !== 'cerrada') {
      return HttpResponse.json({ detail: 'Solo se reabre una partida cerrada y sin otra activa del mismo libro.' }, { status: 409 })
    }
    Object.assign(story, {
      status: 'activa',
      closedAt: null,
      closedReason: null,
      state: stateFor(story.state.phaseIndex, story.state.affinity, story.state.turnCount),
    })
    return HttpResponse.json(storyOut(story))
  }),

  http.post('/api/dev/me/lift-restriction', ({ request }) => {
    const { user, error } = devOnly(request)
    if (!user) return error
    flagsOf(user.id).restrictedUntil = null
    return HttpResponse.json(authUserOut(user))
  }),

  http.post('/api/me/adult-confirmation', async ({ request }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const body = (await request.json().catch(() => null)) as { confirm?: unknown } | null
    if (body?.confirm !== true) return fieldError(422, 'confirm', 'literal_error', 'Input should be True')
    flagsOf(user.id).adultConfirmed = true
    return HttpResponse.json(authUserOut(user))
  }),

  http.delete('/api/me/adult-confirmation', ({ request }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    flagsOf(user.id).adultConfirmed = false
    return HttpResponse.json(authUserOut(user))
  }),

  http.get('/api/characters', ({ request }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    return HttpResponse.json([...mockCharacters, ...customStoriesOf(user.id).map(customToCharacter)])
  }),

  http.get('/api/custom-stories', ({ request }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    return HttpResponse.json(customStoriesOf(user.id))
  }),

  http.post('/api/custom-stories', async ({ request }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const body = (await request.json()) as Record<string, unknown>
    const mode = body.mode
    if (mode !== 'definida' && mode !== 'concepto') {
      return HttpResponse.json(
        { detail: [{ type: 'union_tag_invalid', loc: ['body'], msg: 'Modo no válido', input: mode }] },
        { status: 422 },
      )
    }

    const errors =
      mode === 'definida'
        ? validateDefinida({
            title: asText(body.title),
            name: asText(body.name),
            age: asText(body.age),
            personality: asText(body.personality),
            speakingStyle: asText(body.speakingStyle),
            setting: asText(body.setting),
            tone: asText(body.tone),
            backstory: asText(body.backstory),
            hook: asText(body.hook),
          })
        : validateConcepto({ premise: asText(body.premise), tone: asText(body.tone) })
    if (Object.keys(errors).length) return schemaErrors(mode, errors)

    const content = contentProblem(body)
    if (content) return HttpResponse.json({ detail: content }, { status: 422 })

    const list = customStoriesOf(user.id)
    if (list.length >= MAX_CUSTOM_STORIES) {
      return HttpResponse.json({ detail: CONTENT_MESSAGES.limit }, { status: 409 })
    }

    const id = hex32()
    const input = body as CreateCustomStory
    const isPublic = body.isPublic === true
    const visibility = {
      isPublic,
      freeFirstRead: body.freeFirstRead !== false,
      adult: body.adult === true,
      publishedAt: isPublic ? nowIso() : null,
    }
    let story: CustomStory
    if (input.mode === 'definida') {
      const setting = input.setting.trim()
      story = {
        id,
        characterId: `custom:${id}`,
        mode: 'definida',
        title: input.title.trim(),
        hook: input.hook?.trim() || (setting.split(/(?<=[.!?])\s/)[0] ?? setting).slice(0, 140),
        premise: null,
        tone: input.tone.trim(),
        definition: {
          name: input.name.trim(),
          age: Number(input.age),
          personality: splitTraits(input.personality).join(', '),
          speakingStyle: input.speakingStyle.trim(),
          setting,
          tone: input.tone.trim(),
          backstory: input.backstory.trim(),
        },
        ...visibility,
        createdAt: nowIso(),
      }
    } else {
      // El backend tarda varios segundos en inventar el concepto; en tests no se espera.
      if (import.meta.env.MODE !== 'test') await delay(1500)
      const premise = input.premise.trim()
      story = {
        id,
        characterId: `custom:${id}`,
        mode: 'concepto',
        title: premise.slice(0, 60),
        hook: `[demo] ${premise}`.slice(0, 140),
        premise,
        tone: input.tone?.trim() || null,
        definition: null,
        ...visibility,
        createdAt: nowIso(),
      }
    }
    list.unshift(story)
    return HttpResponse.json(story, { status: 201 })
  }),

  http.patch('/api/custom-stories/:id', async ({ request, params }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const body = (await request.json()) as Record<string, unknown>
    const keys = Object.keys(body)
    const extra = keys.find((k) => k !== 'isPublic' && k !== 'freeFirstRead' && k !== 'adult')
    if (extra) return fieldError(422, extra, 'extra_forbidden', 'Extra inputs are not permitted')
    if (!keys.length) return fieldError(422, 'isPublic', 'missing', 'Indica isPublic, freeFirstRead o adult.')
    // `adult` admite null (= sin cambios), como en el backend.
    const notBool = keys.find((k) => typeof body[k] !== 'boolean' && !(k === 'adult' && body[k] === null))
    if (notBool) return fieldError(422, notBool, 'bool_type', 'Input should be a valid boolean')
    const story = customStoriesOf(user.id).find((s) => s.id === String(params.id))
    if (!story) return HttpResponse.json({ detail: CONTENT_MESSAGES.notFound }, { status: 404 })
    if (typeof body.isPublic === 'boolean') {
      if (body.isPublic && !story.isPublic) story.publishedAt = nowIso()
      story.isPublic = body.isPublic
    }
    if (typeof body.freeFirstRead === 'boolean') story.freeFirstRead = body.freeFirstRead
    if (typeof body.adult === 'boolean') story.adult = body.adult
    return HttpResponse.json(story)
  }),

  http.get('/api/explore', ({ request }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') ?? 20)
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const mode = url.searchParams.get('mode')
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) return fieldError(422, 'limit', 'less_than_equal', 'Límite no válido')
    if (!Number.isInteger(offset) || offset < 0 || offset > 10000) return fieldError(422, 'offset', 'less_than_equal', 'Offset no válido')
    if (mode !== null && mode !== 'definida' && mode !== 'concepto') return fieldError(422, 'mode', 'literal_error', 'Modo no válido')
    const adultOk = flagsOf(user.id).adultConfirmed
    const all = allPublicStories().filter(({ story }) => (!mode || story.mode === mode) && (adultOk || !story.adult))
    const items = all.slice(offset, offset + limit).map(({ story, ownerId }) => toCard(story, ownerId, user.id))
    return HttpResponse.json({
      items,
      limit,
      offset,
      nextOffset: offset + limit < all.length ? offset + limit : null,
    })
  }),

  http.get('/api/me/profile', ({ request }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    return HttpResponse.json(myProfileOut(profileOf(user)))
  }),

  http.patch('/api/me/profile', async ({ request }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const body = (await request.json()) as Record<string, unknown>
    const profile = profileOf(user)
    const errors: { type: string; loc: string[]; msg: string }[] = []
    const add = (field: string, type: string, msg: string) => errors.push({ type, loc: ['body', field], msg })
    const next = { ...profile }

    for (const key of Object.keys(body)) {
      if (!PROFILE_FIELDS.has(key)) add(key, 'extra_forbidden', 'Extra inputs are not permitted')
    }
    if ('displayName' in body) {
      const value = normalizeDisplayName(asText(body.displayName))
      if (!value) add('displayName', 'required', 'El nombre no puede quedar vacío.')
      else if (value.length > PROFILE_LIMITS.displayName) add('displayName', 'too_long', 'El nombre admite como mucho 64 caracteres.')
      else next.displayName = value
    }
    if ('handle' in body) {
      const value = asText(body.handle).trim().toLowerCase()
      if (!HANDLE_PATTERN.test(value)) {
        add('handle', 'handle_format', 'El handle va de 3 a 30 caracteres: letras minúsculas, números o guion bajo.')
      } else next.handle = value
    }
    if ('bio' in body) {
      const value = asText(body.bio).trim()
      if (value.length > PROFILE_LIMITS.bio) add('bio', 'too_long', 'La bio admite como mucho 280 caracteres.')
      else next.bio = value || null
    }
    if ('link' in body) {
      const value = asText(body.link).trim()
      if (value && linkProblem(value)) add('link', 'link_format', 'El enlace tiene que empezar por http:// o https://.')
      else next.link = value || null
    }
    for (const key of ['showPublished', 'showReading'] as const) {
      if (key in body) {
        if (typeof body[key] !== 'boolean') add(key, 'bool_type', 'Input should be a valid boolean')
        else next[key] = body[key]
      }
    }
    for (const field of ['displayName', 'handle', 'bio'] as const) {
      const content = typeof body[field] === 'string' ? contentProblem({ [field]: body[field] }) : null
      if (content && !errors.some((e) => e.loc[1] === field)) add(field, 'content_policy', content)
    }
    if (errors.length) return HttpResponse.json({ detail: errors }, { status: 422 })

    const owner = next.handle !== profile.handle ? userByHandle(next.handle) : null
    if (owner && owner.id !== user.id) return fieldError(409, 'handle', 'handle_taken', 'Ese handle ya está cogido.')

    Object.assign(profile, next)
    return HttpResponse.json(myProfileOut(profile))
  }),

  http.get('/api/profiles/:handle', ({ request, params }) => {
    const viewer = bearerUser(request)
    if (!viewer) return unauthorized()
    const owner = userByHandle(String(params.handle))
    if (!owner) return HttpResponse.json({ detail: 'Perfil no encontrado.' }, { status: 404 })
    const profile = profileOf(owner)
    const isOwner = owner.id === viewer.id
    // Como Explorar: sin confirmar no salen los +18 (el autor siempre ve los suyos).
    const adultOk = isOwner || flagsOf(viewer.id).adultConfirmed
    const published = customStoriesOf(owner.id)
      .filter((s) => s.isPublic && (adultOk || !s.adult))
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
      .map((s) => toCard(s, owner.id, viewer.id))
    // Para otros se omiten las partidas con historias privadas de terceros.
    const reading = readingOf(owner.id).filter((item) => {
      if (isOwner || item.origin !== 'propia') return true
      return findCustomStory(item.characterId)?.story.isPublic ?? false
    })
    const out: PublicProfile = {
      handle: profile.handle,
      displayName: profile.displayName,
      bio: profile.bio,
      link: profile.link,
      avatarUrl: profile.avatarUrl,
      bannerUrl: profile.bannerUrl,
      joinedAt: profile.joinedAt,
      isOwner,
      shelves: {
        published: {
          items: isOwner || profile.showPublished ? published : null,
          visibleToOthers: profile.showPublished,
        },
        reading: {
          items: isOwner || profile.showReading ? reading : null,
          visibleToOthers: profile.showReading,
        },
      },
    }
    return HttpResponse.json(out)
  }),

  http.post('/api/me/:kind', async ({ request, params }) => {
    const kind = String(params.kind)
    if (kind !== 'avatar' && kind !== 'banner') return undefined
    const user = bearerUser(request)
    if (!user) return unauthorized()
    if (!request.headers.get('Content-Type')?.startsWith('multipart/form-data')) {
      return fieldError(415, 'file', 'multipart_required', 'La imagen tiene que enviarse como multipart/form-data.')
    }
    const file = (await request.formData()).get('file')
    if (!(file instanceof Blob) || file.size === 0) return fieldError(422, 'file', 'missing', 'Falta la imagen.')
    const max = (kind === 'avatar' ? 2 : 4) * 1024 * 1024
    if (file.size > max) {
      return fieldError(413, 'file', 'file_too_large', `La imagen pesa demasiado: como mucho ${max / 1024 / 1024} MB.`)
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return fieldError(415, 'file', 'image_type', 'La imagen tiene que ser JPEG, PNG o WebP.')
    }
    const path = `/media/${kind}s/${hex32()}.webp`
    // El backend re-codifica a WebP; el mock guarda los bytes tal cual con su tipo original.
    uploadedMedia.set(path, { bytes: await file.arrayBuffer(), type: file.type })
    const profile = profileOf(user)
    const key = kind === 'avatar' ? 'avatarUrl' : 'bannerUrl'
    if (profile[key]) uploadedMedia.delete(profile[key])
    profile[key] = path
    return HttpResponse.json(myProfileOut(profile))
  }),

  http.delete('/api/me/:kind', ({ request, params }) => {
    const kind = String(params.kind)
    if (kind !== 'avatar' && kind !== 'banner') return undefined
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const profile = profileOf(user)
    const key = kind === 'avatar' ? 'avatarUrl' : 'bannerUrl'
    if (profile[key]) uploadedMedia.delete(profile[key])
    profile[key] = null
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/media/*', ({ request }) => {
    const path = new URL(request.url).pathname
    const uploaded = uploadedMedia.get(path)
    if (uploaded) return new HttpResponse(uploaded.bytes, { headers: { 'Content-Type': uploaded.type } })
    const seeded = SEED_MEDIA[path]
    if (seeded) return new HttpResponse(seeded, { headers: { 'Content-Type': 'image/svg+xml' } })
    return new HttpResponse(null, { status: 404 })
  }),

  http.delete('/api/custom-stories/:id', ({ request, params }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const list = customStoriesOf(user.id)
    const index = list.findIndex((s) => s.id === String(params.id))
    if (index === -1) return HttpResponse.json({ detail: CONTENT_MESSAGES.notFound }, { status: 404 })
    const [removed] = list.splice(index, 1)
    // Cascada, como el backend: se van también las partidas con ese personaje.
    for (const [storyId, story] of storyStore()) {
      if (story.userId === user.id && story.characterId === removed!.characterId) stories.delete(storyId)
    }
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/stories', ({ request }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const own = [...storyStore().values()].filter((s) => s.userId === user.id && s.status === 'activa')
    return HttpResponse.json(
      own.map(
        ({ id, characterId, characterName, state, status, archivedAt, closedAt, closedReason, updatedAt }): StorySummary => ({
          id,
          characterId,
          characterName,
          state,
          status,
          archivedAt,
          closedAt,
          closedReason,
          updatedAt,
        }),
      ),
    )
  }),

  http.post('/api/stories', async ({ request }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const body = (await request.json()) as { characterId?: string }
    const book = findBook(String(body.characterId), user.id)
    if (!book) return HttpResponse.json({ detail: 'Ese personaje no existe.' }, { status: 404 })
    const blocked = policyBlock(user.id, isAdultBook(book))
    if (blocked) return blocked
    const own = userStoriesFor(user.id, book.id)
    const active = own.find((s) => s.status === 'activa')
    // Ya hay partida activa: se devuelve tal cual, sin crear ni cobrar.
    if (active) return HttpResponse.json(storyOut(active))
    const free = freeFirstReadOf(book) && own.length === 0
    if (!free && walletOf(user.id).balance < READ_COST) {
      return HttpResponse.json({ detail: READ_SHORT }, { status: 402 })
    }
    const story = newStory(user.id, book)
    if (!free) addMovement(user.id, -READ_COST, 'lectura', story.id)
    return HttpResponse.json(storyOut(story), { status: 201 })
  }),

  http.get('/api/stories/:id', ({ request, params }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const story = ownStory(user.id, String(params.id))
    if (!story) {
      return HttpResponse.json({ detail: 'Historia no encontrada.' }, { status: 404 })
    }
    return HttpResponse.json(storyOut(story))
  }),

  http.post('/api/stories/:id/chat', async ({ request, params }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const story = ownStory(user.id, String(params.id))
    if (!story) {
      return HttpResponse.json({ detail: 'Historia no encontrada.' }, { status: 404 })
    }
    if (story.status === 'archivada') {
      return HttpResponse.json({ detail: 'Esta lectura está archivada.', code: 'story_archived' }, { status: 409 })
    }
    if (story.status === 'cerrada') return storyClosed(story, null)
    const adultBook = isAdultBook(findBook(story.characterId, user.id))
    const blocked = policyBlock(user.id, adultBook)
    if (blocked) return blocked
    // Como el backend: con capítulo pendiente el turno se rechaza antes de abrir el stream.
    if (story.state.chapter_locked) {
      return HttpResponse.json(
        {
          detail: 'Este capítulo está bloqueado. Desbloquéalo para seguir la historia.',
          code: 'chapter_locked',
          state: story.state,
        },
        { status: 409 },
      )
    }
    const body = (await request.json()) as { message?: string; choiceId?: string }
    const choice = story.state.quickChoices.find((c) => c.id === body.choiceId)
    if (body.choiceId && !choice) {
      return HttpResponse.json({ detail: 'Esa opción ya no está disponible.' }, { status: 422 })
    }
    const userText = choice?.message ?? body.message ?? ''
    // Disparadores del mock (ver POLICY_KEYWORDS). El mensaje que los provoca nunca se guarda.
    const lower = userText.toLowerCase()
    if (lower.includes(POLICY_KEYWORDS.closeAndRestrict) || lower.includes(POLICY_KEYWORDS.close)) {
      closeStory(story)
      recordIncident(story, lower.includes(POLICY_KEYWORDS.closeAndRestrict) ? 'prohibido' : 'explicito', userText)
      const until = lower.includes(POLICY_KEYWORDS.closeAndRestrict) ? restrictFor(user.id, 7) : null
      return storyClosed(story, until, POLICY_MESSAGES.closed)
    }
    if (lower.includes(POLICY_KEYWORDS.restrict)) return accountRestricted(restrictFor(user.id, 3))
    if (lower.includes(POLICY_KEYWORDS.redirect) || (adultBook && /expl[ií]cit/i.test(userText))) {
      return HttpResponse.json(
        { detail: POLICY_MESSAGES.redirected, code: 'content_redirected', reply: POLICY_MESSAGES.redirectReply },
        { status: 422 },
      )
    }
    // Lo último antes del stream, como en el backend: solo gasta cupo lo que llega al modelo.
    if (!DEV_USER_IDS.has(user.id) && turnsUsedToday(user.id) >= MOCK_TURNS_PER_DAY) {
      return HttpResponse.json(
        {
          detail: 'Has llegado al límite de turnos de hoy. La historia te espera: podrás seguir cuando se renueve el cupo.',
          code: 'daily_turn_limit',
          resetsAt: nextMidnightIso(),
          turnsLimit: MOCK_TURNS_PER_DAY,
        },
        { status: 429 },
      )
    }
    turnUsage.set(user.id, { day: localDay(), turns: turnsUsedToday(user.id) + 1 })
    const turn = story.state.turnCount + 1
    const reply = mockReplies[turn % mockReplies.length]!
    // Cada cuatro turnos tocaría fase nueva, pero en el mock toda fase nueva se paga: queda
    // bloqueada y el siguiente turno recibe un 409 hasta pasar por unlock-chapter.
    const wanted = Math.min(PHASES.length - 1, Math.floor(turn / 4))
    const current = story.state.phaseIndex
    story.state = stateFor(current, Math.min(100, story.state.affinity + 4), turn, wanted > current)
    story.updatedAt = nowIso()
    story.messages.push(
      { id: story.messages.length + 1, role: 'user', content: userText },
      { id: story.messages.length + 2, role: 'assistant', content: reply },
    )

    const events: StoryStreamEvent[] = [
      ...chunkText(reply, 18).map((text) => ({ event: 'token' as const, data: { text } })),
      {
        event: 'state',
        data: {
          ...story.state,
          transition: null,
          signals: [],
        },
      },
      { event: 'done', data: {} },
    ]
    return new HttpResponse(createStorySseStream(events), {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    })
  }),

  http.post('/api/stories/:id/unlock-chapter', async ({ request, params }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const story = ownStory(user.id, String(params.id))
    if (!story) return HttpResponse.json({ detail: 'Historia no encontrada.' }, { status: 404 })
    if (story.status === 'archivada') {
      return HttpResponse.json({ detail: 'Esta lectura está archivada.', code: 'story_archived' }, { status: 409 })
    }
    if (story.status === 'cerrada') return storyClosed(story, null)
    const blocked = policyBlock(user.id, isAdultBook(findBook(story.characterId, user.id)))
    if (blocked) return blocked
    if (!story.state.chapter_locked) {
      return HttpResponse.json({ detail: 'No hay ningún capítulo bloqueado.' }, { status: 409 })
    }
    if (walletOf(user.id).balance < CHAPTER_COST) {
      return HttpResponse.json(
        { detail: `No tienes suficientes ${MONEDA.plural} para desbloquear este capítulo.` },
        { status: 402 },
      )
    }
    await delay(150)
    const wallet = addMovement(user.id, -CHAPTER_COST, 'capitulo', story.id)
    const from = story.state.phase
    story.state = stateFor(story.state.phaseIndex + 1, story.state.affinity, story.state.turnCount, false, true)
    return HttpResponse.json({
      ...story.state,
      transition: { from, to: story.state.phase, reason: 'Capítulo desbloqueado (mock).' },
      signals: [],
      balance: wallet.balance,
    })
  }),

  http.get('/api/books/:bookId', ({ request, params }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const book = findBook(bookIdParam(params.bookId), user.id)
    return book ? HttpResponse.json(bookOut(book, user.id)) : bookNotFound()
  }),

  http.post('/api/books/:bookId/reread', async ({ request, params }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const book = findBook(bookIdParam(params.bookId), user.id)
    if (!book) return bookNotFound()
    const blocked = policyBlock(user.id, isAdultBook(book))
    if (blocked) return blocked
    const own = userStoriesFor(user.id, book.id)
    if (!own.length) {
      return HttpResponse.json({ detail: 'Todavía no has empezado este libro.', code: 'not_started' }, { status: 409 })
    }
    // Sin saldo no se archiva nada: cobro, archivo y creación van juntos.
    if (walletOf(user.id).balance < READ_COST) return HttpResponse.json({ detail: READ_SHORT }, { status: 402 })
    await delay(150)
    for (const s of own) {
      if (s.status === 'activa') Object.assign(s, { status: 'archivada', archivedAt: nowIso(), updatedAt: nowIso() })
    }
    const story = newStory(user.id, book)
    addMovement(user.id, -READ_COST, 'lectura', story.id)
    return HttpResponse.json(storyOut(story), { status: 201 })
  }),

  http.get('/api/books/:bookId/history', ({ request, params }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const book = findBook(bookIdParam(params.bookId), user.id)
    if (!book) return bookNotFound()
    const endOf = (s: MockStory) => s.archivedAt ?? s.closedAt ?? ''
    const items: HistoryItem[] = userStoriesFor(user.id, book.id)
      .filter((s) => s.status !== 'activa')
      .sort((a, b) => endOf(b).localeCompare(endOf(a)))
      .map((s) => ({
        storyId: s.id,
        status: s.status,
        startedAt: s.createdAt ?? null,
        archivedAt: s.archivedAt,
        closedAt: s.closedAt,
        phase: s.state.phase,
        phaseLabel: s.state.phaseLabel,
        phaseIndex: s.state.phaseIndex,
        phaseCount: s.state.phaseCount,
        affinity: s.state.affinity,
      }))
    return HttpResponse.json(items)
  }),

  /**
   * Mismo criterio que el backend: +2 mismo tono (sin mayúsculas ni acentos), +1 mismo modo u
   * origen, +1 mismo autor; desempata por lectores y luego por título. Solo públicos o de Psique.
   */
  http.get('/api/books/:bookId/recommended', ({ request, params }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const current = findBook(bookIdParam(params.bookId), user.id)
    if (!current) return bookNotFound()
    const kind = (b: MockBook) => b.custom?.mode ?? b.origin
    const tone = normalizeTone(current.custom?.tone ?? null)
    const candidates: MockBook[] = [
      ...mockCharacters.map((c) => findBook(c.id, user.id)!),
      ...allPublicStories().map(({ story, ownerId }): MockBook => ({
        id: story.characterId,
        origin: 'propia',
        character: null,
        custom: story,
        ownerId,
      })),
    ].filter((b) => b.id !== current.id)
    const scored = candidates.map((b) => {
      let score = 0
      if (tone && normalizeTone(b.custom?.tone ?? null) === tone) score += 2
      if (kind(b) === kind(current)) score += 1
      if (current.ownerId && b.ownerId === current.ownerId) score += 1
      return { card: bookCard(b), score }
    })
    scored.sort(
      (a, b) => b.score - a.score || b.card.readers - a.card.readers || a.card.title.localeCompare(b.card.title, 'es'),
    )
    return HttpResponse.json(scored.slice(0, 6).map((s) => s.card))
  }),

  http.get('/api/books/:bookId/reviews', ({ request, params }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const book = findBook(bookIdParam(params.bookId), user.id)
    if (!book) return bookNotFound()
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') ?? 10)
    const offset = Number(url.searchParams.get('offset') ?? 0)
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) return fieldError(422, 'limit', 'less_than_equal', 'Límite no válido')
    if (!Number.isInteger(offset) || offset < 0) return fieldError(422, 'offset', 'greater_than_equal', 'Offset no válido')
    const all = reviewStore()
      .filter((r) => r.bookId === book.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    return HttpResponse.json({
      items: all.slice(offset, offset + limit).map((r) => reviewOut(r, user.id)),
      limit,
      offset,
      nextOffset: offset + limit < all.length ? offset + limit : null,
    })
  }),

  http.put('/api/books/:bookId/reviews/me', async ({ request, params }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const book = findBook(bookIdParam(params.bookId), user.id)
    if (!book) return bookNotFound()
    const body = (await request.json()) as { rating?: unknown; text?: unknown }
    const rating = body.rating
    if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return fieldError(422, 'rating', 'value_error', 'La nota va de 1 a 5.')
    }
    if (body.text != null && typeof body.text !== 'string') {
      return fieldError(422, 'text', 'string_type', 'Input should be a valid string')
    }
    const text = typeof body.text === 'string' ? body.text.trim() || null : null
    if (text && text.length > 1000) {
      return fieldError(422, 'text', 'string_too_long', 'La reseña admite como mucho 1000 caracteres.')
    }
    const content = text ? contentProblem({ text }) : null
    if (content) return fieldError(422, 'text', 'content_policy', content)
    if (book.ownerId === user.id) {
      return HttpResponse.json({ detail: 'No puedes reseñar tu propio libro.', code: 'own_book' }, { status: 403 })
    }
    if (!userStoriesFor(user.id, book.id).length) {
      return HttpResponse.json(
        { detail: 'Solo puedes reseñar libros que hayas empezado.', code: 'not_started' },
        { status: 403 },
      )
    }
    const existing = reviewStore().find((r) => r.bookId === book.id && r.userId === user.id)
    if (existing) {
      Object.assign(existing, { rating, text, updatedAt: nowIso() })
      return HttpResponse.json(reviewOut(existing, user.id))
    }
    const review: MockReview = {
      id: ++reviewSeq,
      userId: user.id,
      bookId: book.id,
      rating,
      text,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    reviewStore().push(review)
    return HttpResponse.json(reviewOut(review, user.id), { status: 201 })
  }),

  http.delete('/api/books/:bookId/reviews/me', ({ request, params }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const bookId = bookIdParam(params.bookId)
    const list = reviewStore()
    const index = list.findIndex((r) => r.bookId === bookId && r.userId === user.id)
    if (index === -1) return HttpResponse.json({ detail: 'No has reseñado este libro.' }, { status: 404 })
    list.splice(index, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/me/wallet', ({ request }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    return HttpResponse.json(walletOf(user.id))
  }),

  http.post('/api/dev/obolos', async ({ request }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const body = (await request.json()) as { amount?: number }
    return HttpResponse.json(addMovement(user.id, Math.trunc(Number(body.amount) || 0), 'ajuste_dev', null))
  }),

  http.get('/api/scratch-cards/today', ({ request }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const pending = cardsToday(user.id).find((c) => !c.revealed)
    return HttpResponse.json({
      remaining: remainingCards(user.id),
      daily_limit: SCRATCH_DAILY_LIMIT,
      prize: SCRATCH_PRIZE,
      winning_number: SCRATCH_WINNING_NUMBER,
      pending_card: pending ? { id: pending.id, created_at: pending.createdAt } : null,
    })
  }),

  http.post('/api/scratch-cards', async ({ request }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const pending = cardsToday(user.id).find((c) => !c.revealed)
    if (pending) {
      return HttpResponse.json({ id: pending.id, created_at: pending.createdAt, remaining: remainingCards(user.id) })
    }
    if (remainingCards(user.id) === 0) {
      return HttpResponse.json({ detail: 'Ya has rascado todas las tarjetas de hoy.' }, { status: 409 })
    }
    // El número se decide al crear la tarjeta, nunca al rascar.
    const card: MockCard = {
      id: ++scratchCardSeq,
      userId: user.id,
      createdAt: nowIso(),
      number: Math.floor(Math.random() * 10) + 1,
      revealed: false,
    }
    scratchCards.set(card.id, card)
    return HttpResponse.json(
      { id: card.id, created_at: card.createdAt, remaining: remainingCards(user.id) },
      { status: 201 },
    )
  }),

  http.post('/api/scratch-cards/:id/reveal', async ({ request, params }) => {
    const user = bearerUser(request)
    if (!user) return unauthorized()
    const card = scratchCards.get(Number(params.id))
    if (!card || card.userId !== user.id) {
      return HttpResponse.json({ detail: 'Tarjeta no encontrada.' }, { status: 404 })
    }
    const won = card.number === SCRATCH_WINNING_NUMBER
    // Idempotente: el premio se abona solo la primera vez.
    if (!card.revealed) {
      card.revealed = true
      if (won) addMovement(user.id, SCRATCH_PRIZE, 'rasca', String(card.id))
    }
    await delay(150)
    return HttpResponse.json({
      id: card.id,
      number: card.number,
      won,
      prize: won ? SCRATCH_PRIZE : 0,
      balance: walletOf(user.id).balance,
      remaining: remainingCards(user.id),
    })
  }),
]

/** Para tests: vuelve a las historias propias de partida. */
/** Para tests: fija los turnos gastados hoy por una cuenta. */
export function __setTurnsUsed(userId: string, turns: number) {
  turnUsage.set(userId, { day: localDay(), turns })
}

export function __resetCustomStories() {
  for (const u of [DEMO_USER, DEV_USER, ...OTHER_USERS]) users.set(u.username, u)
  turnUsage.clear()
  customStories.clear()
  profiles = null
  uploadedMedia.clear()
  wallets.clear()
  scratchCards.clear()
  reviews = null
  accountFlags.clear()
  incidents = null
  incidentSeq = 0
  for (const [id, story] of stories) if (story.userId === DEMO_USER.id) stories.delete(id)
  demoSeeded = false
}

/**
 * Para tests: estado del mock como recién cargado, incluidas sesiones y secuencias. Lo llama
 * tests/setup.ts antes de cada test para que ninguno dependa del orden ni herede nada.
 */
export function __resetMockState() {
  __resetCustomStories()
  stories.clear()
  sessions.clear()
  lastRefreshToken = null
  refreshFailOnce = false
  scratchCardSeq = 0
  reviewSeq = 0
}

/** Para tests: restringe la cuenta durante unos días, como tras tres cierres. */
export function __restrictAccount(userId: string, days: number) {
  return restrictFor(userId, days)
}

/** Para tests: la cuenta aceptó una versión anterior de los términos (o la vigente, con true). */
export function __setTermsAccepted(userId: string, accepted: boolean) {
  flagsOf(userId).termsVersion = accepted ? LEGAL_VERSION : '2020-01-01'
}

/** Para tests: el siguiente refresh falla una vez. */
export function __failNextRefresh() {
  refreshFailOnce = true
}
