import {
  CandlestickChartIcon,
  BookOpenIcon,
  LineChartIcon,
  ActivityIcon,
} from './ShadcnIcons'
import './Sidebar.css'

export type NavPage = 'chart' | 'journal' | 'analytics'

interface SidebarProps {
  activePage: NavPage
  onSelectPage: (page: NavPage) => void
}

export function Sidebar({ activePage, onSelectPage }: SidebarProps) {
  return (
    <aside className="shadcn-sidebar">
      {/* Sidebar Header with Logo */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <img src="/Logo.jpeg" alt="Logo" className="sidebar-logo" />
          <span className="sidebar-brand-title">chart rabbit</span>
        </div>
      </div>

      {/* Sidebar Content */}
      <div className="sidebar-content">
        {/* Navigation Group */}
        <div className="sidebar-group">
          <div className="sidebar-group-label">Trading Platform</div>
          <div className="sidebar-menu">
            <div className="sidebar-menu-item">
              <button
                className={`sidebar-menu-button ${activePage === 'chart' ? 'active' : ''}`}
                onClick={() => onSelectPage('chart')}
                title="Live Chart"
              >
                <CandlestickChartIcon className="menu-icon" />
                <span className="menu-text">Live Chart</span>
              </button>
            </div>
          </div>
        </div>

        {/* Analytics & Journal Group */}
        <div className="sidebar-group">
          <div className="sidebar-group-label">Analysis & Performance</div>
          <div className="sidebar-menu">
            <div className="sidebar-menu-item">
              <button
                className={`sidebar-menu-button ${activePage === 'journal' ? 'active' : ''}`}
                onClick={() => onSelectPage('journal')}
                title="Journal & Strategy"
              >
                <BookOpenIcon className="menu-icon" />
                <span className="menu-text">Journal & Strategy</span>
              </button>
            </div>

            <div className="sidebar-menu-item">
              <button
                className={`sidebar-menu-button ${activePage === 'analytics' ? 'active' : ''}`}
                onClick={() => onSelectPage('analytics')}
                title="Analytics & PnL"
              >
                <LineChartIcon className="menu-icon" />
                <span className="menu-text">Analytics & PnL</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        <div className="user-profile-card">
          <div className="user-avatar">
            <span>h</span>
          </div>
          <div className="user-info">
            <span className="user-name">Pro Trader</span>
            <span className="user-status">
              <ActivityIcon className="activity-dot" /> Multi-Asset Active
            </span>
          </div>
        </div>
      </div>
    </aside>
  )
}
