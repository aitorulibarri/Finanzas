import { useEffect, useState } from 'react'

/**
 * Zona realmente visible de la pantalla cuando hay teclado virtual.
 *
 * En Android (Chrome desde la 108 y los navegadores basados en él, como el
 * de los Xiaomi) el teclado se pinta ENCIMA de la página sin reducir el
 * viewport de diseño. Un elemento `fixed` pegado abajo queda entonces detrás
 * del teclado y no se ve lo que se escribe. `visualViewport` sí refleja el
 * hueco que deja el teclado, así que de ahí sale la altura y el desplazamiento.
 *
 * Devuelve null si el navegador no lo soporta: se queda el comportamiento normal.
 */
export function useZonaVisible(activo: boolean): { top: number; height: number } | null {
  const [zona, setZona] = useState<{ top: number; height: number } | null>(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (!activo || !vv) return

    const medir = () => setZona({ top: vv.offsetTop, height: vv.height })
    medir()
    vv.addEventListener('resize', medir)
    vv.addEventListener('scroll', medir)
    return () => {
      vv.removeEventListener('resize', medir)
      vv.removeEventListener('scroll', medir)
      setZona(null)
    }
  }, [activo])

  return zona
}

/**
 * Mantiene a la vista el campo que se está escribiendo.
 *
 * Se centra al enfocar y otra vez cada vez que cambia la zona visible: en
 * algunos móviles el teclado tarda más de lo previsto en salir, y centrar solo
 * una vez, con un retardo fijo, deja el campo tapado si el aviso llega tarde.
 */
export function useCentrarCampoEnfocado(): void {
  useEffect(() => {
    let temporizador: number | undefined
    const esCampo = (el: Element | null): el is HTMLElement =>
      el instanceof HTMLElement && el.matches('input, select, textarea')

    const centrar = (retardo: number) => {
      window.clearTimeout(temporizador)
      temporizador = window.setTimeout(() => {
        const el = document.activeElement
        if (esCampo(el)) el.scrollIntoView({ block: 'center', behavior: 'auto' })
      }, retardo)
    }

    const alEnfocar = (e: FocusEvent) => {
      if (esCampo(e.target as Element)) centrar(300)
    }
    const alCambiarZona = () => centrar(80)

    document.addEventListener('focusin', alEnfocar)
    const vv = window.visualViewport
    vv?.addEventListener('resize', alCambiarZona)
    return () => {
      document.removeEventListener('focusin', alEnfocar)
      vv?.removeEventListener('resize', alCambiarZona)
      window.clearTimeout(temporizador)
    }
  }, [])
}
