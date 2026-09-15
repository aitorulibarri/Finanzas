import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { hoy } from '../dominio/fechas'
import {
  borrarCategoria as reglaBorrarCategoria,
  borrarCuenta as reglaBorrarCuenta,
  borrarMovimiento as reglaBorrarMovimiento,
  borrarObjetivo as reglaBorrarObjetivo,
  borrarRecurrente as reglaBorrarRecurrente,
  estaBloqueado,
  type ResultadoBorrado,
} from '../dominio/integridad'
import { generarPendientes } from '../dominio/recurrentes'
import { estadoVacio, type Configuracion, type EstadoFinanzas } from '../dominio/tipos'
import { descargarCopia, leerCopia, type ResultadoLectura } from '../datos/backup'
import { BaseFinanzas } from '../datos/db'
import {
  adaptadorDexie,
  aplicarCascada,
  aplicarCascadaEnMemoria,
  cargarConSemilla,
  type StorageAdapter,
  type TablaEntidad,
} from '../datos/repositorio'

/**
 * Estado global de la aplicación.
 *
 * Mantiene el estado completo en memoria y escribe en IndexedDB en cada
 * cambio. Con el volumen de datos de unas finanzas personales (unos miles de
 * movimientos como mucho) esto va sobrado y evita toda la complejidad de
 * sincronizar cachés parciales.
 *
 * Los cálculos NO viven aquí: salen de dominio/calculos.ts, que es puro y
 * está testeado. Este módulo solo orquesta carga, escritura y recarga.
 */

interface Finanzas {
  estado: EstadoFinanzas
  cargando: boolean
  error: string | null

  guardar<K extends TablaEntidad>(tabla: K, registros: EstadoFinanzas[K]): Promise<void>
  eliminar(tabla: TablaEntidad, ids: string[]): Promise<void>

  eliminarMovimiento(id: string): Promise<void>
  eliminarObjetivo(id: string): Promise<void>
  eliminarRecurrente(id: string): Promise<void>
  /** Devuelve el motivo si el borrado está bloqueado, o null si se hizo. */
  eliminarCuenta(id: string): Promise<string | null>
  eliminarCategoria(id: string, destinoId: string): Promise<string | null>

  guardarConfiguracion(cambios: Partial<Configuracion>): Promise<void>
  exportar(): Promise<void>
  importar(texto: string): Promise<ResultadoLectura>
  vaciarTodo(): Promise<void>
}

const Contexto = createContext<Finanzas | null>(null)

