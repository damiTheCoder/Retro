import { useState } from 'react'
import { Sidebar, type NavPage } from './components/Sidebar'
import TradingChestChart from './components/TradingChestChart'
import { JournalPage } from './components/JournalPage'
import { AnalyticsPage } from './components/AnalyticsPage'
import { PanelLeftIcon } from './components/ShadcnIcons'
import { MobileBottomNav } from './components/MobileBottomNav'
import './App.css'

function App() {
  const [activePage, setActivePage] = useState<NavPage>('chart')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const handleSelectPage = (page: NavPage) => {
    setActivePage(page)
  }

  return (
    <div className="app-root">
      <div className="app-workspace">
        {/* Desktop Sidebar Navigation */}
        {sidebarOpen && (
          <Sidebar activePage={activePage} onSelectPage={handleSelectPage} />
        )}

        {/* Main Page Area */}
        <main className="app-content">
          {/* Top Header Bar inside the page area */}
          <header className="page-top-header">
            <div className="top-header-left">
              <button
                className="header-sidebar-toggle-btn"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                title={sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
              >
                <PanelLeftIcon className="toggle-icon" />
              </button>
              
              {/* Visible on Mobile View (since Sidebar is hidden on mobile) */}
              <div className="mobile-header-brand">
                <img src="/Logo.jpeg" alt="Logo" className="mobile-header-logo" />
                <span className="mobile-header-title">chart rabbit</span>
              </div>
            </div>
          </header>

          {/* Page Content Views */}
          {activePage === 'chart' && (
            <div className="page-view chart-page-view">
              <TradingChestChart />
            </div>
          )}

          {activePage === 'journal' && (
            <div className="page-view">
              <JournalPage />
            </div>
          )}

          {activePage === 'analytics' && (
            <div className="page-view">
              <AnalyticsPage />
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav activePage={activePage} onSelectPage={handleSelectPage} />
    </div>
  )
}

export default App
