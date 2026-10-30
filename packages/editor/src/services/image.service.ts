/**
 * Image service — the browser-side half of image support.
 *
 * Core renders images through an injected resolver but never decodes them
 * (it must stay environment-agnostic). This module owns that browser half:
 * a module-level decoded-bitmap cache keyed by data URL, plus the file →
 * dataURL → element pipeline shared by every insertion path (toolbar picker,
 * drag-and-drop, clipboard paste).
 *
 * Decoding happens once per distinct data URL; afterwards the cache answers
 * synchronously, so panning and zooming replay the same bitmap instead of
 * re-decoding per frame. Cache misses are never fatal — the renderer draws
 * its placeholder until the decode lands.
 */

import { newImageElement, type Point, type OpenDrawElement, type OpenDrawImageElement } from '@opendrawjs/core'

/** Decoded bitmaps keyed by data URL — shared across editor instances. */
const bitmapCache = new Map<string, HTMLImageElement>()

/** Sizes of decoded images keyed by data URL (intrinsic pixel dimensions). */
const sizeCache = new Map<string, { width: number; height: number }>()

/**
 * Excalidraw caps freshly inserted images so a 4000px photo does not swallow
 * the canvas (its `MAX_IMAGE_SIZE`-style fit).
 */
const MAX_INSERTED_IMAGE_SIDE = 480

/** Only image files are ever accepted by the insertion paths. */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

/** The image files of a drop or paste payload (null-safe). */
export function imageFilesOf(files: FileList | null | undefined): File[] {
  return files ? Array.from(files).filter(isImageFile) : []
}

/**
 * The resolver handed to core's renderer and PNG exporter: synchronous cache
 * lookup only — a bitmap that is not decoded yet yields null (placeholder).
 */
export function imageResolver(element: OpenDrawImageElement): CanvasImageSource | null {
  const bitmap = bitmapCache.get(element.dataUrl)
  return bitmap && bitmap.complete && bitmap.naturalWidth > 0 ? bitmap : null
}

/**
 * Requests a decode for the data URL; `onDecoded` fires once it is available
 * (immediately when already cached). Failures are surfaced, never swallowed —
 * the placeholder simply stays.
 */
export function requestImageDecode(dataUrl: string, onDecoded: () => void): void {
  if (typeof window === 'undefined') {
    return
  }
  const cached = bitmapCache.get(dataUrl)
  if (cached && cached.complete) {
    onDecoded()
    return
  }
  const image = new window.Image()
  image.onload = () => {
    bitmapCache.set(dataUrl, image)
    sizeCache.set(dataUrl, { width: image.naturalWidth, height: image.naturalHeight })
    onDecoded()
  }
  image.onerror = () => {
    // eslint-disable-next-line no-console -- degrade visibly per repo error rules
    console.error('[opendraw] image failed to decode', { dataUrlLength: dataUrl.length })
  }
  image.src = dataUrl
}

/** Reads a file as a data URL — one promise per insertion path. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error(`could not read "${file.name}" as a data URL`))
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error(`could not read "${file.name}"`))
    reader.readAsDataURL(file)
  })
}

/**
 * Scales intrinsic dimensions down to the insertion cap, keeping the aspect
 * ratio — mirrors Excalidraw's "fit the image into a sensible box" behavior.
 */
export function fitImageSize(width: number, height: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: MAX_INSERTED_IMAGE_SIDE, height: MAX_INSERTED_IMAGE_SIDE }
  }
  const scale = Math.min(1, MAX_INSERTED_IMAGE_SIDE / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

export interface PreparedImage {
  dataUrl: string
  width: number
  height: number
}

/**
 * Reads one image file end to end: data URL + decode + insertion size. Files
 * that are not images are rejected so callers can filter them up front.
 */
export async function prepareImageFile(file: File, onDecoded?: () => void): Promise<PreparedImage> {
  const dataUrl = await readFileAsDataUrl(file)
  const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    requestImageDecode(dataUrl, () => resolve(sizeCache.get(dataUrl) ?? { width: 0, height: 0 }))
    if (typeof window !== 'undefined') {
      // A decode that never lands must not wedge the insertion — race it
      // with a timeout and fall back to the placeholder-cap size.
      window.setTimeout(() => resolve(sizeCache.get(dataUrl) ?? { width: 0, height: 0 }), 5000)
    } else {
      reject(new Error('image decoding requires a browser environment'))
    }
  })
  const fitted = fitImageSize(size.width, size.height)
  onDecoded?.()
  return { dataUrl, width: fitted.width, height: fitted.height }
}

/** Scene-rect centering for a freshly inserted image, Excalidraw-style fit. */
export function imageElementFromPrepared(
  prepared: PreparedImage,
  at: Point,
): OpenDrawImageElement {
  return newImageElement({
    x: at.x - prepared.width / 2,
    y: at.y - prepared.height / 2,
    width: prepared.width,
    height: prepared.height,
    dataUrl: prepared.dataUrl,
  })
}

/** Every image data URL currently present in a scene (drives decode sweeps). */
export function imageDataUrlsOf(elements: readonly OpenDrawElement[]): string[] {
  const urls: string[] = []
  for (const element of elements) {
    if (element.type === 'image' && !urls.includes(element.dataUrl)) {
      urls.push(element.dataUrl)
    }
  }
  return urls
}
