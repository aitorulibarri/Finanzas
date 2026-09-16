/**
 * Los cuatro caminos del banner de instalación.
 *
 * Son cuatro ramas distintas y es fácil que una quede rota sin que nadie se
 * entere, porque cada una solo se ve en un dispositivo concreto.
 *
 * Como el resto del end-to-end, Playwright no está en las dependencias:
 *
 *   npm install -D playwright && npx playwright install chromium
 *   npm run build && npm run preview &
 *   node e2e/banner-instalacion.mjs
 */
import { existsSync } from 'node:fs'
import { chromium } from 'playwright'

const chromiumPreinstalado = '/opt/pw-browsers/chromium'
const opcionesNavegador = existsSync(chromiumPreinstalado)
  ? { executablePath: chromiumPreinstalado }
  : {}

const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const DIRECCION = 'http://localhost:4173/'
import { mkdirSync } from 'node:fs'
const DIR = new URL('./evidencia/', import.meta.url).pathname
mkdirSync(DIR, { recursive: true })
let fallos = 0

function comprobar(etiqueta, real, esperado) {
  const ok = real === esperado
  if (!ok) fallos++
  console.log(`${ok ? '  OK  ' : ' FALLO'} ${etiqueta} — esperado ${esperado}, real ${real}`)
}

const navegador = await chromium.launch(opcionesNavegador)
const banner = (p) => p.locator('[data-testid=banner-instalacion]')

// --- 1. Escritorio normal: no hay instalación posible, no debe molestar ---
{
  const ctx = await navegador.newContext({ viewport: { width: 1200, height: 800 }, locale: 'es-ES' })
  const p = await ctx.newPage()
  await p.goto(DIRECCION, { waitUntil: 'networkidle' })
  await p.waitForTimeout(800)
  comprobar('1) escritorio sin instalación posible -> sin banner', await banner(p).count(), 0)
  await ctx.close()
}

// --- 2. iPhone en Safari: pasos a mano, porque no existe beforeinstallprompt ---
{
  const ctx = await navegador.newContext({
    userAgent: UA_IPHONE, viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, locale: 'es-ES',
  })
  const p = await ctx.newPage()
  await p.goto(DIRECCION, { waitUntil: 'networkidle' })
  await p.waitForTimeout(800)
  comprobar('2) iPhone -> aparece el banner', await banner(p).count(), 1)
  const texto = await banner(p).textContent()
  comprobar('2) explica el botón Compartir', texto.includes('Compartir'), true)
  comprobar('2) dice por qué: los siete días', texto.includes('siete días'), true)
  comprobar('2) NO ofrece botón instalar en iOS', await banner(p).getByRole('button', { name: 'Instalar' }).count(), 0)

  const scrollH = await p.evaluate(() => document.documentElement.scrollWidth)
  comprobar('2) sin scroll horizontal a 390 px', scrollH <= 390, true)
  await p.screenshot({ path: `${DIR}/20-banner-iphone.png`, fullPage: false })

  // Descartar y comprobar que desaparece y se recuerda.
  await banner(p).getByRole('button', { name: 'Descartar aviso' }).click()
  await p.waitForTimeout(300)
  comprobar('2) tras descartar desaparece', await banner(p).count(), 0)
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForTimeout(800)
  comprobar('2) sigue descartado tras recargar', await banner(p).count(), 0)
  await ctx.close()
}

// --- 3. Ya instalada: ni una palabra ---
{
  // iOS marca las apps de pantalla de inicio con navigator.standalone.
  const ctx = await navegador.newContext({
    userAgent: UA_IPHONE, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  })
  await ctx.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }))
  const p = await ctx.newPage()
  await p.goto(DIRECCION, { waitUntil: 'networkidle' })
  await p.waitForTimeout(800)
  comprobar('3a) iPhone ya instalada (navigator.standalone) -> sin banner', await banner(p).count(), 0)
  await ctx.close()
}
{
  /*
   * OJO: aquí se SIMULA matchMedia. Chromium sin interfaz reporta siempre
   * display-mode: browser, incluso lanzado con --app, porque un standalone de
   * verdad exige instalar la PWA y eso un navegador headless no lo hace. Esto
   * comprueba la rama del componente, no el comportamiento del navegador.
   *
   * Para que la comprobación signifique algo se monta el caso que SÍ mostraría
   * el banner (móvil con evento de instalación disponible) y se verifica que
   * estando instalada no aparece igualmente.
   */
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await ctx.addInitScript(() => {
    const real = window.matchMedia.bind(window)
    window.matchMedia = (q) =>
      q.includes('display-mode: standalone') ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : real(q)
  })
  const p = await ctx.newPage()
  await p.goto(DIRECCION, { waitUntil: 'networkidle' })
  await p.waitForTimeout(800)
  await p.evaluate(() => {
    const e = new Event('beforeinstallprompt')
    Object.assign(e, { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'accepted' }) })
    window.dispatchEvent(e)
  })
  await p.waitForTimeout(400)
  comprobar('3b) ya instalada: ni con evento de instalación aparece (matchMedia simulado)', await banner(p).count(), 0)
  await ctx.close()
}

// --- 4. Android: el navegador ofrece instalar ---
{
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES' })
  const p = await ctx.newPage()
  await p.goto(DIRECCION, { waitUntil: 'networkidle' })
  await p.waitForTimeout(800)
  comprobar('4) antes del evento no hay banner', await banner(p).count(), 0)

  // Evento sintético: el real solo lo dispara Chrome con la app servida por
  // HTTPS y cumpliendo sus criterios, que no se dan en localhost sin más.
  await p.evaluate(() => {
    const e = new Event('beforeinstallprompt')
    Object.assign(e, {
      prompt: async () => {},
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    })
    window.dispatchEvent(e)
  })
  await p.waitForTimeout(400)
  comprobar('4) tras beforeinstallprompt aparece el banner', await banner(p).count(), 1)
  comprobar('4) con botón Instalar', await banner(p).getByRole('button', { name: 'Instalar' }).count(), 1)
  const texto = await banner(p).textContent()
  comprobar('4) sin los pasos de iOS', texto.includes('Compartir'), false)
  await p.screenshot({ path: `${DIR}/21-banner-android.png`, fullPage: false })
  await ctx.close()
}

await navegador.close()
console.log(`\n${fallos === 0 ? '*** LOS CUATRO CAMINOS CORRECTOS ***' : `*** ${fallos} FALLOS ***`}`)
process.exit(fallos ? 1 : 0)
