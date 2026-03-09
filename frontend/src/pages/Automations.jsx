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
} from "react-icons/fa";

export default function Automations() {
  const { authFetch } = useAuth();
  const [automations, setAutomations] = useState([]);
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Form
  const [formName, setFormName] = useState("");
  const [formInstanceId, setFormInstanceId] = useState("");

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

  // Criar automacao: cria workflow N8N + conecta webhook automaticamente
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
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao criar");
      }

      const data = await res.json();
      toast.success(
        `Automacao criada! Workflow N8N #${data.workflowId} + Webhook conectado`
      );
      setFormName("");
      setFormInstanceId("");
      setShowCreate(false);
      load();
    } catch (err) {
      toast.error(err.message || "Erro ao criar automacao");
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
    if (!window.confirm("Excluir automacao e workflow N8N?")) return;
    try {
      await authFetch(`/api/automations/${id}`, { method: "DELETE" });
      toast.success("Automacao removida");
      load();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Automacoes</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-primary hover:bg-primaryLight text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition"
        >
          <FaPlus /> Nova Automacao
        </button>
      </div>

      {/* Criar automacao */}
      {showCreate && (
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 mb-6 space-y-3">
          <p className="text-sm font-bold text-white mb-1">Criar Automacao</p>
          <p className="text-xs text-gray-400 mb-3">
            Ao criar, o sistema automaticamente: cria o workflow no N8N, conecta o webhook
            da Evolution e ativa a automacao.
          </p>

          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Nome da automacao (ex: AutoBot Vendas)"
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
                <FaRobot /> Criar Automacao + Workflow N8N
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
          <p className="text-gray-400">Nenhuma automacao criada</p>
          <p className="text-xs text-gray-500 mt-1">
            Crie uma automacao para gerar o workflow N8N automaticamente
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {automations.map((auto) => (
            <div
              key={auto.id}
              className="bg-dark-card border border-dark-border rounded-2xl px-5 py-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                      auto.active ? "bg-primary/10" : "bg-gray-700/30"
                    }`}
                  >
                    <FaRobot className={auto.active ? "text-primary" : "text-gray-500"} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{auto.name}</p>
                    <p className="text-xs text-gray-400">
                      {auto.instance_name || "---"} | {auto.type}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
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

              {/* Info do workflow */}
              {auto.n8n_workflow_id && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded-md">
                    N8N #{auto.n8n_workflow_id}
                  </span>
                  {auto.n8n_webhook_url && (
                    <span className="inline-flex items-center gap-1 bg-green-400/10 text-green-400 text-[10px] font-bold px-2 py-1 rounded-md">
                      <FaPlug className="text-[8px]" /> Webhook conectado
                    </span>
                  )}
                </div>
              )}

              {auto.n8n_webhook_url && (
                <p className="text-[10px] text-gray-500 mt-1.5 font-mono truncate">
                  {auto.n8n_webhook_url}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
