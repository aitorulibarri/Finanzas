import { porcentaje, sumar, type Cents } from './dinero'
import { enMes, mesDe, mesesEntre, ultimoDiaDelMes, type FechaISO, type MesISO } from './fechas'
import type {
  Categoria,
  Cuenta,
  EstadoFinanzas,
  Movimiento,
  Objetivo,
  Presupuesto,
} from './tipos'

/**
 * Todos los números que enseña la aplicación salen de aquí.
 *
 * Son funciones puras sobre el estado: ni React, ni IndexedDB, ni fechas del
 * sistema salvo las que se pasan como argumento. Eso es lo que permite
 * testear los invariantes financieros en milisegundos y sin navegador.
 *
 * La regla que gobierna todo el módulo: un TRASPASO no es ingreso ni gasto.
 * Mover dinero de tu cuenta corriente a tu cuenta de ahorro no te hace ni
 * más rico ni más pobre, así que no aparece en los totales del mes ni
 * consume presupuesto. Es el error más común de este tipo de aplicaciones y
 * está cubierto por los tests INV-1 e INV-2.
 */

// ---------------------------------------------------------------- saldos

/**
 * Saldo derivado de una cuenta: el inicial más todo lo que ha entrado menos
 * todo lo que ha salido, opcionalmente hasta una fecha.
 *
 * El saldo nunca se almacena. Si se guardara, editar o borrar un movimiento
 * antiguo lo dejaría desincronizado en silencio.
 *
 * Una tarjeta de crédito no necesita tratamiento especial: sus gastos salen
 * de ella, así que el saldo se vuelve negativo solo y resta del patrimonio.
 */
export function saldoCuenta(estado: EstadoFinanzas, cuentaId: string, hasta?: FechaISO): Cents {
  const cuenta = estado.cuentas.find((c) => c.id === cuentaId)
  if (!cuenta) return 0

  let saldo = cuenta.saldoInicial
  for (const m of estado.movimientos) {
    if (hasta && m.fecha > hasta) continue
    if (m.cuentaId === cuentaId) {
      if (m.tipo === 'ingreso') saldo += m.importe
      else saldo -= m.importe // gasto y traspaso salen de la cuenta origen
    }
    if (m.tipo === 'traspaso' && m.cuentaDestinoId === cuentaId) {
      saldo += m.importe
    }
  }
  return saldo
}

/**
 * Lo que vale una cuenta hoy.
 *
 * Para las de inversión manda la última valoración anotada, porque su valor
 * cambia con el mercado sin que haya movimiento. Si todavía no hay ninguna,
 * se cae al saldo derivado, que equivale a decir "vale lo que has metido".
 */
export function valorCuenta(estado: EstadoFinanzas, cuentaId: string, hasta?: FechaISO): Cents {
  const cuenta = estado.cuentas.find((c) => c.id === cuentaId)
  if (!cuenta) return 0

  if (cuenta.tipo === 'inversion') {
    const valoracion = ultimaValoracion(estado, cuentaId, hasta)
    if (valoracion) return valoracion.valor
  }
  return saldoCuenta(estado, cuentaId, hasta)
}

export function ultimaValoracion(estado: EstadoFinanzas, cuentaId: string, hasta?: FechaISO) {
  return estado.valoraciones
    .filter((v) => v.cuentaId === cuentaId && (!hasta || v.fecha <= hasta))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .at(-1)
}

/**
 * Patrimonio neto: lo que valen todas tus cuentas activas juntas.
 *
 * No hay doble conteo posible porque cada cuenta aporta su valor una sola
 * vez, y las de inversión aportan su valoración en lugar de sus aportaciones.
 */
export function patrimonioNeto(estado: EstadoFinanzas, hasta?: FechaISO): Cents {
  return sumar(
    ...estado.cuentas.filter((c) => !c.archivada).map((c) => valorCuenta(estado, c.id, hasta)),
  )
}

/**
 * Rendimiento de una cuenta de inversión: lo que vale menos lo que has
 * metido. Sale gratis de las valoraciones, sin seguir activo por activo.
 */
export function rendimientoInversion(estado: EstadoFinanzas, cuentaId: string) {
  const cuenta = estado.cuentas.find((c) => c.id === cuentaId)
  if (!cuenta) return null

  const aportado = saldoCuenta(estado, cuentaId)
  const valor = valorCuenta(estado, cuentaId)
  const ganancia = valor - aportado
  return { aportado, valor, ganancia, porcentaje: porcentaje(ganancia, aportado) }
}

// ------------------------------------------------------------ mes a mes

