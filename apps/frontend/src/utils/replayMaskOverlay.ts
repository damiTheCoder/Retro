import { registerOverlay } from 'klinecharts'
import type { OverlayCreateFiguresCallbackParams, OverlayFigure } from 'klinecharts'

export const REPLAY_MASK_OVERLAY_NAME = 'replay-mask'
export const REPLAY_MASK_OVERLAY_ID = 'replay-mask-overlay'

export function registerReplayMaskOverlay(): void {
  registerOverlay({
    name: REPLAY_MASK_OVERLAY_NAME,
    totalStep: 1,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    styles: {},
    createPointFigures: (params: OverlayCreateFiguresCallbackParams): OverlayFigure[] => {
      const { overlay, coordinates, bounding, barSpace, xAxis } = params
      const state = overlay.extendData || {}
      if (state.isAtEnd) return []

      const timestamp = state.fromTimestamp ?? overlay.points?.[0]?.timestamp
      if (!timestamp) return []

      const canvasWidth = bounding?.width ?? 2000
      const canvasHeight = bounding?.height ?? 1000

      let fromX: number | undefined = coordinates?.[0]?.x
      if ((fromX == null || isNaN(fromX)) && xAxis && typeof xAxis.convertToPixel === 'function') {
        const px = xAxis.convertToPixel(timestamp)
        if (px != null && !isNaN(px)) {
          fromX = px
        }
      }

      if (fromX == null || isNaN(fromX)) {
        return []
      }

      const halfBar = barSpace?.bar ? barSpace.bar / 2 : 4
      const maskX = Math.max(0, fromX + halfBar)
      const maskWidth = Math.max(0, canvasWidth - maskX + 200)

      if (maskWidth <= 0) return []

      const isDark = typeof document !== 'undefined' && (
        document.body.classList.contains('dark') ||
        document.documentElement.classList.contains('dark') ||
        document.querySelector('.klinecharts-pro-dark') !== null
      )

      // Solid backdrop matching theme to hide future candles cleanly
      const maskColor = isDark ? 'rgba(21, 21, 23, 0.96)' : 'rgba(255, 255, 255, 0.96)'
      const cutLineColor = isDark ? 'rgba(59, 130, 246, 0.85)' : 'rgba(37, 99, 235, 0.85)'

      const figures: OverlayFigure[] = [
        {
          type: 'rect',
          attrs: {
            x: maskX,
            y: 0,
            width: maskWidth,
            height: canvasHeight,
          },
          styles: {
            style: 'fill',
            color: maskColor,
          },
          ignoreEvent: true,
        },
        {
          type: 'line',
          attrs: {
            coordinates: [
              { x: fromX + halfBar, y: 0 },
              { x: fromX + halfBar, y: canvasHeight },
            ],
          },
          styles: {
            style: 'dashed',
            dashedValue: [4, 4],
            color: cutLineColor,
            size: 2,
          },
          ignoreEvent: true,
        },
      ]

      return figures
    },
  })
}
