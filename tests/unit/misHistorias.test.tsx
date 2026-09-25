import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  customStoryFieldErrors,
  deleteCustomStoryCover,
  fetchCustomStory,
  fetchCustomStoryStats,
  fieldErrorsFrom,
  updateCustomStory,
  type CustomStory,
} from '@/api/customStories'
import { COVER_ANGLES, COVER_STOPS, coverFallback, coverInitial } from '@/features/customStories/coverFallback'
import { MyStoryCard } from '@/features/customStories/MyStoryCard'
import { DEMO_USER, seedCustomStories } from '@/mocks/fixtures'
import { __resetCustomStories } from '@/mocks/handlers'
import { routes } from '@/router/paths'
import { AppShell } from '@/shared/layout/AppShell'
import { ApiError, apiClient } from '@/shared/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'

const [CONCEPTO, DEFINIDA] = seedCustomStories()

async function loginDemo() {
  const data = await apiClient<{ access_token: string; user: never }>('/api/auth/login', {
    method: 'POST',
    body: { login: DEMO_USER.username, password: DEMO_USER.password },
    skipAuthRefresh: true,
  })
  useAuthStore.getState().setSession({ accessToken: data.access_token, user: data.user })
}

function renderWithProviders(ui: ReactNode, path = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(async () => {
  __resetCustomStories()
  await loginDemo()
})

describe('coverFallback', () => {
  it('es determinista: el mismo id da siempre el mismo fondo', () => {
    const uno = coverFallback('1084427a03094ac590adbb943a02f801')
    const otra = coverFallback('1084427a03094ac590adbb943a02f801')
    expect(uno).toEqual(otra)
    expect(uno.background).toBe(`linear-gradient(${uno.angle}deg, var(${uno.from}), var(${uno.to}))`)
  })

  it('solo usa colores de los tokens y ángulos de la lista', () => {
    const tokens = new Set(COVER_STOPS.flat())
    for (const id of ['a', 'b', 'c', 'ffff', '1084427a03094ac590adbb943a02f801', '5f0c9d2e7b8a4c1f9e3d6a5b4c3d2e1f']) {
      const fondo = coverFallback(id)
      expect(tokens.has(fondo.from)).toBe(true)
      expect(tokens.has(fondo.to)).toBe(true)
      expect(COVER_ANGLES).toContain(fondo.angle)
    }
  })

  it('reparte: ids distintos no caen todos en la misma pareja', () => {
    const ids = Array.from({ length: 60 }, (_, i) => `historia-${i}`)
    const parejas = new Set(ids.map((id) => `${coverFallback(id).from}|${coverFallback(id).to}`))
    expect(parejas.size).toBeGreaterThan(1)
  })

  it('la inicial sale del título y aguanta los títulos raros', () => {
    expect(coverInitial('  café a medianoche')).toBe('C')
    expect(coverInitial('')).toBe('?')
  })
})

describe('MyStoryCard', () => {
  it('pinta los badges de estado y enlaza al detalle y a la vista de lector', () => {
    renderWithProviders(<MyStoryCard story={CONCEPTO} />)

    expect(screen.getByText('Privada')).toBeInTheDocument()
    expect(screen.getByText('Concepto')).toBeInTheDocument()
    expect(screen.getByText('Primera lectura gratis')).toBeInTheDocument()
    expect(screen.queryByText('+18')).not.toBeInTheDocument()

    expect(screen.getByRole('link', { name: CONCEPTO.title })).toHaveAttribute(
      'href',
      routes.misHistoriaDetalle(CONCEPTO.id),
    )
    expect(screen.getByRole('link', { name: `Ver ${CONCEPTO.title} como lector` })).toHaveAttribute(
      'href',
      routes.book(CONCEPTO.characterId),
    )
  })

  it('cambia los badges según el estado de la historia', () => {
    const adulta: CustomStory = { ...DEFINIDA, adult: true, freeFirstRead: false }
    renderWithProviders(<MyStoryCard story={adulta} />)

    expect(screen.getByText('Pública')).toBeInTheDocument()
    expect(screen.getByText('Definida')).toBeInTheDocument()
    expect(screen.getByText('+18')).toBeInTheDocument()
    expect(screen.queryByText('Primera lectura gratis')).not.toBeInTheDocument()
  })

  it('sin portada dibuja el fondo generado; con portada, la imagen', () => {
    const { unmount } = renderWithProviders(<MyStoryCard story={CONCEPTO} />)
    const fondo = screen.getByTestId('portada-generada')
    expect(fondo).toHaveStyle({ background: coverFallback(CONCEPTO.id).background })
    // Decorativo: la inicial no la lee nadie, el título va al lado en texto.
    expect(fondo).toHaveAttribute('aria-hidden', 'true')
    unmount()

    renderWithProviders(<MyStoryCard story={DEFINIDA} />)
    expect(screen.queryByTestId('portada-generada')).not.toBeInTheDocument()
    const img = document.querySelector('img')!
    expect(img).toHaveAttribute('src', DEFINIDA.coverUrl)
    expect(img).toHaveAttribute('alt', '')
    expect(img).toHaveAttribute('loading', 'lazy')
  })

  it('solo enseña las acciones que recibe y avisa sin mutar nada', async () => {
    const user = userEvent.setup()
    const onEditar = vi.fn()
    const onVisibilidad = vi.fn()
    renderWithProviders(<MyStoryCard story={CONCEPTO} onEditar={onEditar} onVisibilidad={onVisibilidad} />)

    expect(screen.queryByRole('button', { name: `Borrar ${CONCEPTO.title}` })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: `Portada de ${CONCEPTO.title}` })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: `Editar ${CONCEPTO.title}` }))
    expect(onEditar).toHaveBeenCalledWith(CONCEPTO)

    // Privada: el botón ofrece publicar y manda el valor que hay que guardar.
    await user.click(screen.getByRole('button', { name: `Publicar ${CONCEPTO.title}` }))
    expect(onVisibilidad).toHaveBeenCalledWith(CONCEPTO, true)
  })

  it('una historia pública ofrece despublicar', () => {
    renderWithProviders(<MyStoryCard story={DEFINIDA} onVisibilidad={vi.fn()} />)
    expect(screen.getByRole('button', { name: `Despublicar ${DEFINIDA.title}` })).toBeInTheDocument()
  })

  it('sin métricas no se inventa ninguna; con ellas las enseña', () => {
    const { unmount } = renderWithProviders(<MyStoryCard story={DEFINIDA} />)
    expect(screen.queryByText('lectoras')).not.toBeInTheDocument()
    expect(screen.queryByText('reseñas')).not.toBeInTheDocument()
    unmount()

    renderWithProviders(
      <MyStoryCard story={DEFINIDA} stats={{ readers: 12, ratingAverage: 4.5, reviewCount: 3 }} />,
    )
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('4,5')).toBeInTheDocument()
    expect(screen.getByText('reseñas')).toBeInTheDocument()
  })

  it('no anida interactivos: ningún botón cuelga de un enlace', () => {
    renderWithProviders(
      <MyStoryCard story={DEFINIDA} onEditar={vi.fn()} onPortada={vi.fn()} onVisibilidad={vi.fn()} onBorrar={vi.fn()} />,
    )
    for (const boton of screen.getAllByRole('button')) {
      expect(boton.closest('a')).toBeNull()
    }
  })
})

