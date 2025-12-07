import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import DashboardPage from './pages/DashboardPage';
import ImportPage from './pages/ImportPage';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <Router>
      <div className="flex h-screen bg-gray-50">
        <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />
        
        {/* Main Content */}
        <div
          className={`flex-1 transition-all duration-300 ease-in-out ${
            isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
          }`}
          style={{ willChange: 'margin-left' }}
        >
          <main className="h-full overflow-y-auto">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/import" element={<ImportPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;

