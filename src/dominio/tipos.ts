import type { Cents } from './dinero'
import type { FechaISO, MesISO } from './fechas'

/**
 * Modelo de dominio. Sin `enum` a propósito: el tsconfig del proyecto activa
 * `erasableSyntaxOnly`, así que los conjuntos cerrados se expresan como
 * objetos `as const` más un tipo unión derivado. De paso son serializables a
 * JSON sin conversión, que es lo que necesita la copia de seguridad.
 */

export const TIPOS_CUENTA = {
  corriente: 'Cuenta corriente',
  ahorro: 'Ahorro',
  efectivo: 'Efectivo',
  inversion: 'Inversión',
  tarjeta: 'Tarjeta de crédito',
} as const
export type TipoCuenta = keyof typeof TIPOS_CUENTA

export const TIPOS_MOVIMIENTO = {
  ingreso: 'Ingreso',
  gasto: 'Gasto',
  traspaso: 'Traspaso',
} as const
export type TipoMovimiento = keyof typeof TIPOS_MOVIMIENTO

export const FRECUENCIAS = {
  semanal: 'Semanal',
  mensual: 'Mensual',
  trimestral: 'Trimestral',
  anual: 'Anual',
} as const
export type Frecuencia = keyof typeof FRECUENCIAS

/**
 * Una cuenta donde vive el dinero.
 *
 * El saldo NO se guarda: se deriva de `saldoInicial` más los movimientos.
 * Guardar un saldo mutable es lo que produce descuadres cuando se edita o
 * borra un movimiento antiguo.
 *
 * `saldoInicial` es lo que había el día que empezaste a registrar, para no
 * tener que meter el historial entero.
 */
export interface Cuenta {
  id: string
  nombre: string
  tipo: TipoCuenta
  saldoInicial: Cents
  /** Las de tipo tarjeta restan del patrimonio en vez de sumar. */
  color: string
  archivada: boolean
  orden: number
}

/**
 * Valor de mercado de una cuenta de inversión en una fecha.
 *
 * Una cuenta de inversión no se comporta como una corriente: su valor cambia
 * solo, sin que haya movimiento. Aquí anotas lo que vale cuando lo miras. La
 * diferencia contra las aportaciones netas es el rendimiento, que sale gratis
 * sin necesidad de seguir activo por activo.
 */
export interface Valoracion {
  id: string
  cuentaId: string
  fecha: FechaISO
  valor: Cents
}

/**
 * Un movimiento de dinero.
 *
 * `importe` es SIEMPRE positivo; el signo lo pone `tipo`. Mezclar ambas
 * convenciones es la vía rápida a sumar dos veces con el signo cambiado.
 *
 * Un `traspaso` mueve dinero entre dos cuentas tuyas: lleva `cuentaDestinoId`
 * y NO lleva `categoriaId`. No es ni ingreso ni gasto y no puede consumir
 * presupuesto, porque tu patrimonio no cambia al mover dinero de un bolsillo
 * a otro.
 */
export interface Movimiento {
  id: string
  fecha: FechaISO
  tipo: TipoMovimiento
  importe: Cents
  /** Origen en gasto y traspaso; destino en ingreso. */
  cuentaId: string
  /** Solo en traspaso: cuenta que recibe. */
  cuentaDestinoId?: string
  /** Obligatoria en ingreso y gasto; prohibida en traspaso. */
  categoriaId?: string
  descripcion: string
  notas?: string
  /** Si lo generó un recurrente, para no duplicarlo en el siguiente arranque. */
  recurrenteId?: string
  creadoEn: string
}

export interface Categoria {
  id: string
  nombre: string
  tipo: 'ingreso' | 'gasto'
  icono: string
  color: string
  /** Jerarquía de un solo nivel: una subcategoría no puede tener hijas. */
  padreId?: string
  archivada: boolean
  orden: number
}

/**
 * Límite de gasto mensual de una categoría.
 * `mes` a null significa que se repite todos los meses.
 */
export interface Presupuesto {
  id: string
  categoriaId: string
  importeMensual: Cents
  mes: MesISO | null
}

/**
 * Aportación a un objetivo.
 *
 * Es una ETIQUETA sobre un traspaso que ya existe (`movimientoId`), no dinero
 * nuevo. Así no se cuenta dos veces y puedes tener "viaje" y "fondo de
 * emergencia" repartiéndose la misma cuenta de ahorro.
 */
export interface Aportacion {
  id: string
  objetivoId: string
  movimientoId?: string
  fecha: FechaISO
  importe: Cents
}

export interface Objetivo {
  id: string
  nombre: string
  objetivo: Cents
  fechaLimite?: FechaISO
  /** Solo informativo: dónde se guarda este dinero. */
  cuentaId?: string
  icono: string
  color: string
  archivado: boolean
  orden: number
}

/**
 * Plantilla que se materializa sola: nómina, alquiler, suscripciones.
 *
 * `ultimaGeneracion` es lo que hace idempotente la generación: al arrancar se
 * crean solo las ocurrencias que van desde ahí hasta hoy, nunca al futuro.
 */
export interface Recurrente {
  id: string
  nombre: string
  tipo: TipoMovimiento
  importe: Cents
  cuentaId: string
  cuentaDestinoId?: string
  categoriaId?: string
  frecuencia: Frecuencia
  /** 1-31 en mensual/trimestral/anual; se recorta al último día del mes. */
  diaDelMes?: number
  /** 0-6, domingo a sábado, en frecuencia semanal. */
  diaDeLaSemana?: number
  /** 1-12, solo en frecuencia anual. */
  mesDelAnio?: number
  fechaInicio: FechaISO
  fechaFin?: FechaISO
  ultimaGeneracion?: FechaISO
  activo: boolean
}

/**
 * Preferencias y estado de la aplicación.
 *
 * `ultimaCopia` no es un adorno: como los datos viven solo en el navegador,
 * de aquí sale el aviso de que llevas demasiado tiempo sin exportar.
 */
export interface Configuracion {
  id: 'unica'
  moneda: string
  locale: string
  ultimaCopia?: FechaISO
  /** Cuenta preseleccionada al dar de alta un movimiento. */
  cuentaPorDefectoId?: string
  semillaAplicada: boolean
}

/** Estado completo, tal y como viaja en la copia de seguridad. */
export interface EstadoFinanzas {
  cuentas: Cuenta[]
  movimientos: Movimiento[]
  categorias: Categoria[]
  presupuestos: Presupuesto[]
  objetivos: Objetivo[]
  aportaciones: Aportacion[]
  recurrentes: Recurrente[]
  valoraciones: Valoracion[]
  configuracion: Configuracion
}

export function nuevoId(): string {
  return crypto.randomUUID()
}

export function estadoVacio(): EstadoFinanzas {
  return {
    cuentas: [],
    movimientos: [],
    categorias: [],
    presupuestos: [],
    objetivos: [],
    aportaciones: [],
    recurrentes: [],
    valoraciones: [],
    configuracion: {
      id: 'unica',
      moneda: 'EUR',
      locale: 'es-ES',
      semillaAplicada: false,
    },
  }
}
