/**
 * Validación de extremo a extremo contra el bundle de producción.
 *
 * No forma parte de la suite de tests (esa es `npm run test`, que cubre el
 * dominio y la capa de datos). Esto conduce la interfaz real en un navegador
 * real para comprobar que los invariantes financieros se sostienen de punta a
 * punta, incluido el que más se rompe en este tipo de aplicaciones: que un
 * traspaso entre cuentas propias no cambie el patrimonio.
 *
 * Playwright no está en las dependencias del proyecto porque pesa unos 50 MB
 * y no hace falta para usar la aplicación. Para ejecutarlo:
 *
 *   npm install -D playwright
 *   npm run build && npm run preview &
 *   node e2e/validacion.mjs
 *
 * Las capturas quedan en e2e/evidencia/.
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'

const DIR = new URL('./evidencia/', import.meta.url).pathname
mkdirSync(DIR, { recursive: true })

const norm = (s) => (s ?? '').replace(/ /g, ' ').trim()
let fallos = 0
let paso = 0

function comprobar(etiqueta, real, esperado) {
  const ok = norm(real) === esperado
  if (!ok) fallos++
  console.log(`${ok ? '  OK  ' : ' FALLO'} ${etiqueta}\n         esperado: "${esperado}"\n         real:     "${norm(real)}"`)
}

process.on('unhandledRejection', async (e) => { try { await p.screenshot({ path: `${DIR}/99-fallo.png`, fullPage: true }) } catch {} ; console.error('FALLO:', e.message); process.exit(1) })
// En una máquina normal Playwright encuentra su propio navegador; esta ruta
// solo se usa si existe, para entornos que traen Chromium preinstalado.
const chromiumPreinstalado = '/opt/pw-browsers/chromium'
const navegador = await chromium.launch(
  existsSync(chromiumPreinstalado) ? { executablePath: chromiumPreinstalado } : {},
)
const ctx = await navegador.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'es-ES' })
const p = await ctx.newPage()
p.on('pageerror', (e) => { console.log('  ERROR DE PÁGINA:', e.message); fallos++ })

const captura = async (nombre) => p.screenshot({ path: `${DIR}/${String(++paso).padStart(2, '0')}-${nombre}.png`, fullPage: true })

const dialogo = () => p.getByRole('dialog')

async function crearCuenta(nombre, tipo, saldo) {
  await p.getByRole('button', { name: /^(\+ Nueva cuenta|Crear cuenta|Crear mi primera cuenta)$/ }).first().click()
  const d = dialogo()
  await d.getByPlaceholder('Cuenta nómina').fill(nombre)
  await d.locator('select').first().selectOption(tipo)
  await d.getByPlaceholder('0,00').fill(saldo)
  await d.getByRole('button', { name: 'Guardar' }).click()
  await p.waitForTimeout(250)
}

console.log('\n=== 1. Cuentas: nómina 1.200 € y ahorro 3.000 € ===')
await p.goto('http://localhost:4173/#/cuentas', { waitUntil: 'networkidle' })
await crearCuenta('Cuenta nómina', 'corriente', '1200,00')
await crearCuenta('Ahorro', 'ahorro', '3000,00')
const patrimonioInicial = await p.locator('p.text-3xl').first().textContent()
comprobar('patrimonio neto tras crear las dos cuentas', patrimonioInicial, '4200,00 €')
await captura('cuentas-creadas')

console.log('\n=== 2. Gasto de 45 € en Ocio ===')
await p.goto('http://localhost:4173/#/movimientos', { waitUntil: 'networkidle' })
await p.getByRole('button', { name: '+ Añadir' }).click()
await dialogo().getByPlaceholder('0,00').fill('45,00')
await dialogo().getByRole('button', { name: 'Ocio', exact: true }).click()
await dialogo().getByRole('button', { name: 'Añadir', exact: true }).click()
await p.waitForTimeout(300)
await captura('gasto-anotado')

await p.goto('http://localhost:4173/#/cuentas', { waitUntil: 'networkidle' })
const trasGasto = await p.locator('p.text-3xl').first().textContent()
comprobar('el gasto reduce el patrimonio', trasGasto, '4155,00 €')

console.log('\n=== 3. Presupuesto de 200 € en Ocio ===')
await p.goto('http://localhost:4173/#/presupuestos', { waitUntil: 'networkidle' })
await p.getByRole('button', { name: '+ Presupuesto', exact: true }).click()
await dialogo().locator('select').first().selectOption({ label: '🎉 Ocio' })
await dialogo().getByPlaceholder('200,00').fill('200,00')
await dialogo().getByRole('button', { name: 'Guardar' }).click()
await p.waitForTimeout(300)
const consumo = await p.locator('text=/de 200,00/').first().textContent()
comprobar('consumo del presupuesto', consumo, '45,00 € de 200,00 €')
await captura('presupuesto')

console.log('\n=== 4. INV-1 EN LA APP REAL: traspaso de 300 € nómina -> ahorro ===')
await p.goto('http://localhost:4173/#/movimientos', { waitUntil: 'networkidle' })
await p.getByRole('button', { name: '+ Añadir' }).click()
const d = dialogo()
await d.getByRole('button', { name: 'Traspaso' }).click()
await d.getByPlaceholder('0,00').fill('300,00')
await d.locator('select').nth(0).selectOption({ label: 'Cuenta nómina' })
await d.locator('select').nth(1).selectOption({ label: 'Ahorro' })
await d.getByRole('button', { name: 'Añadir', exact: true }).click()
await p.waitForTimeout(300)
await captura('traspaso-hecho')

await p.goto('http://localhost:4173/#/cuentas', { waitUntil: 'networkidle' })
const trasTraspaso = await p.locator('p.text-3xl').first().textContent()
comprobar('EL PATRIMONIO NO CAMBIA tras el traspaso', trasTraspaso, '4155,00 €')

// textContent devuelve el texto aunque sea blanco sobre blanco, así que la
// aserción de arriba pasaba con la cifra invisible. Esto comprueba que se ve.
const contraste = await p.locator('p.text-3xl').first().evaluate((el) => {
  const color = getComputedStyle(el).color
  let fondo = 'rgba(0, 0, 0, 0)'
  for (let n = el; n; n = n.parentElement) {
    const c = getComputedStyle(n).backgroundColor
    if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') { fondo = c; break }
  }
  const lum = (s) => {
    const [r, g, b] = s.match(/\d+/g).map(Number)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  return Math.abs(lum(color) - lum(fondo)) > 60
})
comprobar('la cifra del patrimonio se ve sobre su fondo', String(contraste), 'true')

await p.goto('http://localhost:4173/#/resumen', { waitUntil: 'networkidle' })
await p.waitForTimeout(600)
const ingresos = await p.locator('p.text-xs:text-is("Ingresos") + p').first().textContent()
const gastos = await p.locator('p.text-xs:text-is("Gastos") + p').first().textContent()
comprobar('el traspaso NO cuenta como ingreso', ingresos, '0,00 €')
comprobar('el traspaso NO cuenta como gasto', gastos, '−45,00 €')
const ahorro = await p.locator('p.text-xs:text-is("Ahorro del mes") + p').first().textContent()
comprobar('un ahorro negativo lleva su signo menos', ahorro, '−45,00 €')
const mesTitulo = await p.locator('span.first-letter\\:uppercase').first().textContent()
comprobar('el mes se escribe en español, no con cada palabra en mayúscula', mesTitulo, 'septiembre de 2026')
await captura('resumen')

console.log('\n=== 5. Objetivo "Viaje" 3.000 € con el traspaso asignado ===')
await p.goto('http://localhost:4173/#/objetivos', { waitUntil: 'networkidle' })
await p.getByRole('button', { name: /^(\+ Nuevo objetivo|Crear objetivo)$/ }).first().click()
await dialogo().getByPlaceholder('Viaje a Japón').fill('Viaje')
await dialogo().getByPlaceholder('3.000,00').fill('3000,00')
await dialogo().getByRole('button', { name: 'Guardar' }).click()
await p.waitForTimeout(300)
await p.getByRole('button', { name: 'Asignar traspaso' }).click()
await p.waitForTimeout(200)
await dialogo().getByRole('button', { name: 'Asignar', exact: true }).first().click()
await p.waitForTimeout(400)
const progreso = await p.locator('p.text-2xl').first().textContent()
comprobar('aportado al objetivo', progreso, '300,00 €')
const pct = await p.locator('text=/^\\d+ %$/').first().textContent()
comprobar('porcentaje del objetivo', pct, '10 %')
await captura('objetivo')

console.log('\n=== 6. Copia de seguridad: exportar, borrar todo, reimportar ===')
await p.goto('http://localhost:4173/#/ajustes', { waitUntil: 'networkidle' })
const descarga = p.waitForEvent('download')
await p.getByRole('button', { name: /Exportar copia/ }).click()
const fichero = await descarga
const ruta = `${DIR}/copia.json`
await fichero.saveAs(ruta)
console.log(`  OK   copia descargada como ${fichero.suggestedFilename()}`)

p.on('dialog', (d) => d.accept())
await p.getByRole('button', { name: 'Borrar todos mis datos' }).click()
await p.waitForTimeout(800)

await p.goto('http://localhost:4173/#/cuentas', { waitUntil: 'networkidle' })
const trasBorrar = await p.locator('p.text-3xl').first().textContent()
comprobar('tras borrar todo el patrimonio es cero', trasBorrar, '0,00 €')

await p.goto('http://localhost:4173/#/ajustes', { waitUntil: 'networkidle' })
await p.locator('input[type=file]').setInputFiles(ruta)
await p.waitForTimeout(500)
await captura('resumen-importacion')
await dialogo().getByRole('button', { name: 'Sustituir mis datos' }).click()
await p.waitForTimeout(800)

await p.goto('http://localhost:4173/#/cuentas', { waitUntil: 'networkidle' })
const trasImportar = await p.locator('p.text-3xl').first().textContent()
comprobar('INV-10: el patrimonio vuelve idéntico tras reimportar', trasImportar, '4155,00 €')

await p.goto('http://localhost:4173/#/objetivos', { waitUntil: 'networkidle' })
const objetivoTras = await p.locator('p.text-2xl').first().textContent()
comprobar('el objetivo también vuelve intacto', objetivoTras, '300,00 €')
await captura('tras-reimportar')

console.log('\n=== 7. Vista de móvil ===')
await p.setViewportSize({ width: 390, height: 844 })
await p.goto('http://localhost:4173/#/resumen', { waitUntil: 'networkidle' })
await p.waitForTimeout(600)
await captura('movil-resumen')
const scrollH = await p.evaluate(() => document.documentElement.scrollWidth)
comprobar('no hay scroll horizontal a 390 px', String(scrollH <= 390), 'true')

await navegador.close()
console.log(`\n${fallos === 0 ? '*** TODAS LAS COMPROBACIONES PASAN ***' : `*** ${fallos} COMPROBACIONES FALLIDAS ***`}`)
process.exit(fallos === 0 ? 0 : 1)
