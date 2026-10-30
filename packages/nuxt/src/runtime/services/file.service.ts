/**
 * Browser file plumbing: saving a blob to disk and picking a file to open.
 * SSR-safe — every entry point no-ops without a document.
 */

/** Triggers a download of `url` as `filename`. */
export function downloadURL(url: string, filename: string): void {
  if (typeof document === 'undefined') {
    return
  }
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
}

/** Saves text content as a file download. */
export function downloadText(text: string, filename: string, type: string): void {
  if (typeof document === 'undefined') {
    return
  }
  const url = URL.createObjectURL(new Blob([text], { type }))
  downloadURL(url, filename)
  URL.revokeObjectURL(url)
}

/** How long a never-answered picker's hidden input may linger. */
const PICKER_CLEANUP_MS = 60_000

/**
 * Opens the system file picker. Resolves with the chosen files, or an empty
 * list when the dialog is dismissed (browsers fire no event for a cancel,
 * so the stray input is removed on a timer regardless).
 */
export function pickFiles(accept: string, multiple = false): Promise<File[]> {
  if (typeof document === 'undefined') {
    return Promise.resolve([])
  }
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.style.display = 'none'
    input.addEventListener('change', () => {
      resolve(input.files ? Array.from(input.files) : [])
      input.remove()
    })
    input.addEventListener('cancel', () => {
      resolve([])
      input.remove()
    })
    document.body.appendChild(input)
    input.click()
    window.setTimeout(() => input.remove(), PICKER_CLEANUP_MS)
  })
}
