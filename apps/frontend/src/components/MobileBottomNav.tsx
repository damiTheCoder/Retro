import type { NavPage } from './Sidebar'
import {
  CandlestickChartIcon,
  BookOpenIcon,
  LineChartIcon,
  MessageSquareIcon,
} from './ShadcnIcons'
import './MobileBottomNav.css'

interface MobileBottomNavProps {
  activePage: NavPage
  onSelectPage: (page: NavPage) => void
}

export function MobileBottomNav({
  activePage,
  onSelectPage,
}: MobileBottomNavProps) {
  return (
    <nav className="mobile-bottom-nav">
      <button
        className={`bottom-nav-item ${activePage === 'chart' ? 'active' : ''}`}
        onClick={() => onSelectPage('chart')}
      >
        <CandlestickChartIcon className="nav-icon" />
        <span className="nav-label">Live Chart</span>
      </button>

      <button
        className={`bottom-nav-item ${activePage === 'journal' ? 'active' : ''}`}
        onClick={() => onSelectPage('journal')}
      >
        <BookOpenIcon className="nav-icon" />
        <span className="nav-label">Journal</span>
      </button>

      <button
        className={`bottom-nav-item ${activePage === 'analytics' ? 'active' : ''}`}
        onClick={() => onSelectPage('analytics')}
      >
        <LineChartIcon className="nav-icon" />
        <span className="nav-label">Analytics</span>
      </button>

      <button
        className={`bottom-nav-item ${activePage === 'aichat' ? 'active' : ''}`}
        onClick={() => onSelectPage('aichat')}
      >
        <MessageSquareIcon className="nav-icon" />
        <span className="nav-label">AI Chat</span>
      </button>
    </nav>
  )
}
