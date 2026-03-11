import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  FaHome,
  FaWhatsapp,
  FaProjectDiagram,
  FaCog,
  FaSignOutAlt,
  FaUsers,
} from "react-icons/fa";

const menuSections = [
  {
    label: "GERAL",
    links: [
      { to: "/", label: "Dashboard", icon: FaHome },
    ],
  },
  {
    label: "CRM",
    links: [
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

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-dark-card border-r border-dark-border flex flex-col">
        <div className="p-5 border-b border-dark-border">
          <h1 className="text-xl font-extrabold text-primary tracking-wider">
            ATTACKZAP
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">CRM WhatsApp</p>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          {menuSections.map((section) => (
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
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
