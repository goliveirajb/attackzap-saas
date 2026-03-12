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
    { to: "/app", label: "Inicio", icon: FaHome },
    { to: "/app/conversations", label: "Conversas", icon: FaComments },
    { to: "/app/crm", label: "Contatos", icon: FaUsers },
    { to: "/app/instances", label: "Conexoes", icon: FaWhatsapp },
    { to: "/app/settings", label: "Config", icon: FaCog },
  ];
  return items;
};

export default function Layout() {
  const { user, logout, totalUnread } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const isConversations = location.pathname.includes("/conversations");

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const closeMobile = () => setMobileOpen(false);

  // All menu links flattened for the collapsed sidebar
  const allLinks = getMenuSections(user?.role).flatMap((s) => s.links);

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={closeMobile} />
      )}

      {/* Sidebar - collapsed by default (icons only), expands on hover/click */}
      <aside
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
        className={`
          fixed md:static inset-y-0 left-0 z-50
          ${sidebarExpanded ? "w-64" : "w-[68px]"}
          bg-dark-card border-r border-dark-border flex-col
          transition-all duration-200 ease-in-out
          hidden md:flex
        `}
      >
        {/* Header */}
        <div className={`border-b border-dark-border flex items-center ${sidebarExpanded ? "p-5" : "p-3 justify-center"}`}>
          {sidebarExpanded ? (
            <div>
              <h1 className="text-xl font-extrabold text-primary tracking-wider">ATTACKZAP</h1>
              <p className="text-xs text-gray-400 mt-0.5">CRM WhatsApp</p>
            </div>
          ) : (
            <h1 className="text-lg font-extrabold text-primary">AZ</h1>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          {sidebarExpanded ? (
            getMenuSections(user?.role).map((section) => (
              <div key={section.label} className="mb-4 px-3">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4 mb-2">
                  {section.label}
                </p>
                <div className="space-y-0.5">
                  {section.links.map((link) => (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      end={link.to === "/app"}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                          isActive
                            ? "bg-primary text-white shadow-md"
                            : "text-gray-400 hover:text-white hover:bg-dark-cardSoft"
                        }`
                      }
                    >
                      <link.icon className="text-base" />
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
            ))
          ) : (
            <div className="flex flex-col items-center gap-1 px-2">
              {allLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === "/app"}
                  title={link.label}
                  className={({ isActive }) =>
                    `w-11 h-11 flex items-center justify-center rounded-xl transition-all relative ${
                      isActive
                        ? "bg-primary text-white shadow-md"
                        : "text-gray-400 hover:text-white hover:bg-dark-cardSoft"
                    }`
                  }
                >
                  <link.icon size={18} />
                  {link.to === "/app/conversations" && totalUnread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-green-500 text-white text-[9px] font-bold rounded-full px-1">
                      {totalUnread > 99 ? "99+" : totalUnread}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className={`border-t border-dark-border ${sidebarExpanded ? "p-3" : "p-2"}`}>
          {sidebarExpanded ? (
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs text-gray-400 truncate">
                {user?.name || user?.email}
              </span>
              <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 transition" title="Sair">
                <FaSignOutAlt />
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <button onClick={handleLogout} className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-500 hover:text-red-400 hover:bg-dark-cardSoft transition" title="Sair">
                <FaSignOutAlt size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile sidebar (full, for hamburger menu) */}
      <aside className={`
        fixed inset-y-0 left-0 z-50
        w-64 bg-dark-card border-r border-dark-border flex flex-col
        transform transition-transform duration-200
        md:hidden
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="p-5 border-b border-dark-border flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-primary tracking-wider">ATTACKZAP</h1>
            <p className="text-xs text-gray-400 mt-0.5">CRM WhatsApp</p>
          </div>
          <button onClick={closeMobile} className="text-gray-400 hover:text-white">
            <FaTimes size={18} />
          </button>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto">
          {getMenuSections(user?.role).map((section) => (
            <div key={section.label} className="mb-4">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4 mb-2">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.links.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.to === "/app"}
                    onClick={closeMobile}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        isActive
                          ? "bg-primary text-white shadow-md"
                          : "text-gray-400 hover:text-white hover:bg-dark-cardSoft"
                      }`
                    }
                  >
                    <link.icon className="text-base" />
                    {link.label}
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
              <FaSignOutAlt />
            </button>
          </div>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile header */}
        <header id="mobile-header" className="md:hidden flex items-center justify-between px-4 py-3 bg-dark-card border-b border-dark-border flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="text-gray-400 hover:text-white">
            <FaBars size={18} />
          </button>
          <h1 className="text-sm font-bold text-primary">ATTACKZAP</h1>
          <div className="w-6" />
        </header>

        <main id="main-content" className={`flex-1 overflow-y-auto ${isConversations ? "p-0 pb-14 md:pb-0" : "p-3 md:p-6 pb-16 md:pb-6"}`}>
          <Outlet />
        </main>

        {/* Bottom Navigation - Mobile only, hidden via CSS class when chat is open */}
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
                <item.icon size={18} />
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
