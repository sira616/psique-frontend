import { expect, test, type Page } from '@playwright/test'
import { expectNoSeriousA11yViolations, loginDemo } from './helpers'

/**
 * Los radios de los filtros van `sr-only` dentro de su etiqueta con forma de chip: quien usa el
 * ratón pulsa la etiqueta, así que el test hace lo mismo (el input queda tapado por ella).
 */
function chip(page: Page, grupo: string, etiqueta: string) {
  return page.getByRole('group', { name: grupo }).getByText(etiqueta, { exact: true })
}

// Este fichero va después de los otros (Playwright los ordena por nombre) y el mock guarda el
// estado en memoria durante toda la ejecución: por eso aquí se puede publicar y editar sin
// romper a nadie. El borrado de verdad se queda en los tests unitarios; aquí se cancela, para
// que un fichero nuevo añadido más tarde no se encuentre sin las historias sembradas.

/** PNG de 1×1 de verdad: el mock comprueba el tipo y el tamaño, y luego sirve estos bytes. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGM4YRMFAAMuAV/M3aHKAAAAAElFTkSuQmCC',
  'base64',
)

test('sección Mis historias: buscar, filtrar y publicar', async ({ page }) => {
  await loginDemo(page)

  await test.step('llegar desde la navegación', async () => {
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Mis historias' }).click()
    await expect(page).toHaveURL(/\/mis-historias$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Mis historias' })).toBeVisible()
    await expect(page.getByRole('status')).toHaveText('2 historias en pantalla.')
    await expectNoSeriousA11yViolations(page, 'mis historias')
  })

  const tarjetas = page.getByRole('region', { name: 'Historias propias' }).getByRole('listitem')

  await test.step('buscar por título', async () => {
    const buscador = page.getByRole('searchbox', { name: 'Buscar por título' })
    await buscador.fill('cafe')
    await expect(tarjetas).toHaveCount(1)
    await expect(page.getByRole('status')).toHaveText('1 historia en pantalla.')
    await buscador.fill('zzzz')
    await expect(page.getByText(/ninguna cuadra con lo que has pedido/)).toBeVisible()
    await page.getByRole('button', { name: 'Quitar filtros' }).click()
    await expect(tarjetas).toHaveCount(2)
  })

  await test.step('filtrar por visibilidad', async () => {
    await chip(page, 'Visibilidad', 'Privadas').click()
    await expect(page.getByRole('radio', { name: 'Privadas' })).toBeChecked()
    await expect(tarjetas).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'La carta del faro', exact: true })).toBeVisible()
    await chip(page, 'Visibilidad', 'Todas').click()
    await expect(tarjetas).toHaveCount(2)

    await chip(page, 'Tipo de historia', 'Concepto').click()
    await expect(tarjetas).toHaveCount(1)
    await chip(page, 'Tipo de historia', 'Todos').click()
    await expect(tarjetas).toHaveCount(2)
  })

  await test.step('publicar desde la tarjeta', async () => {
    await page.getByRole('button', { name: 'Publicar La carta del faro' }).click()
    await expect(page.getByRole('button', { name: 'Despublicar La carta del faro' })).toBeVisible()
    const fila = tarjetas.filter({ has: page.getByRole('link', { name: 'La carta del faro', exact: true }) })
    await expect(fila.getByText('Pública')).toBeVisible()
  })

  await test.step('el diálogo de borrar avisa de las partidas ajenas', async () => {
    await page.getByRole('button', { name: 'Borrar La carta del faro' }).click()
    const dialogo = page.getByRole('dialog', { name: '¿Borrar «La carta del faro»?' })
    await expect(dialogo.getByText(/sus partidas siguen jugables/)).toBeVisible()
    await expectNoSeriousA11yViolations(page, 'confirmación de borrado')
    await dialogo.getByRole('button', { name: 'Cancelar' }).click()
    await expect(dialogo).toBeHidden()
    await expect(tarjetas).toHaveCount(2)
  })
})

test('detalle: editar, portada, aviso del personaje y métricas', async ({ page }) => {
  await loginDemo(page)
  await page.goto('/mis-historias')
  // exact: la tarjeta tiene también un «Ver … como lector» con el mismo título dentro.
  await page.getByRole('link', { name: 'Café a medianoche', exact: true }).click()

  await test.step('cabecera y accesibilidad', async () => {
    await expect(page.getByRole('heading', { level: 1, name: 'Café a medianoche' })).toBeVisible()
    await expect(page.getByText(/con Carmen Ruiz, 34 años/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ver como lectores' })).toBeVisible()
    await expectNoSeriousA11yViolations(page, 'detalle de historia propia')
  })

  await test.step('editar el título con guardado explícito', async () => {
    const historia = page.getByRole('region', { name: 'La historia' })
    await historia.getByLabel('Título').fill('Café al alba')
    await historia.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(historia.getByText('Cambios guardados.')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Café al alba' })).toBeVisible()
  })

  await test.step('un 422 de contenido se cuenta sin perder lo escrito', async () => {
    const historia = page.getByRole('region', { name: 'La historia' })
    await historia.getByLabel('Gancho').fill('Una escena sexual explícita tras la barra')
    await historia.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(historia.getByRole('alert')).toContainText('fundido a negro')
    await expect(historia.getByLabel('Gancho')).toHaveValue('Una escena sexual explícita tras la barra')
  })

  await test.step('el aviso del personaje habla de las partidas en curso', async () => {
    const personaje = page.getByRole('region', { name: 'El personaje' })
    await expect(personaje.getByText(/afectan a las partidas/)).toBeVisible()
    await expect(personaje.getByText(/notará el cambio en su siguiente mensaje/)).toBeVisible()
  })

  await test.step('subir y quitar portada', async () => {
    const portada = page.getByRole('region', { name: 'Portada' })
    await portada.locator('input[type=file]').setInputFiles({
      name: 'portada.png',
      mimeType: 'image/png',
      buffer: PNG_1X1,
    })
    await portada.getByRole('button', { name: 'Guardar portada' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Portada actualizada.' })).toBeVisible()

    await portada.getByRole('button', { name: 'Quitar portada' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Portada quitada.' })).toBeVisible()
    await expect(portada.getByTestId('portada-generada')).toBeVisible()
  })

  await test.step('métricas y reseñas', async () => {
    const metricas = page.getByRole('region', { name: 'Cómo le está yendo' })
    await expect(metricas.getByText('Lectoras')).toBeVisible()
    await expect(metricas.getByText('Partidas activas')).toBeVisible()
    await expect(metricas.getByText(/Todavía no hay reseñas/)).toBeVisible()
  })

  await test.step('despublicar desde el detalle', async () => {
    const ajustes = page.getByRole('region', { name: 'Visibilidad y lectura' })
    const publicada = ajustes.getByRole('switch', { name: 'Publicada en Explorar' })
    await expect(publicada).toHaveAttribute('aria-checked', 'true')
    await publicada.click()
    await expect(publicada).toHaveAttribute('aria-checked', 'false')
    await expect(ajustes.getByText('Ahora es privada: ya no aparece en Explorar.')).toBeVisible()
  })
})

test('una historia que no es tuya se ve como no encontrada', async ({ page }) => {
  await loginDemo(page)
  await page.goto(`/mis-historias/${'0'.repeat(32)}`)

  await expect(page.getByRole('heading', { level: 1, name: 'No encontramos esta historia' })).toBeVisible()
  await expectNoSeriousA11yViolations(page, 'historia no encontrada')
  await page.getByRole('link', { name: 'Volver a Mis historias' }).click()
  await expect(page).toHaveURL(/\/mis-historias$/)
})
