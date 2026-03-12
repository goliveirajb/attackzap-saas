import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import {
  FaUsers, FaWhatsapp, FaAddressBook, FaEnvelope, FaChartBar,
  FaEdit, FaTrash, FaCheck, FaTimes, FaSearch, FaCrown,
  FaToggleOn, FaToggleOff, FaUserShield,
} from "react-icons/fa";

const PLAN_COLORS = {
  free: "bg-gray-500/20 text-gray-400",
  basico: "bg-blue-500/20 text-blue-400",
  medio: "bg-purple-500/20 text-purple-400",
  completo: "bg-amber-500/20 text-amber-400",
};

const PLAN_LABELS = {
  free: "Free",
  basico: "Basico",
  medio: "Profissional",
  completo: "Empresarial",
};

export default function Admin() {
  const { authFetch, user } = useAuth();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [usersRes, statsRes] = await Promise.all([
        authFetch("/api/admin/users"),
        authFetch("/api/admin/stats"),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (err) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleEdit = (u) => {
    setEditingUser(u.id);
    setEditForm({ name: u.name, email: u.email, plan: u.plan, role: u.role || "user" });
  };

  const handleSave = async (id) => {
    try {
      const res = await authFetch(`/api/admin/users/${id}`, {
        method: "PUT",
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        toast.success("Usuario atualizado");
        setEditingUser(null);
        loadData();
      }
    } catch (err) {
      toast.error("Erro ao salvar");
    }
  };

  const handleToggleActive = async (u) => {
    try {
      const res = await authFetch(`/api/admin/users/${u.id}`, {
        method: "PUT",
        body: JSON.stringify({ active: u.active ? 0 : 1 }),
      });
      if (res.ok) {
        toast.success(u.active ? "Usuario desativado" : "Usuario ativado");
        loadData();
      }
    } catch (err) {
      toast.error("Erro");
    }
  };

  const handleDelete = async (u) => {
    if (!confirm(`Tem certeza que deseja excluir ${u.name || u.email}? Isso remove TODOS os dados.`)) return;
    try {
      const res = await authFetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Usuario excluido");
        loadData();
      }
    } catch (err) {
      toast.error("Erro ao excluir");
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.plan || "").toLowerCase().includes(q)
    );
  });

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <FaUserShield className="text-5xl text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-400">Acesso Restrito</h2>
          <p className="text-gray-500 text-sm mt-2">Somente administradores podem acessar esta pagina</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-dark-text flex items-center gap-2">
            <FaUserShield className="text-primary" /> Painel Admin
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Gerencie todos os clientes da plataforma</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={FaUsers} label="Usuarios" value={stats.totalUsers} color="text-blue-400" />
          <StatCard icon={FaCheck} label="Ativos" value={stats.activeUsers} color="text-green-400" />
          <StatCard icon={FaWhatsapp} label="Instancias" value={stats.totalInstances} color="text-green-400" />
          <StatCard icon={FaWhatsapp} label="Conectados" value={stats.connectedInstances} color="text-emerald-400" />
          <StatCard icon={FaAddressBook} label="Contatos" value={stats.totalContacts} color="text-purple-400" />
          <StatCard icon={FaEnvelope} label="Mensagens" value={stats.totalMessages} color="text-amber-400" />
        </div>
      )}

      {/* Plan distribution */}
      {stats?.planCounts && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(stats.planCounts || []).map((p) => (
            <div key={p.plan} className="bg-dark-card border border-dark-border rounded-xl p-4 flex items-center gap-3">
              <FaCrown className={PLAN_COLORS[p.plan]?.split(" ")[1] || "text-gray-400"} />
              <div>
                <p className="text-lg font-bold text-dark-text">{p.count}</p>
                <p className="text-xs text-gray-400">{PLAN_LABELS[p.plan] || p.plan}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar por nome, email ou plano..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-dark-card border border-dark-border rounded-xl text-sm text-dark-text placeholder:text-gray-500 focus:outline-none focus:border-primary"
        />
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-dark-card border border-dark-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-border">
                  <th className="text-left text-xs font-bold text-gray-500 uppercase px-4 py-3">Usuario</th>
                  <th className="text-left text-xs font-bold text-gray-500 uppercase px-4 py-3">Plano</th>
                  <th className="text-left text-xs font-bold text-gray-500 uppercase px-4 py-3">Role</th>
                  <th className="text-center text-xs font-bold text-gray-500 uppercase px-4 py-3">Instancias</th>
                  <th className="text-center text-xs font-bold text-gray-500 uppercase px-4 py-3">Contatos</th>
                  <th className="text-center text-xs font-bold text-gray-500 uppercase px-4 py-3">Status</th>
                  <th className="text-left text-xs font-bold text-gray-500 uppercase px-4 py-3">Criado</th>
                  <th className="text-right text-xs font-bold text-gray-500 uppercase px-4 py-3">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-dark-border/50 hover:bg-dark-cardSoft/50 transition">
                    <td className="px-4 py-3">
                      {editingUser === u.id ? (
                        <div className="space-y-1">
                          <input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full bg-dark-cardSoft border border-dark-border rounded-lg px-2 py-1 text-sm text-dark-text"
                          />
                          <input
                            value={editForm.email}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            className="w-full bg-dark-cardSoft border border-dark-border rounded-lg px-2 py-1 text-sm text-dark-text"
                          />
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-semibold text-dark-text">{u.name || "—"}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingUser === u.id ? (
                        <select
                          value={editForm.plan}
                          onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })}
                          className="bg-dark-cardSoft border border-dark-border rounded-lg px-2 py-1 text-sm text-dark-text"
                        >
                          <option value="free">Free</option>
                          <option value="basico">Basico</option>
                          <option value="medio">Profissional</option>
                          <option value="completo">Empresarial</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${PLAN_COLORS[u.plan] || PLAN_COLORS.free}`}>
                          {PLAN_LABELS[u.plan] || u.plan || "Free"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingUser === u.id ? (
                        <select
                          value={editForm.role}
                          onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                          className="bg-dark-cardSoft border border-dark-border rounded-lg px-2 py-1 text-sm text-dark-text"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span className={`text-xs font-bold ${u.role === "admin" ? "text-red-400" : "text-gray-400"}`}>
                          {u.role === "admin" ? "Admin" : "User"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-dark-text">{u.instances_count || 0}</td>
                    <td className="px-4 py-3 text-center text-sm text-dark-text">{u.contacts_count || 0}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleToggleActive(u)} title={u.active ? "Desativar" : "Ativar"}>
                        {u.active ? (
                          <FaToggleOn className="text-green-400 text-xl mx-auto" />
                        ) : (
                          <FaToggleOff className="text-gray-500 text-xl mx-auto" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {editingUser === u.id ? (
                          <>
                            <button onClick={() => handleSave(u.id)} className="text-green-400 hover:text-green-300">
                              <FaCheck />
                            </button>
                            <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-white">
                              <FaTimes />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleEdit(u)} className="text-gray-400 hover:text-primary">
                              <FaEdit />
                            </button>
                            <button onClick={() => handleDelete(u)} className="text-gray-400 hover:text-red-400">
                              <FaTrash />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((u) => (
              <div key={u.id} className="bg-dark-card border border-dark-border rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-dark-text">{u.name || "—"}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${PLAN_COLORS[u.plan] || PLAN_COLORS.free}`}>
                    {PLAN_LABELS[u.plan] || u.plan || "Free"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                  <span className="flex items-center gap-1"><FaWhatsapp /> {u.instances_count || 0}</span>
                  <span className="flex items-center gap-1"><FaAddressBook /> {u.contacts_count || 0}</span>
                  <span>{new Date(u.created_at).toLocaleDateString("pt-BR")}</span>
                  {u.role === "admin" && <span className="text-red-400 font-bold">Admin</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggleActive(u)} className="flex-1 py-2 rounded-lg text-xs font-bold bg-dark-cardSoft border border-dark-border flex items-center justify-center gap-1.5">
                    {u.active ? <><FaToggleOn className="text-green-400" /> Ativo</> : <><FaToggleOff className="text-gray-500" /> Inativo</>}
                  </button>
                  <button onClick={() => handleEdit(u)} className="py-2 px-3 rounded-lg text-xs bg-dark-cardSoft border border-dark-border text-gray-400 hover:text-primary">
                    <FaEdit />
                  </button>
                  <button onClick={() => handleDelete(u)} className="py-2 px-3 rounded-lg text-xs bg-dark-cardSoft border border-dark-border text-gray-400 hover:text-red-400">
                    <FaTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">Nenhum usuario encontrado</div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`${color} text-sm`} />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className="text-xl font-extrabold text-dark-text">{value?.toLocaleString?.() || 0}</p>
    </div>
  );
}
