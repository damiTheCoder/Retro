import TradingChestChart from './components/TradingChestChart'
import BacktestPanel from './components/BacktestPanel'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Asset Charts</h1>
        <p>Search and chart any crypto asset in real-time</p>
      </header>
      <main className="app-main">
        <div className="app-main-chart">
          <TradingChestChart />
        </div>
        <div className="app-main-sidebar">
          <BacktestPanel />
        </div>
      </main>
    </div>
  )
}

export default App
