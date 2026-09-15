import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { BaseFinanzas } from './db'
import {
  adaptadorDexie,
  aplicarCascada,
  cargarConSemilla,
  type StorageAdapter,
} from './repositorio'
import { borrarMovimiento, borrarObjetivo, borrarRecurrente } from '../dominio/integridad'
import { saldoCuenta, patrimonioNeto } from '../dominio/calculos'
import { unaAportacion, unaCuenta, unMovimiento, unObjetivo } from '../dominio/fixtures'

/**
 * Estos tests corren contra una IndexedDB de verdad (fake-indexeddb), no
 * contra un doble: si el esquema, los índices o las transacciones están mal,
 * aquí se ve. Cada test usa una base con nombre propio para no pisarse.
 */
let db: BaseFinanzas
let adaptador: StorageAdapter
let contador = 0

beforeEach(() => {
  db = new BaseFinanzas(`prueba-${++contador}`)
  adaptador = adaptadorDexie(db)
})

afterEach(async () => {
  await db.delete()
})

describe('carga inicial y semilla', () => {
  test('una base vacía se siembra con las categorías por defecto', async () => {
    const estado = await cargarConSemilla(adaptador)
    expect(estado.categorias.length).toBeGreaterThan(20)
    expect(estado.categorias.some((c) => c.nombre === 'Salario' && c.tipo === 'ingreso')).toBe(true)
    expect(estado.categorias.some((c) => c.nombre === 'Ocio' && c.tipo === 'gasto')).toBe(true)
    expect(estado.configuracion.semillaAplicada).toBe(true)
  })

  test('el segundo arranque no duplica las categorías', async () => {
    const primera = await cargarConSemilla(adaptador)
    const segunda = await cargarConSemilla(adaptador)
    expect(segunda.categorias).toHaveLength(primera.categorias.length)
  })

  test('si archivas todas las categorías no reaparecen al arrancar', async () => {
    const estado = await cargarConSemilla(adaptador)
    await adaptador.guardar('categorias', estado.categorias.map((c) => ({ ...c, archivada: true })))

    const recargado = await cargarConSemilla(adaptador)
    expect(recargado.categorias.every((c) => c.archivada)).toBe(true)
  })

  test('la jerarquía de categorías sobrevive al viaje de ida y vuelta', async () => {
    const estado = await cargarConSemilla(adaptador)
    const viajes = estado.categorias.find((c) => c.nombre === 'Viajes')!
    expect(viajes.padreId).toBe('cat-ocio')
  })
})

describe('CRUD de movimientos', () => {
  test('se guardan, se leen y se borran', async () => {
    await cargarConSemilla(adaptador)
    await adaptador.guardar('cuentas', [unaCuenta({ id: 'c1', saldoInicial: 100000 })])
    await adaptador.guardar('movimientos', [
      unMovimiento({ id: 'm1', tipo: 'gasto', importe: 4500, cuentaId: 'c1', categoriaId: 'cat-ocio' }),
    ])

    let estado = await adaptador.cargar()
    expect(estado.movimientos).toHaveLength(1)
    expect(saldoCuenta(estado, 'c1')).toBe(95500)

    await adaptador.borrar('movimientos', ['m1'])
    estado = await adaptador.cargar()
    expect(estado.movimientos).toHaveLength(0)
    expect(saldoCuenta(estado, 'c1')).toBe(100000)
  })

  test('guardar dos veces el mismo id actualiza en vez de duplicar', async () => {
    await adaptador.guardar('movimientos', [unMovimiento({ id: 'm1', importe: 1000 })])
    await adaptador.guardar('movimientos', [unMovimiento({ id: 'm1', importe: 2000 })])

    const estado = await adaptador.cargar()
    expect(estado.movimientos).toHaveLength(1)
    expect(estado.movimientos[0].importe).toBe(2000)
  })

  test('guardar una lista vacía no rompe', async () => {
    await expect(adaptador.guardar('movimientos', [])).resolves.toBeUndefined()
    await expect(adaptador.borrar('movimientos', [])).resolves.toBeUndefined()
  })

  test('los movimientos de un mes se recuperan por su índice de fecha', async () => {
    await adaptador.guardar('movimientos', [
      unMovimiento({ id: 'm1', fecha: '2026-01-31' }),
      unMovimiento({ id: 'm2', fecha: '2026-02-01' }),
      unMovimiento({ id: 'm3', fecha: '2025-12-31' }),
    ])

    const enero = await db.movimientos.where('fecha').between('2026-01-01', '2026-01-31', true, true).toArray()
    expect(enero.map((m) => m.id)).toEqual(['m1'])
  })
})

