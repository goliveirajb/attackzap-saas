import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useState } from "react";
import {
  FaHome,
  FaWhatsapp,
  FaProjectDiagram,
  FaCog,
  FaSignOutAlt,
  FaUsers,
  FaComments,
  FaBars,
  FaTimes,
  FaUserShield,
} from "react-icons/fa";

const getMenuSections = (role) => {
  const sections = [
    {
      label: "GERAL",
      links: [
        { to: "/app", label: "Dashboard", icon: FaHome },
      ],
    },
    {
      label: "CRM",
      links: [
        { to: "/app/conversations", label: "Conversas", icon: FaComments },
        { to: "/app/crm", label: "Contatos", icon: FaUsers },
      ],
    },
    {
      label: "WHATSAPP",
      links: [
        { to: "/app/instances", label: "Conexoes", icon: FaWhatsapp },
      ],
    },
    {
      label: "AUTOMACOES",
      links: [
        { to: "/app/flows", label: "Fluxos", icon: FaProjectDiagram },
      ],
    },
    {
      label: "SISTEMA",
      links: [
        { to: "/app/settings", label: "Configuracoes", icon: FaCog },
      ],
    },
  ];

  if (role === "admin") {
    sections.push({
      label: "ADMIN",
      links: [
        { to: "/app/admin", label: "Gerenciar Clientes", icon: FaUserShield },
      ],
    });
  }

  return sections;
};

// Bottom nav items for mobile
const getBottomNavItems = () => {
  const items = [
    { to: "/app/conversations", label: "Conversas", icon: FaComments },
    { to: "/app/crm", label: "Contatos", icon: FaUsers },
    { to: "/app/flows", label: "Fluxos", icon: FaProjectDiagram },
  ];
  return items;
};

export default function Layout() {
  const { user, logout, totalUnread } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isConversations = location.pathname.includes("/conversations");

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const closeSidebar = () => setSidebarOpen(false);

  const allLinks = getMenuSections(user?.role).flatMap((s) => s.links);

  return (
    <div className="min-h-screen flex">
      {/* Overlay when sidebar is open */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40" onClick={closeSidebar} />
      )}

      {/* Desktop sidebar - always collapsed (icons only) */}
      <aside className="fixed md:static inset-y-0 left-0 z-50 w-[72px] bg-dark-card border-r border-dark-border flex-col hidden md:flex">
        {/* Header - hamburger to open full sidebar */}
        <div className="border-b border-dark-border p-3 flex flex-col items-center gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-12 h-10 flex items-center justify-center rounded-xl text-gray-400 hover:text-white hover:bg-dark-cardSoft transition"
            title="Abrir menu"
          >
            <FaBars size={20} />
          </button>
        </div>

        {/* Nav icons */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="flex flex-col items-center gap-2 px-2">
            {allLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/app"}
                title={link.label}
                className={({ isActive }) =>
                  `w-12 h-12 flex items-center justify-center rounded-xl transition-all relative ${
                    isActive
                      ? "bg-primary text-white shadow-md"
                      : "text-gray-400 hover:text-white hover:bg-dark-cardSoft"
                  }`
                }
              >
                <link.icon size={22} />
                {link.to === "/app/conversations" && totalUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-[20px] flex items-center justify-center bg-green-500 text-white text-[10px] font-bold rounded-full px-1">
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-dark-border p-2">
          <div className="flex justify-center">
            <button onClick={handleLogout} className="w-12 h-12 flex items-center justify-center rounded-xl text-gray-500 hover:text-red-400 hover:bg-dark-cardSoft transition" title="Sair">
              <FaSignOutAlt size={20} />
            </button>
          </div>
        </div>
      </aside>

      {/* Full sidebar panel (opens on hamburger click - both mobile and desktop) */}
      <aside className={`
        fixed inset-y-0 left-0 z-50
        w-72 bg-dark-card border-r border-dark-border flex flex-col
        transform transition-transform duration-200
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="p-5 border-b border-dark-border flex items-center justify-between" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}>
          <div>
            <h1 className="text-xl font-extrabold text-primary tracking-wider">ATTACKZAP</h1>
            <p className="text-xs text-gray-400 mt-0.5">CRM WhatsApp</p>
          </div>
          <button onClick={closeSidebar} className="text-gray-400 hover:text-white">
            <FaTimes size={20} />
          </button>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto">
          {getMenuSections(user?.role).map((section) => (
            <div key={section.label} className="mb-5">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4 mb-2">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.links.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.to === "/app"}
                    onClick={closeSidebar}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                        isActive
                          ? "bg-primary text-white shadow-md"
                          : "text-gray-400 hover:text-white hover:bg-dark-cardSoft"
                      }`
                    }
                  >
                    <link.icon size={18} />
                    {link.label}
                    {link.to === "/app/conversations" && totalUnread > 0 && (
                      <span className="ml-auto min-w-[20px] h-5 flex items-center justify-center bg-green-500 text-white text-[10px] font-bold rounded-full px-1">
                        {totalUnread > 99 ? "99+" : totalUnread}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-dark-border">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs text-gray-400 truncate">{user?.name || user?.email}</span>
            <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 transition" title="Sair">
              <FaSignOutAlt size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile header */}
        <header id="mobile-header" className="md:hidden flex items-center justify-between px-4 py-3 bg-dark-card border-b border-dark-border flex-shrink-0" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
          <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white">
            <FaBars size={20} />
          </button>
          <h1 className="text-sm font-bold text-primary">ATTACKZAP</h1>
          <div className="w-6" />
        </header>

        <main id="main-content" className={`flex-1 overflow-y-auto ${isConversations ? "p-0 pb-14 md:pb-0" : "p-3 md:p-6 pb-16 md:pb-6"}`}>
          <Outlet />
        </main>

        {/* Bottom Navigation - Mobile only */}
        <nav id="bottom-nav" className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-dark-card border-t border-dark-border safe-area-bottom">
          <div className="flex items-center justify-around px-1 py-1.5">
            {getBottomNavItems().map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/app"}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center py-1.5 px-2 rounded-xl min-w-[56px] transition-all relative ${
                    isActive
                      ? "text-primary"
                      : "text-gray-500"
                  }`
                }
              >
                <item.icon size={20} />
                {item.to === "/app/conversations" && totalUnread > 0 && (
                  <span className="absolute top-0.5 right-1 min-w-[16px] h-[16px] flex items-center justify-center bg-green-500 text-white text-[8px] font-bold rounded-full px-0.5">
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </span>
                )}
                <span className="text-[9px] mt-0.5 font-medium">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