export function ProveedorFinanzas({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoFinanzas>(estadoVacio)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Inicialización perezosa de useState: crea el adaptador una sola vez, sin
  // leer un ref durante el render ni abrir una conexión nueva en cada uno.
  const [adaptador] = useState<StorageAdapter>(() => adaptadorDexie(new BaseFinanzas()))

  // Arranque: cargar, sembrar si es la primera vez y materializar los
  // recurrentes que hayan vencido desde la última visita.
  useEffect(() => {
    let vivo = true

    ;(async () => {
      try {
        const cargado = await cargarConSemilla(adaptador)
        const { movimientos, avances } = generarPendientes(cargado, hoy())

        if (movimientos.length === 0) {
          if (vivo) setEstado(cargado)
          return
        }

        const recurrentes = cargado.recurrentes.map((r) => {
          const avance = avances.find((a) => a.id === r.id)
          return avance ? { ...r, ultimaGeneracion: avance.ultimaGeneracion } : r
        })

        await adaptador.guardar('movimientos', movimientos)
        await adaptador.guardar('recurrentes', recurrentes)

        if (vivo) {
          setEstado({
            ...cargado,
            movimientos: [...cargado.movimientos, ...movimientos],
            recurrentes,
          })
        }
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos')
      } finally {
        if (vivo) setCargando(false)
      }
    })()

    return () => {
      vivo = false
    }
  }, [adaptador])

  const guardar = useCallback<Finanzas['guardar']>(
    async (tabla, registros) => {
      await adaptador.guardar(tabla, registros)
      setEstado((actual) => {
        const porId = new Map((registros as Array<{ id: string }>).map((r) => [r.id, r]))
        const existentes = actual[tabla] as Array<{ id: string }>
        const actualizados = existentes.map((r) => porId.get(r.id) ?? r)
        const nuevos = (registros as Array<{ id: string }>).filter(
          (r) => !existentes.some((e) => e.id === r.id),
        )
        return { ...actual, [tabla]: [...actualizados, ...nuevos] }
      })
    },
    [adaptador],
  )

  const eliminar = useCallback<Finanzas['eliminar']>(
    async (tabla, ids) => {
      await adaptador.borrar(tabla, ids)
      const fuera = new Set(ids)
      setEstado((actual) => ({
        ...actual,
        [tabla]: (actual[tabla] as Array<{ id: string }>).filter((r) => !fuera.has(r.id)),
      }))
    },
    [adaptador],
  )

  /** Ejecuta una regla de integridad contra la base y contra el estado en memoria. */
  const aplicarRegla = useCallback(
    async (resultado: ResultadoBorrado): Promise<string | null> => {
      if (estaBloqueado(resultado)) return resultado.motivo
      await aplicarCascada(adaptador, resultado)
      setEstado((actual) => aplicarCascadaEnMemoria(actual, resultado))
      return null
    },
    [adaptador],
  )

  const eliminarMovimiento = useCallback(
    async (id: string) => {
      await aplicarRegla(reglaBorrarMovimiento(estado, id))
    },
    [aplicarRegla, estado],
  )

  const eliminarObjetivo = useCallback(
    async (id: string) => {
      await aplicarRegla(reglaBorrarObjetivo(estado, id))
    },
    [aplicarRegla, estado],
  )

  const eliminarRecurrente = useCallback(
    async (id: string) => {
      await aplicarRegla(reglaBorrarRecurrente(estado, id))
    },
    [aplicarRegla, estado],
  )

  const eliminarCuenta = useCallback(
    (id: string) => aplicarRegla(reglaBorrarCuenta(estado, id)),
    [aplicarRegla, estado],
  )

  const eliminarCategoria = useCallback(
    (id: string, destinoId: string) => aplicarRegla(reglaBorrarCategoria(estado, id, destinoId)),
    [aplicarRegla, estado],
  )

  const guardarConfiguracion = useCallback(
    async (cambios: Partial<Configuracion>) => {
      const configuracion = { ...estado.configuracion, ...cambios }
      await adaptador.guardarConfiguracion(configuracion)
      setEstado((actual) => ({ ...actual, configuracion }))
    },
    [adaptador, estado.configuracion],
  )

  const exportar = useCallback(async () => {
    descargarCopia(estado)
    await guardarConfiguracion({ ultimaCopia: hoy() })
  }, [estado, guardarConfiguracion])

  const importar = useCallback(
    async (texto: string): Promise<ResultadoLectura> => {
      const leido = leerCopia(texto)
      if (!leido.ok) return leido
      await adaptador.reemplazarTodo(leido.copia.estado)
      setEstado(leido.copia.estado)
      return leido
    },
    [adaptador],
  )

  const vaciarTodo = useCallback(async () => {
    await adaptador.vaciar()
    const limpio = await cargarConSemilla(adaptador)
    setEstado(limpio)
  }, [adaptador])

  const valor = useMemo<Finanzas>(
    () => ({
      estado,
      cargando,
      error,
      guardar,
      eliminar,
      eliminarMovimiento,
      eliminarObjetivo,
      eliminarRecurrente,
      eliminarCuenta,
      eliminarCategoria,
      guardarConfiguracion,
      exportar,
      importar,
      vaciarTodo,
    }),
    [
      estado, cargando, error, guardar, eliminar, eliminarMovimiento, eliminarObjetivo,
      eliminarRecurrente, eliminarCuenta, eliminarCategoria, guardarConfiguracion,
      exportar, importar, vaciarTodo,
    ],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useFinanzas(): Finanzas {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useFinanzas debe usarse dentro de ProveedorFinanzas')
  return ctx
}
