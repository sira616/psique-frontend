/** Contrato de la API de historias. Espejo de `app/schemas/story.py` del backend. */

export type PhaseId = 'conocerse' | 'confianza' | 'tension' | 'conflicto' | 'desenlace'

/** `message` es el texto que se guarda y se manda al modelo si se elige. */
export type QuickChoice = { id: string; label: string; message: string }

export type StoryState = {
  phase: PhaseId
  phaseLabel: string
  phaseIndex: number
  phaseCount: number
  affinity: number
  turnCount: number
  /** Escena o tema en curso al que responden las sugerencias. */
  scene?: string | null
  quickChoices: QuickChoice[]
  /** Economía: el capítulo siguiente espera a que se pague. Opcionales por compatibilidad. */
  chapter_locked?: boolean
  next_phase?: string | null
  chapter_cost?: number
}

export type PhaseTransition = { from: PhaseId; to: PhaseId; reason: string }

export type StateEventData = StoryState & {
  transition: PhaseTransition | null
  signals: string[]
}

/** Eventos SSE de `POST /api/stories/{id}/chat`. */
export type StoryStreamEvent =
  | { event: 'token'; data: { text: string } }
  | { event: 'state'; data: StateEventData }
  | { event: 'error'; data: { message: string } }
  | { event: 'done'; data: Record<string, never> }

export type CharacterOrigin = 'psique' | 'propia'
export type CustomStoryMode = 'definida' | 'concepto'

/**
 * En las propias de modo concepto el perfil se descubre jugando: name, age, tagline,
 * traits y scenario llegan a null. title y hook siempre vienen.
 */
export type Character = {
  id: string
  origin: CharacterOrigin
  mode: CustomStoryMode | null
  title: string
  hook: string
  name: string | null
  age: number | null
  tagline: string | null
  traits: string[] | null
  scenario: string | null
}

export type StoryMessage = {
  id: number | string
  role: 'user' | 'assistant'
  content: string
  createdAt?: string | null
}

/** Solo hay una partida `activa` por usuario y libro; al releer, la anterior pasa a `archivada`. */
export type StoryStatus = 'activa' | 'archivada'

export type Story = {
  id: string
  characterId: string
  characterName: string
  state: StoryState
  messages: StoryMessage[]
  facts: { key: string; value: string }[]
  status: StoryStatus
  archivedAt: string | null
  createdAt?: string | null
}

export type StorySummary = {
  id: string
  characterId: string
  characterName: string
  state: StoryState
  status: StoryStatus
  archivedAt: string | null
  updatedAt?: string | null
}

/**
 * Parte un buffer SSE en eventos completos. Devuelve lo que sobra (un evento a medias)
 * para concatenarlo con el siguiente trozo.
 */
export function parseSseBuffer(buffer: string): { events: StoryStreamEvent[]; rest: string } {
  const blocks = buffer.replace(/\r\n/g, '\n').split('\n\n')
  const rest = blocks.pop() ?? ''
  const events: StoryStreamEvent[] = []
  for (const block of blocks) {
    let name: string | null = null
    const dataLines: string[] = []
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) name = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
    }
    if (!name || dataLines.length === 0) continue
    try {
      events.push({ event: name, data: JSON.parse(dataLines.join('\n')) } as StoryStreamEvent)
    } catch {
      // Un evento corrupto no debe tumbar el resto del turno.
    }
  }
  return { events, rest }
}
