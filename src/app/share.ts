export async function shareFile(file: File): Promise<void> {
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      console.warn('Share failed, downloading instead', error)
    }
  }
  const url = URL.createObjectURL(new Blob([file], { type: 'application/octet-stream' }))
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
