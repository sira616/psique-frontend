import { describe, expect, it } from 'vitest'
import { parseSseBuffer } from '@/shared/lib/events'

describe('parseSseBuffer', () => {
  it('parte eventos con nombre y guarda el resto incompleto', () => {
    const buffer =
      'event: token\ndata: {"text":"Hola. "}\n\n' +
      'event: state\ndata: {"phase":"conocerse","affinity":25}\n\n' +
      'event: tok'
    const { events, rest } = parseSseBuffer(buffer)
    expect(events.map((e) => e.event)).toEqual(['token', 'state'])
    expect(events[0]).toEqual({ event: 'token', data: { text: 'Hola. ' } })
    expect(rest).toBe('event: tok')
  })

  it('acepta CRLF e ignora bloques corruptos o sin nombre', () => {
    const buffer = 'event: token\r\ndata: {roto\r\n\r\ndata: {"a":1}\r\n\r\nevent: done\r\ndata: {}\r\n\r\n'
    const { events, rest } = parseSseBuffer(buffer)
    expect(events).toEqual([{ event: 'done', data: {} }])
    expect(rest).toBe('')
  })
})
