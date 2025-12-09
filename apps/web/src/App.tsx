import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ImportPage from './pages/ImportPage';
import SetupNastavnaGodinaPage from './pages/SetupNastavnaGodinaPage';
import NastavniPlanPage from './pages/NastavniPlanPage';
import ProtectedRoute from './components/ProtectedRoute';

function AppContent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { isAuthenticated, isLoading } = useAuth();

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    );
  }

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
              <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/import" element={<ProtectedRoute allowedRoles={['ADMIN']}><ImportPage /></ProtectedRoute>} />
              <Route path="/setup-nastavna-godina" element={<ProtectedRoute><SetupNastavnaGodinaPage /></ProtectedRoute>} />
              <Route path="/nastavni-plan" element={<ProtectedRoute><NastavniPlanPage /></ProtectedRoute>} />
              <Route path="/login" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

