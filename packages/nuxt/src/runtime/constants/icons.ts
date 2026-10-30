/**
 * Central semantic icon registry — the ONLY module allowed to import
 * lucide-vue-next. Every icon in the product flows through `<UiIcon>` and a
 * name from `IconName`, so swapping the icon set or tuning a single glyph
 * happens in exactly one place.
 */
import type { Component } from 'vue'

import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowDownToLine,
  ArrowUpRight,
  ArrowUpToLine,
  BringToFront,
  Brush,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Diamond,
  Eraser,
  FileDown,
  FileType,
  FileUp,
  Flashlight,
  FlipHorizontal2,
  FlipVertical2,
  FolderOpen,
  Frame,
  Grid2x2,
  Grid3x3,
  Group,
  Hand,
  ImageDown,
  ImagePlus,
  Keyboard,
  Lock,
  LockKeyhole,
  LockOpen,
  Maximize,
  Minus,
  Moon,
  MousePointer2,
  Paintbrush,
  PaintBucket,
  PaintRoller,
  Pen,
  Pencil,
  PenLine,
  Radius,
  RectangleHorizontal,
  Redo2,
  Scan,
  ScanSearch,
  Scissors,
  SendToBack,
  Slash,
  Square,
  Sun,
  Trash2,
  Triangle,
  Type,
  Undo2,
  Ungroup,
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
  | 'group'
  | 'ungroup'
  | 'flipHorizontal'
  | 'flipVertical'
  | 'copyStyles'
  | 'pasteStyles'
  | 'toolLock'
  // arrange
  | 'alignLeftEdges'
  | 'alignHorizontalCenters'
  | 'alignRightEdges'
  | 'alignTopEdges'
  | 'alignVerticalCenters'
  | 'alignBottomEdges'
  | 'distributeHorizontal'
  | 'distributeVertical'
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
  | 'zoomToFit'
  | 'zoomToSelection'
  | 'shortcuts'
  | 'open'
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
  | 'arrowheadNone'
  | 'arrowheadArrow'
  | 'arrowheadBar'
  | 'arrowheadCircle'
  | 'arrowheadTriangle'
  | 'arrowheadDiamond'
  | 'chevronDown'

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
  group: Group,
  ungroup: Ungroup,
  flipHorizontal: FlipHorizontal2,
  flipVertical: FlipVertical2,
  copyStyles: Paintbrush,
  pasteStyles: PaintRoller,
  toolLock: LockKeyhole,

  // arrange
  alignLeftEdges: AlignStartVertical,
  alignHorizontalCenters: AlignCenterVertical,
  alignRightEdges: AlignEndVertical,
  alignTopEdges: AlignStartHorizontal,
  alignVerticalCenters: AlignCenterHorizontal,
  alignBottomEdges: AlignEndHorizontal,
  distributeHorizontal: AlignHorizontalDistributeCenter,
  distributeVertical: AlignVerticalDistributeCenter,

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
  zoomToFit: Maximize,
  zoomToSelection: ScanSearch,
  shortcuts: Keyboard,
  open: FolderOpen,
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
  // Arrowhead glyphs; the picker rotates/fills them per head kind.
  arrowheadNone: Minus,
  arrowheadArrow: ChevronRight,
  arrowheadBar: Minus,
  arrowheadCircle: Circle,
  arrowheadTriangle: Triangle,
  arrowheadDiamond: Diamond,
  chevronDown: ChevronDown,
}
