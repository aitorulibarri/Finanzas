import Dexie, { type EntityTable } from 'dexie'
import type {
  Aportacion,
  Categoria,
  Configuracion,
  Cuenta,
  Movimiento,
  Objetivo,
  Presupuesto,
  Recurrente,
  Valoracion,
} from '../dominio/tipos'

/**
 * Esquema de IndexedDB.
 *
 * Los datos viven solo en este navegador. No salen a ningún servidor, lo que
 * es bueno para la privacidad y peligroso para la durabilidad: si se borran
 * los datos de navegación, se van. De ahí que la copia de seguridad a fichero
 * no sea una función accesoria sino parte del producto.
 *
 * Los índices declarados son los que usan las consultas reales: por fecha
 * para las vistas de mes, y por cuenta y categoría para los desgloses.
 */
export class BaseFinanzas extends Dexie {
  cuentas!: EntityTable<Cuenta, 'id'>
  movimientos!: EntityTable<Movimiento, 'id'>
  categorias!: EntityTable<Categoria, 'id'>
  presupuestos!: EntityTable<Presupuesto, 'id'>
  objetivos!: EntityTable<Objetivo, 'id'>
  aportaciones!: EntityTable<Aportacion, 'id'>
  recurrentes!: EntityTable<Recurrente, 'id'>
  valoraciones!: EntityTable<Valoracion, 'id'>
  configuracion!: EntityTable<Configuracion, 'id'>

  constructor(nombre = 'finanzas') {
    super(nombre)

    // Versión 1. Al cambiar el esquema hay que añadir un .version(2) nuevo
    // con su upgrade, nunca editar este, o las bases ya creadas en el
    // navegador del usuario dejarán de abrir.
    this.version(1).stores({
      cuentas: 'id, orden, archivada',
      movimientos: 'id, fecha, cuentaId, cuentaDestinoId, categoriaId, recurrenteId',
      categorias: 'id, tipo, padreId, orden',
      presupuestos: 'id, categoriaId, mes',
      objetivos: 'id, orden, archivado',
      aportaciones: 'id, objetivoId, movimientoId',
      recurrentes: 'id, activo',
      valoraciones: 'id, cuentaId, fecha',
      configuracion: 'id',
    })
  }
}
