import { useStore } from '../state/store'
import { IconButton } from '../ui/IconButton'

export function UndoRedo() {
  const canUndo = useStore((state) => state.past.length > 0)
  const canRedo = useStore((state) => state.future.length > 0)
  const undo = useStore((state) => state.undo)
  const redo = useStore((state) => state.redo)

  return (
    <>
      <IconButton icon="undo" label="Undo" disabled={!canUndo} onClick={undo} />
      <IconButton icon="redo" label="Redo" disabled={!canRedo} onClick={redo} />
    </>
  )
}
