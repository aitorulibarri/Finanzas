import 'fake-indexeddb/auto'
import { describe, expect, test } from 'vitest'
import { construirCopia, leerCopia, necesitaCopia, nombreFicheroCopia, resumirCopia } from './backup'
import { BaseFinanzas } from './db'
import { adaptadorDexie, type StorageAdapter } from './repositorio'
import { patrimonioNeto, progresoObjetivo, saldoCuenta, tasaAhorro } from '../dominio/calculos'
import { estadoVacio, type EstadoFinanzas } from '../dominio/tipos'

/**
 * Un estado con TODOS los tipos de entidad y todas las aristas: cuenta de
 * inversión con valoraciones, los tres tipos de movimiento, jerarquía de
 * categorías, presupuesto puntual y recurrente, objetivo con aportaciones
 * ligadas a un traspaso, y un recurrente con generación ya avanzada.
 */
function estadoCompleto(): EstadoFinanzas {
  return {
    ...estadoVacio(),
    cuentas: [
      { id: 'c1', nombre: 'Cuenta nómina', tipo: 'corriente', saldoInicial: 120000, color: '#0ea5e9', archivada: false, orden: 0 },
      { id: 'c2', nombre: 'Ahorro', tipo: 'ahorro', saldoInicial: 300000, color: '#10b981', archivada: false, orden: 1 },
      { id: 'c3', nombre: 'Indexa', tipo: 'inversion', saldoInicial: 0, color: '#8b5cf6', archivada: false, orden: 2 },
      { id: 'c4', nombre: 'Visa', tipo: 'tarjeta', saldoInicial: 0, color: '#ef4444', archivada: false, orden: 3 },
      { id: 'c5', nombre: 'Cuenta vieja', tipo: 'corriente', saldoInicial: 5000, color: '#94a3b8', archivada: true, orden: 4 },
    ],
    categorias: [
      { id: 'k-salario', nombre: 'Salario', tipo: 'ingreso', icono: '💼', color: '#10b981', archivada: false, orden: 0 },
      { id: 'k-ocio', nombre: 'Ocio', tipo: 'gasto', icono: '🎉', color: '#a855f7', archivada: false, orden: 1 },
      { id: 'k-viajes', nombre: 'Viajes', tipo: 'gasto', icono: '✈️', color: '#c084fc', padreId: 'k-ocio', archivada: false, orden: 2 },
    ],
    movimientos: [
      { id: 'm1', fecha: '2026-01-25', tipo: 'ingreso', importe: 190000, cuentaId: 'c1', categoriaId: 'k-salario', descripcion: 'Nómina', recurrenteId: 'r1', creadoEn: '2026-01-25T08:00:00.000Z' },
      { id: 'm2', fecha: '2026-01-10', tipo: 'gasto', importe: 4500, cuentaId: 'c1', categoriaId: 'k-ocio', descripcion: 'Cena', notas: 'Con Marta', creadoEn: '2026-01-10T22:00:00.000Z' },
      { id: 'm3', fecha: '2026-01-26', tipo: 'traspaso', importe: 30000, cuentaId: 'c1', cuentaDestinoId: 'c2', descripcion: 'A la hucha', creadoEn: '2026-01-26T10:00:00.000Z' },
      { id: 'm4', fecha: '2026-01-27', tipo: 'traspaso', importe: 100000, cuentaId: 'c1', cuentaDestinoId: 'c3', descripcion: 'Aportación Indexa', creadoEn: '2026-01-27T10:00:00.000Z' },
      { id: 'm5', fecha: '2026-01-15', tipo: 'gasto', importe: 25000, cuentaId: 'c4', categoriaId: 'k-viajes', descripcion: 'Vuelo', creadoEn: '2026-01-15T12:00:00.000Z' },
    ],
    presupuestos: [
      { id: 'p1', categoriaId: 'k-ocio', importeMensual: 20000, mes: null },
      { id: 'p2', categoriaId: 'k-ocio', importeMensual: 50000, mes: '2026-01' },
    ],
    objetivos: [
      { id: 'o1', nombre: 'Viaje a Japón', objetivo: 300000, fechaLimite: '2026-07-15', cuentaId: 'c2', icono: '✈️', color: '#8b5cf6', archivado: false, orden: 0 },
      { id: 'o2', nombre: 'Colchón', objetivo: 600000, icono: '🛡️', color: '#0ea5e9', archivado: false, orden: 1 },
    ],
    aportaciones: [
      { id: 'a1', objetivoId: 'o1', movimientoId: 'm3', fecha: '2026-01-26', importe: 30000 },
      { id: 'a2', objetivoId: 'o2', fecha: '2026-01-05', importe: 50000 },
    ],
    recurrentes: [
      { id: 'r1', nombre: 'Nómina', tipo: 'ingreso', importe: 190000, cuentaId: 'c1', categoriaId: 'k-salario', frecuencia: 'mensual', diaDelMes: 25, fechaInicio: '2026-01-01', ultimaGeneracion: '2026-01-25', activo: true },
      { id: 'r2', nombre: 'Netflix', tipo: 'gasto', importe: 1399, cuentaId: 'c1', categoriaId: 'k-ocio', frecuencia: 'mensual', diaDelMes: 31, fechaInicio: '2026-01-01', fechaFin: '2026-12-31', activo: false },
    ],
    valoraciones: [
      { id: 'v1', cuentaId: 'c3', fecha: '2026-01-31', valor: 112000 },
      { id: 'v2', cuentaId: 'c3', fecha: '2026-02-28', valor: 105000 },
    ],
    configuracion: { id: 'unica', moneda: 'EUR', locale: 'es-ES', ultimaCopia: '2026-01-31', cuentaPorDefectoId: 'c1', semillaAplicada: true },
  }
}

