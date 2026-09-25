import { expect, test } from '@playwright/test'
import { expectNoSeriousA11yViolations, loginDemo } from './helpers'

// Datos de la API simulada (src/mocks): Lucía empieza sin leer y gratis; la cuenta demo tiene
// una partida con Mateo en capítulo bloqueado (story-bloqueada) y 5 óbolos de bienvenida.
test('login → libro → partida → capítulo bloqueado → rasca y gana → desbloquear', async ({ page }) => {
  await test.step('login', async () => {
    await page.goto('/login')
    await expectNoSeriousA11yViolations(page, 'login')
    await loginDemo(page)
  })

  await test.step('Historias', async () => {
    await expect(page.getByRole('link', { name: 'Ver libro: Lucía Ferrer' })).toBeVisible()
    await expectNoSeriousA11yViolations(page, 'historias')
  })

  await test.step('página de libro y leer', async () => {
    await page.getByRole('link', { name: 'Ver libro: Lucía Ferrer' }).click()
    await expect(page).toHaveURL(/\/libro\/lucia$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Lucía Ferrer' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Leer gratis' })).toBeVisible()
    await expectNoSeriousA11yViolations(page, 'libro')
    await page.getByRole('button', { name: 'Leer gratis' }).click()
    await expect(page).toHaveURL(/\/historia\/story-/)
  })

  await test.step('mensaje y sugerencia en la partida', async () => {
    const composer = page.getByRole('textbox', { name: 'Mensaje' })
    await expect(composer).toBeEnabled()
    await expectNoSeriousA11yViolations(page, 'partida')

    await composer.fill('Hola, Lucía. ¿Qué estás restaurando?')
    await page.getByRole('button', { name: 'Enviar mensaje' }).click()
    await expect(page.getByText('Hola, Lucía. ¿Qué estás restaurando?')).toBeVisible()

    // Tras el primer turno el mock cambia a la escena del taller y sus sugerencias.
    const suggestions = page.getByRole('toolbar', { name: 'Sugerencias' })
    const choice = suggestions.getByRole('button', { name: 'Preguntar por la carta' })
    await expect(choice).toBeEnabled()
    await choice.click()
    await expect(page.getByText('¿De quién es esa carta que escondes entre las páginas?')).toBeVisible()
    await expect(composer).toBeEnabled()
  })

  await test.step('capítulo bloqueado', async () => {
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Historias', exact: true }).click()
    await page.getByRole('link', { name: /^Mateo/ }).first().click()
    await expect(page).toHaveURL(/\/historia\/story-bloqueada$/)
    await expect(page.getByRole('textbox', { name: 'Mensaje' })).toBeDisabled()
    await expect(page.getByText('El siguiente capítulo está bloqueado.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Desbloquear capítulo · 2 óbolos' })).toBeVisible()
  })

  await test.step('Rasca y gana con teclado', async () => {
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Rasca y gana' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Rasca y gana' })).toBeVisible()
    await page.getByRole('button', { name: 'Sacar tarjeta' }).click()
    const scratchAll = page.getByRole('button', { name: 'Rascar todo' })
    await expect(scratchAll).toBeEnabled()
    await expectNoSeriousA11yViolations(page, 'rasca y gana')

    await scratchAll.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText(/^Ha salido un \d+/)).toBeVisible()
    await expect(page.getByTestId('numero-tarjeta')).toHaveText(/^\d+$/)
  })

  await test.step('volver y desbloquear', async () => {
    await page.goBack()
    await expect(page).toHaveURL(/\/historia\/story-bloqueada$/)
    await page.getByRole('button', { name: 'Desbloquear capítulo · 2 óbolos' }).click()
    await expect(page.getByText('El siguiente capítulo está bloqueado.')).toBeHidden()
    await expect(page.getByRole('textbox', { name: 'Mensaje' })).toBeEnabled()
  })
})

test('una partida cerrada por las normas se abre en solo lectura', async ({ page }) => {
  await loginDemo(page)
  // La cookie de refresh del mock sobrevive a la recarga: así se prueba también restaurar sesión.
  await page.goto('/historia/story-cerrada')
  await expect(page.getByText(/Cerrada por incumplir las normas el/)).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Esta partida se ha cerrado.' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Mensaje' })).toHaveCount(0)
  await expect(page.getByRole('toolbar', { name: 'Sugerencias' })).toHaveCount(0)
  await expectNoSeriousA11yViolations(page, 'partida cerrada')
})
