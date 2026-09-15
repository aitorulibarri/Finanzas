# Finanzas

Control de finanzas personales: ingresos, gastos, ahorro e inversión, en una web
que puedes instalar en el móvil.

**Tus datos no salen de tu navegador.** No hay servidor, ni cuenta, ni registro:
todo se guarda en el almacenamiento local de tu dispositivo. Eso significa que
nadie puede leer tus finanzas, y también que **nadie puede recuperártelas**. Lee
la sección de copias de seguridad antes de meter meses de datos.

## Qué hace

- **Ingresos y gastos** con categorías, subcategorías y búsqueda por mes.
- **Traspasos** entre cuentas propias, que no cuentan como gasto ni como ingreso:
  mover dinero de la cuenta corriente al ahorro no te hace ni más rico ni más
  pobre, y la aplicación lo trata así en todos los cálculos.
- **Presupuestos** mensuales por categoría, con aviso al pasarte.
- **Objetivos de ahorro** con meta y fecha, que te dicen cuánto apartar al mes.
  Varios objetivos pueden convivir sobre la misma cuenta de ahorro.
- **Cuentas de inversión** cuyo valor actualizas a mano cuando lo consultas; la
  diferencia con lo aportado es tu rendimiento.
- **Movimientos recurrentes**: nómina, alquiler, suscripciones. Se apuntan solos.
- **Copia de seguridad** a fichero JSON, y restauración desde él.
- Funciona **sin conexión** e **instalable** en el móvil como aplicación.

## Copias de seguridad: léelo

Los datos viven en IndexedDB, en este navegador y en este dispositivo. Se pierden
si borras los datos de navegación, si el navegador libera espacio por su cuenta o
si cambias de equipo. No hay copia en la nube porque no hay nube.

La aplicación exporta un fichero JSON con todo desde **Ajustes → Copia de
seguridad**, y avisa sola cuando llevas más de 30 días sin hacer una. Guárdalo
donde guardes cosas importantes. Restaurarlo es arrastrar el mismo fichero a la
pantalla de importar.

## Arrancarlo en local

Necesitas Node 22 o superior.

```bash
npm install
npm run dev          # desarrollo en http://localhost:5173
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Construye a `dist/` |
| `npm run preview` | Sirve el `dist/` ya construido |
| `npm run test` | Tests |
| `npm run test:tz` | Los mismos tests bajo UTC+14 y UTC−11 |
| `npm run lint` | Estilo y errores comunes |

### Validación de extremo a extremo

Además de los tests, `e2e/validacion.mjs` conduce la aplicación en un navegador
real contra el bundle de producción y comprueba los invariantes de punta a
punta, incluido que un traspaso de 300 € entre cuentas propias no mueva el
patrimonio. Playwright no está entre las dependencias porque pesa unos 50 MB y
no hace falta para usar la aplicación:

```bash
npm install -D playwright && npx playwright install chromium
npm run build && npm run preview &
node e2e/validacion.mjs
```

## Publicarlo en GitHub Pages

El repositorio trae el workflow listo, pero hay **dos pasos que tienes que dar tú**
una sola vez:

1. En GitHub, **Settings → Pages → Source: GitHub Actions**.
2. Fusionar la rama de trabajo a `main`. El despliegue se dispara al empujar a
   `main`, o a mano desde la pestaña **Actions → Desplegar en GitHub Pages →
   Run workflow**.

Quedará publicada en `https://<tu-usuario>.github.io/Finanzas/`.

## Cómo está construido

Vite 8 · React 19 · TypeScript · Tailwind 4 · Dexie (IndexedDB) · Zod · Recharts ·
Vitest.

```
src/
  dominio/    TypeScript puro: sin React y sin base de datos
  datos/      IndexedDB detrás de la interfaz StorageAdapter
  estado/     Contexto de React sobre el repositorio
  ui/         Pantallas y componentes
```

La regla que gobierna la estructura: **toda la matemática financiera vive en
`src/dominio/` y no depende de React ni de IndexedDB**, así que se puede testear
entera en menos de un segundo y sin navegador. Ningún componente calcula nada por
su cuenta.

### Dos decisiones que evitan bugs de clase entera

**El dinero es un entero de céntimos, nunca un número decimal.** En coma flotante
`0.1 + 0.2` no es `0.3`, y ese error se acumula hasta descuadrar saldos. La
entrada de texto se parsea con aritmética entera, sin pasar por `parseFloat`.

**La fecha es el string `'YYYY-MM-DD'`, nunca un `Date` ni un timestamp.** Si se
guardara una marca de tiempo, un gasto del 31 de enero a las 23:00 pasaría a ser
1 de febrero al convertir a UTC y aparecería en el mes equivocado. Los tests se
ejecutan también bajo UTC+14 y UTC−11 para detectarlo si alguien reintroduce
conversiones de zona horaria.

### Invariantes con test

Los diez que sostienen que los números sean correctos:

| | |
|---|---|
| INV-1 | Un traspaso no altera el patrimonio neto |
| INV-2 | Un traspaso no cuenta como ingreso ni gasto, ni consume presupuesto |
| INV-3 | Aritmética exacta en céntimos |
| INV-4 | Las fechas no cambian de mes según la zona horaria |
| INV-5 | Generar recurrentes dos veces no duplica movimientos |
| INV-6 | Un recibo a día 31 cae el 28/29 en febrero y no se salta el mes |
| INV-7 | La tasa de ahorro sin ingresos devuelve `null`, no `NaN` |
| INV-8 | El saldo se deriva de los movimientos, nunca se almacena |
| INV-9 | Ningún borrado deja números incorrectos detrás |
| INV-10 | Exportar e importar reproduce el estado exacto |

## Lo que no hace (todavía)

Sincronización entre dispositivos, importación de extractos bancarios en CSV,
desglose de inversiones por activo con precios automáticos, multidivisa con
conversión, y préstamos con cuadro de amortización.

La persistencia está detrás de la interfaz `StorageAdapter` (`src/datos/repositorio.ts`),
así que añadir un backend con sincronización sería escribir otra implementación de
esos seis métodos, sin tocar el dominio ni la interfaz. Lo que esa interfaz **no**
tiene todavía es una marca de tiempo por registro, que haría falta para resolver
conflictos entre dispositivos.
