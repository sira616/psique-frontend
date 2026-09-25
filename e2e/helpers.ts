import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

export const DEMO = { username: 'demo', password: 'DemoPsique2026', handle: 'demo' }

export async function loginDemo(page: Page) {
  const home = page.getByRole('heading', { level: 1, name: '¿Con quién empieza tu historia?' })
  const username = page.getByLabel('Usuario', { exact: true })
  await page.goto('/login')
  // El mock, a falta de cookie, canjea el último refresh emitido (imita al navegador en Node):
  // un contexto nuevo puede llegar ya con sesión y el login redirige a Historias.
  await expect(home.or(username)).toBeVisible()
  if (await home.isVisible()) {
    // Puede ser la sesión de otra cuenta que dejó abierta un test anterior (la dev, por
    // ejemplo): cada test tiene que saber con quién entra, así que si no es la demo, fuera.
    const perfil = page.getByRole('link', { name: 'Tu perfil' })
    if ((await perfil.getAttribute('href')) === `/u/${DEMO.handle}`) return
    await page.getByRole('button', { name: 'Cerrar sesión' }).click()
    await expect(username).toBeVisible()
  }
  await username.fill(DEMO.username)
  await page.getByLabel('Contraseña', { exact: true }).fill(DEMO.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(home).toBeVisible()
}

/**
 * Solo bloquean las violaciones serious y critical: son las que impiden usar la página con
 * teclado o lector de pantalla. Las menores quedan anotadas en el informe HTML.
 */
export async function expectNoSeriousA11yViolations(page: Page, where: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const found = results.violations.map((v) => `${v.id} (${v.impact})`).join(', ') || 'ninguna'
  test.info().annotations.push({
    type: `axe: ${where}`,
    description: `${results.passes.length} reglas pasan; violaciones: ${found}`,
  })
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`)
  expect(serious, `Violaciones de accesibilidad en ${where}`).toEqual([])
}
