import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import {
  FaRobot, FaKey, FaSave, FaSpinner, FaToggleOn, FaToggleOff,
  FaWhatsapp, FaCog, FaClock, FaComments, FaBrain,
} from "react-icons/fa";

export default function AiConfig() {
  const { authFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [instances, setInstances] = useState([]);

  const [config, setConfig] = useState({
    openai_key: "",
    model: "gpt-4o-mini",
    system_prompt: "",
    active: false,
    ignore_groups: true,
    max_context_messages: 10,
    response_delay_ms: 2000,
    pause_after_human_mins: 30,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [cfgRes, instRes] = await Promise.all([
          authFetch("/api/crm/ai/config"),
          authFetch("/api/crm/ai/instances"),
        ]);
        const cfgData = await cfgRes.json();
        const instData = await instRes.json();

        if (cfgData && cfgData.id) {
          setConfig({
            openai_key: cfgData.openai_key || "",
            model: cfgData.model || "gpt-4o-mini",
            system_prompt: cfgData.system_prompt || "",
            active: !!cfgData.active,
            ignore_groups: !!cfgData.ignore_groups,
            max_context_messages: cfgData.max_context_messages || 10,
            response_delay_ms: cfgData.response_delay_ms || 2000,
            pause_after_human_mins: cfgData.pause_after_human_mins || 30,
          });
        }
        setInstances(Array.isArray(instData) ? instData : []);
      } catch {} finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!config.openai_key && config.active) {
      return toast.error("Informe a chave da OpenAI");
    }
    setSaving(true);
    try {
      const res = await authFetch("/api/crm/ai/config", {
        method: "PUT",
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error();
      toast.success("Configuracao salva!");
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const toggleInstance = async (id, active) => {
    try {
      const res = await authFetch(`/api/crm/ai/instances/${id}/toggle`, {
        method: "PUT",
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error();
      setInstances((prev) => prev.map((i) => i.id === id ? { ...i, ai_active: active ? 1 : 0 } : i));
      toast.success(active ? "IA ativada" : "IA desativada");
    } catch {
      toast.error("Erro ao alterar");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FaSpinner className="animate-spin text-primary text-2xl mr-3" />
        <span className="text-gray-400">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8 max-w-3xl">
      <div>
        <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
          <FaBrain className="text-primary" /> Assistente IA
        </h2>
        <p className="text-[10px] md:text-xs text-gray-500 mt-0.5">
          Configure a IA para responder seus clientes automaticamente via ChatGPT
        </p>
      </div>

      {/* Main toggle */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${config.active ? "bg-green-400/10" : "bg-dark-cardSoft"}`}>
              <FaRobot className={config.active ? "text-green-400 text-lg" : "text-gray-600 text-lg"} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">IA Ativa</p>
              <p className="text-[10px] text-gray-500">{config.active ? "Respondendo automaticamente" : "Desativada"}</p>
            </div>
          </div>
          <button onClick={() => setConfig({ ...config, active: !config.active })}>
            {config.active
              ? <FaToggleOn className="text-green-400 text-3xl" />
              : <FaToggleOff className="text-gray-600 text-3xl" />
            }
          </button>
        </div>
      </div>

      {/* API Key */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-5 space-y-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <FaKey size={10} /> Credenciais
        </h3>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Chave API OpenAI</label>
          <input
            type="password"
            value={config.openai_key}
            onChange={(e) => setConfig({ ...config, openai_key: e.target.value })}
            placeholder="sk-..."
            className="w-full px-4 py-2.5 rounded-lg border border-dark-border bg-dark-cardSoft text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary font-mono"
          />
          <p className="text-[9px] text-gray-600 mt-1">Obtenha em platform.openai.com/api-keys</p>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Modelo</label>
          <select
            value={config.model}
            onChange={(e) => setConfig({ ...config, model: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg border border-dark-border bg-dark-cardSoft text-sm text-white focus:outline-none focus:border-primary"
          >
            <option value="gpt-4o-mini">GPT-4o Mini (rapido e barato)</option>
            <option value="gpt-4o">GPT-4o (mais inteligente)</option>
            <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
            <option value="gpt-4.1">GPT-4.1</option>
          </select>
        </div>
      </div>

      {/* System Prompt */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-5 space-y-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <FaComments size={10} /> Instrucoes (Prompt)
        </h3>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Como a IA deve se comportar?</label>
          <textarea
            value={config.system_prompt}
            onChange={(e) => setConfig({ ...config, system_prompt: e.target.value })}
            placeholder={"Exemplo: Voce e o assistente virtual da empresa XYZ.\nSeu nome e Ana.\nResponda de forma educada e objetiva.\nSe o cliente perguntar sobre precos, informe que nosso plano custa R$99/mes.\nSe nao souber a resposta, peca para aguardar que um atendente humano ira responder."}
            rows={8}
            className="w-full px-4 py-2.5 rounded-lg border border-dark-border bg-dark-cardSoft text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary resize-none leading-relaxed"
          />
          <p className="text-[9px] text-gray-600 mt-1">
            Aqui voce treina a IA. Informe o nome da empresa, produtos, precos, horarios, regras de atendimento, etc.
          </p>
        </div>
      </div>

      {/* Behavior */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-5 space-y-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <FaCog size={10} /> Comportamento
        </h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white">Ignorar grupos</p>
            <p className="text-[9px] text-gray-600">Nao responder em conversas de grupo</p>
          </div>
          <button onClick={() => setConfig({ ...config, ignore_groups: !config.ignore_groups })}>
            {config.ignore_groups
              ? <FaToggleOn className="text-green-400 text-2xl" />
              : <FaToggleOff className="text-gray-600 text-2xl" />
            }
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] text-gray-400 mb-1 flex items-center gap-1">
              <FaComments size={8} /> Mensagens de contexto
            </label>
            <input
              type="number" min={1} max={30}
              value={config.max_context_messages}
              onChange={(e) => setConfig({ ...config, max_context_messages: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-cardSoft text-sm text-white focus:outline-none focus:border-primary"
            />
            <p className="text-[8px] text-gray-600 mt-0.5">Historico enviado pro GPT</p>
          </div>
          <div>
            <label className="block text-[10px] text-gray-400 mb-1 flex items-center gap-1">
              <FaClock size={8} /> Delay resposta (ms)
            </label>
            <input
              type="number" min={0} max={10000} step={500}
              value={config.response_delay_ms}
              onChange={(e) => setConfig({ ...config, response_delay_ms: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-cardSoft text-sm text-white focus:outline-none focus:border-primary"
            />
            <p className="text-[8px] text-gray-600 mt-0.5">Tempo antes de responder</p>
          </div>
          <div>
            <label className="block text-[10px] text-gray-400 mb-1 flex items-center gap-1">
              <FaClock size={8} /> Pausar apos humano (min)
            </label>
            <input
              type="number" min={0} max={1440}
              value={config.pause_after_human_mins}
              onChange={(e) => setConfig({ ...config, pause_after_human_mins: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-cardSoft text-sm text-white focus:outline-none focus:border-primary"
            />
            <p className="text-[8px] text-gray-600 mt-0.5">IA pausa se voce respondeu</p>
          </div>
        </div>
      </div>

      {/* Per-instance toggles */}
      {instances.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <FaWhatsapp size={10} /> Instancias
          </h3>
          <p className="text-[9px] text-gray-600">Ative a IA por instancia WhatsApp</p>
          <div className="space-y-2">
            {instances.map((inst) => (
              <div key={inst.id} className="flex items-center justify-between p-3 rounded-xl bg-dark-cardSoft/50">
                <div className="flex items-center gap-2.5">
                  <FaWhatsapp className="text-green-400" size={14} />
                  <span className="text-sm text-white">{inst.display_name}</span>
                </div>
                <button onClick={() => toggleInstance(inst.id, !inst.ai_active)}>
                  {inst.ai_active
                    ? <FaToggleOn className="text-green-400 text-2xl" />
                    : <FaToggleOff className="text-gray-600 text-2xl" />
                  }
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary hover:bg-primaryLight text-white font-medium transition disabled:opacity-50"
      >
        {saving ? <FaSpinner className="animate-spin" size={14} /> : <FaSave size={14} />}
        {saving ? "Salvando..." : "Salvar Configuracao"}
      </button>
    </div>
  );
}