describe('Cabecera: navegación con iconos', () => {
  it('"Rasca y gana" queda solo con icono pero conserva su nombre accesible', async () => {
    renderWithProviders(
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<p>Inicio</p>} />
        </Route>
      </Routes>,
    )

    const enlace = await screen.findByRole('link', { name: 'Rasca y gana' })
    expect(enlace).toHaveAttribute('href', routes.rascaYGana)
    expect(enlace).toHaveAttribute('title', 'Rasca y gana')
    // Solo icono: no queda texto visible dentro del enlace.
    expect(enlace).toHaveTextContent('')
    // Las demás entradas siguen leyéndose por su texto.
    expect(screen.getByRole('link', { name: 'Explorar' })).toHaveAttribute('href', routes.explorar)
    expect(screen.getByRole('link', { name: 'Crear historia' })).toHaveAttribute('href', routes.nuevaHistoria)
  })

  it('la navegación principal lleva a Mis historias', async () => {
    renderWithProviders(
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<p>Inicio</p>} />
        </Route>
      </Routes>,
    )

    const principal = await screen.findByRole('navigation', { name: 'Principal' })
    const enlace = within(principal).getByRole('link', { name: 'Mis historias' })
    expect(enlace).toHaveAttribute('href', routes.misHistorias)
    // Con texto, no solo icono: es una entrada que se usa a diario.
    expect(enlace).toHaveTextContent('Mis historias')
  })
})