describe('las cascadas se ejecutan de verdad sobre la base', () => {
  test('borrar un traspaso asignado a un objetivo borra su aportación', async () => {
    await adaptador.guardar('objetivos', [unObjetivo({ id: 'o1' })])
    await adaptador.guardar('movimientos', [
      unMovimiento({ id: 'm1', tipo: 'traspaso', cuentaId: 'c1', cuentaDestinoId: 'c2', categoriaId: undefined }),
    ])
    await adaptador.guardar('aportaciones', [unaAportacion({ id: 'a1', objetivoId: 'o1', movimientoId: 'm1' })])

    const estado = await adaptador.cargar()
    await aplicarCascada(adaptador, borrarMovimiento(estado, 'm1'))

    const despues = await adaptador.cargar()
    expect(despues.movimientos).toHaveLength(0)
    expect(despues.aportaciones).toHaveLength(0)
  })

  test('borrar un objetivo borra sus aportaciones y conserva las de otros', async () => {
    await adaptador.guardar('objetivos', [unObjetivo({ id: 'o1' }), unObjetivo({ id: 'o2' })])
    await adaptador.guardar('aportaciones', [
      unaAportacion({ id: 'a1', objetivoId: 'o1' }),
      unaAportacion({ id: 'a2', objetivoId: 'o2' }),
    ])

    const estado = await adaptador.cargar()
    await aplicarCascada(adaptador, borrarObjetivo(estado, 'o1'))

    const despues = await adaptador.cargar()
    expect(despues.aportaciones.map((a) => a.id)).toEqual(['a2'])
  })

  test('borrar un recurrente conserva sus movimientos ya cobrados', async () => {
    await adaptador.guardar('recurrentes', [
      {
        id: 'r1', nombre: 'Nómina', tipo: 'ingreso', importe: 190000, cuentaId: 'c1',
        categoriaId: 'cat-salario', frecuencia: 'mensual', diaDelMes: 25,
        fechaInicio: '2026-01-01', activo: true,
      },
    ])
    await adaptador.guardar('cuentas', [unaCuenta({ id: 'c1', saldoInicial: 0 })])
    await adaptador.guardar('movimientos', [
      unMovimiento({ id: 'm1', tipo: 'ingreso', importe: 190000, cuentaId: 'c1', recurrenteId: 'r1' }),
    ])

    const antes = await adaptador.cargar()
    const saldoAntes = saldoCuenta(antes, 'c1')

    await aplicarCascada(adaptador, borrarRecurrente(antes, 'r1'))

    const despues = await adaptador.cargar()
    expect(despues.recurrentes).toHaveLength(0)
    expect(despues.movimientos).toHaveLength(1)
    expect(despues.movimientos[0].recurrenteId).toBeUndefined()
    // Lo importante: el saldo no se ha movido.
    expect(saldoCuenta(despues, 'c1')).toBe(saldoAntes)
  })
})

describe('reemplazo y vaciado', () => {
  test('reemplazarTodo deja exactamente el estado dado, sin restos', async () => {
    await cargarConSemilla(adaptador)
    await adaptador.guardar('movimientos', [unMovimiento({ id: 'viejo' })])

    const nuevo = {
      ...(await adaptador.cargar()),
      movimientos: [unMovimiento({ id: 'nuevo' })],
      categorias: [],
    }
    await adaptador.reemplazarTodo(nuevo)

    const estado = await adaptador.cargar()
    expect(estado.movimientos.map((m) => m.id)).toEqual(['nuevo'])
    expect(estado.categorias).toHaveLength(0)
  })

  test('vaciar lo borra todo', async () => {
    await cargarConSemilla(adaptador)
    await adaptador.guardar('cuentas', [unaCuenta({ id: 'c1', saldoInicial: 100000 })])

    await adaptador.vaciar()

    const estado = await adaptador.cargar()
    expect(estado.cuentas).toHaveLength(0)
    expect(estado.categorias).toHaveLength(0)
    expect(patrimonioNeto(estado)).toBe(0)
  })
})

describe('la semilla no pisa los datos importados', () => {
  test('importar una copia con el flag a false no duplica las categorías', async () => {
    // Una copia editada a mano, o de una versión anterior, puede traer
    // semillaAplicada en false. Si solo se mirara el flag, al arrancar se
    // añadirían las categorías por defecto ENCIMA de las importadas.
    const estado = await cargarConSemilla(adaptador)
    const misCategorias = estado.categorias.slice(0, 3).map((c) => ({ ...c, nombre: `Mía ${c.nombre}` }))

    await adaptador.reemplazarTodo({
      ...estado,
      categorias: misCategorias,
      configuracion: { ...estado.configuracion, semillaAplicada: false },
    })

    const recargado = await cargarConSemilla(adaptador)
    expect(recargado.categorias).toHaveLength(3)
    expect(recargado.categorias.every((c) => c.nombre.startsWith('Mía'))).toBe(true)
    expect(recargado.configuracion.semillaAplicada).toBe(true)
  })
})
