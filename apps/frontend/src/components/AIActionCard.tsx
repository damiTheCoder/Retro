import React from 'react'
import type { ChartActionPayload } from '../utils/chartActionStore'
import { LineChartIcon, BookOpenIcon, SparklesIcon, CheckCircle2Icon } from './ShadcnIcons'
import './AIActionCard.css'

interface AIActionCardProps {
  action: ChartActionPayload
  onNavigateToPage?: (page: 'chart' | 'journal' | 'analytics' | 'aichat', symbol?: string, timeframe?: string) => void
}

export function AIActionCard({ action, onNavigateToPage }: AIActionCardProps) {
  if (!action) return null

  const isChartAction = action.type === 'draw_setup' || action.type === 'switch_chart' || action.type === 'activate_tool' || action.type === 'start_replay'
  const isJournalAction = action.type === 'log_trade'

  const handleActionClick = () => {
    if (!onNavigateToPage) return

    if (isChartAction) {
      onNavigateToPage('chart', action.symbol, action.timeframe)
    } else if (isJournalAction) {
      onNavigateToPage('journal')
    }
  }

  return (
    <div className="ai-action-card">
      <div className="ai-action-card-header">
        <div className="ai-action-card-title-group">
          <span className="ai-action-card-icon">
            {isJournalAction ? <BookOpenIcon width="16" height="16" /> : <LineChartIcon width="16" height="16" />}
          </span>
          <span>{action.title || (isJournalAction ? 'Trade Auto-Logged' : 'Live Chart Action')}</span>
        </div>

        <div className="ai-action-card-badges">
          {action.symbol && (
            <span className="ai-action-badge symbol-badge">{action.symbol}</span>
          )}
          {action.timeframe && (
            <span className="ai-action-badge">{action.timeframe}</span>
          )}
        </div>
      </div>

      {action.description && (
        <div className="ai-action-card-body">{action.description}</div>
      )}

      {action.drawings && action.drawings.length > 0 && (
        <div className="ai-action-drawings-list">
          {action.drawings.map((d, i) => (
            <div key={i} className="ai-action-drawing-item">
              <span className="ai-action-bullet" />
              <span>
                <strong>{d.label || d.name}</strong>
                {d.points && d.points[0]?.value != null && (
                  <span> @ {d.points[0].value.toLocaleString()}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {isJournalAction && action.tradeData && (
        <div className="ai-action-drawings-list">
          <div className="ai-action-drawing-item">
            <span className="ai-action-bullet" />
            <span>
              <strong>{action.tradeData.type} {action.tradeData.symbol}</strong> @ ${action.tradeData.entryPrice?.toLocaleString()} ({action.tradeData.outcome} {action.tradeData.pnlAmount ? (action.tradeData.pnlAmount >= 0 ? `+$${action.tradeData.pnlAmount}` : `-$${Math.abs(action.tradeData.pnlAmount)}`) : ''})
            </span>
          </div>
        </div>
      )}

      <div className="ai-action-card-footer">
        {isChartAction && (
          <button className="ai-action-primary-btn" onClick={handleActionClick}>
            <LineChartIcon width="14" height="14" />
            <span>View on Live Chart</span>
          </button>
        )}
        {isJournalAction && (
          <button className="ai-action-primary-btn" onClick={handleActionClick}>
            <BookOpenIcon width="14" height="14" />
            <span>Open Trade Journal</span>
          </button>
        )}
      </div>
    </div>
  )
}
