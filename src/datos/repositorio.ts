import type { Cascada } from '../dominio/integridad'
import { estadoVacio, type Configuracion, type EstadoFinanzas } from '../dominio/tipos'
import type { BaseFinanzas } from './db'
import { categoriasIniciales } from './semilla'

/** Tablas de entidades con id; la configuración va aparte porque es única. */
export type TablaEntidad = Exclude<keyof EstadoFinanzas, 'configuracion'>

const TABLAS: TablaEntidad[] = [
  'cuentas',
  'movimientos',
  'categorias',
  'presupuestos',
  'objetivos',
  'aportaciones',
  'recurrentes',
  'valoraciones',
]

/**
 * Contrato de persistencia.
 *
 * Toda la aplicación habla con esta interfaz y nunca con Dexie directamente.
 * Es la costura que permitirá enchufar más adelante un backend con
 * sincronización entre móvil y ordenador sin tocar ni el dominio ni la
 * interfaz: bastará con otra implementación de estos seis métodos.
 */
export interface StorageAdapter {
  cargar(): Promise<EstadoFinanzas>
  guardar<K extends TablaEntidad>(tabla: K, registros: EstadoFinanzas[K]): Promise<void>
  borrar(tabla: TablaEntidad, ids: string[]): Promise<void>
  guardarConfiguracion(configuracion: Configuracion): Promise<void>
  /** Sustituye todo el contenido. Lo usa la importación de copias. */
  reemplazarTodo(estado: EstadoFinanzas): Promise<void>
  vaciar(): Promise<void>
}

export function adaptadorDexie(db: BaseFinanzas): StorageAdapter {
  return {
    async cargar() {
      const [
        cuentas, movimientos, categorias, presupuestos,
        objetivos, aportaciones, recurrentes, valoraciones, configuraciones,
      ] = await Promise.all([
        db.cuentas.toArray(),
        db.movimientos.toArray(),
        db.categorias.toArray(),
        db.presupuestos.toArray(),
        db.objetivos.toArray(),
        db.aportaciones.toArray(),
        db.recurrentes.toArray(),
        db.valoraciones.toArray(),
        db.configuracion.toArray(),
      ])

      const base = estadoVacio()
      return {
        cuentas, movimientos, categorias, presupuestos,
        objetivos, aportaciones, recurrentes, valoraciones,
        configuracion: configuraciones[0] ?? base.configuracion,
      }
    },

    async guardar(tabla, registros) {
      if (registros.length === 0) return
      await db.table(tabla).bulkPut(registros)
    },

    async borrar(tabla, ids) {
      if (ids.length === 0) return
      await db.table(tabla).bulkDelete(ids)
    },

    async guardarConfiguracion(configuracion) {
      await db.configuracion.put(configuracion)
    },

    async reemplazarTodo(estado) {
      await db.transaction('rw', db.tables, async () => {
        await Promise.all(db.tables.map((t) => t.clear()))
        for (const tabla of TABLAS) {
          const registros = estado[tabla]
          if (registros.length > 0) await db.table(tabla).bulkPut(registros)
        }
        await db.configuracion.put(estado.configuracion)
      })
    },

    async vaciar() {
      await db.transaction('rw', db.tables, async () => {
        await Promise.all(db.tables.map((t) => t.clear()))
      })
    },
  }
}

/**
 * Carga el estado y, la primera vez, siembra las categorías por defecto.
 *
 * Hay dos guardas, no una. El flag `semillaAplicada` evita que las categorías
 * reaparezcan si más adelante las archivas todas. La comprobación de que la
 * tabla está vacía cubre el caso que el flag no ve: importar una copia cuyo
 * flag venga a false pero que ya traiga categorías dentro, que sin esto
 * acabaría con las por defecto duplicadas encima de las tuyas.
 */
export async function cargarConSemilla(adaptador: StorageAdapter): Promise<EstadoFinanzas> {
  const estado = await adaptador.cargar()

  if (estado.configuracion.semillaAplicada) return estado

  if (estado.categorias.length > 0) {
    // Ya hay categorías: no sembrar, solo dejar constancia de que no hace falta.
    const configuracion: Configuracion = { ...estado.configuracion, semillaAplicada: true }
    await adaptador.guardarConfiguracion(configuracion)
    return { ...estado, configuracion }
  }

  const categorias = categoriasIniciales()
  const configuracion: Configuracion = { ...estado.configuracion, semillaAplicada: true }

  await adaptador.guardar('categorias', categorias)
  await adaptador.guardarConfiguracion(configuracion)

  return { ...estado, categorias, configuracion }
}

/**
 * Ejecuta en la base lo que han decidido las reglas de integridad: primero
 * reescribe lo que cambia, luego borra.
 */
export async function aplicarCascada(adaptador: StorageAdapter, cascada: Cascada): Promise<void> {
  if (cascada.reescribir) {
    for (const tabla of TABLAS) {
      const registros = cascada.reescribir[tabla]
      if (registros && registros.length > 0) {
        await adaptador.guardar(tabla, registros as never)
      }
    }
  }

  for (const tabla of TABLAS) {
    const ids = cascada[tabla]
    if (ids && ids.length > 0) await adaptador.borrar(tabla, ids)
  }
}

/** Aplica una cascada sobre un estado en memoria, para no recargar de la base. */
export function aplicarCascadaEnMemoria(estado: EstadoFinanzas, cascada: Cascada): EstadoFinanzas {
  const nuevo: EstadoFinanzas = { ...estado }

  for (const tabla of TABLAS) {
    const reescritos = cascada.reescribir?.[tabla] as Array<{ id: string }> | undefined
    if (reescritos && reescritos.length > 0) {
      const porId = new Map(reescritos.map((r) => [r.id, r]))
      nuevo[tabla] = (nuevo[tabla] as Array<{ id: string }>).map(
        (r) => porId.get(r.id) ?? r,
      ) as never
    }

    const borrados = cascada[tabla]
    if (borrados && borrados.length > 0) {
      const fuera = new Set(borrados)
      nuevo[tabla] = (nuevo[tabla] as Array<{ id: string }>).filter(
        (r) => !fuera.has(r.id),
      ) as never
    }
  }

  return nuevo
}
