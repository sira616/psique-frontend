import { expect, test, type Page } from '@playwright/test'
import { expectNoSeriousA11yViolations, loginDemo } from './helpers'

// El mock arranca nuevo en cada ejecución: la partida cerrada de la demo (story-cerrada) empieza
// sin apelar y su incidente es el #1. flujo-principal no toca incidentes.

const DEV = { username: 'dev', password: 'DevPsique2026' }

async function loginAs(page: Page, account: { username: string; password: string }) {
  await page.goto('/login')
  await page.getByLabel('Usuario', { exact: true }).fill(account.username)
  await page.getByLabel('Contraseña', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '¿Con quién empieza tu historia?' })).toBeVisible()
}

test('términos y privacidad se leen sin sesión', async ({ page }) => {
  await page.goto('/terminos')
  await expect(page.getByRole('heading', { level: 1, name: 'Términos de uso' })).toBeVisible()
  await expect(page.getByRole('note')).toContainText('Borrador pendiente de revisión legal')
  await expect(page.getByText(/Versión 2026-09-18/)).toBeVisible()
  await expectNoSeriousA11yViolations(page, 'términos')

  await page.getByRole('navigation', { name: 'Textos legales' }).getByRole('link', { name: 'Política de privacidad' }).click()
  await expect(page).toHaveURL(/\/privacidad$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Política de privacidad' })).toBeVisible()
  await expect(page.getByRole('note')).toContainText('Borrador pendiente de revisión legal')
  await expectNoSeriousA11yViolations(page, 'privacidad')

  await page.setViewportSize({ width: 375, height: 800 })
  await expectNoSeriousA11yViolations(page, 'privacidad en móvil')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

// Serie explícita: la revisión necesita la apelación del test anterior. Si esa falla, la
// segunda se salta en vez de fallar por una causa que no es suya.
test.describe.serial('apelación y revisión', () => {
  test('apelar la partida cerrada deja la apelación pendiente', async ({ page }) => {
    await loginDemo(page)
    await page.goto('/historia/story-cerrada')
    await expect(page).toHaveURL(/\/historia\/story-cerrada\/archivo$/)
    const appeal = page.getByRole('region', { name: 'Apelación' })
    await expect(appeal.getByText('¿Crees que fue un error?')).toBeVisible()
    await appeal.getByRole('button', { name: 'Apelar' }).click()

    const field = appeal.getByRole('textbox', { name: 'Tu explicación (opcional)' })
    await expect(field).toBeFocused()
    await field.fill('Solo pedía un café y una conversación larga.')
    await expectNoSeriousA11yViolations(page, 'formulario de apelación')
    await appeal.getByRole('button', { name: 'Enviar apelación' }).click()

    await expect(appeal.getByText('Apelación pendiente.')).toBeVisible()
    await expect(appeal.getByText('Solo pedía un café y una conversación larga.')).toBeVisible()
    await expectNoSeriousA11yViolations(page, 'apelación pendiente')
  })

  test('la cuenta dev revisa la apelación en Moderación y la partida se reabre', async ({ page }) => {
    await loginDemo(page)
    await page.getByRole('button', { name: 'Cerrar sesión' }).click()
    await loginAs(page, DEV)

    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Dev' }).click()
    await page.getByRole('navigation', { name: 'Secciones de Dev' }).getByRole('link', { name: 'Moderación' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Moderación' })).toBeVisible()
    await expect(page.getByText('1–3 de 3')).toBeVisible()
    await expectNoSeriousA11yViolations(page, 'cola de moderación')

    await page.getByRole('button', { name: /^#1 / }).click()
    const detail = page.getByRole('region', { name: 'Incidente #1' })
    await expect(detail.getByText(/Confidencial: solo para revisar este incidente/)).toBeVisible()
    await expect(detail.getByText('Solo pedía un café y una conversación larga.')).toBeVisible()
    await expectNoSeriousA11yViolations(page, 'detalle de incidente')

    await detail.getByRole('button', { name: 'Aceptar' }).click()
    await expect(detail.getByText(/La partida se ha reabierto\./)).toBeVisible()
    await expect(detail.getByText('Sin extracto (caducado o resuelto).')).toBeVisible()

    await page.getByRole('button', { name: /^#3 / }).click()
    const own = page.getByRole('region', { name: 'Incidente #3' })
    await expect(own.getByText('Es un incidente tuyo: tiene que revisarlo otra persona.')).toBeVisible()
    await expect(own.getByRole('button', { name: 'Aceptar' })).toBeDisabled()
  })
})
