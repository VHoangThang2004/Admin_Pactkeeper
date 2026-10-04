import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { DashboardOverview } from './pages/DashboardOverview';
import { PlayerManagement } from './pages/PlayerManagement';
import { GachaManagement } from './pages/GachaManagement';
import { ContentManagement } from './pages/ContentManagement';
import { PaymentManagement } from './pages/PaymentManagement';
import { LiveSupport } from './pages/LiveSupport';

export const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('adminToken'));
  const [adminName, setAdminName] = useState<string>(localStorage.getItem('adminName') || 'System Admin');

  const handleLoginSuccess = (newToken: string, name: string) => {
    localStorage.setItem('adminToken', newToken);
    localStorage.setItem('adminName', name);
    setToken(newToken);
    setAdminName(name);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminName');
    setToken(null);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={!token ? <Login onLoginSuccess={handleLoginSuccess} /> : <Navigate to="/" replace />}
        />
        <Route
          element={token ? <Layout adminName={adminName} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
        >
          <Route path="/" element={<DashboardOverview />} />
          <Route path="/players" element={<PlayerManagement />} />
          <Route path="/gacha" element={<GachaManagement />} />
          <Route path="/content" element={<ContentManagement />} />
          <Route path="/payments" element={<PaymentManagement />} />
          <Route path="/support" element={<LiveSupport />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
