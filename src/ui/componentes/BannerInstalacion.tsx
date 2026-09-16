import { useEffect, useState } from 'react'
import { Aviso, Boton } from './base'

/**
 * Aviso para instalar la aplicación en la pantalla de inicio.
 *
 * En iPhone esto NO es una comodidad, es protección de los datos. Safari borra
 * el almacenamiento de un sitio tras siete días sin visitarlo, y ahí dentro
 * está IndexedDB, que es donde vive todo tu historial. Las aplicaciones
 * añadidas a la pantalla de inicio quedan exentas porque llevan su propio
 * contador, que no avanza con el uso de Safari. Traducido: usarla en una
 * pestaña durante un mes y no instalarla termina con la app vacía un día
 * cualquiera, sin aviso y sin forma de recuperarlo.
 *
 * En Android el navegador ofrece un diálogo de instalación nativo y basta con
 * lanzarlo. En iOS no existe ese evento, así que hay que explicar los pasos.
 */

/** No está en lib.dom: solo la implementan los navegadores basados en Chromium. */
interface EventoInstalacion extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const CLAVE_DESCARTE = 'finanzas:banner-instalacion'

/**
 * En iOS el descarte caduca a los cinco días, por debajo de la ventana de
 * siete en la que se pierden los datos, para que el aviso vuelva antes de que
 * sea tarde. En Android no hay nada que perder, así que el descarte es
 * definitivo y no se insiste.
 */
const DIAS_DESCARTE_IOS = 5

function leerDescarte(): number | null {
  try {
    const valor = localStorage.getItem(CLAVE_DESCARTE)
    return valor ? Number(valor) : null
  } catch {
    // En ventana privada el acceso lanza. Sin memoria del descarte, pero
    // tampoco se rompe nada: el aviso simplemente vuelve a salir.
    return null
  }
}

function guardarDescarte() {
  try {
    localStorage.setItem(CLAVE_DESCARTE, String(Date.now()))
  } catch {
    // Igual que arriba: si no se puede recordar, no pasa nada grave.
  }
}

function estaInstalada(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // Safari en iOS no implementa display-mode y usa esta propiedad suya.
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

function esIOS(): boolean {
  const ua = window.navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return true
  // Un iPad con iPadOS 13 o superior se anuncia como Macintosh; se distingue
  // de un Mac de verdad porque tiene pantalla táctil.
  return /Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1
}

/** ¿Sigue vigente un descarte anterior? */
function siguesDescartado(enIOS: boolean): boolean {
  const descarte = leerDescarte()
  if (descarte === null) return false
  if (!enIOS) return true
  return (Date.now() - descarte) / 86_400_000 < DIAS_DESCARTE_IOS
}

export function BannerInstalacion() {
  /*
   * El estado se calcula en el inicializador perezoso de useState y no dentro
   * de un efecto. Así se resuelve en el primer render, sin un segundo render
   * en cascada y sin el parpadeo de enseñar el estado equivocado durante un
   * instante. Solo se lee `window`, que en una aplicación de navegador está
   * disponible desde el principio.
   */
  const [ios] = useState(esIOS)
  const [instalada, setInstalada] = useState(estaInstalada)
  const [descartado, setDescartado] = useState(() => siguesDescartado(esIOS()))
  const [evento, setEvento] = useState<EventoInstalacion | null>(null)

  // El efecto solo se suscribe a eventos del navegador, que es para lo que
  // están los efectos.
  useEffect(() => {
    const alPoderInstalar = (e: Event) => {
      // Sin esto el navegador muestra su propia barra, que es fácil de ignorar
      // y no explica por qué conviene instalarla.
      e.preventDefault()
      setEvento(e as EventoInstalacion)
    }
    const alInstalar = () => setInstalada(true)

    window.addEventListener('beforeinstallprompt', alPoderInstalar)
    window.addEventListener('appinstalled', alInstalar)
    return () => {
      window.removeEventListener('beforeinstallprompt', alPoderInstalar)
      window.removeEventListener('appinstalled', alInstalar)
    }
  }, [])

  function descartar() {
    guardarDescarte()
    setDescartado(true)
  }

  async function instalar() {
    if (!evento) return
    await evento.prompt()
    const { outcome } = await evento.userChoice
    setEvento(null)
    if (outcome === 'dismissed') descartar()
  }

  if (instalada || descartado) return null
  // Fuera de iOS solo se ofrece cuando el navegador dice que se puede: en un
  // escritorio sin instalación posible, el aviso sería ruido.
  if (!ios && !evento) return null

  return (
    <div className="mb-4" data-testid="banner-instalacion">
      <Aviso tono={ios ? 'alerta' : 'info'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {ios ? (
              <>
                <p className="font-semibold">Añádela a tu pantalla de inicio</p>
                <p className="mt-1">
                  En iPhone no es opcional: si la usas desde una pestaña de Safari, el sistema
                  borra tus datos tras siete días sin abrirla. Instalada queda fuera de esa
                  limpieza.
                </p>
                <p className="mt-2">
                  Pulsa <strong>Compartir</strong> abajo y elige{' '}
                  <strong>Añadir a pantalla de inicio</strong>.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">Instálala como aplicación</p>
                <p className="mt-1">
                  Se abre desde tu pantalla de inicio, a pantalla completa y sin conexión.
                </p>
              </>
            )}
          </div>

          <div className="flex shrink-0 gap-1.5">
            {!ios && evento && (
              <Boton variante="primario" onClick={() => void instalar()}>
                Instalar
              </Boton>
            )}
            <Boton variante="fantasma" onClick={descartar} aria-label="Descartar aviso">
              ✕
            </Boton>
          </div>
        </div>
      </Aviso>
    </div>
  )
}
