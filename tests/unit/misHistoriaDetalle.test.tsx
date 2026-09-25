import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import type { CustomStoryStats } from '@/api/customStories'
import { CONTENT_MESSAGES, DEMO_USER, seedCustomStories } from '@/mocks/fixtures'
import { __resetCustomStories } from '@/mocks/handlers'
import { server } from '@/mocks/server'
import { MyStoryDetailPage } from '@/pages/MyStoryDetail'
import { routes } from '@/router/paths'
import { apiClient } from '@/shared/lib/apiClient'
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

function renderDetalle(id: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[routes.misHistoriaDetalle(id)]}>
        <Routes>
          <Route path="/mis-historias/:storyId" element={<MyStoryDetailPage />} />
          <Route path={routes.misHistorias} element={<h1>Mis historias</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function seccion(name: string) {
  return screen.getByRole('region', { name })
}

beforeEach(async () => {
  __resetCustomStories()
  await loginDemo()
})

describe('detalle de una historia propia: carga', () => {
  it('abre la cabecera con título, gancho, estado, fechas y la vista de lectores', async () => {
    renderDetalle(DEFINIDA.id)

    expect(await screen.findByRole('heading', { level: 1, name: DEFINIDA.title })).toBeInTheDocument()
    expect(screen.getByText(DEFINIDA.hook, { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText('Pública')).toBeInTheDocument()
    expect(screen.getByText('Definida')).toBeInTheDocument()
    expect(screen.getByText(/con Carmen Ruiz, 34 años/)).toBeInTheDocument()
    expect(screen.getByText(/Creada el 15 de septiembre de 2026/)).toBeInTheDocument()
    expect(screen.getByText(/Publicada el 15 de septiembre de 2026/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver como lectores' })).toHaveAttribute(
      'href',
      routes.book(DEFINIDA.characterId),
    )
  })

  it('una historia de otra cuenta se ve como «no encontrada», sin error crudo', async () => {
    renderDetalle('0'.repeat(32))

    expect(await screen.findByRole('heading', { level: 1, name: 'No encontramos esta historia' })).toBeInTheDocument()
    expect(screen.getByText(/sea de otra cuenta/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a Mis historias' })).toHaveAttribute('href', routes.misHistorias)
    // Ni el detalle en bruto del backend ni una pantalla en blanco.
    expect(screen.queryByText('Historia propia no encontrada.')).not.toBeInTheDocument()
  })

  it('una fecha de publicación vacía se dice, no se deja en blanco', async () => {
    renderDetalle(CONCEPTO.id)
    expect(await screen.findByText('Sin publicar todavía')).toBeInTheDocument()
  })
})

describe('detalle: edición de la historia', () => {
  it('guarda solo los campos que han cambiado', async () => {
    const user = userEvent.setup()
    let body: unknown
    server.use(
      http.patch('/api/custom-stories/:id', async ({ request }) => {
        body = await request.clone().json()
        return undefined
      }),
    )
    renderDetalle(DEFINIDA.id)

    const titulo = await screen.findByLabelText('Título')
    await user.clear(titulo)
    await user.click(titulo)
    await user.paste('Café al alba')
    await user.click(within(seccion('La historia')).getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(body).toEqual({ title: 'Café al alba' }))
    expect(await within(seccion('La historia')).findByText('Cambios guardados.')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 1, name: 'Café al alba' })).toBeInTheDocument()
  })

  it('sin cambios no manda nada y lo dice', async () => {
    const user = userEvent.setup()
    let patched = false
    server.use(
      http.patch('/api/custom-stories/:id', () => {
        patched = true
        return undefined
      }),
    )
    renderDetalle(DEFINIDA.id)

    await screen.findByLabelText('Título')
    await user.click(within(seccion('La historia')).getByRole('button', { name: 'Guardar cambios' }))

    expect(await within(seccion('La historia')).findByText('No hay nada nuevo que guardar.')).toBeInTheDocument()
    expect(patched).toBe(false)
  })

  it('vaciar la descripción la borra', async () => {
    const user = userEvent.setup()
    let body: unknown
    server.use(
      http.patch('/api/custom-stories/:id', async ({ request }) => {
        body = await request.clone().json()
        return undefined
      }),
    )
    renderDetalle(DEFINIDA.id)

    const descripcion = await screen.findByLabelText('Descripción')
    expect(descripcion).toHaveValue(DEFINIDA.description)
    await user.clear(descripcion)
    await user.click(within(seccion('La historia')).getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(body).toEqual({ description: null }))
  })

  it('pasarse del límite se marca en el campo antes de enviar', async () => {
    const user = userEvent.setup()
    let patched = false
    server.use(
      http.patch('/api/custom-stories/:id', () => {
        patched = true
        return undefined
      }),
    )
    renderDetalle(DEFINIDA.id)

    const descripcion = await screen.findByLabelText('Descripción')
    await user.clear(descripcion)
    await user.click(descripcion)
    // Pegar de más no se recorta en silencio: se marca.
    await user.paste('x'.repeat(1001))
    await user.click(within(seccion('La historia')).getByRole('button', { name: 'Guardar cambios' }))

    expect(descripcion).toHaveAttribute('aria-invalid', 'true')
    expect(descripcion).toHaveAccessibleDescription(/Como mucho 1000 caracteres/)
    expect(descripcion).toHaveFocus()
    expect(patched).toBe(false)
  })

  it('un 422 por campo del backend marca ese campo, lo enfoca y no guarda nada', async () => {
    const user = userEvent.setup()
    server.use(
      http.patch('/api/custom-stories/:id', () =>
        HttpResponse.json(
          { detail: [{ type: 'too_short', loc: ['body', 'title'], msg: 'Value error, El título necesita al menos 3 caracteres.' }] },
          { status: 422 },
        ),
      ),
    )
    renderDetalle(DEFINIDA.id)

    const titulo = await screen.findByLabelText('Título')
    await user.clear(titulo)
    await user.click(titulo)
    await user.paste('Café al alba')
    await user.click(within(seccion('La historia')).getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(titulo).toHaveAttribute('aria-invalid', 'true'))
    expect(titulo).toHaveAccessibleDescription(/necesita al menos 3 caracteres/)
    expect(titulo).toHaveFocus()
    // Un PATCH rechazado no guarda nada: la cabecera sigue con el título de antes.
    expect(screen.getByRole('heading', { level: 1, name: DEFINIDA.title })).toBeInTheDocument()
  })

  it('un 422 general (filtro de contenido) se enseña como alerta del formulario', async () => {
    const user = userEvent.setup()
    renderDetalle(DEFINIDA.id)

    const gancho = await screen.findByLabelText('Gancho')
    await user.clear(gancho)
    await user.click(gancho)
    await user.paste('Una escena sexual explícita en la cafetería')
    const form = within(seccion('La historia')).getByRole('button', { name: 'Guardar cambios' }).closest('form')!
    await user.click(within(seccion('La historia')).getByRole('button', { name: 'Guardar cambios' }))

    const alerta = await within(seccion('La historia')).findByRole('alert')
    expect(alerta).toHaveTextContent(CONTENT_MESSAGES.sexual)
    // Asociada al formulario, no solo pintada de rojo.
    expect(form).toHaveAttribute('aria-describedby', alerta.id)
    expect(gancho).not.toHaveAttribute('aria-invalid')
  })
})

describe('detalle: el personaje', () => {
  it('en modo definida se edita y avisa de las partidas en curso', async () => {
    const user = userEvent.setup()
    let body: unknown
    server.use(
      http.patch('/api/custom-stories/:id', async ({ request }) => {
        body = await request.clone().json()
        return undefined
      }),
    )
    renderDetalle(DEFINIDA.id)

    const personaje = await waitFor(() => seccion('El personaje'))
    expect(within(personaje).getByText(/afectan a las partidas/)).toBeInTheDocument()
    expect(within(personaje).getByText(/en cada turno/)).toBeInTheDocument()
    expect(within(personaje).getByText(/notará el cambio en su siguiente mensaje/)).toBeInTheDocument()
    expect(within(personaje).getByText(/El saludo ya enviado y lo ya jugado no cambian/)).toBeInTheDocument()

    const nombre = within(personaje).getByLabelText('Nombre del personaje')
    await user.clear(nombre)
    await user.click(nombre)
    await user.paste('Carmen Ruiz de Alda')
    await user.click(within(personaje).getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(body).toEqual({ name: 'Carmen Ruiz de Alda' }))
  })

  it('una edad de menores se para antes de enviar', async () => {
    const user = userEvent.setup()
    let patched = false
    server.use(
      http.patch('/api/custom-stories/:id', () => {
        patched = true
        return undefined
      }),
    )
    renderDetalle(DEFINIDA.id)

    const personaje = await waitFor(() => seccion('El personaje'))
    const edad = within(personaje).getByLabelText('Edad')
    await user.clear(edad)
    await user.click(edad)
    await user.paste('17')
    await user.click(within(personaje).getByRole('button', { name: 'Guardar cambios' }))

    expect(edad).toHaveAttribute('aria-invalid', 'true')
    expect(edad).toHaveAccessibleDescription(/tienen que ser adultos/)
    expect(edad).toHaveFocus()
    expect(patched).toBe(false)
  })

  it('en modo concepto no se edita ni se enseña el perfil, solo la premisa', async () => {
    renderDetalle(CONCEPTO.id)

    const personaje = await waitFor(() => seccion('El personaje'))
    expect(within(personaje).getByText(CONCEPTO.premise!)).toBeInTheDocument()
    expect(within(personaje).getByText(/lo inventa Psique/)).toBeInTheDocument()
    expect(within(personaje).getByText(/La premisa tampoco se puede cambiar/)).toBeInTheDocument()
    expect(within(personaje).queryByLabelText('Nombre del personaje')).not.toBeInTheDocument()
    expect(within(personaje).queryByLabelText('Premisa')).not.toBeInTheDocument()
    expect(within(personaje).queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument()
    // El nombre que el mock le inventa no se filtra por ninguna parte.
    expect(screen.queryByText(/Aitana/)).not.toBeInTheDocument()
  })
})

describe('detalle: portada', () => {
  it('quita la portada que hay y deja volver a subir otra', async () => {
    const user = userEvent.setup()
    renderDetalle(DEFINIDA.id)

    const portada = await waitFor(() => seccion('Portada'))
    // alt="": la portada es decorativa, el título va al lado en texto.
    expect(portada.querySelector('img')).toHaveAttribute('src', DEFINIDA.coverUrl)
    expect(within(portada).getByText(/hasta 4 MB/)).toBeInTheDocument()
    expect(within(portada).getByText(/apaisada/)).toBeInTheDocument()

    await user.click(within(portada).getByRole('button', { name: 'Quitar portada' }))

    expect(await screen.findByText('Portada quitada.')).toBeInTheDocument()
    // Sin portada se dibuja el fondo generado y el botón pasa a ofrecer subirla.
    expect(await within(portada).findByTestId('portada-generada')).toBeInTheDocument()
    expect(within(portada).getByText('Subir portada')).toBeInTheDocument()
    expect(within(portada).queryByRole('button', { name: 'Quitar portada' })).not.toBeInTheDocument()
  })

  it('sin portada no ofrece quitarla', async () => {
    renderDetalle(CONCEPTO.id)
    const portada = await waitFor(() => seccion('Portada'))
    expect(within(portada).getByText('Subir portada')).toBeInTheDocument()
    expect(within(portada).queryByRole('button', { name: 'Quitar portada' })).not.toBeInTheDocument()
  })
})

describe('detalle: visibilidad y lectura', () => {
  it('publica, cambia el precio y marca +18 con un PATCH de un solo campo', async () => {
    const user = userEvent.setup()
    const bodies: unknown[] = []
    server.use(
      http.patch('/api/custom-stories/:id', async ({ request }) => {
        bodies.push(await request.clone().json())
        return undefined
      }),
    )
    renderDetalle(CONCEPTO.id)

    const ajustes = await waitFor(() => seccion('Visibilidad y lectura'))
    const publica = within(ajustes).getByRole('switch', { name: 'Publicada en Explorar' })
    expect(publica).toHaveAttribute('aria-checked', 'false')
    await user.click(publica)
    expect(publica).toHaveAttribute('aria-checked', 'true')
    expect(await within(ajustes).findByText('Ahora es pública y aparece en Explorar.')).toBeInTheDocument()

    await user.click(within(ajustes).getByRole('switch', { name: 'Primera lectura gratis' }))
    await user.click(within(ajustes).getByRole('switch', { name: '+18' }))

    await waitFor(() => expect(bodies).toHaveLength(3))
    expect(bodies).toEqual([{ isPublic: true }, { freeFirstRead: false }, { adult: true }])
  })

  it('si el servidor falla, el interruptor vuelve atrás', async () => {
    const user = userEvent.setup()
    server.use(
      http.patch('/api/custom-stories/:id', () =>
        HttpResponse.json({ detail: 'Historia propia no encontrada.' }, { status: 404 }),
      ),
    )
    renderDetalle(CONCEPTO.id)

    const ajustes = await waitFor(() => seccion('Visibilidad y lectura'))
    const publica = within(ajustes).getByRole('switch', { name: 'Publicada en Explorar' })
    await user.click(publica)

    expect(await within(ajustes).findByRole('alert')).toHaveTextContent('Historia propia no encontrada.')
    expect(publica).toHaveAttribute('aria-checked', 'false')
  })
})

describe('detalle: métricas', () => {
  it('enseña las cuatro métricas y el vacío de reseñas', async () => {
    renderDetalle(DEFINIDA.id)

    const metricas = await waitFor(() => seccion('Cómo le está yendo'))
    expect(await within(metricas).findByText('Lectoras')).toBeInTheDocument()
    expect(within(metricas).getByText('Partidas activas')).toBeInTheDocument()
    expect(within(metricas).getByText('Nota media')).toBeInTheDocument()
    expect(within(metricas).getByText('Reseñas')).toBeInTheDocument()
    // Sin reseñas la nota media no se inventa: se deja en raya.
    expect(within(metricas).getByText('—')).toBeInTheDocument()
    expect(within(metricas).getByText(/Todavía no hay reseñas/)).toBeInTheDocument()
  })

  it('con reseñas enseña la nota media y las últimas', async () => {
    const stats: CustomStoryStats = {
      readers: 12,
      activeStories: 3,
      ratingAverage: 4.5,
      reviewCount: 2,
      recentReviews: [
        {
          id: 1,
          rating: 5,
          text: 'Me la he leído de una sentada.',
          author: { displayName: 'Nora', handle: 'nora', avatarUrl: null },
          isMine: false,
          createdAt: '2026-09-18T10:00:00',
          updatedAt: '2026-09-18T10:00:00',
        },
        {
          id: 2,
          rating: 4,
          text: null,
          author: { displayName: 'Marcos', handle: 'marcos', avatarUrl: null },
          isMine: false,
          createdAt: '2026-09-17T10:00:00',
          updatedAt: '2026-09-17T10:00:00',
        },
      ],
    }
    server.use(http.get('/api/custom-stories/:id/stats', () => HttpResponse.json(stats)))
    renderDetalle(DEFINIDA.id)

    const metricas = await waitFor(() => seccion('Cómo le está yendo'))
    expect(await within(metricas).findByText('12')).toBeInTheDocument()
    expect(within(metricas).getByText('4,5')).toBeInTheDocument()
    expect(within(metricas).getByText(/4,5 de media sobre 2 reseñas/)).toBeInTheDocument()
    expect(within(metricas).getByText('Me la he leído de una sentada.')).toBeInTheDocument()
    expect(within(metricas).getByRole('link', { name: /Nora/ })).toHaveAttribute('href', routes.profile('nora'))
  })

  it('si las métricas fallan, lo dice sin tumbar la página', async () => {
    server.use(
      http.get('/api/custom-stories/:id/stats', () => HttpResponse.json({ detail: 'Vaya' }, { status: 500 })),
    )
    renderDetalle(DEFINIDA.id)

    const metricas = await waitFor(() => seccion('Cómo le está yendo'))
    expect(await within(metricas).findByRole('alert')).toHaveTextContent('No se pudieron cargar las métricas.')
    expect(screen.getByRole('heading', { level: 1, name: DEFINIDA.title })).toBeInTheDocument()
  })
})

describe('detalle: borrar', () => {
  it('confirma con el mismo aviso y vuelve a la sección', async () => {
    const user = userEvent.setup()
    renderDetalle(CONCEPTO.id)

    await user.click(await screen.findByRole('button', { name: `Borrar «${CONCEPTO.title}»` }))
    const dialogo = screen.getByRole('dialog', { name: `¿Borrar «${CONCEPTO.title}»?` })
    expect(within(dialogo).getByText(/sus partidas siguen jugables/)).toBeInTheDocument()

    await user.click(within(dialogo).getByRole('button', { name: 'Sí, borrar' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Mis historias' })).toBeInTheDocument()
  })
})
