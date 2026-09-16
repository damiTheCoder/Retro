import { registerOverlay } from 'klinecharts'
import type { OverlayCreateFiguresCallbackParams, OverlayFigure } from 'klinecharts'

function formatIntOrDec(val: number, decimals = 3): string {
  if (isNaN(val)) return '0'
  return val.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })
}

function calculatePips(diff: number, price: number): string {
  if (price >= 1000) {
    return Math.round(diff).toLocaleString('en-US')
  } else if (price >= 100) {
    return (diff * 10).toFixed(1)
  } else if (price >= 1) {
    return (diff * 1000).toFixed(1)
  } else {
    return (diff * 100000).toFixed(1)
  }
}

function createPositionFigures(
  params: OverlayCreateFiguresCallbackParams,
  isLong: boolean
): OverlayFigure[] {
  const { overlay, coordinates, yAxis } = params
  if (!coordinates || coordinates.length === 0) return []

  const entryCoord = coordinates[0]
  if (!entryCoord) return []

  const currentStep = overlay.currentStep ?? 3
  const entryPrice = overlay.points[0]?.value ?? 0
  const x0 = entryCoord.x

  const targetFill = 'rgba(0, 150, 136, 0.25)'
  const targetBorder = '#00a68c'
  const stopFill = 'rgba(215, 60, 60, 0.28)'
  const stopBorder = '#c62828'

  // STEP 1: Click 1 placed (Entry). User is dragging cursor to set Target price & box width.
  if (currentStep === 1) {
    const cursorCoord = coordinates[1] ?? { x: x0 + 160, y: entryCoord.y - 80 }
    const cursorPrice = overlay.points[1]?.value ?? (yAxis ? yAxis.convertFromPixel(cursorCoord.y) : (isLong ? entryPrice * 1.02 : entryPrice * 0.98))

    const targetPrice = cursorPrice
    const yTarget = cursorCoord.y
    const yEntry = entryCoord.y

    const minX = Math.min(x0, cursorCoord.x)
    const maxX = Math.max(x0, cursorCoord.x, minX + 40)
    const centerX = minX + (maxX - minX) / 2

    const targetDiff = Math.abs(targetPrice - entryPrice)
    const targetPct = entryPrice ? (targetDiff / entryPrice) * 100 : 0
    const targetPips = calculatePips(targetDiff, entryPrice)
    const targetAmount = (targetDiff * 616.7).toFixed(2)
    const targetText = `Target: ${formatIntOrDec(targetDiff, 3)} (${targetPct.toFixed(3)}%) ${targetPips}, Amount: ${targetAmount}`

    const figures: OverlayFigure[] = []

    // Live Target Zone Box Preview
    figures.push({
      type: 'polygon',
      attrs: {
        coordinates: [
          { x: minX, y: yEntry },
          { x: maxX, y: yEntry },
          { x: maxX, y: yTarget },
          { x: minX, y: yTarget },
        ],
      },
      styles: {
        style: 'stroke_fill',
        color: targetFill,
        borderColor: targetBorder,
        borderSize: 1,
      },
    })

    // Entry Line
    figures.push({
      type: 'line',
      attrs: {
        coordinates: [
          { x: minX, y: yEntry },
          { x: maxX, y: yEntry },
        ],
      },
      styles: { color: '#333333', size: 1.5 },
    })

    // Live Target Pill Preview
    const targetPillY = Math.min(yTarget, yEntry) - 18
    const targetPillW = 310
    figures.push({
      type: 'rect',
      attrs: {
        x: centerX - targetPillW / 2,
        y: targetPillY - 13,
        width: targetPillW,
        height: 26,
      },
      styles: {
        style: 'stroke_fill',
        color: '#00a68c',
        borderColor: 'transparent',
        borderRadius: 13,
      },
    })
    figures.push({
      type: 'text',
      attrs: { x: centerX, y: targetPillY, text: targetText, align: 'center', baseline: 'middle' },
      styles: { color: '#ffffff', size: 11, family: 'sans-serif', weight: '600', backgroundColor: 'transparent' },
    })

    return figures
  }

  // STEP 2 & 3: Target is set. In Step 2, user is dragging cursor to set Stop Loss. In Step 3, drawing is complete.
  const targetCoord = coordinates[1]
  const stopCoord = coordinates[2]

  let targetPrice = overlay.points[1]?.value
  if (targetPrice == null) {
    targetPrice = isLong ? entryPrice * 1.01867 : entryPrice * 0.98133
  }

  let stopPrice = overlay.points[2]?.value
  if (stopPrice == null && currentStep === 2 && stopCoord) {
    stopPrice = yAxis ? yAxis.convertFromPixel(stopCoord.y) : (isLong ? entryPrice * 0.952 : entryPrice * 1.048)
  } else if (stopPrice == null) {
    stopPrice = isLong ? entryPrice * 0.952 : entryPrice * 1.048
  }

  // Derive horizontal bounds from control points for 2D resizing
  const x1 = targetCoord ? targetCoord.x : x0 + 160
  const x2 = stopCoord ? stopCoord.x : x1

  const minX = Math.min(x0, x1, x2)
  const rawMaxX = Math.max(x0, x1, x2)
  const maxX = rawMaxX - minX < 40 ? minX + 160 : rawMaxX

  const yEntry = entryCoord.y
  const yTarget = targetCoord?.y ?? (yAxis ? yAxis.convertToPixel(targetPrice) : yEntry - 100)
  const yStop = stopCoord?.y ?? (yAxis ? yAxis.convertToPixel(stopPrice) : yEntry + 140)

  const targetDiff = Math.abs(targetPrice - entryPrice)
  const targetPct = entryPrice ? (targetDiff / entryPrice) * 100 : 1.867
  const targetPips = calculatePips(targetDiff, entryPrice)

  const stopDiff = Math.abs(entryPrice - stopPrice)
  const stopPct = entryPrice ? (stopDiff / entryPrice) * 100 : 4.800
  const stopPips = calculatePips(stopDiff, entryPrice)

  const qty = 0.066
  const targetAmount = (targetDiff * 616.7).toFixed(2)
  const stopAmount = (stopDiff * 199.2).toFixed(0)

  const riskReward = stopDiff > 0 ? (targetDiff / stopDiff).toFixed(2) : '0.39'
  const pnlVal = -17813

  const targetText = `Target: ${formatIntOrDec(targetDiff, 3)} (${targetPct.toFixed(3)}%) ${targetPips}, Amount: ${targetAmount}`
  const centerTextL1 = `Open PnL: ${formatIntOrDec(pnlVal, 0)}, Qty: ${qty}`
  const centerTextL2 = `Risk/reward ratio: ${riskReward}`
  const stopText = `Stop: ${formatIntOrDec(stopDiff, 3)} (${stopPct.toFixed(3)}%) ${stopPips}, Amount: ${stopAmount}`

  const figures: OverlayFigure[] = []

  // 1. Target Zone Polygon
  figures.push({
    type: 'polygon',
    attrs: {
      coordinates: [
        { x: minX, y: yEntry },
        { x: maxX, y: yEntry },
        { x: maxX, y: yTarget },
        { x: minX, y: yTarget },
      ],
    },
    styles: {
      style: 'stroke_fill',
      color: targetFill,
      borderColor: targetBorder,
      borderSize: 1,
    },
  })

  // 2. Stop Loss Zone Polygon
  figures.push({
    type: 'polygon',
    attrs: {
      coordinates: [
        { x: minX, y: yEntry },
        { x: maxX, y: yEntry },
        { x: maxX, y: yStop },
        { x: minX, y: yStop },
      ],
    },
    styles: {
      style: 'stroke_fill',
      color: stopFill,
      borderColor: stopBorder,
      borderSize: 1,
    },
  })

  // 3. Entry Line
  figures.push({
    type: 'line',
    attrs: {
      coordinates: [
        { x: minX, y: yEntry },
        { x: maxX, y: yEntry },
      ],
    },
    styles: {
      color: '#333333',
      size: 1.5,
    },
  })

  const centerX = minX + (maxX - minX) / 2

  // Anti-overlap spacing calculation
  const topY = Math.min(yTarget, yEntry)
  const bottomY = Math.max(yStop, yEntry)
  const targetGap = Math.abs(yTarget - yEntry)
  const stopGap = Math.abs(yStop - yEntry)

  // 4. Target Pill (Floating ABOVE top edge of Target Box)
  const targetPillY = targetGap < 45 ? yEntry - 42 : topY - 18
  const targetPillW = 310
  figures.push({
    type: 'rect',
    attrs: {
      x: centerX - targetPillW / 2,
      y: targetPillY - 13,
      width: targetPillW,
      height: 26,
    },
    styles: {
      style: 'stroke_fill',
      color: '#00a68c',
      borderColor: 'transparent',
      borderRadius: 13,
    },
  })
  figures.push({
    type: 'text',
    attrs: {
      x: centerX,
      y: targetPillY,
      text: targetText,
      align: 'center',
      baseline: 'middle',
    },
    styles: {
      color: '#ffffff',
      size: 11,
      family: 'sans-serif',
      weight: '600',
      backgroundColor: 'transparent',
    },
  })

  // 5. Center Pill (Positioned right at Entry line level)
  const centerPillW = 225
  const centerPillH = 40
  figures.push({
    type: 'rect',
    attrs: {
      x: centerX - centerPillW / 2,
      y: yEntry - centerPillH / 2,
      width: centerPillW,
      height: centerPillH,
    },
    styles: {
      style: 'stroke_fill',
      color: '#ef5350',
      borderColor: '#ffffff',
      borderSize: 1.5,
      borderRadius: 10,
    },
  })

  figures.push({
    type: 'text',
    attrs: {
      x: centerX,
      y: yEntry - 9,
      text: centerTextL1,
      align: 'center',
      baseline: 'middle',
    },
    styles: {
      color: '#ffffff',
      size: 11,
      family: 'sans-serif',
      weight: '600',
      backgroundColor: 'transparent',
    },
  })

  figures.push({
    type: 'text',
    attrs: {
      x: centerX,
      y: yEntry + 9,
      text: centerTextL2,
      align: 'center',
      baseline: 'middle',
    },
    styles: {
      color: '#ffffff',
      size: 11,
      family: 'sans-serif',
      weight: '600',
      backgroundColor: 'transparent',
    },
  })

  // 6. Stop Loss Pill (Floating BELOW bottom edge of Stop Loss Box)
  const stopPillY = stopGap < 45 ? yEntry + 42 : bottomY + 18
  const stopPillW = 285
  figures.push({
    type: 'rect',
    attrs: {
      x: centerX - stopPillW / 2,
      y: stopPillY - 13,
      width: stopPillW,
      height: 26,
    },
    styles: {
      style: 'stroke_fill',
      color: '#ef5350',
      borderColor: 'transparent',
      borderRadius: 13,
    },
  })
  figures.push({
    type: 'text',
    attrs: {
      x: centerX,
      y: stopPillY,
      text: stopText,
      align: 'center',
      baseline: 'middle',
    },
    styles: {
      color: '#ffffff',
      size: 11,
      family: 'sans-serif',
      weight: '600',
      backgroundColor: 'transparent',
    },
  })

  return figures
}

export function registerPositionOverlays(): void {
  registerOverlay({
    name: 'longPosition',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    styles: {
      point: {
        color: '#2962ff',
        borderColor: '#ffffff',
        borderSize: 1.5,
        radius: 5,
        activeColor: '#2962ff',
        activeBorderColor: '#ffffff',
        activeBorderSize: 2,
        activeRadius: 7,
      },
    },
    createPointFigures: (params) => createPositionFigures(params, true),
  })

  registerOverlay({
    name: 'shortPosition',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    styles: {
      point: {
        color: '#2962ff',
        borderColor: '#ffffff',
        borderSize: 1.5,
        radius: 5,
        activeColor: '#2962ff',
        activeBorderColor: '#ffffff',
        activeBorderSize: 2,
        activeRadius: 7,
      },
    },
    createPointFigures: (params) => createPositionFigures(params, false),
  })
}