/** Ingresos del mes. Los traspasos quedan fuera por construcción (INV-2). */
export function ingresosDelMes(estado: EstadoFinanzas, mes: MesISO): Cents {
  return sumar(
    ...estado.movimientos.filter((m) => m.tipo === 'ingreso' && enMes(m.fecha, mes)).map((m) => m.importe),
  )
}

/** Gastos del mes. Los traspasos quedan fuera por construcción (INV-2). */
export function gastosDelMes(estado: EstadoFinanzas, mes: MesISO): Cents {
  return sumar(
    ...estado.movimientos.filter((m) => m.tipo === 'gasto' && enMes(m.fecha, mes)).map((m) => m.importe),
  )
}

/** Lo que has conseguido apartar en el mes. Puede ser negativo. */
export function ahorroDelMes(estado: EstadoFinanzas, mes: MesISO): Cents {
  return ingresosDelMes(estado, mes) - gastosDelMes(estado, mes)
}

/**
 * Qué porcentaje de lo que entra consigues no gastar.
 *
 * Devuelve null si no hubo ingresos: sin base de cálculo la tasa no existe,
 * y devolver null en vez de NaN o Infinity obliga a la interfaz a decidir
 * qué pintar en ese caso (INV-7).
 */
export function tasaAhorro(estado: EstadoFinanzas, mes: MesISO): number | null {
  const ingresos = ingresosDelMes(estado, mes)
  return porcentaje(ahorroDelMes(estado, mes), ingresos)
}

export interface ResumenMes {
  mes: MesISO
  ingresos: Cents
  gastos: Cents
  ahorro: Cents
  tasaAhorro: number | null
}

export function resumenMes(estado: EstadoFinanzas, mes: MesISO): ResumenMes {
  const ingresos = ingresosDelMes(estado, mes)
  const gastos = gastosDelMes(estado, mes)
  const ahorro = ingresos - gastos
  return { mes, ingresos, gastos, ahorro, tasaAhorro: porcentaje(ahorro, ingresos) }
}

/** Serie para el gráfico de barras de ingresos contra gastos. */
export function serieMensual(estado: EstadoFinanzas, meses: MesISO[]): ResumenMes[] {
  return meses.map((m) => resumenMes(estado, m))
}

/** Patrimonio al cierre de cada mes, para el gráfico de evolución. */
export function evolucionPatrimonio(estado: EstadoFinanzas, meses: MesISO[]) {
  return meses.map((mes) => ({ mes, patrimonio: patrimonioNeto(estado, ultimoDiaDelMes(mes)) }))
}

// ------------------------------------------------------------ categorías

/**
 * Una categoría y sus hijas. La jerarquía es de un solo nivel, así que basta
 * con mirar los hijos directos.
 */
export function conDescendientes(categorias: Categoria[], categoriaId: string): Set<string> {
  const ids = new Set([categoriaId])
  for (const c of categorias) {
    if (c.padreId === categoriaId) ids.add(c.id)
  }
  return ids
}

export interface GastoCategoria {
  categoria: Categoria
  importe: Cents
  porcentaje: number | null
}

/**
 * Gasto del mes por categoría, de mayor a menor.
 *
 * Las subcategorías se agregan a su madre para que el gráfico no se llene de
 * porciones diminutas.
 */
export function gastosPorCategoria(estado: EstadoFinanzas, mes: MesISO): GastoCategoria[] {
  const total = gastosDelMes(estado, mes)
  const porId = new Map<string, Cents>()

  for (const m of estado.movimientos) {
    if (m.tipo !== 'gasto' || !enMes(m.fecha, mes) || !m.categoriaId) continue
    const categoria = estado.categorias.find((c) => c.id === m.categoriaId)
    const clave = categoria?.padreId ?? m.categoriaId
    porId.set(clave, (porId.get(clave) ?? 0) + m.importe)
  }

  return [...porId.entries()]
    .map(([id, importe]) => {
      const categoria = estado.categorias.find((c) => c.id === id)
      return categoria ? { categoria, importe, porcentaje: porcentaje(importe, total) } : null
    })
    .filter((x): x is GastoCategoria => x !== null)
    .sort((a, b) => b.importe - a.importe)
}

// ---------------------------------------------------------- presupuestos

/**
 * El presupuesto que aplica a una categoría en un mes.
 *
 * Un presupuesto fijado para ese mes concreto gana al recurrente (`mes: null`),
 * que es el que se repite todos los meses.
 */
export function presupuestoAplicable(
  presupuestos: Presupuesto[],
  categoriaId: string,
  mes: MesISO,
): Presupuesto | undefined {
  const delMes = presupuestos.find((p) => p.categoriaId === categoriaId && p.mes === mes)
  return delMes ?? presupuestos.find((p) => p.categoriaId === categoriaId && p.mes === null)
}

