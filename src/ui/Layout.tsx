import type { ReactNode } from 'react'
import { BannerInstalacion } from './componentes/BannerInstalacion'
import { PAGINAS, type Pagina } from './navegacion'

/**
 * Armazón de la aplicación.
 *
 * En móvil la navegación va abajo, al alcance del pulgar, porque apuntar un
 * gasto se hace de pie en una tienda y no sentado en un escritorio. En
 * pantalla ancha pasa a una columna lateral.
 */
export function Layout({
  pagina,
  onNavegar,
  children,
}: {
  pagina: Pagina
  onNavegar: (p: Pagina) => void
  children: ReactNode
}) {
  const entradas = Object.entries(PAGINAS) as Array<[Pagina, (typeof PAGINAS)[Pagina]]>

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex max-w-6xl">
        {/* Navegación lateral en escritorio */}
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col gap-1 border-r border-slate-200 p-4 md:flex dark:border-slate-800">
          <div className="mb-6 px-2">
            <h1 className="text-lg font-bold">Finanzas</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Tus cuentas, bajo control</p>
          </div>
          {entradas.map(([clave, { titulo, icono }]) => (
            <button
              key={clave}
              type="button"
              onClick={() => onNavegar(clave)}
              aria-current={pagina === clave ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                pagina === clave
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span aria-hidden>{icono}</span>
              {titulo}
            </button>
          ))}
        </aside>

        <main className="min-w-0 flex-1 pb-24 md:pb-8">
          <header className="border-b border-slate-200 px-4 py-4 md:px-8 dark:border-slate-800">
            <h2 className="text-xl font-bold">{PAGINAS[pagina].titulo}</h2>
          </header>
          <div className="px-4 py-5 md:px-8">
            {/* Va en el armazón y no en una pantalla concreta para que se vea
                se entre por donde se entre. */}
            <BannerInstalacion />
            {children}
          </div>
        </main>
      </div>

      {/* Navegación inferior en móvil */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-slate-200 bg-white/95 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-900/95"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {entradas.map(([clave, { titulo, icono }]) => (
          <button
            key={clave}
            type="button"
            onClick={() => onNavegar(clave)}
            aria-current={pagina === clave ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
              pagina === clave ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            <span className="text-lg" aria-hidden>
              {icono}
            </span>
            {titulo}
          </button>
        ))}
      </nav>
    </div>
  )
}
