import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  FaWhatsapp, FaComments, FaUsers, FaInbox, FaPaperPlane,
  FaSpinner, FaBell,
} from "react-icons/fa";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const COLORS = ["#0a6fbe", "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6"];

function StatCard({ icon: Icon, label, value, sub, color, bg }) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-2xl p-4 md:p-5 flex items-center gap-4">
      <div className={`h-11 w-11 md:h-12 md:w-12 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`text-lg md:text-xl ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xl md:text-2xl font-bold text-white">{value}</p>
        <p className="text-[10px] md:text-xs text-gray-400 truncate">{label}</p>
        {sub && <p className="text-[9px] text-gray-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function ChartCard({ title, children, className = "" }) {
  return (
    <div className={`bg-dark-card border border-dark-border rounded-2xl p-4 md:p-5 ${className}`}>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">{title}</h3>
      {children}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-card border border-dark-border rounded-xl px-3 py-2 shadow-xl">
      <p className="text-[10px] text-gray-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-semibold" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { authFetch } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await authFetch("/api/crm/dashboard-stats");
        const data = await res.json();
        setStats(data);
      } catch {} finally {
        setLoading(false);
      }
    };
    load();
  }, [authFetch]);

  // Transform messages per day into chart data
  const messagesChart = useMemo(() => {
    if (!stats?.messagesPerDay) return [];
    const map = {};
    stats.messagesPerDay.forEach((r) => {
      const d = new Date(r.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      if (!map[d]) map[d] = { date: d, Recebidas: 0, Enviadas: 0 };
      if (r.direction === "incoming") map[d].Recebidas = Number(r.count);
      else map[d].Enviadas = Number(r.count);
    });
    return Object.values(map);
  }, [stats]);

  // Contacts per stage pie data
  const stageChart = useMemo(() => {
    if (!stats?.contactsPerStage) return [];
    return stats.contactsPerStage.map((r) => ({
      name: r.stage,
      value: Number(r.count),
      color: r.color,
    }));
  }, [stats]);

  // New contacts per day
  const newContactsChart = useMemo(() => {
    if (!stats?.newContactsPerDay) return [];
    return stats.newContactsPerDay.map((r) => ({
      date: new Date(r.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      Contatos: Number(r.count),
    }));
  }, [stats]);

  // Messages by hour
  const hourChart = useMemo(() => {
    if (!stats?.messagesByHour) return [];
    const map = {};
    for (let h = 0; h < 24; h++) map[h] = { hour: `${String(h).padStart(2, "0")}h`, Recebidas: 0, Enviadas: 0 };
    stats.messagesByHour.forEach((r) => {
      if (r.direction === "incoming") map[r.hour].Recebidas = Number(r.count);
      else map[r.hour].Enviadas = Number(r.count);
    });
    return Object.values(map);
  }, [stats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FaSpinner className="animate-spin text-primary text-2xl mr-3" />
        <span className="text-gray-400">Carregando dashboard...</span>
      </div>
    );
  }

  if (!stats) {
    return <div className="text-center text-gray-500 py-20">Erro ao carregar dados</div>;
  }

  const responseRate = stats.total_messages > 0
    ? Math.round((stats.outgoing / stats.total_messages) * 100) : 0;

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h2 className="text-lg md:text-xl font-bold text-white">Dashboard</h2>
        <p className="text-[10px] md:text-xs text-gray-500 mt-0.5">Visao geral do seu atendimento</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={FaUsers} label="Total Contatos" value={stats.total_contacts}
          color="text-primary" bg="bg-primary/10"
        />
        <StatCard
          icon={FaComments} label="Total Mensagens" value={stats.total_messages.toLocaleString("pt-BR")}
          sub={`${stats.incoming} recebidas | ${stats.outgoing} enviadas`}
          color="text-indigo-400" bg="bg-indigo-400/10"
        />
        <StatCard
          icon={FaWhatsapp} label="Instancias" value={`${stats.connected_instances}/${stats.total_instances}`}
          sub={stats.connected_instances > 0 ? "Conectadas" : "Nenhuma conectada"}
          color="text-green-400" bg="bg-green-400/10"
        />
        <StatCard
          icon={FaBell} label="Nao lidos" value={stats.unread_contacts}
          color="text-yellow-400" bg="bg-yellow-400/10"
        />
      </div>

      {/* Row: Messages chart + Funnel pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Mensagens por dia (14 dias)" className="lg:col-span-2">
          {messagesChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={messagesChart}>
                <defs>
                  <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0a6fbe" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0a6fbe" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
                <Area type="monotone" dataKey="Recebidas" stroke="#0a6fbe" fill="url(#gradIn)" strokeWidth={2} />
                <Area type="monotone" dataKey="Enviadas" stroke="#6366f1" fill="url(#gradOut)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-gray-600 text-sm">Sem dados ainda</div>
          )}
        </ChartCard>

        <ChartCard title="Contatos por etapa">
          {stageChart.length > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={stageChart} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                    paddingAngle={3} dataKey="value" stroke="none"
                  >
                    {stageChart.map((entry, i) => (
                      <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-2">
                {stageChart.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color || COLORS[i % COLORS.length] }} />
                    <span className="text-[10px] text-gray-400">{s.name} ({s.value})</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-gray-600 text-sm">Sem dados</div>
          )}
        </ChartCard>
      </div>

      {/* Row: Hour distribution + New contacts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Horarios de pico (30 dias)">
          {hourChart.some((h) => h.Recebidas > 0 || h.Enviadas > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hour" tick={{ fill: "#6b7280", fontSize: 9 }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
                <Bar dataKey="Recebidas" fill="#0a6fbe" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Enviadas" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-600 text-sm">Sem dados</div>
          )}
        </ChartCard>

        <ChartCard title="Novos contatos por dia (14 dias)">
          {newContactsChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={newContactsChart}>
                <defs>
                  <linearGradient id="gradContacts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Contatos" stroke="#10b981" fill="url(#gradContacts)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-600 text-sm">Sem dados</div>
          )}
        </ChartCard>
      </div>

      {/* Row: Top contacts + Response rate */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Top contatos por mensagens" className="lg:col-span-2">
          {stats.topContacts?.length > 0 ? (
            <div className="space-y-3">
              {stats.topContacts.map((c, i) => {
                const maxCount = stats.topContacts[0].msg_count;
                const pct = maxCount > 0 ? (c.msg_count / maxCount) * 100 : 0;
                return (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-600 w-4 text-right font-mono">{i + 1}</span>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/60 to-primaryDark flex-shrink-0 flex items-center justify-center text-white font-bold text-[10px]">
                      {(c.name || "?").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-white font-medium truncate">{c.name || c.phone}</p>
                        <span className="text-[10px] text-gray-500 ml-2 flex-shrink-0">{c.msg_count} msgs</span>
                      </div>
                      <div className="w-full bg-dark-cardSoft rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-gradient-to-r from-primary to-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-[120px] flex items-center justify-center text-gray-600 text-sm">Sem dados</div>
          )}
        </ChartCard>

        <ChartCard title="Resumo">
          <div className="space-y-4">
            <div className="text-center py-3">
              <div className="relative inline-flex items-center justify-center w-24 h-24">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="8" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#0a6fbe" strokeWidth="8"
                    strokeDasharray={`${responseRate * 2.51} 251`} strokeLinecap="round" />
                </svg>
                <span className="absolute text-xl font-bold text-white">{responseRate}%</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-2">Taxa de resposta</p>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-dark-cardSoft/50">
                <div className="flex items-center gap-2">
                  <FaInbox className="text-primary" size={12} />
                  <span className="text-xs text-gray-400">Recebidas</span>
                </div>
                <span className="text-xs text-white font-semibold">{stats.incoming.toLocaleString("pt-BR")}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-dark-cardSoft/50">
                <div className="flex items-center gap-2">
                  <FaPaperPlane className="text-indigo-400" size={12} />
                  <span className="text-xs text-gray-400">Enviadas</span>
                </div>
                <span className="text-xs text-white font-semibold">{stats.outgoing.toLocaleString("pt-BR")}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-dark-cardSoft/50">
                <div className="flex items-center gap-2">
                  <FaUsers className="text-green-400" size={12} />
                  <span className="text-xs text-gray-400">Contatos</span>
                </div>
                <span className="text-xs text-white font-semibold">{stats.total_contacts}</span>
              </div>
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
