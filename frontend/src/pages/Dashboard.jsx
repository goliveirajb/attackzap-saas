import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { FaWhatsapp, FaRobot, FaPlug } from "react-icons/fa";

export default function Dashboard() {
  const { authFetch } = useAuth();
  const [stats, setStats] = useState({ instances: 0, automations: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        const [instRes, autoRes] = await Promise.all([
          authFetch("/api/whatsapp/instances"),
          authFetch("/api/automations"),
        ]);
        const instances = await instRes.json();
        const automations = await autoRes.json();
        setStats({
          instances: Array.isArray(instances) ? instances.length : 0,
          automations: Array.isArray(automations) ? automations.length : 0,
        });
      } catch {}
    };
    load();
  }, [authFetch]);

  const cards = [
    {
      label: "Instancias WhatsApp",
      value: stats.instances,
      icon: FaWhatsapp,
      color: "text-green-400",
      bg: "bg-green-400/10",
    },
    {
      label: "Automacoes Ativas",
      value: stats.automations,
      icon: FaRobot,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Webhooks Conectados",
      value: stats.automations,
      icon: FaPlug,
      color: "text-yellow-400",
      bg: "bg-yellow-400/10",
    },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Dashboard</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {cards.map((c) => (
          <div
            key={c.label}
            className="bg-dark-card border border-dark-border rounded-2xl p-5 flex items-center gap-4"
          >
            <div className={`h-12 w-12 rounded-xl ${c.bg} flex items-center justify-center`}>
              <c.icon className={`text-xl ${c.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{c.value}</p>
              <p className="text-xs text-gray-400">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-dark-card border border-dark-border rounded-2xl p-6">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
          Como comecar
        </h3>
        <ol className="space-y-2 text-sm text-gray-300">
          <li>
            <span className="text-primary font-bold">1.</span> Crie uma instancia WhatsApp e escaneie o QR Code
          </li>
          <li>
            <span className="text-primary font-bold">2.</span> Crie uma automacao - o workflow N8N sera criado automaticamente
          </li>
          <li>
            <span className="text-primary font-bold">3.</span> O webhook da Evolution sera conectado ao N8N automaticamente
          </li>
          <li>
            <span className="text-primary font-bold">4.</span> Pronto! Sua automacao ja esta funcionando
          </li>
        </ol>
      </div>
    </div>
  );
}
