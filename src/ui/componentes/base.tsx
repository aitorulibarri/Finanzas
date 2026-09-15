import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { formatearEuros } from '../../dominio/dinero'
import type { Cents } from '../../dominio/dinero'

/** Piezas comunes de interfaz. Todas responden a claro y oscuro. */

/**
 * Tarjeta base.
 *
 * `fondo` va aparte de `className` a propósito: en Tailwind, entre dos clases
 * que tocan la misma propiedad gana la que aparezca después en la hoja de
 * estilos, no la que se escriba después en el atributo. Pasar un `bg-*` por
 * className junto al `bg-white` de aquí dejaba el fondo sin cambiar mientras
 * el texto sí cambiaba, y la cifra quedaba blanca sobre blanco.
 */
export function Tarjeta({
  children,
  className = '',
  fondo = 'bg-white dark:bg-slate-900',
}: {
  children: ReactNode
  className?: string
  fondo?: string
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 p-4 shadow-sm dark:border-slate-800 ${fondo} ${className}`}
    >
      {children}
    </div>
  )
}

type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'fantasma'

const estilosBoton: Record<VarianteBoton, string> = {
  primario: 'bg-slate-900 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200',
  secundario:
    'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
  peligro: 'bg-red-600 text-white hover:bg-red-700',
  fantasma: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
}

export function Boton({
  variante = 'secundario',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBoton }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${estilosBoton[variante]} ${className}`}
      {...props}
    />
  )
}

export function Campo({
  etiqueta,
  error,
  children,
}: {
  etiqueta: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{etiqueta}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{error}</span>}
    </label>
  )
}

const estiloEntrada =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-400'

export function Entrada({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${estiloEntrada} ${className}`} {...props} />
}

export function Desplegable({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${estiloEntrada} ${className}`} {...props} />
}

/** Importe con color según si suma o resta. */
export function Importe({
  cents,
  tipo,
  compacto = false,
  className = '',
}: {
  cents: Cents
  tipo?: 'ingreso' | 'gasto' | 'traspaso' | 'neutro'
  compacto?: boolean
  className?: string
}) {
  const color =
    tipo === 'ingreso'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tipo === 'gasto'
        ? 'text-red-600 dark:text-red-400'
        : tipo === 'traspaso'
          ? 'text-sky-600 dark:text-sky-400'
          : cents < 0
            ? 'text-red-600 dark:text-red-400'
            : 'text-slate-900 dark:text-slate-100'

  /*
   * Cero no lleva signo: no es ni positivo ni negativo, y "+0,00 €" en la
   * tarjeta de ingresos de un mes sin ingresos se lee como un error.
   *
   * Sin tipo explícito el signo lo pone el propio importe, porque se pinta
   * el valor absoluto: si no, un ahorro mensual de −45 € aparecería como
   * "45,00 €" en rojo y se leería como un ahorro positivo.
   */
  const signo =
    cents === 0 ? '' : tipo === 'ingreso' ? '+' : tipo === 'gasto' ? '−' : cents < 0 ? '−' : ''

  return (
    <span className={`tabular-nums font-semibold ${color} ${className}`}>
      {signo}
      {formatearEuros(Math.abs(cents), compacto)}
    </span>
  )
}

export function BarraProgreso({
  porcentaje,
  color = 'bg-slate-900 dark:bg-slate-100',
}: {
  porcentaje: number
  color?: string
}) {
  const ancho = Math.min(100, Math.max(0, porcentaje))
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${ancho}%` }} />
    </div>
  )
}

export function EstadoVacio({
  icono,
  titulo,
  descripcion,
  accion,
}: {
  icono: string
  titulo: string
  descripcion: string
  accion?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
      <span className="text-4xl">{icono}</span>
      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{titulo}</h3>
      <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{descripcion}</p>
      {accion}
    </div>
  )
}

export function Modal({
  abierto,
  titulo,
  onCerrar,
  children,
}: {
  abierto: boolean
  titulo: string
  onCerrar: () => void
  children: ReactNode
}) {
  if (!abierto) return null
  const idTitulo = `modal-${titulo.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      onKeyDown={(e) => e.key === 'Escape' && onCerrar()}
    >
      {/* role="dialog" y aria-modal dicen a los lectores de pantalla que lo de
          detrás queda inerte mientras esto está abierto. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-2xl dark:bg-slate-900"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={idTitulo} className="text-lg font-semibold text-slate-900 dark:text-slate-100">{titulo}</h2>
          <Boton variante="fantasma" onClick={onCerrar} aria-label="Cerrar">
            ✕
          </Boton>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Aviso({
  tono = 'info',
  children,
}: {
  tono?: 'info' | 'alerta' | 'error'
  children: ReactNode
}) {
  const estilos = {
    info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200',
    alerta: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
    error: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200',
  }[tono]
  return <div className={`rounded-xl border px-4 py-3 text-sm ${estilos}`}>{children}</div>
}
