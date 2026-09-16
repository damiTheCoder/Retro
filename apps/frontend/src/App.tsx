import { useState, useEffect } from 'react'
import { Sidebar, type NavPage } from './components/Sidebar'
import TradingChestChart from './components/TradingChestChart'
import { JournalPage } from './components/JournalPage'
import { AnalyticsPage } from './components/AnalyticsPage'
import { AIChatPage } from './components/AIChatPage'
import { PlusIcon } from './components/ShadcnIcons'
import { MobileBottomNav } from './components/MobileBottomNav'
import {
  getChatThreads,
  getActiveThreadId,
  setActiveThreadId as setStoreActiveThreadId,
  createNextChatThread,
  deleteChatThread,
  subscribeChat,
  type ChatThread,
} from './utils/chatStore'
import './App.css'

function App() {
  const [activePage, setActivePage] = useState<NavPage>('chart')
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string>('')

  const syncChatData = () => {
    setThreads(getChatThreads())
    setActiveThreadId(getActiveThreadId())
  }

  useEffect(() => {
    syncChatData()
    const unsubscribe = subscribeChat(syncChatData)
    return () => unsubscribe()
  }, [])

  const [historyMenuOpen, setHistoryMenuOpen] = useState(false)

  const currentThread = threads.find((t) => t.id === activeThreadId)

  const handleNewChat = () => {
    createNextChatThread()
    setActivePage('aichat')
  }

  const handleDeleteCurrentThread = () => {
    if (currentThread) {
      deleteChatThread(currentThread.id)
    }
  }

  const handleSelectPage = (page: NavPage) => {
    setActivePage(page)
  }

  return (
    <div className="app-root">
      <div className="app-workspace">
        {/* Desktop Sidebar Navigation */}
        <Sidebar activePage={activePage} onSelectPage={handleSelectPage} />

        {/* Main Page Area */}
        <main className="app-content">
          {/* Top Header Bar inside the page area (Always visible across all pages) */}
          <header className="page-top-header">
            <div className="top-header-left">
              {/* Visible on Mobile View (since Sidebar is hidden on mobile) */}
              <div className="mobile-header-brand">
                <img src="/Logo.jpeg" alt="Logo" className="mobile-header-logo" />
                <span className="mobile-header-title">Chart Rabbit</span>
              </div>
            </div>

            {/* Header Right Actions (Always Visible Across All Pages) */}
            <div className="top-header-right-actions">
              <button className="new-chat-btn" onClick={handleNewChat} title="Start new AI conversation">
                <PlusIcon /> <span>New Chat</span>
              </button>

              <div className="history-dropdown-container">
                <button
                  className="history-menu-btn"
                  onClick={() => setHistoryMenuOpen(!historyMenuOpen)}
                  title="Chat History"
                >
                  <span>History</span>
                </button>

                {historyMenuOpen && (
                  <div className="history-menu-popover">
                    <div className="history-menu-header">Chat History</div>
                    <div className="history-menu-list">
                      {threads.length === 0 ? (
                        <div className="history-empty-item">No past chats</div>
                      ) : (
                        threads.map((t) => (
                          <button
                            key={t.id}
                            className={`history-menu-item ${t.id === activeThreadId ? 'active' : ''}`}
                            onClick={() => {
                              setStoreActiveThreadId(t.id)
                              setActivePage('aichat')
                              setHistoryMenuOpen(false)
                            }}
                          >
                            <span className="history-item-title">{t.title}</span>
                          </button>
                        ))
                      )}
                    </div>
                    {currentThread && (
                      <div className="history-menu-footer">
                        <button
                          className="history-delete-current-btn"
                          onClick={() => {
                            handleDeleteCurrentThread()
                            setHistoryMenuOpen(false)
                          }}
                        >
                          Delete Current Chat
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Page Content Views */}
          {activePage === 'chart' && (
            <div className="page-view chart-page-view">
              <TradingChestChart onNavigateToJournal={() => handleSelectPage('journal')} />
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

          {activePage === 'aichat' && (
            <div className="page-view">
              <AIChatPage />
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
