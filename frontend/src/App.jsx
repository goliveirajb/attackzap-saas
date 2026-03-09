import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Instances from "./pages/Instances";
import Automations from "./pages/Automations";
import ScheduledMessages from "./pages/ScheduledMessages";
import Groups from "./pages/Groups";
import Settings from "./pages/Settings";

function PrivateRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="instances" element={<Instances />} />
        <Route path="groups" element={<Groups />} />
        <Route path="flows" element={<Automations />} />
        <Route path="automations" element={<Automations />} />
        <Route path="scheduled-messages" element={<ScheduledMessages />} />
        <Route path="settings" element={<Settings />} />
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