describe('INV-10: exportar e importar reproduce el mismo estado', () => {
  test('el viaje por JSON no pierde ni cambia nada', () => {
    const original = estadoCompleto()

    // El viaje real: serializar a texto, como el fichero que se descarga,
    // y volver a leerlo. Así se detecta cualquier cosa no serializable.
    const texto = JSON.stringify(construirCopia(original))
    const leido = leerCopia(texto)

    expect(leido.ok).toBe(true)
    if (!leido.ok) return
    expect(leido.copia.estado).toEqual(original)
  })

  test('los números calculados son idénticos antes y después', () => {
    const original = estadoCompleto()
    const leido = leerCopia(JSON.stringify(construirCopia(original)))
    if (!leido.ok) throw new Error(leido.error)
    const recuperado = leido.copia.estado

    expect(patrimonioNeto(recuperado)).toBe(patrimonioNeto(original))
    expect(tasaAhorro(recuperado, '2026-01')).toBe(tasaAhorro(original, '2026-01'))
    for (const c of original.cuentas) {
      expect(saldoCuenta(recuperado, c.id)).toBe(saldoCuenta(original, c.id))
    }
    for (const o of original.objetivos) {
      expect(progresoObjetivo(recuperado, o, '2026-02-01').aportado)
        .toBe(progresoObjetivo(original, o, '2026-02-01').aportado)
    }
  })

  test('el round-trip completo pasando por IndexedDB', async () => {
    const db = new BaseFinanzas('prueba-roundtrip')
    const adaptador: StorageAdapter = adaptadorDexie(db)
    const original = estadoCompleto()

    try {
      await adaptador.reemplazarTodo(original)
      const guardado = await adaptador.cargar()

      // Exportar lo que hay en la base.
      const texto = JSON.stringify(construirCopia(guardado))

      // Borrarlo todo, como haría el usuario al cambiar de ordenador.
      await adaptador.vaciar()
      expect((await adaptador.cargar()).movimientos).toHaveLength(0)

      // Reimportar.
      const leido = leerCopia(texto)
      if (!leido.ok) throw new Error(leido.error)
      await adaptador.reemplazarTodo(leido.copia.estado)

      const final = await adaptador.cargar()
      const ordenar = <T extends { id: string }>(xs: T[]) => [...xs].sort((a, b) => a.id.localeCompare(b.id))

      expect(ordenar(final.cuentas)).toEqual(ordenar(original.cuentas))
      expect(ordenar(final.movimientos)).toEqual(ordenar(original.movimientos))
      expect(ordenar(final.categorias)).toEqual(ordenar(original.categorias))
      expect(ordenar(final.presupuestos)).toEqual(ordenar(original.presupuestos))
      expect(ordenar(final.objetivos)).toEqual(ordenar(original.objetivos))
      expect(ordenar(final.aportaciones)).toEqual(ordenar(original.aportaciones))
      expect(ordenar(final.recurrentes)).toEqual(ordenar(original.recurrentes))
      expect(ordenar(final.valoraciones)).toEqual(ordenar(original.valoraciones))
      expect(final.configuracion).toEqual(original.configuracion)
      expect(patrimonioNeto(final)).toBe(patrimonioNeto(original))
    } finally {
      await db.delete()
    }
  })
})

