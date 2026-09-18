import { useState, useEffect } from 'react'
import {
  getChatThreads,
  getActiveThreadId,
  setActiveThreadId,
  createNextChatThread,
  deleteChatThread,
  subscribeChat,
  type ChatThread,
} from '../utils/chatStore'
import { ChartLineUpIcon, BookOpenIcon, LineChartIcon, AnthropicIcon } from './ShadcnIcons'
import './Sidebar.css'

export type NavPage = 'chart' | 'journal' | 'analytics' | 'aichat'

interface SidebarProps {
  activePage: NavPage
  onSelectPage: (page: NavPage) => void
  collapsed?: boolean
}

export function Sidebar({ activePage, onSelectPage, collapsed = false }: SidebarProps) {
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [activeThreadId, setActiveId] = useState<string>('')

  const syncChat = () => {
    setThreads(getChatThreads())
    setActiveId(getActiveThreadId())
  }

  useEffect(() => {
    syncChat()
    const unsubscribe = subscribeChat(syncChat)
    return () => unsubscribe()
  }, [])

  const handleSelectThread = (threadId: string) => {
    setActiveThreadId(threadId)
    onSelectPage('aichat')
  }

  const handleCreateNewChat = (e: React.MouseEvent) => {
    e.stopPropagation()
    createNextChatThread()
    onSelectPage('aichat')
  }

  const handleDeleteThread = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    deleteChatThread(id)
  }

  return (
    <aside className={`shadcn-sidebar${collapsed ? ' collapsed' : ''}`}>
      {/* Sidebar Header with Logo */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <img src="/Logo.jpeg" alt="Logo" className="sidebar-logo" />
          <span className="sidebar-brand-title">Chart Rabbit</span>
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
                <span className="menu-icon"><ChartLineUpIcon width="18" height="18" /></span>
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
                <span className="menu-icon"><BookOpenIcon width="18" height="18" /></span>
                <span className="menu-text">Journal & Strategy</span>
              </button>
            </div>

            <div className="sidebar-menu-item">
              <button
                className={`sidebar-menu-button ${activePage === 'analytics' ? 'active' : ''}`}
                onClick={() => onSelectPage('analytics')}
                title="Analytics & PnL"
              >
                <span className="menu-icon"><LineChartIcon width="18" height="18" /></span>
                <span className="menu-text">Analytics & PnL</span>
              </button>
            </div>
          </div>
        </div>

        {/* AI Assistant & Chat History Group */}
        <div className="sidebar-group">
          <div className="sidebar-group-header">
            <span className="sidebar-group-label">AI Assistant</span>
            <button
              className="sidebar-add-chat-btn"
              onClick={handleCreateNewChat}
              title="Add New Chat"
            >
              <span>+ New</span>
            </button>
          </div>

          <div className="sidebar-menu">
            <div className="sidebar-menu-item">
              <button
                className={`sidebar-menu-button ${activePage === 'aichat' ? 'active' : ''}`}
                onClick={() => onSelectPage('aichat')}
                title="AI Trading Assistant"
              >
                <span className="menu-icon"><AnthropicIcon width="18" height="18" /></span>
                <span className="menu-text">AI Trading Assistant</span>
              </button>
            </div>
          </div>

          {/* Chat History List */}
          <div className="chat-history-section" style={{ display: 'none' }}>
            <div className="history-section-title">Recent Chat History</div>
            <div className="history-list">
              {threads.length === 0 ? (
                <div className="empty-history-text">No chats yet</div>
              ) : (
                threads.map((thread) => {
                  const isActive = activePage === 'aichat' && activeThreadId === thread.id
                  return (
                    <div
                      key={thread.id}
                      className={`history-item ${isActive ? 'active' : ''}`}
                      onClick={() => handleSelectThread(thread.id)}
                    >
                      <span className="history-title">{thread.title}</span>
                      <button
                        className="history-delete-btn"
                        onClick={(e) => handleDeleteThread(e, thread.id)}
                        title="Delete chat"
                      >
                        Delete
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        <div className="user-profile-card">
          <div className="user-avatar">
            <span>PT</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
