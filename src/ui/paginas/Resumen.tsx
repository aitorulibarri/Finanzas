import { useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  consumosDelMes, evolucionPatrimonio, gastosPorCategoria,
  patrimonioNeto, resumenMes, serieMensual,
} from '../../dominio/calculos'
import { aEuros, formatearEuros } from '../../dominio/dinero'
import { formatearFecha, formatearMes, mesActual, sumarMeses, ultimosMeses } from '../../dominio/fechas'
import { proximasOcurrencias } from '../../dominio/recurrentes'
import { hoy } from '../../dominio/fechas'
import { useFinanzas } from '../../estado/FinanzasContext'
import { BarraProgreso, Boton, EstadoVacio, Importe, Tarjeta } from '../componentes/base'

const NOMBRES_MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const etiquetaMesCorto = (mes: string) => NOMBRES_MES_CORTO[Number(mes.slice(5, 7)) - 1]

/** Tooltip común: los importes se formatean en euros, no en céntimos crudos. */
function TooltipEuros({
  active, payload, label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
      {label && <p className="mb-1 font-semibold">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}: <strong className="tabular-nums">{formatearEuros(Math.round((p.value ?? 0) * 100))}</strong>
        </p>
      ))}
    </div>
  )
}

export function Resumen() {
  const { estado } = useFinanzas()
  const [mes, setMes] = useState(mesActual())

  const resumen = useMemo(() => resumenMes(estado, mes), [estado, mes])
  const patrimonio = useMemo(() => patrimonioNeto(estado), [estado])
  const categorias = useMemo(() => gastosPorCategoria(estado, mes), [estado, mes])
  const consumos = useMemo(() => consumosDelMes(estado, mes), [estado, mes])
  const proximos = useMemo(() => proximasOcurrencias(estado, hoy(), 30).slice(0, 5), [estado])

  const meses = useMemo(() => ultimosMeses(mes, 12), [mes])
  const serie = useMemo(
    () => serieMensual(estado, meses).map((r) => ({
      mes: etiquetaMesCorto(r.mes),
      Ingresos: aEuros(r.ingresos),
      Gastos: aEuros(r.gastos),
    })),
    [estado, meses],
  )
  const evolucion = useMemo(
    () => evolucionPatrimonio(estado, meses).map((p) => ({
      mes: etiquetaMesCorto(p.mes),
      Patrimonio: aEuros(p.patrimonio),
    })),
    [estado, meses],
  )

  const sinDatos = estado.movimientos.length === 0 && estado.cuentas.length === 0

  if (sinDatos) {
    return (
      <EstadoVacio
        icono="👋"
        titulo="Empecemos por el principio"
        descripcion="Crea tus cuentas con el saldo que tengan hoy y empieza a apuntar movimientos. En cuanto haya un mes completo, aquí verás en qué se te va el dinero."
        accion={
          <Boton variante="primario" onClick={() => (window.location.hash = '/cuentas')}>
            Crear mi primera cuenta
          </Boton>
        }
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1">
        <Boton variante="fantasma" onClick={() => setMes(sumarMeses(mes, -1))} aria-label="Mes anterior">←</Boton>
        <span className="min-w-40 text-center text-sm font-semibold capitalize">{formatearMes(mes)}</span>
        <Boton variante="fantasma" onClick={() => setMes(sumarMeses(mes, 1))} aria-label="Mes siguiente">→</Boton>
      </div>

      {/* El patrimonio es la cifra con la que arranca la pantalla: es la única
          que responde de verdad a "cuánto tengo". */}
      <Tarjeta className="bg-slate-900 text-white dark:bg-white dark:text-slate-900">
        <p className="text-xs font-medium opacity-70">Patrimonio neto</p>
        <p className="mt-1 text-4xl font-bold tabular-nums">{formatearEuros(patrimonio)}</p>
      </Tarjeta>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tarjeta>
          <p className="text-xs text-slate-500 dark:text-slate-400">Ingresos</p>
          <p className="mt-1 text-xl"><Importe cents={resumen.ingresos} tipo="ingreso" /></p>
        </Tarjeta>
        <Tarjeta>
          <p className="text-xs text-slate-500 dark:text-slate-400">Gastos</p>
          <p className="mt-1 text-xl"><Importe cents={resumen.gastos} tipo="gasto" /></p>
        </Tarjeta>
        <Tarjeta>
          <p className="text-xs text-slate-500 dark:text-slate-400">Ahorro del mes</p>
          <p className="mt-1 text-xl"><Importe cents={resumen.ahorro} /></p>
        </Tarjeta>
        <Tarjeta>
          <p className="text-xs text-slate-500 dark:text-slate-400">Tasa de ahorro</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {resumen.tasaAhorro === null ? (
              <span className="text-base font-normal text-slate-400">Sin ingresos</span>
            ) : (
              `${resumen.tasaAhorro.toFixed(0)} %`
            )}
          </p>
        </Tarjeta>
      </div>

      {/* Gastos por categoría: barras horizontales ordenadas, no un donut.
          Comparar ángulos de porciones parecidas es mucho más difícil que
          comparar longitudes, y los nombres largos caben sin recortar. Un
          solo color para todas: el tamaño ya lo dice la longitud de la barra,
          teñirlas además por importe sería codificar dos veces lo mismo. */}
      {categorias.length > 0 && (
        <Tarjeta>
          <h3 className="mb-3 text-sm font-semibold">En qué se ha ido el dinero</h3>
          <ul className="space-y-2.5">
            {categorias.slice(0, 8).map(({ categoria, importe, porcentaje }) => (
              <li key={categoria.id}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span aria-hidden>{categoria.icono}</span>
                    <span className="truncate">{categoria.nombre}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatearEuros(importe)}
                    {porcentaje !== null && (
                      <span className="ml-1.5 text-xs text-slate-400">{porcentaje.toFixed(0)} %</span>
                    )}
                  </span>
                </div>
                <BarraProgreso
                  porcentaje={porcentaje ?? 0}
                  color="bg-viz-gastos"
                />
              </li>
            ))}
          </ul>
          {categorias.length > 8 && (
            <p className="mt-3 text-xs text-slate-400">
              Y {categorias.length - 8} categorías más con menos gasto.
            </p>
          )}
        </Tarjeta>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Dos series distintas: leyenda obligatoria, y los colores son las
            ranuras validadas de la paleta, no verde contra rojo. */}
        <Tarjeta>
          <h3 className="mb-3 text-sm font-semibold">Ingresos y gastos, últimos 12 meses</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="var(--color-viz-rejilla)" vertical={false} />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" />
                <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" width={56}
                  tickFormatter={(v: number) => formatearEuros(Math.round(v * 100), true)} />
                <Tooltip content={<TooltipEuros />} cursor={{ fill: 'var(--color-viz-rejilla)', opacity: 0.4 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Ingresos" fill="var(--color-viz-ingresos)" radius={[4, 4, 0, 0]} maxBarSize={14} />
                <Bar dataKey="Gastos" fill="var(--color-viz-gastos)" radius={[4, 4, 0, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>

        {/* Una sola serie: el título ya la nombra, así que no lleva leyenda. */}
        <Tarjeta>
          <h3 className="mb-3 text-sm font-semibold">Evolución del patrimonio</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucion} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="var(--color-viz-rejilla)" vertical={false} />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" />
                <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" width={56}
                  tickFormatter={(v: number) => formatearEuros(Math.round(v * 100), true)} />
                <Tooltip content={<TooltipEuros />} />
                <Line
                  type="monotone" dataKey="Patrimonio" stroke="var(--color-viz-patrimonio)"
                  strokeWidth={2} dot={false} activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {consumos.length > 0 && (
          <Tarjeta>
            <h3 className="mb-3 text-sm font-semibold">Presupuestos del mes</h3>
            <ul className="space-y-3">
              {consumos.slice(0, 5).map((c) => (
                <li key={c.presupuesto.id}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden>{c.categoria.icono}</span>
                      {c.categoria.nombre}
                    </span>
                    <span className={`tabular-nums text-xs ${c.superado ? 'font-semibold text-red-600 dark:text-red-400' : 'text-slate-500'}`}>
                      {formatearEuros(c.gastado)} de {formatearEuros(c.limite)}
                    </span>
                  </div>
                  <BarraProgreso
                    porcentaje={c.porcentaje ?? 0}
                    color={c.superado ? 'bg-red-500' : (c.porcentaje ?? 0) > 80 ? 'bg-amber-500' : 'bg-viz-gastos'}
                  />
                </li>
              ))}
            </ul>
          </Tarjeta>
        )}

        {proximos.length > 0 && (
          <Tarjeta>
            <h3 className="mb-1 text-sm font-semibold">Próximos movimientos</h3>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Previsiones de tus recurrentes. Todavía no cuentan en ningún saldo.
            </p>
            <ul className="space-y-2">
              {proximos.map((p, i) => (
                <li key={`${p.recurrente.id}-${i}`} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate">{p.recurrente.nombre}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{formatearFecha(p.fecha)}</span>
                  </span>
                  <Importe cents={p.recurrente.importe} tipo={p.recurrente.tipo} />
                </li>
              ))}
            </ul>
          </Tarjeta>
        )}
      </div>
    </div>
  )
}
