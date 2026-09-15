import type {
  Aportacion,
  Categoria,
  Cuenta,
  EstadoFinanzas,
  Movimiento,
  Objetivo,
  Presupuesto,
  Valoracion,
} from './tipos'
import { estadoVacio } from './tipos'

/** Constructores para los tests. Valores por defecto sensatos, todo sobreescribible. */

let contador = 0
const id = (p: string) => `${p}-${++contador}`

export function unaCuenta(p: Partial<Cuenta> = {}): Cuenta {
  return {
    id: id('cuenta'),
    nombre: 'Cuenta nómina',
    tipo: 'corriente',
    saldoInicial: 0,
    color: '#0ea5e9',
    archivada: false,
    orden: 0,
    ...p,
  }
}

export function unaCategoria(p: Partial<Categoria> = {}): Categoria {
  return {
    id: id('cat'),
    nombre: 'Ocio',
    tipo: 'gasto',
    icono: '🎉',
    color: '#f59e0b',
    archivada: false,
    orden: 0,
    ...p,
  }
}

export function unMovimiento(p: Partial<Movimiento> = {}): Movimiento {
  return {
    id: id('mov'),
    fecha: '2026-01-15',
    tipo: 'gasto',
    importe: 4500,
    cuentaId: 'cuenta-1',
    categoriaId: 'cat-1',
    descripcion: 'Movimiento',
    creadoEn: '2026-01-15T12:00:00.000Z',
    ...p,
  }
}

export function unPresupuesto(p: Partial<Presupuesto> = {}): Presupuesto {
  return { id: id('pre'), categoriaId: 'cat-1', importeMensual: 20000, mes: null, ...p }
}

export function unObjetivo(p: Partial<Objetivo> = {}): Objetivo {
  return {
    id: id('obj'),
    nombre: 'Viaje',
    objetivo: 300000,
    icono: '✈️',
    color: '#8b5cf6',
    archivado: false,
    orden: 0,
    ...p,
  }
}

export function unaAportacion(p: Partial<Aportacion> = {}): Aportacion {
  return { id: id('apo'), objetivoId: 'obj-1', fecha: '2026-01-20', importe: 30000, ...p }
}

export function unaValoracion(p: Partial<Valoracion> = {}): Valoracion {
  return { id: id('val'), cuentaId: 'cuenta-1', fecha: '2026-01-31', valor: 500000, ...p }
}

export function unEstado(p: Partial<EstadoFinanzas> = {}): EstadoFinanzas {
  return { ...estadoVacio(), ...p }
}
