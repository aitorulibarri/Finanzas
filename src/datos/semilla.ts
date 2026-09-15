import type { Categoria } from '../dominio/tipos'

/**
 * Categorías con las que arranca la aplicación.
 *
 * El objetivo es que puedas empezar a apuntar gastos en el primer minuto sin
 * tener que diseñarte un plan contable. Son editables y archivables desde
 * Ajustes: esto es un punto de partida, no una imposición.
 */

interface Semilla {
  id: string
  nombre: string
  tipo: 'ingreso' | 'gasto'
  icono: string
  color: string
  padreId?: string
}

const SEMILLAS: Semilla[] = [
  // Ingresos
  { id: 'cat-salario', nombre: 'Salario', tipo: 'ingreso', icono: '💼', color: '#10b981' },
  { id: 'cat-extras', nombre: 'Extras y bonus', tipo: 'ingreso', icono: '🎁', color: '#14b8a6' },
  { id: 'cat-reembolsos', nombre: 'Reembolsos', tipo: 'ingreso', icono: '↩️', color: '#06b6d4' },
  { id: 'cat-otros-ingresos', nombre: 'Otros ingresos', tipo: 'ingreso', icono: '💰', color: '#22c55e' },

  // Gastos: vivienda
  { id: 'cat-vivienda', nombre: 'Vivienda', tipo: 'gasto', icono: '🏠', color: '#f43f5e' },
  { id: 'cat-alquiler', nombre: 'Alquiler o hipoteca', tipo: 'gasto', icono: '🔑', color: '#f43f5e', padreId: 'cat-vivienda' },
  { id: 'cat-suministros', nombre: 'Luz, agua y gas', tipo: 'gasto', icono: '💡', color: '#fb7185', padreId: 'cat-vivienda' },
  { id: 'cat-internet', nombre: 'Internet y móvil', tipo: 'gasto', icono: '📶', color: '#fda4af', padreId: 'cat-vivienda' },

  // Gastos: alimentación
  { id: 'cat-alimentacion', nombre: 'Alimentación', tipo: 'gasto', icono: '🛒', color: '#f97316' },
  { id: 'cat-super', nombre: 'Supermercado', tipo: 'gasto', icono: '🥦', color: '#f97316', padreId: 'cat-alimentacion' },
  { id: 'cat-restaurantes', nombre: 'Restaurantes', tipo: 'gasto', icono: '🍽️', color: '#fb923c', padreId: 'cat-alimentacion' },

  // Gastos: transporte
  { id: 'cat-transporte', nombre: 'Transporte', tipo: 'gasto', icono: '🚗', color: '#0ea5e9' },
  { id: 'cat-gasolina', nombre: 'Gasolina', tipo: 'gasto', icono: '⛽', color: '#0ea5e9', padreId: 'cat-transporte' },
  { id: 'cat-transporte-publico', nombre: 'Transporte público', tipo: 'gasto', icono: '🚇', color: '#38bdf8', padreId: 'cat-transporte' },

  // Gastos: ocio
  { id: 'cat-ocio', nombre: 'Ocio', tipo: 'gasto', icono: '🎉', color: '#a855f7' },
  { id: 'cat-salir', nombre: 'Salir', tipo: 'gasto', icono: '🍻', color: '#a855f7', padreId: 'cat-ocio' },
  { id: 'cat-viajes', nombre: 'Viajes', tipo: 'gasto', icono: '✈️', color: '#c084fc', padreId: 'cat-ocio' },
  { id: 'cat-hobbies', nombre: 'Aficiones', tipo: 'gasto', icono: '🎸', color: '#d8b4fe', padreId: 'cat-ocio' },

  // Gastos: resto
  { id: 'cat-suscripciones', nombre: 'Suscripciones', tipo: 'gasto', icono: '📺', color: '#8b5cf6' },
  { id: 'cat-salud', nombre: 'Salud', tipo: 'gasto', icono: '⚕️', color: '#ef4444' },
  { id: 'cat-ropa', nombre: 'Ropa', tipo: 'gasto', icono: '👕', color: '#ec4899' },
  { id: 'cat-educacion', nombre: 'Educación', tipo: 'gasto', icono: '📚', color: '#6366f1' },
  { id: 'cat-regalos', nombre: 'Regalos', tipo: 'gasto', icono: '🎀', color: '#f472b6' },
  { id: 'cat-impuestos', nombre: 'Impuestos', tipo: 'gasto', icono: '🧾', color: '#64748b' },
  { id: 'cat-otros-gastos', nombre: 'Otros gastos', tipo: 'gasto', icono: '📦', color: '#94a3b8' },
]

/**
 * Categoría a la que van a parar los movimientos cuando borras la suya.
 * Se garantiza que siempre existe para que el borrado nunca deje huérfanos.
 */
export const CATEGORIA_POR_DEFECTO = 'cat-otros-gastos'

export function categoriasIniciales(): Categoria[] {
  return SEMILLAS.map((s, i) => ({ ...s, archivada: false, orden: i }))
}
