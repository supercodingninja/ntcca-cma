// Copyright © 2026 Reverend Frederick D. Thomas, Jr. — All Rights Reserved.
// Unauthorized use is strictly prohibited.

import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import Login from './pages/Login';
import Home from './pages/Home';
import './App.css';

// ==========================================================================
// This Area Of Code Is: Church Context Provider
// Explanation: Global state for the currently selected NTCC church.
//              Persists to localStorage so refresh doesn't lose it.
// In Other Words: Every screen knows which church family you're in.
// ==========================================================================
export interface ChurchContextValue {
  selectedChurchId: string | null;
  setSelectedChurchId: (id: string | null) => void;
}

const ChurchContext = createContext<ChurchContextValue>({
  selectedChurchId: null,
  setSelectedChurchId: () => {},
});

export const useChurch = () => useContext(ChurchContext);

// ==========================================================================
// This Area Of Code Is: Auth Guard / Protected Route
// Explanation: Wraps every authenticated route. Redirects to /login if
//              the user is not signed in. Shows a loading state while
//              auth initializes to prevent flash-of-login.
// In Other Words: The bouncer that keeps strangers out of the app.
// ==========================================================================
function AuthGuard() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        <div className="text-white text-base animate-pulse">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

// ==========================================================================
// This Area Of Code Is: App Shell Layout
// Explanation: The visual frame around every authenticated page.
//              Sets the black background, full-height shell, and
//              overflow rules so sections can't break the viewport.
// In Other Words: The container that holds the entire app experience.
// ==========================================================================
function AppShell({ children }: { children?: ReactNode }) {
  return (
    <div className="app-shell relative min-h-screen w-full overflow-x-hidden bg-black text-white selection:bg-amber-500/30">
      {children ?? <Outlet />}
    </div>
  );
}

// ==========================================================================
// This Area Of Code Is: Root Application Component
// Explanation: Boots the router, auth provider, church context, and theme.
//              All global providers live here. Routes are flat:
//              /login = public landing, everything else = protected.
// In Other Words: This is the ignition switch for the entire NTCC Music App.
// ==========================================================================
export default function App() {
  const [selectedChurchId, setSelectedChurchId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('ntcc-selected-church');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (selectedChurchId) {
      localStorage.setItem('ntcc-selected-church', selectedChurchId);
    }
  }, [selectedChurchId]);

  return (
    <ChurchContext.Provider value={{ selectedChurchId, setSelectedChurchId }}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<Login />} />

            {/* Protected routes */}
            <Route element={<AuthGuard />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<Home />} />
                <Route path="/home" element={<Home />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ChurchContext.Provider>
  );
}
