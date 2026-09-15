import type { EstadoFinanzas } from './tipos'

/**
 * Qué arrastra cada borrado.
 *
 * Esto no es limpieza cosmética de datos sueltos: cada regla de aquí existe
 * porque sin ella algún número queda mal. Si borras un traspaso que estaba
 * asignado a un objetivo y no se borra su aportación, el objetivo sigue
 * contando dinero que ya no existe.
 *
 * Son funciones puras sobre el estado para poder testearlas sin base de
 * datos; la capa de datos solo ejecuta lo que estas deciden.
 */

/** Lo que hay que borrar, por tabla, y los registros que hay que reescribir. */
export interface Cascada {
  movimientos?: string[]
  aportaciones?: string[]
  valoraciones?: string[]
  presupuestos?: string[]
  objetivos?: string[]
  categorias?: string[]
  cuentas?: string[]
  recurrentes?: string[]
  /** Registros modificados que hay que volver a guardar. */
  reescribir?: Partial<EstadoFinanzas>
}

export interface Bloqueo {
  bloqueado: true
  motivo: string
}

export type ResultadoBorrado = Cascada | Bloqueo

export function estaBloqueado(r: ResultadoBorrado): r is Bloqueo {
  return 'bloqueado' in r
}

/**
 * Borrar un movimiento se lleva las aportaciones que lo etiquetaban.
 *
 * Una aportación a un objetivo es una etiqueta sobre un traspaso real. Si el
 * traspaso desaparece, la etiqueta no puede sobrevivir sola o el objetivo
 * mostraría progreso respaldado por dinero que ya no se movió.
 */
export function borrarMovimiento(estado: EstadoFinanzas, movimientoId: string): Cascada {
  return {
    movimientos: [movimientoId],
    aportaciones: estado.aportaciones
      .filter((a) => a.movimientoId === movimientoId)
      .map((a) => a.id),
  }
}

/**
 * Borrar una categoría reasigna sus movimientos en vez de dejarlos huérfanos.
 *
 * Un movimiento sin categoría válida desaparecería del desglose de gastos
 * pero seguiría contando en el total del mes, y los números dejarían de
 * cuadrar entre pantallas. Las subcategorías se reasignan también.
 */
export function borrarCategoria(
  estado: EstadoFinanzas,
  categoriaId: string,
  destinoId: string,
): ResultadoBorrado {
  if (destinoId === categoriaId) {
    return { bloqueado: true, motivo: 'No se puede reasignar una categoría a sí misma' }
  }
  const destino = estado.categorias.find((c) => c.id === destinoId)
  if (!destino) {
    return { bloqueado: true, motivo: 'La categoría de destino no existe' }
  }

  const afectadas = new Set([
    categoriaId,
    ...estado.categorias.filter((c) => c.padreId === categoriaId).map((c) => c.id),
  ])

  const movimientos = estado.movimientos
    .filter((m) => m.categoriaId && afectadas.has(m.categoriaId))
    .map((m) => ({ ...m, categoriaId: destinoId }))

  const recurrentes = estado.recurrentes
    .filter((r) => r.categoriaId && afectadas.has(r.categoriaId))
    .map((r) => ({ ...r, categoriaId: destinoId }))

  return {
    categorias: [...afectadas],
    // Los presupuestos de una categoría que ya no existe no se reasignan:
    // fusionarlos con los del destino daría un límite inventado.
    presupuestos: estado.presupuestos.filter((p) => afectadas.has(p.categoriaId)).map((p) => p.id),
    reescribir: { movimientos, recurrentes },
  }
}

/**
 * Borrar una cuenta con movimientos se bloquea.
 *
 * Aquí no hay reasignación razonable: mover el historial a otra cuenta
 * falsearía sus saldos, y borrarlo en cascada destruiría meses de registro
 * por un clic. Se ofrece archivar, que la saca del patrimonio y de los
 * desplegables sin tocar nada.
 */
export function borrarCuenta(estado: EstadoFinanzas, cuentaId: string): ResultadoBorrado {
  const usos = estado.movimientos.filter(
    (m) => m.cuentaId === cuentaId || m.cuentaDestinoId === cuentaId,
  ).length

  if (usos > 0) {
    return {
      bloqueado: true,
      motivo: `Esta cuenta tiene ${usos} ${usos === 1 ? 'movimiento' : 'movimientos'}. Archívala en vez de borrarla para conservar el historial.`,
    }
  }

  const recurrentes = estado.recurrentes.filter(
    (r) => r.cuentaId === cuentaId || r.cuentaDestinoId === cuentaId,
  )
  if (recurrentes.length > 0) {
    return {
      bloqueado: true,
      motivo: `Esta cuenta la usan ${recurrentes.length} movimientos recurrentes. Bórralos o cámbialos de cuenta primero.`,
    }
  }

  return { cuentas: [cuentaId], valoraciones: estado.valoraciones.filter((v) => v.cuentaId === cuentaId).map((v) => v.id) }
}

/** Borrar un objetivo se lleva sus aportaciones, que no tienen sentido sin él. */
export function borrarObjetivo(estado: EstadoFinanzas, objetivoId: string): Cascada {
  return {
    objetivos: [objetivoId],
    aportaciones: estado.aportaciones.filter((a) => a.objetivoId === objetivoId).map((a) => a.id),
  }
}

/**
 * Borrar un recurrente NO borra lo que ya generó.
 *
 * Esos movimientos son dinero que de verdad se movió: nóminas cobradas y
 * recibos pagados. Borrarlos reescribiría el pasado y descuadraría todos los
 * saldos. Solo se les quita la referencia al recurrente.
 */
export function borrarRecurrente(estado: EstadoFinanzas, recurrenteId: string): Cascada {
  const generados = estado.movimientos
    .filter((m) => m.recurrenteId === recurrenteId)
    .map(({ recurrenteId: _, ...resto }) => resto)

  return { recurrentes: [recurrenteId], reescribir: { movimientos: generados } }
}