describe('API de historias propias (mock)', () => {
  it('trae el detalle y responde 404 con detalle en texto si no es tuya', async () => {
    const story = await fetchCustomStory(CONCEPTO.id)
    expect(story.title).toBe(CONCEPTO.title)
    expect(story.description).toBeNull()
    expect(story.coverUrl).toBeNull()

    await expect(fetchCustomStory('0'.repeat(32))).rejects.toMatchObject({
      status: 404,
      message: 'Historia propia no encontrada.',
    })
  })

  it('trae las métricas con sus reseñas recientes', async () => {
    const stats = await fetchCustomStoryStats(DEFINIDA.id)
    expect(stats).toMatchObject({
      readers: expect.any(Number),
      activeStories: expect.any(Number),
      reviewCount: expect.any(Number),
    })
    expect(stats.recentReviews.length).toBeLessThanOrEqual(5)
  })

  /**
   * La subida (multipart) no se puede probar aquí: en jsdom el `File` global no es el que
   * reconoce el parser de undici y `request.formData()` revienta dentro del mock. Por eso el
   * repo tampoco tiene test unitario de avatar ni de banner. Se cubre en e2e (fase 2).
   */
  it('quita la portada y repetirlo sigue respondiendo 204', async () => {
    await expect(deleteCustomStoryCover(DEFINIDA.id)).resolves.toBeUndefined()
    expect((await fetchCustomStory(DEFINIDA.id)).coverUrl).toBeNull()
    await expect(deleteCustomStoryCover(DEFINIDA.id)).resolves.toBeUndefined()

    await expect(deleteCustomStoryCover('0'.repeat(32))).rejects.toMatchObject({ status: 404 })
  })

  it('la historia sembrada con portada la trae en el detalle', async () => {
    expect((await fetchCustomStory(DEFINIDA.id)).coverUrl).toBe(DEFINIDA.coverUrl)
  })

  it('edita título, gancho y descripción, y vaciar la descripción la borra', async () => {
    const editada = await updateCustomStory(DEFINIDA.id, {
      title: 'Café al alba',
      hook: 'La cafetería cierra al amanecer y alguien no se quiere ir.',
      description: 'Una noche larga.',
    })
    expect(editada.title).toBe('Café al alba')
    expect(editada.description).toBe('Una noche larga.')

    expect((await updateCustomStory(DEFINIDA.id, { description: '' })).description).toBeNull()
    expect((await updateCustomStory(DEFINIDA.id, { description: null })).description).toBeNull()
  })

  it('una descripción demasiado larga es un error de ese campo', async () => {
    const error = await updateCustomStory(DEFINIDA.id, { description: 'x'.repeat(1001) }).catch((e: unknown) => e)
    expect((error as ApiError).status).toBe(422)
    expect(customStoryFieldErrors(error)).toEqual({
      description: 'La descripción admite como mucho 1000 caracteres.',
    })
  })

  it('los campos de personaje en modo concepto son un error general en texto', async () => {
    const error = await updateCustomStory(CONCEPTO.id, { name: 'Aitana' }).catch((e: unknown) => e)
    expect((error as ApiError).status).toBe(422)
    // Sin campo al que señalar: va al mensaje general.
    expect(customStoryFieldErrors(error)).toEqual({})
    expect((error as ApiError).message).toMatch(/modo concepto/i)
  })

  it('premise no es editable y cae como campo no permitido', async () => {
    const error = await updateCustomStory(CONCEPTO.id, { premise: 'otra' } as never).catch((e: unknown) => e)
    expect(customStoryFieldErrors(error)).toEqual({ premise: 'Extra inputs are not permitted' })
  })
})

describe('customStoryFieldErrors', () => {
  it('lee el campo esté anidado el modo o no', () => {
    const anidado = new ApiError(422, 'x', {
      detail: [{ loc: ['body', 'definida', 'age'], msg: 'Value error, Edad no válida' }],
    })
    const plano = new ApiError(422, 'x', {
      detail: [{ loc: ['body', 'description'], msg: 'La descripción admite como mucho 1000 caracteres.' }],
    })
    const subida = new ApiError(415, 'x', { detail: [{ loc: ['body', 'file'], msg: 'Formato no válido.' }] })

    expect(customStoryFieldErrors(anidado)).toEqual({ age: 'Edad no válida' })
    expect(customStoryFieldErrors(plano)).toEqual({
      description: 'La descripción admite como mucho 1000 caracteres.',
    })
    expect(customStoryFieldErrors(subida)).toEqual({ file: 'Formato no válido.' })
    // `fieldErrorsFrom` sigue siendo solo para los 422 del formulario de creación.
    expect(fieldErrorsFrom(subida)).toEqual({})
  })
})