describe('un fichero corrupto se rechaza sin dejar nada a medias', () => {
  test('JSON inválido', () => {
    const r = leerCopia('{esto no es json')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('JSON')
  })

  test('JSON truncado a la mitad', () => {
    const texto = JSON.stringify(construirCopia(estadoCompleto()))
    expect(leerCopia(texto.slice(0, texto.length / 2)).ok).toBe(false)
  })

  test('JSON válido pero que no es una copia', () => {
    expect(leerCopia('{"hola":"mundo"}').ok).toBe(false)
  })

  test('una copia de una versión futura se rechaza explícitamente', () => {
    const copia = { ...construirCopia(estadoCompleto()), version: 99 }
    const r = leerCopia(JSON.stringify(copia))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('Actualiza la aplicación')
  })

  test('una copia con un importe negativo se rechaza', () => {
    const estado = estadoCompleto()
    estado.movimientos[0].importe = -190000
    const r = leerCopia(JSON.stringify(construirCopia(estado)))
    expect(r.ok).toBe(false)
  })

  test('una copia con un traspaso categorizado se rechaza', () => {
    const estado = estadoCompleto()
    estado.movimientos[2].categoriaId = 'k-ocio'
    const r = leerCopia(JSON.stringify(construirCopia(estado)))
    expect(r.ok).toBe(false)
  })

  test('una copia con una fecha imposible se rechaza', () => {
    const estado = estadoCompleto()
    estado.movimientos[0].fecha = '2026-02-30'
    expect(leerCopia(JSON.stringify(construirCopia(estado))).ok).toBe(false)
  })
})

describe('resumen previo y aviso de copia', () => {
  test('el resumen dice qué hay dentro antes de sustituir nada', () => {
    const r = resumirCopia(construirCopia(estadoCompleto()))
    expect(r.cuentas).toBe(5)
    expect(r.movimientos).toBe(5)
    expect(r.objetivos).toBe(2)
    expect(r.desde).toBe('2026-01-10')
    expect(r.hasta).toBe('2026-01-27')
  })

  test('el nombre del fichero lleva la fecha', () => {
    expect(nombreFicheroCopia('2026-03-15')).toBe('finanzas-backup-2026-03-15.json')
  })

  test('sin movimientos no molesta con el aviso', () => {
    const c = estadoVacio().configuracion
    expect(necesitaCopia(c, 0, '2026-06-01')).toBe(false)
  })

  test('con movimientos y sin ninguna copia, avisa', () => {
    const c = estadoVacio().configuracion
    expect(necesitaCopia(c, 10, '2026-06-01')).toBe(true)
  })

  test('avisa cuando han pasado más de 30 días', () => {
    const c = { ...estadoVacio().configuracion, ultimaCopia: '2026-01-01' }
    expect(necesitaCopia(c, 10, '2026-01-20')).toBe(false)
    expect(necesitaCopia(c, 10, '2026-03-01')).toBe(true)
  })
})
