/**
 * Central semantic icon registry — the ONLY module allowed to import
 * lucide-vue-next. Every icon in the product flows through `<UiIcon>` and a
 * name from `IconName`, so swapping the icon set or tuning a single glyph
 * happens in exactly one place.
 */
import type { Component } from 'vue'

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpRight,
  ArrowUpToLine,
  BringToFront,
  Brush,
  Circle,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Diamond,
  Eraser,
  FileDown,
  FileType,
  FileUp,
  Frame,
  Grid2x2,
  Grid3x3,
  Hand,
  ImageDown,
  ImagePlus,
  Flashlight,
  Lock,
  LockOpen,
  Minus,
  Moon,
  MousePointer2,
  PaintBucket,
  Pen,
  Pencil,
  PenLine,
  Radius,
  RectangleHorizontal,
  Redo2,
  Scan,
  Scissors,
  SendToBack,
  Slash,
  Square,
  Sun,
  Trash2,
  Type,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-vue-next'

/** Semantic icon names used across the vuedraw chrome. */
export type IconName =
  // tools
  | 'selection'
  | 'hand'
  | 'rectangle'
  | 'diamond'
  | 'ellipse'
  | 'arrow'
  | 'line'
  | 'freedraw'
  | 'text'
  | 'imageTool'
  | 'eraser'
  | 'frameTool'
  | 'laserTool'
  // history & object actions
  | 'undo'
  | 'redo'
  | 'trash'
  | 'lock'
  | 'unlock'
  | 'bringFront'
  | 'bringForward'
  | 'sendBackward'
  | 'sendBack'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'duplicate'
  // view & file
  | 'image'
  | 'svg'
  | 'save'
  | 'load'
  | 'grid'
  | 'sun'
  | 'moon'
  | 'zoomIn'
  | 'zoomOut'
  | 'resetZoom'
  | 'clear'
  | 'close'
  // style controls
  | 'fillHachure'
  | 'fillCrossHatch'
  | 'fillSolid'
  | 'strokeThin'
  | 'strokeMedium'
  | 'strokeBold'
  | 'cornerSharp'
  | 'cornerRound'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'

export const iconRegistry: Record<IconName, Component> = {
  // tools
  selection: MousePointer2,
  hand: Hand,
  rectangle: Square,
  diamond: Diamond,
  ellipse: Circle,
  arrow: ArrowUpRight,
  line: Minus,
  freedraw: Pencil,
  text: Type,
  imageTool: ImagePlus,
  eraser: Eraser,
  frameTool: Frame,
  laserTool: Flashlight,

  // history & object actions
  undo: Undo2,
  redo: Redo2,
  trash: Trash2,
  lock: Lock,
  unlock: LockOpen,
  bringFront: BringToFront,
  bringForward: ArrowUpToLine,
  sendBackward: ArrowDownToLine,
  sendBack: SendToBack,
  copy: Copy,
  cut: Scissors,
  paste: ClipboardPaste,
  duplicate: CopyPlus,

  // view & file
  image: ImageDown,
  svg: FileType,
  save: FileDown,
  load: FileUp,
  grid: Grid3x3,
  sun: Sun,
  moon: Moon,
  zoomIn: ZoomIn,
  zoomOut: ZoomOut,
  resetZoom: Scan,
  clear: Trash2,
  close: X,

  // style controls
  fillHachure: Slash,
  fillCrossHatch: Grid2x2,
  fillSolid: PaintBucket,
  strokeThin: PenLine,
  strokeMedium: Pen,
  strokeBold: Brush,
  cornerSharp: RectangleHorizontal,
  cornerRound: Radius,
  alignLeft: AlignLeft,
  alignCenter: AlignCenter,
  alignRight: AlignRight,
}
