import { z } from 'zod'
import { esFechaValida, esMesValido } from './fechas'

/**
 * Validación de entrada y de ficheros importados.
 *
 * Los `refine` de aquí abajo no son decorativos: codifican las reglas que
 * mantienen los números correctos. Un traspaso con categoría o un importe
 * negativo no son datos raros, son datos que romperían el cálculo de
 * ingresos, gastos y presupuestos.
 */

const fechaISO = z.string().refine(esFechaValida, 'Fecha inválida, se espera AAAA-MM-DD')
const mesISO = z.string().refine(esMesValido, 'Mes inválido, se espera AAAA-MM')

/** Importe en céntimos: entero y estrictamente positivo. El signo lo pone el tipo. */
const importePositivo = z
  .number()
  .int('El importe debe estar en céntimos enteros')
  .positive('El importe debe ser mayor que cero')

/** Los saldos y valoraciones sí pueden ser negativos (una tarjeta, una pérdida). */
const importeConSigno = z.number().int('El importe debe estar en céntimos enteros')

export const esquemaCuenta = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1, 'La cuenta necesita un nombre'),
  tipo: z.enum(['corriente', 'ahorro', 'efectivo', 'inversion', 'tarjeta']),
  saldoInicial: importeConSigno,
  color: z.string(),
  archivada: z.boolean(),
  orden: z.number().int(),
})

export const esquemaValoracion = z.object({
  id: z.string().min(1),
  cuentaId: z.string().min(1),
  fecha: fechaISO,
  valor: importeConSigno,
})

export const esquemaMovimiento = z
  .object({
    id: z.string().min(1),
    fecha: fechaISO,
    tipo: z.enum(['ingreso', 'gasto', 'traspaso']),
    importe: importePositivo,
    cuentaId: z.string().min(1),
    cuentaDestinoId: z.string().optional(),
    categoriaId: z.string().optional(),
    descripcion: z.string(),
    notas: z.string().optional(),
    recurrenteId: z.string().optional(),
    creadoEn: z.string(),
  })
  .refine((m) => m.tipo !== 'traspaso' || !!m.cuentaDestinoId, {
    message: 'Un traspaso necesita cuenta de destino',
    path: ['cuentaDestinoId'],
  })
  .refine((m) => m.tipo !== 'traspaso' || m.categoriaId == null, {
    // Si un traspaso llevara categoría acabaría consumiendo presupuesto y
    // contándose como gasto, que es justo lo que no es.
    message: 'Un traspaso no puede llevar categoría',
    path: ['categoriaId'],
  })
  .refine((m) => m.tipo !== 'traspaso' || m.cuentaDestinoId !== m.cuentaId, {
    message: 'El origen y el destino no pueden ser la misma cuenta',
    path: ['cuentaDestinoId'],
  })
  .refine((m) => m.tipo === 'traspaso' || !!m.categoriaId, {
    message: 'Elige una categoría',
    path: ['categoriaId'],
  })
  .refine((m) => m.tipo === 'traspaso' || m.cuentaDestinoId == null, {
    message: 'Solo los traspasos tienen cuenta de destino',
    path: ['cuentaDestinoId'],
  })

export const esquemaCategoria = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1, 'La categoría necesita un nombre'),
  tipo: z.enum(['ingreso', 'gasto']),
  icono: z.string(),
  color: z.string(),
  padreId: z.string().optional(),
  archivada: z.boolean(),
  orden: z.number().int(),
})

export const esquemaPresupuesto = z.object({
  id: z.string().min(1),
  categoriaId: z.string().min(1),
  importeMensual: importePositivo,
  mes: mesISO.nullable(),
})

export const esquemaAportacion = z.object({
  id: z.string().min(1),
  objetivoId: z.string().min(1),
  movimientoId: z.string().optional(),
  fecha: fechaISO,
  importe: importeConSigno,
})

export const esquemaObjetivo = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1, 'El objetivo necesita un nombre'),
  objetivo: importePositivo,
  fechaLimite: fechaISO.optional(),
  cuentaId: z.string().optional(),
  icono: z.string(),
  color: z.string(),
  archivado: z.boolean(),
  orden: z.number().int(),
})

export const esquemaRecurrente = z
  .object({
    id: z.string().min(1),
    nombre: z.string().min(1, 'El recurrente necesita un nombre'),
    tipo: z.enum(['ingreso', 'gasto', 'traspaso']),
    importe: importePositivo,
    cuentaId: z.string().min(1),
    cuentaDestinoId: z.string().optional(),
    categoriaId: z.string().optional(),
    frecuencia: z.enum(['semanal', 'mensual', 'trimestral', 'anual']),
    diaDelMes: z.number().int().min(1).max(31).optional(),
    diaDeLaSemana: z.number().int().min(0).max(6).optional(),
    mesDelAnio: z.number().int().min(1).max(12).optional(),
    fechaInicio: fechaISO,
    fechaFin: fechaISO.optional(),
    ultimaGeneracion: fechaISO.optional(),
    activo: z.boolean(),
  })
  .refine((r) => r.tipo !== 'traspaso' || !!r.cuentaDestinoId, {
    message: 'Un traspaso recurrente necesita cuenta de destino',
    path: ['cuentaDestinoId'],
  })
  .refine((r) => r.tipo !== 'traspaso' || r.categoriaId == null, {
    message: 'Un traspaso no puede llevar categoría',
    path: ['categoriaId'],
  })
  .refine((r) => r.tipo === 'traspaso' || !!r.categoriaId, {
    message: 'Elige una categoría',
    path: ['categoriaId'],
  })
  .refine((r) => r.frecuencia !== 'semanal' || r.diaDeLaSemana != null, {
    message: 'Indica el día de la semana',
    path: ['diaDeLaSemana'],
  })
  .refine((r) => r.frecuencia === 'semanal' || r.diaDelMes != null, {
    message: 'Indica el día del mes',
    path: ['diaDelMes'],
  })
  .refine((r) => !r.fechaFin || r.fechaFin >= r.fechaInicio, {
    message: 'La fecha de fin no puede ser anterior a la de inicio',
    path: ['fechaFin'],
  })

export const esquemaConfiguracion = z.object({
  id: z.literal('unica'),
  moneda: z.string(),
  locale: z.string(),
  ultimaCopia: fechaISO.optional(),
  cuentaPorDefectoId: z.string().optional(),
  semillaAplicada: z.boolean(),
})

export const esquemaEstado = z.object({
  cuentas: z.array(esquemaCuenta),
  movimientos: z.array(esquemaMovimiento),
  categorias: z.array(esquemaCategoria),
  presupuestos: z.array(esquemaPresupuesto),
  objetivos: z.array(esquemaObjetivo),
  aportaciones: z.array(esquemaAportacion),
  recurrentes: z.array(esquemaRecurrente),
  valoraciones: z.array(esquemaValoracion),
  configuracion: esquemaConfiguracion,
})

/** Versión del formato de copia de seguridad. Subir al cambiar el esquema. */
export const VERSION_ESQUEMA = 1

export const esquemaCopia = z.object({
  version: z.number().int(),
  exportadoEn: z.string(),
  estado: esquemaEstado,
})

export type Copia = z.infer<typeof esquemaCopia>
