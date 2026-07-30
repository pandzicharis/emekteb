import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ImportPage from './pages/ImportPage';
import SetupNastavnaGodinaPage from './pages/SetupNastavnaGodinaPage';
import NastavniPlanPage from './pages/NastavniPlanPage';
import UpravljanjeLekcijamaPage from './pages/UpravljanjeLekcijamaPage';
import MuallimiPage from './pages/MuallimiPage';
import BazaPodatakaPage from './pages/BazaPodatakaPage';
import CasoviPage from './pages/CasoviPage';
import UceniciPage from './pages/UceniciPage';
import SkolaHifzaPage from './pages/SkolaHifzaPage';
import ReportsPage from './pages/ReportsPage';
import YearConclusionPage from './pages/YearConclusionPage';
import SlobodniDaniPage from './pages/SlobodniDaniPage';
import DiplomaBuilderPage from './pages/DiplomaBuilderPage';
import ProtectedRoute from './components/ProtectedRoute';
import RoditeljDijeteDetailPage from './pages/RoditeljDijeteDetailPage';
import RoditeljCalendarPage from './pages/RoditeljCalendarPage';
import RoditeljStatisticsPage from './pages/RoditeljStatisticsPage';
import RoditeljNotificationsPage from './pages/RoditeljNotificationsPage';
import RoditeljProfileSettingsPage from './pages/RoditeljProfileSettingsPage';
import RoditeljHomeworkPage from './pages/RoditeljHomeworkPage';
import KomunikacijaPage from './pages/KomunikacijaPage';

function AppContent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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

  return (
    <Router>
      {!isAuthenticated ? (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <div className="flex h-screen bg-gray-50">
          <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />

          {/* Main Content */}
          <div
            className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${
              isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
            }`}
            style={{ willChange: 'margin-left' }}
          >
            <TopBar />
            <main className="flex-1 overflow-y-auto">
              <Routes>
                <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                <Route path="/import" element={<ProtectedRoute allowedRoles={['ADMIN']}><ImportPage /></ProtectedRoute>} />
                <Route path="/setup-nastavna-godina" element={<ProtectedRoute><SetupNastavnaGodinaPage /></ProtectedRoute>} />
                <Route path="/nastavni-plan" element={<ProtectedRoute><NastavniPlanPage /></ProtectedRoute>} />
                <Route path="/lekcije" element={<ProtectedRoute><UpravljanjeLekcijamaPage /></ProtectedRoute>} />
                <Route path="/casovi" element={<ProtectedRoute><CasoviPage /></ProtectedRoute>} />
                <Route path="/ucenici" element={<ProtectedRoute><UceniciPage /></ProtectedRoute>} />
                <Route path="/skola-hifza" element={<ProtectedRoute allowedRoles={['MUALLIM']}><SkolaHifzaPage /></ProtectedRoute>} />
                <Route path="/izvjestaji" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
                <Route path="/zakljucivanje-godine" element={<ProtectedRoute><YearConclusionPage /></ProtectedRoute>} />
                <Route path="/diplome-builder" element={<ProtectedRoute allowedRoles={['MUALLIM']}><DiplomaBuilderPage /></ProtectedRoute>} />
                <Route path="/slobodni-dani" element={<ProtectedRoute allowedRoles={['ADMIN']}><SlobodniDaniPage /></ProtectedRoute>} />
                <Route path="/settings/muallimi" element={<ProtectedRoute allowedRoles={['ADMIN']}><MuallimiPage /></ProtectedRoute>} />
                <Route path="/settings/baza" element={<ProtectedRoute allowedRoles={['ADMIN']}><BazaPodatakaPage /></ProtectedRoute>} />
                {/* Roditelj routes */}
                <Route path="/roditelj/dijete/:id" element={<ProtectedRoute allowedRoles={['RODITELJ']}><RoditeljDijeteDetailPage /></ProtectedRoute>} />
                <Route path="/roditelj/kalendar" element={<ProtectedRoute allowedRoles={['RODITELJ']}><RoditeljCalendarPage /></ProtectedRoute>} />
                <Route path="/roditelj/statistike" element={<ProtectedRoute allowedRoles={['RODITELJ']}><RoditeljStatisticsPage /></ProtectedRoute>} />
                <Route path="/roditelj/obavjestenja" element={<ProtectedRoute allowedRoles={['RODITELJ']}><RoditeljNotificationsPage /></ProtectedRoute>} />
                <Route path="/roditelj/zadace" element={<ProtectedRoute allowedRoles={['RODITELJ']}><RoditeljHomeworkPage /></ProtectedRoute>} />
                <Route path="/roditelj/postavke" element={<ProtectedRoute allowedRoles={['RODITELJ']}><RoditeljProfileSettingsPage /></ProtectedRoute>} />
                <Route path="/komunikacija" element={<ProtectedRoute><KomunikacijaPage /></ProtectedRoute>} />
                <Route path="/login" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      )}
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

