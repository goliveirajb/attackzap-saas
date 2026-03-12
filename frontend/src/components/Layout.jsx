import { Outlet, NavLink, useNavigate } from "react-router-dom";
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
        { to: "/", label: "Dashboard", icon: FaHome },
      ],
    },
    {
      label: "CRM",
      links: [
        { to: "/conversations", label: "Conversas", icon: FaComments },
        { to: "/crm", label: "Contatos", icon: FaUsers },
      ],
    },
    {
      label: "WHATSAPP",
      links: [
        { to: "/instances", label: "Conexoes", icon: FaWhatsapp },
      ],
    },
    {
      label: "AUTOMACOES",
      links: [
        { to: "/flows", label: "Fluxos", icon: FaProjectDiagram },
      ],
    },
    {
      label: "SISTEMA",
      links: [
        { to: "/settings", label: "Configuracoes", icon: FaCog },
      ],
    },
  ];

  if (role === "admin") {
    sections.push({
      label: "ADMIN",
      links: [
        { to: "/admin", label: "Gerenciar Clientes", icon: FaUserShield },
      ],
    });
  }

  return sections;
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={closeMobile} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 bg-dark-card border-r border-dark-border flex flex-col
        transform transition-transform duration-200
        ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <div className="p-5 border-b border-dark-border flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-primary tracking-wider">
              ATTACKZAP
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">CRM WhatsApp</p>
          </div>
          <button onClick={closeMobile} className="text-gray-400 hover:text-white md:hidden">
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
                    end={link.to === "/"}
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
            <span className="text-xs text-gray-400 truncate">
              {user?.name || user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-red-400 transition"
              title="Sair"
            >
              <FaSignOutAlt />
            </button>
          </div>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-dark-card border-b border-dark-border">
          <button onClick={() => setMobileOpen(true)} className="text-gray-400 hover:text-white">
            <FaBars size={18} />
          </button>
          <h1 className="text-sm font-bold text-primary">ATTACKZAP</h1>
          <div className="w-6" />
        </header>

        <main className="flex-1 overflow-y-auto p-3 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
