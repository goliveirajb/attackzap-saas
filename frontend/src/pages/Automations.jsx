import { useEffect, useState, useMemo } from "react";
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
  FaCopy,
  FaSync,
  FaWhatsapp,
  FaSearch,
  FaTimes,
  FaCog,
  FaCheckCircle,
  FaBan,
} from "react-icons/fa";
import ScheduledMessages from "./ScheduledMessages";

const FLOW_TEMPLATES = [
  {
    value: "scheduled_message",
    label: "Mensagem Programada",
    desc: "Envia mensagens automaticas em horarios agendados via cron",
    icon: FaClock,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    borderColor: "border-blue-400/30",
  },
  {
    value: "group_fetch",
    label: "Busca ID de Grupos",
    desc: "Busca os IDs dos grupos WhatsApp via Evolution API",
    icon: FaUsers,
    color: "text-green-400",
    bg: "bg-green-400/10",
    borderColor: "border-green-400/30",
  },
];

const TABS = [
  { key: "add", label: "Adicionar Fluxo", icon: FaPlus },
  { key: "active", label: "Fluxos Ativos", icon: FaCheckCircle },
  { key: "inactive", label: "Fluxos Desativados", icon: FaBan },
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

// ========== Modal de Configuracao do Fluxo ==========
function FlowConfigModal({ flow, authFetch, onClose, onRefresh }) {
  const typeInfo = FLOW_TEMPLATES.find((t) => t.value === flow.type) || FLOW_TEMPLATES[0];
  const TypeIcon = typeInfo.icon;

  const handleToggle = async () => {
    try {
      await authFetch(`/api/automations/${flow.id}/toggle`, {
        method: "PATCH",
        body: JSON.stringify({ active: !flow.active }),
      });
      toast.success(flow.active ? "Fluxo desativado" : "Fluxo ativado");
      onRefresh();
    } catch {
      toast.error("Erro ao alterar status");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Excluir fluxo e workflow N8N?")) return;
    try {
      await authFetch(`/api/automations/${flow.id}`, { method: "DELETE" });
      toast.success("Fluxo removido");
      onClose();
      onRefresh();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-dark-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-dark-border"
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border sticky top-0 bg-dark-card z-10">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${flow.active ? typeInfo.bg : "bg-gray-700/30"}`}>
              <TypeIcon className={flow.active ? typeInfo.color : "text-gray-500"} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{flow.name}</p>
              <p className="text-[10px] text-gray-500">{typeInfo.label} - {flow.instance_name || "---"}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition p-2">
            <FaTimes size={16} />
          </button>
        </div>

        {/* Status + Actions */}
        <div className="px-6 py-4 border-b border-dark-border">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                flow.active ? "bg-green-400/10 text-green-400" : "bg-gray-600/20 text-gray-500"
              }`}>
                {flow.active ? <FaCheckCircle size={9} /> : <FaBan size={9} />}
                {flow.active ? "Ativo" : "Desativado"}
              </span>
              {flow.n8n_workflow_id && (
                <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded-md">
                  N8N #{flow.n8n_workflow_id}
                </span>
              )}
              {flow.n8n_webhook_url && (
                <span className="inline-flex items-center gap-1 bg-green-400/10 text-green-400 text-[10px] font-bold px-2 py-1 rounded-md">
                  <FaPlug size={8} /> Webhook
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggle}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition ${
                  flow.active
                    ? "bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                    : "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                }`}
              >
                {flow.active ? <FaToggleOff size={12} /> : <FaToggleOn size={12} />}
                {flow.active ? "Desativar" : "Ativar"}
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
              >
                <FaTrash size={10} /> Excluir
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {flow.type === "scheduled_message" && (
            <ScheduledMessages automationId={flow.id} />
          )}
          {flow.type === "group_fetch" && (
            <GroupFetchPanel instanceName={flow.instance_name} authFetch={authFetch} />
          )}
        </div>
      </div>
    </div>
  );
}

// ========== Modal Criar Novo Fluxo ==========
function CreateFlowModal({ flowType, authFetch, instances, onClose, onCreated }) {
  const typeInfo = FLOW_TEMPLATES.find((t) => t.value === flowType);
  const TypeIcon = typeInfo.icon;
  const [formName, setFormName] = useState("");
  const [formInstanceId, setFormInstanceId] = useState("");
  const [creating, setCreating] = useState(false);

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
          type: flowType,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao criar");
      }

      const data = await res.json();
      toast.success(`Fluxo "${typeInfo.label}" criado! Workflow N8N #${data.workflowId}`);
      onClose();
      onCreated();
    } catch (err) {
      toast.error(err.message || "Erro ao criar fluxo");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-dark-card rounded-2xl shadow-2xl w-full max-w-md p-6 border border-dark-border" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${typeInfo.bg}`}>
            <TypeIcon className={typeInfo.color} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Criar {typeInfo.label}</p>
            <p className="text-[10px] text-gray-500">{typeInfo.desc}</p>
          </div>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder={`Nome do fluxo (ex: ${flowType === "group_fetch" ? "Busca Grupos Vendas" : "AutoBot Vendas"})`}
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
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-dark-cardSoft transition">
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition disabled:opacity-50"
          >
            {creating ? <FaSpinner className="animate-spin" /> : <FaRobot />}
            {creating ? "Criando..." : "Criar Fluxo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ========== Pagina Principal ==========
export default function Automations() {
  const { authFetch } = useAuth();
  const [automations, setAutomations] = useState([]);
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("add");
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [createType, setCreateType] = useState(null);

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

  useEffect(() => { load(); }, []);

  const activeFlows = useMemo(() => automations.filter((a) => !!a.active), [automations]);
  const inactiveFlows = useMemo(() => automations.filter((a) => !a.active), [automations]);

  const getTypeInfo = (type) =>
    FLOW_TEMPLATES.find((t) => t.value === type) || FLOW_TEMPLATES[0];

  const handleFlowCreated = () => {
    setCreateType(null);
    setActiveTab("active");
    load();
  };

  const openFlow = (flow) => {
    setSelectedFlow(flow);
  };

  // Refresh selected flow data after changes
  const refreshAndUpdate = async () => {
    await load();
  };

  // Keep selectedFlow in sync with automations
  useEffect(() => {
    if (selectedFlow) {
      const updated = automations.find((a) => a.id === selectedFlow.id);
      if (updated) setSelectedFlow(updated);
      else setSelectedFlow(null);
    }
  }, [automations]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <FaRobot className="text-primary" /> Fluxos
        </h2>
        <span className="text-[10px] text-gray-500 bg-dark-cardSoft px-3 py-1 rounded-full">
          {automations.length} fluxo(s)
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-dark-card border border-dark-border rounded-xl p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count = tab.key === "active" ? activeFlows.length : tab.key === "inactive" ? inactiveFlows.length : null;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab.key
                  ? "bg-primary text-white shadow-md"
                  : "text-gray-500 hover:text-white hover:bg-dark-cardSoft"
              }`}
            >
              <Icon size={11} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">
                {tab.key === "add" ? "Novo" : tab.key === "active" ? "Ativos" : "Inativos"}
              </span>
              {count !== null && count > 0 && (
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                  activeTab === tab.key ? "bg-white/20 text-white" : "bg-dark-cardSoft text-gray-400"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <FaSpinner className="animate-spin text-primary mr-2" />
          <span className="text-sm text-gray-400">Carregando...</span>
        </div>
      ) : (
        <>
          {/* ===== TAB: Adicionar Fluxo ===== */}
          {activeTab === "add" && (
            <div>
              <p className="text-sm text-gray-400 mb-4">Selecione o tipo de fluxo que deseja criar:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {FLOW_TEMPLATES.map((ft) => {
                  const Icon = ft.icon;
                  return (
                    <button
                      key={ft.value}
                      onClick={() => setCreateType(ft.value)}
                      className={`text-left rounded-2xl border ${ft.borderColor} bg-dark-card p-5 transition hover:border-primary hover:shadow-lg hover:shadow-primary/5 group`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`h-12 w-12 rounded-xl ${ft.bg} flex items-center justify-center transition group-hover:scale-110`}>
                          <Icon className={`${ft.color} text-xl`} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white group-hover:text-primary transition">{ft.label}</p>
                          <p className="text-[10px] text-gray-500">{ft.desc}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-600">
                          {automations.filter((a) => a.type === ft.value).length} criado(s)
                        </span>
                        <span className="text-xs text-primary font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <FaPlus size={9} /> Criar
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===== TAB: Fluxos Ativos ===== */}
          {activeTab === "active" && (
            <div>
              {activeFlows.length === 0 ? (
                <div className="bg-dark-card border border-dark-border rounded-2xl p-12 text-center">
                  <FaCheckCircle className="text-4xl text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">Nenhum fluxo ativo</p>
                  <p className="text-xs text-gray-500 mt-1">Crie um novo fluxo na aba "Adicionar Fluxo"</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeFlows.map((flow) => {
                    const typeInfo = getTypeInfo(flow.type);
                    const TypeIcon = typeInfo.icon;
                    return (
                      <div
                        key={flow.id}
                        onClick={() => openFlow(flow)}
                        className="bg-dark-card border border-dark-border rounded-2xl p-5 cursor-pointer transition hover:border-primary hover:shadow-lg hover:shadow-primary/5 group"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`h-10 w-10 rounded-xl ${typeInfo.bg} flex items-center justify-center`}>
                            <TypeIcon className={typeInfo.color} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-white truncate group-hover:text-primary transition">{flow.name}</p>
                            <p className="text-[10px] text-gray-500 truncate">{flow.instance_name || "---"}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`inline-flex items-center gap-1 ${typeInfo.bg} ${typeInfo.color} text-[9px] font-bold px-2 py-0.5 rounded-md`}>
                            <TypeIcon size={8} /> {typeInfo.label}
                          </span>
                          <span className="inline-flex items-center gap-1 bg-green-400/10 text-green-400 text-[9px] font-bold px-2 py-0.5 rounded-md">
                            <FaCheckCircle size={7} /> Ativo
                          </span>
                          {flow.n8n_workflow_id && (
                            <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-[9px] font-bold px-2 py-0.5 rounded-md">
                              N8N #{flow.n8n_workflow_id}
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex items-center justify-end">
                          <span className="text-[10px] text-gray-600 flex items-center gap-1 group-hover:text-primary transition">
                            <FaCog size={9} /> Configurar
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===== TAB: Fluxos Desativados ===== */}
          {activeTab === "inactive" && (
            <div>
              {inactiveFlows.length === 0 ? (
                <div className="bg-dark-card border border-dark-border rounded-2xl p-12 text-center">
                  <FaBan className="text-4xl text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">Nenhum fluxo desativado</p>
                  <p className="text-xs text-gray-500 mt-1">Fluxos desativados aparecem aqui</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inactiveFlows.map((flow) => {
                    const typeInfo = getTypeInfo(flow.type);
                    const TypeIcon = typeInfo.icon;
                    return (
                      <div
                        key={flow.id}
                        onClick={() => openFlow(flow)}
                        className="bg-dark-card border border-dark-border rounded-2xl p-5 cursor-pointer transition hover:border-gray-500 opacity-70 hover:opacity-100 group"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="h-10 w-10 rounded-xl bg-gray-700/30 flex items-center justify-center">
                            <TypeIcon className="text-gray-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-gray-400 truncate group-hover:text-white transition">{flow.name}</p>
                            <p className="text-[10px] text-gray-600 truncate">{flow.instance_name || "---"}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="inline-flex items-center gap-1 bg-gray-600/20 text-gray-500 text-[9px] font-bold px-2 py-0.5 rounded-md">
                            <TypeIcon size={8} /> {typeInfo.label}
                          </span>
                          <span className="inline-flex items-center gap-1 bg-gray-600/20 text-gray-500 text-[9px] font-bold px-2 py-0.5 rounded-md">
                            <FaBan size={7} /> Desativado
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-end">
                          <span className="text-[10px] text-gray-600 flex items-center gap-1 group-hover:text-white transition">
                            <FaCog size={9} /> Configurar
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ===== Modal: Criar Fluxo ===== */}
      {createType && (
        <CreateFlowModal
          flowType={createType}
          authFetch={authFetch}
          instances={instances}
          onClose={() => setCreateType(null)}
          onCreated={handleFlowCreated}
        />
      )}

      {/* ===== Modal: Configurar Fluxo ===== */}
      {selectedFlow && (
        <FlowConfigModal
          flow={selectedFlow}
          authFetch={authFetch}
          instances={instances}
          onClose={() => setSelectedFlow(null)}
          onRefresh={refreshAndUpdate}
        />
      )}
    </div>
  );
}
