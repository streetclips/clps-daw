import '@fontsource/press-start-2p/latin-400.css'
import './styles/global.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { engine } from './audio/engine'
import { startAutosave } from './state/autosave'
import { requestPersistentStorage } from './state/storage'
import { useStore } from './state/store'

document.addEventListener('gesturestart', (event) => event.preventDefault())
engine.setSongSource(() => useStore.getState().song)
startAutosave()
void requestPersistentStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
