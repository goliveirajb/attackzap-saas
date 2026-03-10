import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import {
  FaRobot,
  FaPlus,
  FaTrash,
  FaToggleOn,
  FaToggleOff,
  FaPlug,
  FaSpinner,
  FaUsers,
  FaClock,
  FaChevronDown,
  FaChevronUp,
  FaCopy,
  FaSync,
  FaWhatsapp,
  FaSearch,
} from "react-icons/fa";
import ScheduledMessages from "./ScheduledMessages";

const FLOW_TYPES = [
  {
    value: "scheduled_message",
    label: "Mensagem Programada",
    desc: "Envia mensagens automaticas em horarios agendados via cron",
    icon: FaClock,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    value: "group_fetch",
    label: "Busca ID de Grupos",
    desc: "Busca os IDs dos grupos WhatsApp via Evolution API",
    icon: FaUsers,
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
];

// ========== Painel inline para Busca de Grupos ==========
function GroupFetchPanel({ instanceName, authFetch }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [search, setSearch] = useState("");

  const fetchGroups = async () => {
    if (!instanceName) return toast.error("Instancia nao encontrada");
    setLoading(true);
    setGroups([]);
    try {
      const res = await authFetch(`/api/whatsapp/instances/${instanceName}/groups`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGroups(Array.isArray(data) ? data : []);
      setFetched(true);
      toast.success(`${data.length} grupo(s) encontrado(s)`);
    } catch {
      toast.error("Erro ao buscar grupos");
    } finally {
      setLoading(false);
    }
  };

  const copyId = (id) => {
    navigator.clipboard.writeText(id);
    toast.success("ID copiado!");
  };

  const filtered = groups.filter(
    (g) =>
      g.name?.toLowerCase().includes(search.toLowerCase()) ||
      g.id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold text-white">Grupos WhatsApp</p>
        <button
          onClick={fetchGroups}
          disabled={loading}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition disabled:opacity-50"
        >
          {loading ? <FaSync className="animate-spin" /> : <FaUsers />}
          {loading ? "Buscando..." : "Buscar Grupos"}
        </button>
      </div>

      {fetched && groups.length > 0 && (
        <div className="relative mb-3">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por nome ou ID..."
            className="w-full rounded-lg bg-dark-card border border-dark-border pl-8 pr-4 py-2 text-sm text-dark-text placeholder:text-gray-500 focus:outline-none focus:border-primary"
          />
        </div>
      )}

      {!fetched && !loading ? (
        <div className="bg-dark-cardSoft border border-dark-border rounded-xl p-8 text-center">
          <FaUsers className="text-3xl text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-400">Clique em "Buscar Grupos" para carregar</p>
          <p className="text-[10px] text-gray-500 mt-1">Instancia: {instanceName}</p>
        </div>
      ) : fetched && groups.length === 0 ? (
        <div className="bg-dark-cardSoft border border-dark-border rounded-xl p-8 text-center">
          <p className="text-xs text-gray-400">Nenhum grupo encontrado</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {fetched && (
            <p className="text-[10px] text-gray-500 mb-1">
              {filtered.length} grupo(s) {search ? "filtrado(s)" : "encontrado(s)"}
            </p>
          )}
          {filtered.map((group) => (
            <div
              key={group.id}
              className="bg-dark-cardSoft border border-dark-border rounded-xl px-4 py-2.5 flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-green-400/10 flex items-center justify-center flex-shrink-0">
                  <FaWhatsapp className="text-green-400 text-sm" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{group.name}</p>
                  <p className="text-[10px] text-gray-500 font-mono truncate">{group.id}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {group.size > 0 && (
                  <span className="text-[10px] text-gray-400 bg-dark-card px-2 py-0.5 rounded-md">
                    {group.size}
                  </span>
                )}
                <button
                  onClick={() => copyId(group.id)}
                  className="flex items-center gap-1 text-[10px] text-primary hover:text-primaryLight transition px-2 py-1 rounded-md bg-primary/10 hover:bg-primary/20"
                >
                  <FaCopy /> ID
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ========== Pagina Principal ==========
export default function Automations() {
  const { authFetch } = useAuth();
  const [automations, setAutomations] = useState([]);
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // Form
  const [formName, setFormName] = useState("");
  const [formInstanceId, setFormInstanceId] = useState("");
  const [formType, setFormType] = useState("scheduled_message");

  const load = async () => {
    try {
      const [autoRes, instRes] = await Promise.all([
        authFetch("/api/automations"),
        authFetch("/api/whatsapp/instances"),
      ]);
      const autoData = await autoRes.json();
      const instData = await instRes.json();
      setAutomations(Array.isArray(autoData) ? autoData : []);
      setInstances(Array.isArray(instData) ? instData : []);
    } catch {
      toast.error("Erro ao carregar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!formName.trim()) return toast.error("Digite um nome");
    if (!formInstanceId) return toast.error("Selecione uma instancia");

    const instance = instances.find((i) => i.id === Number(formInstanceId));
    if (!instance) return toast.error("Instancia nao encontrada");

    setCreating(true);
    try {
      const res = await authFetch("/api/automations/create", {
        method: "POST",
        body: JSON.stringify({
          instanceId: instance.id,
          instanceName: instance.instance_name,
          name: formName.trim(),
          type: formType,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao criar");
      }

      const data = await res.json();
      const typeLabel = FLOW_TYPES.find((t) => t.value === formType)?.label || formType;
      toast.success(`Fluxo "${typeLabel}" criado! Workflow N8N #${data.workflowId}`);
      setFormName("");
      setFormInstanceId("");
      setFormType("scheduled_message");
      setShowCreate(false);
      load();
    } catch (err) {
      toast.error(err.message || "Erro ao criar fluxo");
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id, currentActive) => {
    try {
      await authFetch(`/api/automations/${id}/toggle`, {
        method: "PATCH",
        body: JSON.stringify({ active: !currentActive }),
      });
      toast.success(currentActive ? "Desativada" : "Ativada");
      load();
    } catch {
      toast.error("Erro ao alterar status");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Excluir fluxo e workflow N8N?")) return;
    try {
      await authFetch(`/api/automations/${id}`, { method: "DELETE" });
      toast.success("Fluxo removido");
      if (expandedId === id) setExpandedId(null);
      load();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const getTypeInfo = (type) =>
    FLOW_TYPES.find((t) => t.value === type) || FLOW_TYPES[0];

  const selectedType = FLOW_TYPES.find((t) => t.value === formType);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Fluxos N8N</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-primary hover:bg-primaryLight text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition"
        >
          <FaPlus /> Novo Fluxo
        </button>
      </div>

      {/* Criar fluxo */}
      {showCreate && (
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 mb-6 space-y-4">
          <p className="text-sm font-bold text-white">Criar Novo Fluxo</p>

          {/* Seletor de tipo */}
          <div>
            <p className="text-xs text-gray-400 mb-2">Selecione o tipo de fluxo:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FLOW_TYPES.map((ft) => {
                const Icon = ft.icon;
                const selected = formType === ft.value;
                return (
                  <button
                    key={ft.value}
                    onClick={() => setFormType(ft.value)}
                    className={`text-left rounded-xl border p-4 transition ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-dark-border bg-dark-cardSoft hover:border-gray-600"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`h-8 w-8 rounded-lg ${ft.bg} flex items-center justify-center`}>
                        <Icon className={ft.color} />
                      </div>
                      <span className={`text-sm font-bold ${selected ? "text-primary" : "text-white"}`}>
                        {ft.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">{ft.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder={`Nome do fluxo (ex: ${selectedType?.value === "group_fetch" ? "Busca Grupos Vendas" : "AutoBot Vendas"})`}
            className="w-full rounded-xl bg-dark-cardSoft border border-dark-border px-4 py-2.5 text-sm text-dark-text placeholder:text-gray-500 focus:outline-none focus:border-primary"
          />

          <select
            value={formInstanceId}
            onChange={(e) => setFormInstanceId(e.target.value)}
            className="w-full rounded-xl bg-dark-cardSoft border border-dark-border px-4 py-2.5 text-sm text-dark-text focus:outline-none focus:border-primary"
          >
            <option value="">Selecione uma instancia WhatsApp</option>
            {instances.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.instance_name} ({inst.status})
              </option>
            ))}
          </select>

          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-3 rounded-xl transition disabled:opacity-50"
          >
            {creating ? (
              <>
                <FaSpinner className="animate-spin" /> Criando workflow N8N...
              </>
            ) : (
              <>
                <FaRobot /> Criar Fluxo + Workflow N8N
              </>
            )}
          </button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : automations.length === 0 ? (
        <div className="bg-dark-card border border-dark-border rounded-2xl p-12 text-center">
          <FaRobot className="text-5xl text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Nenhum fluxo criado</p>
          <p className="text-xs text-gray-500 mt-1">
            Crie um fluxo para gerar o workflow N8N automaticamente
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {automations.map((auto) => {
            const typeInfo = getTypeInfo(auto.type);
            const TypeIcon = typeInfo.icon;
            const isExpanded = expandedId === auto.id;

            return (
              <div
                key={auto.id}
                className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden"
              >
                {/* Header do card */}
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                          auto.active ? typeInfo.bg : "bg-gray-700/30"
                        }`}
                      >
                        <TypeIcon className={auto.active ? typeInfo.color : "text-gray-500"} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{auto.name}</p>
                        <p className="text-xs text-gray-400">{auto.instance_name || "---"}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Botao Abrir/Fechar */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : auto.id)}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition ${
                          isExpanded
                            ? "bg-primary text-white"
                            : "bg-primary/10 text-primary hover:bg-primary/20"
                        }`}
                      >
                        {isExpanded ? <FaChevronUp className="text-[10px]" /> : <FaChevronDown className="text-[10px]" />}
                        {isExpanded ? "Fechar" : "Abrir"}
                      </button>

                      <button
                        onClick={() => handleToggle(auto.id, !!auto.active)}
                        className="p-2 transition"
                        title={auto.active ? "Desativar" : "Ativar"}
                      >
                        {auto.active ? (
                          <FaToggleOn className="text-xl text-green-400" />
                        ) : (
                          <FaToggleOff className="text-xl text-gray-500" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(auto.id)}
                        className="text-gray-500 hover:text-red-400 p-2 transition"
                      >
                        <FaTrash className="text-xs" />
                      </button>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className={`inline-flex items-center gap-1 ${typeInfo.bg} ${typeInfo.color} text-[10px] font-bold px-2 py-1 rounded-md`}>
                      <TypeIcon className="text-[8px]" /> {typeInfo.label}
                    </span>
                    {auto.n8n_workflow_id && (
                      <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded-md">
                        N8N #{auto.n8n_workflow_id}
                      </span>
                    )}
                    {auto.n8n_webhook_url && (
                      <span className="inline-flex items-center gap-1 bg-green-400/10 text-green-400 text-[10px] font-bold px-2 py-1 rounded-md">
                        <FaPlug className="text-[8px]" /> Webhook
                      </span>
                    )}
                  </div>
                </div>

                {/* Painel expandido */}
                {isExpanded && (
                  <div className="border-t border-dark-border px-5 py-5 bg-dark-bg/50">
                    {auto.type === "scheduled_message" && (
                      <ScheduledMessages automationId={auto.id} />
                    )}
                    {auto.type === "group_fetch" && (
                      <GroupFetchPanel
                        instanceName={auto.instance_name}
                        authFetch={authFetch}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