export interface ConsumoPresupuesto {
  presupuesto: Presupuesto
  categoria: Categoria
  limite: Cents
  gastado: Cents
  restante: Cents
  porcentaje: number | null
  superado: boolean
}

/**
 * Cuánto llevas gastado de un presupuesto.
 *
 * Suma la categoría y sus hijas, y solo movimientos de tipo gasto: un
 * traspaso a la cuenta de ahorro no consume el presupuesto de Ocio (INV-2).
 */
export function consumoPresupuesto(
  estado: EstadoFinanzas,
  presupuesto: Presupuesto,
  mes: MesISO,
): ConsumoPresupuesto | null {
  const categoria = estado.categorias.find((c) => c.id === presupuesto.categoriaId)
  if (!categoria) return null

  const ids = conDescendientes(estado.categorias, presupuesto.categoriaId)
  const gastado = sumar(
    ...estado.movimientos
      .filter((m) => m.tipo === 'gasto' && enMes(m.fecha, mes) && m.categoriaId && ids.has(m.categoriaId))
      .map((m) => m.importe),
  )

  return {
    presupuesto,
    categoria,
    limite: presupuesto.importeMensual,
    gastado,
    restante: presupuesto.importeMensual - gastado,
    porcentaje: porcentaje(gastado, presupuesto.importeMensual),
    superado: gastado > presupuesto.importeMensual,
  }
}

/** Todos los presupuestos que aplican al mes, los más consumidos primero. */
export function consumosDelMes(estado: EstadoFinanzas, mes: MesISO): ConsumoPresupuesto[] {
  const categoriasConPresupuesto = new Set(estado.presupuestos.map((p) => p.categoriaId))
  return [...categoriasConPresupuesto]
    .map((categoriaId) => {
      const p = presupuestoAplicable(estado.presupuestos, categoriaId, mes)
      return p ? consumoPresupuesto(estado, p, mes) : null
    })
    .filter((c): c is ConsumoPresupuesto => c !== null)
    .sort((a, b) => (b.porcentaje ?? 0) - (a.porcentaje ?? 0))
}

// -------------------------------------------------------------- objetivos

export interface ProgresoObjetivo {
  objetivo: Objetivo
  aportado: Cents
  restante: Cents
  porcentaje: number | null
  completado: boolean
  /** Cuánto habría que apartar cada mes para llegar a la fecha límite. */
  cuotaMensual: Cents | null
  mesesRestantes: number | null
}

/**
 * Progreso de un objetivo de ahorro.
 *
 * Lo aportado sale de las aportaciones, que son etiquetas sobre traspasos ya
 * existentes y no dinero nuevo. Por eso pueden convivir varios objetivos
 * sobre la misma cuenta de ahorro sin contar dos veces lo mismo.
 */
export function progresoObjetivo(
  estado: EstadoFinanzas,
  objetivo: Objetivo,
  hoy: FechaISO,
): ProgresoObjetivo {
  const aportado = sumar(
    ...estado.aportaciones.filter((a) => a.objetivoId === objetivo.id).map((a) => a.importe),
  )
  const restante = Math.max(0, objetivo.objetivo - aportado)

  let mesesRestantes: number | null = null
  let cuotaMensual: Cents | null = null
  if (objetivo.fechaLimite) {
    mesesRestantes = mesesEntre(mesDe(hoy), mesDe(objetivo.fechaLimite))
    if (mesesRestantes > 0 && restante > 0) {
      cuotaMensual = Math.ceil(restante / mesesRestantes)
    }
  }

  return {
    objetivo,
    aportado,
    restante,
    porcentaje: porcentaje(aportado, objetivo.objetivo),
    completado: aportado >= objetivo.objetivo,
    cuotaMensual,
    mesesRestantes,
  }
}

// ----------------------------------------------------------------- varios

/** Movimientos del mes, del más reciente al más antiguo. */
export function movimientosDelMes(estado: EstadoFinanzas, mes: MesISO): Movimiento[] {
  return estado.movimientos
    .filter((m) => enMes(m.fecha, mes))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creadoEn.localeCompare(a.creadoEn))
}

export function cuentasActivas(estado: EstadoFinanzas): Cuenta[] {
  return estado.cuentas.filter((c) => !c.archivada).sort((a, b) => a.orden - b.orden)
}

export function categoriasDe(estado: EstadoFinanzas, tipo: 'ingreso' | 'gasto'): Categoria[] {
  return estado.categorias.filter((c) => c.tipo === tipo && !c.archivada).sort((a, b) => a.orden - b.orden)
}
