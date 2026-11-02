# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

PWA de finanzas personales (Vite 8 · React 19 · TypeScript · Tailwind 4 · Dexie · Zod · Recharts · Vitest). **No hay backend ni cuentas**: todo vive en IndexedDB del navegador del usuario. Por eso cada persona que abre la URL solo ve sus datos (aislamiento por navegador/dispositivo, no por usuario), y dos personas en el mismo navegador comparten datos. Cualquier cambio que envíe datos fuera del navegador rompe la promesa central del README.

Interfaz, comentarios y mensajes en español; seguir esa convención.

## Comandos

```bash
npm run dev            # http://localhost:5173
npm run build          # tsc -b && vite build
npm run lint           # oxlint
npm run test           # vitest run (entorno node, src/**/*.test.ts)
npx vitest run src/dominio/calculos.test.ts        # un fichero
npx vitest run -t "traspaso"                       # por nombre
npm run test:tz        # tests bajo UTC+14 y UTC-11; es lo que corre CI
```

- `test:tz` usa la sintaxis `TZ=... vitest`, que **solo funciona en Git Bash/Unix**, no en PowerShell ni cmd.
- CI (`ci.yml`, ramas distintas de `main`): lint → `test:tz` → build. El despliegue (`deploy.yml`, push a `main`) repite lint y `test:tz` y publica en GitHub Pages con `build:pages` (base `/Finanzas/`). URL: https://aitorulibarri.github.io/Finanzas/
- El entorno `github-pages` del repo restringe las ramas que pueden desplegar; `main` se añadió a mano. Si el job `desplegar` falla con "not allowed to deploy ... environment protection rules", es eso (Settings → Environments).

### E2E con navegador real

Playwright **no** está en las dependencias (pesa ~50 MB). Para usarlo: `npm install -D playwright && npx playwright install chromium`, y **no commitear** el cambio en `package.json`/`package-lock.json` (`git checkout` de ambos al terminar). Los scripts esperan el bundle servido en el puerto 4173:

```bash
npm run build && npm run preview -- --port 4173 &
node e2e/validacion.mjs          # invariantes financieros de punta a punta
node e2e/banner-instalacion.mjs  # ramas del aviso de instalación (iOS, Android, escritorio)
```

Las capturas van a `e2e/evidencia/` (ignorada por git). `validacion.mjs` calcula esa ruta con `new URL(...).pathname`, que en Windows da `C:\C:\...` y falla; `banner-instalacion.mjs` ya usa `fileURLToPath`.

## Arquitectura

Capas con dependencia en un solo sentido: `ui → estado → datos → dominio`.

- **`src/dominio/`**: TypeScript puro, sin React ni IndexedDB. **Toda la matemática financiera vive aquí** (`calculos`, `recurrentes`, `integridad`, `dinero`, `fechas`, `esquemas` Zod). Ningún componente calcula por su cuenta. Es lo que se testea de forma exhaustiva.
- **`src/datos/`**: la interfaz `StorageAdapter` (`repositorio.ts`) es la única costura de persistencia; `adaptadorDexie` la implementa sobre `BaseFinanzas` (`db.ts`). La app nunca habla con Dexie directamente. `backup.ts` exporta/importa JSON validando el fichero entero con Zod antes de tocar la base.
- **`src/estado/FinanzasContext.tsx`**: mantiene el estado completo en memoria y escribe en IndexedDB en cada cambio (write-through). Al arrancar carga, siembra categorías (`cargarConSemilla`) y materializa los recurrentes vencidos (`generarPendientes`).
- **`src/ui/`**: páginas, `Layout` y componentes. Enrutado por hash (`#/cuentas`, `#/movimientos`...) vía `navegacion.ts`; solo `Resumen` se carga con `lazy` porque es la única que usa Recharts.

### Invariantes que no se pueden romper

Hay diez con test (INV-1…10, tabla en el README). Los que más condicionan el código:

- **Dinero = entero de céntimos**, nunca decimal; el texto se parsea con aritmética entera, sin `parseFloat`.
- **Fecha = string `'YYYY-MM-DD'`**, nunca `Date` ni timestamp, para que un gasto del 31/01 23:00 no cambie de mes según la zona horaria. Por eso `test:tz` existe.
- **El saldo se deriva de los movimientos**, nunca se almacena. Un **traspaso** no es ingreso ni gasto ni consume presupuesto y no cambia el patrimonio.
- **Los borrados pasan por `integridad.ts`**: son funciones puras que devuelven una `Cascada` (qué borrar/reescribir) o un `Bloqueo`; `aplicarCascada` la ejecuta en la base y `aplicarCascadaEnMemoria` en el estado. No borrar registros directamente con `eliminar` si tienen dependientes (p. ej. borrar un traspaso arrastra sus aportaciones a objetivos).
- **Semilla de categorías para bases ya creadas**: `cargarConSemilla` solo siembra una vez (`semillaAplicada`). Para que quien ya usa la app reciba una categoría nueva hace falta una migración con su propio flag opcional en `Configuracion` (ver `semillaInversionAplicada` y `añadirCategoriaInversion` en `repositorio.ts`), o se duplicaría o reaparecería tras borrarla.
- **Esquema de IndexedDB**: nunca editar `this.version(1)` en `db.ts`; un cambio de esquema es un `.version(2)` nuevo con su `upgrade`, o las bases ya creadas en los navegadores de los usuarios dejarán de abrir. Si cambia la forma de los datos, subir también `VERSION_ESQUEMA` (`esquemas.ts`) y mantener compatible la importación de copias antiguas.

## PWA y aviso de instalación

`vite-plugin-pwa` (`registerType: 'autoUpdate'`) genera manifest y service worker; `start_url`/`scope` dependen de `GITHUB_PAGES`. Tras un despliegue, un móvil con la app abierta puede seguir sirviendo la versión anterior hasta cerrarla del todo.

`ui/componentes/BannerInstalacion.tsx` tiene ramas distintas por plataforma: iOS (pasos a mano; el aviso reaparece a los 5 días porque Safari borra el almacenamiento a los 7 sin instalar), Android (pasos a mano según navegador por user agent, más botón **Instalar** si llega `beforeinstallprompt`) y otros (solo con el evento). Los e2e simulan `beforeinstallprompt` con un evento inventado: el diálogo nativo real no está verificado en un dispositivo físico, y Chromium automatizado no lo dispara.

## Móvil: teclado virtual y pruebas

- En Android (Chrome ≥108 y derivados, como el navegador de Xiaomi) el teclado se pinta **encima** de la página sin reducir el viewport. `Modal` (`base.tsx`) se ciñe a `visualViewport` vía `useZonaVisible`, y `useCentrarCampoEnfocado` (montado en `Layout`) recentra el campo enfocado; ambos viven en `ui/useTecladoVirtual.ts`. `index.html` añade `interactive-widget=resizes-content`. No volver a un modal `fixed inset-0` pegado abajo sin esto.
- En formularios largos, poner los campos de texto arriba (en `FormularioMovimiento` el concepto va junto al importe, antes de las categorías) para que queden por encima del teclado.
- Redimensionar la ventana de Chrome no cambia `innerWidth`. Para ver el diseño móvil, incrustar la app en un `<iframe>` de 390 px (misma origin); un teclado se simula sustituyendo `window.visualViewport` del iframe por un `EventTarget` con `height`/`offsetTop`. No sustituye a probar en un dispositivo real: el fallo del teclado en Xiaomi no está verificado en uno físico.
- Las pruebas contra producción escriben en el IndexedDB real del navegador (`finanzas`): borrarlo al terminar (`indexedDB.deleteDatabase('finanzas')`).
