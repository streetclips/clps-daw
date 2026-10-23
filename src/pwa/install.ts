import { useSyncExternalStore } from 'react'

type InstallPromptEvent = Event & { prompt: () => Promise<void> }

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()

const publish = () => listeners.forEach((listener) => listener())

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  deferred = event as InstallPromptEvent
  publish()
})

window.addEventListener('appinstalled', () => {
  deferred = null
  publish()
})

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useInstallPrompt(): (() => void) | null {
  const available = useSyncExternalStore(subscribe, () => deferred !== null)
  if (!available) return null
  return () => {
    const event = deferred
    deferred = null
    publish()
    void event?.prompt()
  }
}
