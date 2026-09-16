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
  const { overlay, coordinates, bounding, yAxis, xAxis } = params
  if (!overlay || !overlay.points || overlay.points.length === 0) return []

  const entryPoint = overlay.points[0]
  if (!entryPoint || entryPoint.value == null || isNaN(entryPoint.value)) return []

  const entryPrice = entryPoint.value
  const currentStep = overlay.currentStep ?? 3

  const canvasWidth = bounding?.width ?? 1000
  const canvasHeight = bounding?.height ?? 500

  // 1. Calculate yEntry (Y pixel position for Entry Price)
  let yEntry: number | undefined = coordinates?.[0]?.y
  if (yEntry == null || isNaN(yEntry)) {
    if (yAxis && typeof yAxis.convertToPixel === 'function') {
      const py = yAxis.convertToPixel(entryPrice)
      if (py != null && !isNaN(py)) {
        yEntry = py
      }
    }
  }
  if (yEntry == null || isNaN(yEntry)) {
    yEntry = canvasHeight / 2
  }

  // 2. Calculate x0 (X pixel position for Entry Point)
  let x0: number | undefined = coordinates?.[0]?.x
  if ((x0 == null || isNaN(x0)) && xAxis && typeof xAxis.convertToPixel === 'function' && entryPoint) {
    if (entryPoint.dataIndex != null) {
      const px = xAxis.convertToPixel(entryPoint.dataIndex)
      if (px != null && !isNaN(px)) x0 = px
    } else if (entryPoint.timestamp != null) {
      const px = xAxis.convertToPixel(entryPoint.timestamp)
      if (px != null && !isNaN(px)) x0 = px
    }
  }

  const isEntryXInvalid = x0 == null || isNaN(x0)

  // Determine minX and maxX for drawing target/stop loss zone boxes and pills
  let minX: number
  let maxX: number

  if (isEntryXInvalid) {
    // When chart isn't visible yet or entry point is in the future during replay:
    // Display the Stop Loss and Take Profit zone box on the right portion of the chart screen
    minX = Math.max(20, canvasWidth - 320)
    maxX = canvasWidth - 20
  } else {
    // Entry X is valid
    const validX0 = x0!
    let x1 = coordinates?.[1]?.x
    let x2 = coordinates?.[2]?.x

    if ((x1 == null || isNaN(x1)) && xAxis && typeof xAxis.convertToPixel === 'function' && overlay.points[1]) {
      const pt1 = overlay.points[1]
      if (pt1.dataIndex != null) {
        const px = xAxis.convertToPixel(pt1.dataIndex)
        if (px != null && !isNaN(px)) x1 = px
      } else if (pt1.timestamp != null) {
        const px = xAxis.convertToPixel(pt1.timestamp)
        if (px != null && !isNaN(px)) x1 = px
      }
    }

    if ((x2 == null || isNaN(x2)) && xAxis && typeof xAxis.convertToPixel === 'function' && overlay.points[2]) {
      const pt2 = overlay.points[2]
      if (pt2.dataIndex != null) {
        const px = xAxis.convertToPixel(pt2.dataIndex)
        if (px != null && !isNaN(px)) x2 = px
      } else if (pt2.timestamp != null) {
        const px = xAxis.convertToPixel(pt2.timestamp)
        if (px != null && !isNaN(px)) x2 = px
      }
    }

    const valX1 = x1 != null && !isNaN(x1) ? x1 : validX0 + 160
    const valX2 = x2 != null && !isNaN(x2) ? x2 : valX1

    const rawMinX = Math.min(validX0, valX1, valX2)
    const rawMaxX = Math.max(validX0, valX1, valX2)

    if (rawMaxX < 0) {
      minX = 20
      maxX = 200
    } else if (rawMinX > canvasWidth) {
      minX = Math.max(20, canvasWidth - 320)
      maxX = canvasWidth - 20
    } else {
      minX = rawMinX
      maxX = rawMaxX - rawMinX < 40 ? rawMinX + 160 : rawMaxX
    }
  }

  const targetFill = 'rgba(0, 150, 136, 0.25)'
  const targetBorder = '#00a68c'
  const stopFill = 'rgba(215, 60, 60, 0.28)'
  const stopBorder = '#c62828'

  // STEP 1: Click 1 placed (Entry). User is dragging cursor to set Target price & box width.
  if (currentStep === 1) {
    let cursorPrice = overlay.points[1]?.value
    let yTarget: number | undefined = coordinates?.[1]?.y
    if (cursorPrice == null || isNaN(cursorPrice)) {
      if (yTarget != null && !isNaN(yTarget) && yAxis && typeof yAxis.convertFromPixel === 'function') {
        cursorPrice = yAxis.convertFromPixel(yTarget)
      } else {
        cursorPrice = isLong ? entryPrice * 1.02 : entryPrice * 0.98
      }
    }
    if (yTarget == null || isNaN(yTarget)) {
      if (yAxis && typeof yAxis.convertToPixel === 'function') {
        const py = yAxis.convertToPixel(cursorPrice)
        if (py != null && !isNaN(py)) yTarget = py
      }
    }
    if (yTarget == null || isNaN(yTarget)) {
      yTarget = isLong ? yEntry - 80 : yEntry + 80
    }

    const centerX = minX + (maxX - minX) / 2
    const targetDiff = Math.abs(cursorPrice - entryPrice)
    const targetPct = entryPrice ? (targetDiff / entryPrice) * 100 : 0
    const targetPips = calculatePips(targetDiff, entryPrice)
    const targetAmount = (targetDiff * 616.7).toFixed(2)
    const targetText = `Target: ${formatIntOrDec(targetDiff, 3)} (${targetPct.toFixed(3)}%) ${targetPips}, Amount: ${targetAmount}`

    const figures: OverlayFigure[] = []

    // Horizontal guide line across chart for target
    figures.push({
      type: 'line',
      attrs: {
        coordinates: [
          { x: 0, y: yTarget },
          { x: canvasWidth, y: yTarget },
        ],
      },
      styles: { color: targetBorder, size: 1, style: 'dashed', dashedValue: [4, 4] },
    })

    // Target Zone Polygon
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
          { x: 0, y: yEntry },
          { x: canvasWidth, y: yEntry },
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
  let targetPrice = overlay.points[1]?.value
  if (targetPrice == null || isNaN(targetPrice)) {
    targetPrice = isLong ? entryPrice * 1.01867 : entryPrice * 0.98133
  }

  let yTarget: number | undefined = coordinates?.[1]?.y
  if (yTarget == null || isNaN(yTarget) || currentStep === 3) {
    if (yAxis && typeof yAxis.convertToPixel === 'function') {
      const py = yAxis.convertToPixel(targetPrice)
      if (py != null && !isNaN(py)) yTarget = py
    }
  }
  if (yTarget == null || isNaN(yTarget)) {
    yTarget = isLong ? yEntry - 100 : yEntry + 100
  }

  let stopPrice = overlay.points[2]?.value
  if (stopPrice == null || isNaN(stopPrice)) {
    if (currentStep === 2 && coordinates?.[2]?.y != null && !isNaN(coordinates[2].y) && yAxis && typeof yAxis.convertFromPixel === 'function') {
      stopPrice = yAxis.convertFromPixel(coordinates[2].y)
    } else {
      stopPrice = isLong ? entryPrice * 0.952 : entryPrice * 1.048
    }
  }

  let yStop: number | undefined = coordinates?.[2]?.y
  if (yStop == null || isNaN(yStop) || currentStep === 3) {
    if (yAxis && typeof yAxis.convertToPixel === 'function') {
      const py = yAxis.convertToPixel(stopPrice)
      if (py != null && !isNaN(py)) yStop = py
    }
  }
  if (yStop == null || isNaN(yStop)) {
    yStop = isLong ? yEntry + 140 : yEntry - 140
  }

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

  // Horizontal dashed guide line across full screen for Take Profit
  figures.push({
    type: 'line',
    attrs: {
      coordinates: [
        { x: 0, y: yTarget },
        { x: canvasWidth, y: yTarget },
      ],
    },
    styles: {
      color: targetBorder,
      size: 1,
      style: 'dashed',
      dashedValue: [5, 4],
    },
  })

  // Horizontal dashed guide line across full screen for Stop Loss
  figures.push({
    type: 'line',
    attrs: {
      coordinates: [
        { x: 0, y: yStop },
        { x: canvasWidth, y: yStop },
      ],
    },
    styles: {
      color: stopBorder,
      size: 1,
      style: 'dashed',
      dashedValue: [5, 4],
    },
  })

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

  // 3. Entry Line across full width
  figures.push({
    type: 'line',
    attrs: {
      coordinates: [
        { x: 0, y: yEntry },
        { x: canvasWidth, y: yEntry },
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
        borderSize: 2,
        radius: 8,
        activeColor: '#2962ff',
        activeBorderColor: '#ffffff',
        activeBorderSize: 3,
        activeRadius: 14,
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
        borderSize: 2,
        radius: 8,
        activeColor: '#2962ff',
        activeBorderColor: '#ffffff',
        activeBorderSize: 3,
        activeRadius: 14,
      },
    },
    createPointFigures: (params) => createPositionFigures(params, false),
  })
}
