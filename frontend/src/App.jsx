import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Instances from "./pages/Instances";
import Automations from "./pages/Automations";
import CRM from "./pages/CRM";
import Conversations from "./pages/Conversations";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";

function PrivateRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace state={{ from: "/app" }} />;
}

// Mobile goes to conversations, desktop goes to dashboard
function MobileRedirect() {
  const isMobile = window.innerWidth < 768;
  return isMobile ? <Navigate to="/app/conversations" replace /> : <Dashboard />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/home" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/app"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<MobileRedirect />} />
        <Route path="instances" element={<Instances />} />
        <Route path="conversations" element={<Conversations />} />
        <Route path="crm" element={<CRM />} />
        <Route path="flows" element={<Automations />} />
        <Route path="automations" element={<Automations />} />
        <Route path="settings" element={<Settings />} />
        <Route path="admin" element={<Admin />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
