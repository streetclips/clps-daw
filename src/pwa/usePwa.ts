import { useRegisterSW } from 'virtual:pwa-register/react'

export function usePwa() {
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  const controlled = 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null

  return {
    offlineReady: offlineReady || controlled,
    needRefresh,
    update: () => updateServiceWorker(true),
  }
}
