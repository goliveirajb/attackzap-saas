import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import {
  FaClock,
  FaPlus,
  FaTrash,
  FaToggleOn,
  FaToggleOff,
  FaImage,
  FaUpload,
  FaSpinner,
  FaCalendarDay,
  FaPen,
  FaTimes,
} from "react-icons/fa";

const DIAS_SEMANA = [
  { value: 0, label: "Dom", full: "Domingo" },
  { value: 1, label: "Seg", full: "Segunda" },
  { value: 2, label: "Ter", full: "Terca" },
  { value: 3, label: "Qua", full: "Quarta" },
  { value: 4, label: "Qui", full: "Quinta" },
  { value: 5, label: "Sex", full: "Sexta" },
  { value: 6, label: "Sab", full: "Sabado" },
];

const parseDias = (diasStr) => {
  if (!diasStr) return [0, 1, 2, 3, 4, 5, 6];
  return diasStr.split(",").map(Number).filter((n) => !isNaN(n));
};

const getDiaHoje = () => new Date().getDay();

const formatHorario = (h) => {
  if (!h) return "-";
  const parts = String(h).split(":");
  return `${parts[0]}:${parts[1]}`;
};

export default function ScheduledMessages({ automationId = null }) {
  const { authFetch } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroDia, setFiltroDia] = useState(getDiaHoje());

  // Modal criar
  const [modalCriar, setModalCriar] = useState(false);
  const [criando, setCriando] = useState(false);
  const [formHorario, setFormHorario] = useState("08:00");
  const [formText, setFormText] = useState("");
  const [formNumbers, setFormNumbers] = useState("");
  const [formDias, setFormDias] = useState([0, 1, 2, 3, 4, 5, 6]);

  // Modal editar dias
  const [editDiasId, setEditDiasId] = useState(null);
  const [editDias, setEditDias] = useState([]);

  // Preview imagem
  const [previewImagem, setPreviewImagem] = useState(null);

  const load = async () => {
    try {
      const res = await authFetch("/api/scheduled-messages");
      const data = await res.json();
      let msgs = Array.isArray(data) ? data : [];
      if (automationId) {
        msgs = msgs.filter((m) => m.automation_id === automationId);
      }
      setMessages(msgs);
    } catch {
      toast.error("Erro ao carregar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [automationId]);

  // Filtrar por dia
  const msgFiltradas = useMemo(() => {
    if (filtroDia === -1) return messages;
    return messages.filter((msg) => parseDias(msg.dias_semana).includes(filtroDia));
  }, [messages, filtroDia]);

  // Contagem por dia
  const contagemPorDia = useMemo(() => {
    const counts = {};
    DIAS_SEMANA.forEach((d) => { counts[d.value] = 0; });
    messages.forEach((msg) => {
      parseDias(msg.dias_semana).forEach((d) => { if (counts[d] !== undefined) counts[d]++; });
    });
    return counts;
  }, [messages]);

  const toggleDia = (_arr, setArr, dia) => {
    setArr((prev) => prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]);
  };

  const handleCreate = async () => {
    if (!formHorario) return toast.error("Defina o horario");
    if (formDias.length === 0) return toast.error("Selecione pelo menos um dia");
    if (!formNumbers.trim()) return toast.error("Informe os numeros");

    setCriando(true);
    try {
      const res = await authFetch("/api/scheduled-messages", {
        method: "POST",
        body: JSON.stringify({
          automationId,
          horario: formHorario + ":00",
          messageText: formText,
          targetNumbers: formNumbers.trim(),
          diasSemana: formDias.sort((a, b) => a - b).join(","),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Mensagem programada criada!");
      setFormText("");
      setFormNumbers("");
      setFormHorario("08:00");
      setFormDias([0, 1, 2, 3, 4, 5, 6]);
      setModalCriar(false);
      load();
    } catch {
      toast.error("Erro ao criar mensagem");
    } finally {
      setCriando(false);
    }
  };

  const handleToggle = async (msg) => {
    try {
      await authFetch(`/api/scheduled-messages/${msg.id}`, {
        method: "PUT",
        body: JSON.stringify({ active: msg.active ? 0 : 1 }),
      });
      toast.success(msg.active ? "Desativada" : "Ativada");
      load();
    } catch {
      toast.error("Erro ao alterar");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Excluir mensagem programada?")) return;
    try {
      await authFetch(`/api/scheduled-messages/${id}`, { method: "DELETE" });
      toast.success("Removida");
      load();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const uploadImagem = async (id, file) => {
    const toastId = toast.loading("Enviando imagem...");
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await authFetch(`/api/scheduled-messages/${id}/upload`, {
        method: "POST",
        body: JSON.stringify({ base64, filename: file.name }),
      });
      toast.dismiss(toastId);
      if (!res.ok) throw new Error();
      toast.success("Imagem enviada!");
      load();
    } catch {
      toast.dismiss(toastId);
      toast.error("Erro ao enviar imagem");
    }
  };

  const handleRemoveImage = async (id) => {
    try {
      await authFetch(`/api/scheduled-messages/${id}/image`, { method: "DELETE" });
      toast.success("Imagem removida");
      load();
    } catch {
      toast.error("Erro ao remover imagem");
    }
  };

  const salvarDias = async () => {
    if (!editDiasId || editDias.length === 0) {
      toast.error("Selecione pelo menos um dia");
      return;
    }
    try {
      await authFetch(`/api/scheduled-messages/${editDiasId}`, {
        method: "PUT",
        body: JSON.stringify({ dias_semana: editDias.sort((a, b) => a - b).join(",") }),
      });
      toast.success("Dias atualizados!");
      setEditDiasId(null);
      load();
    } catch {
      toast.error("Erro ao atualizar dias");
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-bold text-white">Mensagens Programadas</p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            Configure horarios para envio automatico. Filtre por dia da semana.
          </p>
        </div>
        <button
          onClick={() => setModalCriar(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primaryLight text-white text-xs font-medium px-4 py-2 rounded-lg transition"
        >
          <FaPlus size={10} /> Novo Horario
        </button>
      </div>

      {/* Filtro por dia */}
      <div className="bg-dark-cardSoft border border-dark-border rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <FaCalendarDay className="text-primary text-sm" />
          <span className="text-xs font-medium text-gray-300">Filtrar por dia</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFiltroDia(-1)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              filtroDia === -1
                ? "bg-primary text-white shadow-md"
                : "bg-dark-card text-gray-400 hover:bg-dark-card/80"
            }`}
          >
            Todos ({messages.length})
          </button>
          {DIAS_SEMANA.map((dia) => {
            const isHoje = dia.value === getDiaHoje();
            const isActive = filtroDia === dia.value;
            return (
              <button
                key={dia.value}
                onClick={() => setFiltroDia(dia.value)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all relative ${
                  isActive
                    ? "bg-primary text-white shadow-md"
                    : isHoje
                    ? "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
                    : "bg-dark-card text-gray-400 hover:bg-dark-card/80"
                }`}
              >
                {dia.label}
                <span className={`ml-1 ${isActive ? "text-white/70" : "text-gray-500"}`}>
                  {contagemPorDia[dia.value]}
                </span>
                {isHoje && !isActive && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista em grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <FaSpinner className="animate-spin text-primary mr-2" />
          <span className="text-sm text-gray-400">Carregando...</span>
        </div>
      ) : msgFiltradas.length === 0 ? (
        <div className="bg-dark-cardSoft border border-dark-border rounded-xl p-8 text-center">
          <FaClock className="text-4xl text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">
            {messages.length === 0
              ? "Nenhum horario programado."
              : `Nenhum horario para ${filtroDia === -1 ? "este filtro" : DIAS_SEMANA.find((d) => d.value === filtroDia)?.full}.`}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">Clique em "Novo Horario" para criar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {msgFiltradas.map((msg) => {
            const diasMsg = parseDias(msg.dias_semana);
            return (
              <div
                key={msg.id}
                className={`bg-dark-card rounded-xl border overflow-hidden transition-all ${
                  msg.active ? "border-primary/30" : "border-dark-border opacity-60"
                }`}
              >
                {/* Header do card */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
                  <div className="flex items-center gap-2">
                    <FaClock className={msg.active ? "text-primary" : "text-gray-500"} />
                    <span className="text-lg font-bold text-white">{formatHorario(msg.horario)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleToggle(msg)} title={msg.active ? "Desativar" : "Ativar"}>
                      {msg.active ? (
                        <FaToggleOn className="text-xl text-green-400 hover:text-green-500 transition" />
                      ) : (
                        <FaToggleOff className="text-xl text-gray-500 hover:text-gray-400 transition" />
                      )}
                    </button>
                    <button onClick={() => handleDelete(msg.id)} className="text-red-400/60 hover:text-red-400 transition" title="Excluir">
                      <FaTrash size={14} />
                    </button>
                  </div>
                </div>

                {/* Dias da semana */}
                <div className="px-4 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-gray-500 uppercase font-medium">Dias</span>
                    <button
                      onClick={() => { setEditDiasId(msg.id); setEditDias([...diasMsg]); }}
                      className="text-gray-500 hover:text-primary transition"
                      title="Editar dias"
                    >
                      <FaPen size={10} />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    {DIAS_SEMANA.map((dia) => {
                      const ativo = diasMsg.includes(dia.value);
                      return (
                        <span
                          key={dia.value}
                          className={`w-8 h-7 flex items-center justify-center rounded text-[10px] font-medium transition-all ${
                            ativo
                              ? "bg-primary/10 text-primary border border-primary/30"
                              : "bg-dark-cardSoft text-gray-600 border border-transparent"
                          }`}
                        >
                          {dia.label}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Texto / Numeros */}
                <div className="px-4 pt-2">
                  {msg.message_text && (
                    <p className="text-xs text-gray-300 mb-1">{msg.message_text}</p>
                  )}
                  <p className="text-[10px] text-gray-500 font-mono truncate">
                    Para: {msg.target_numbers}
                  </p>
                </div>

                {/* Imagem */}
                <div className="px-4 py-3">
                  {msg.media_base64 ? (
                    <div className="relative group">
                      <img
                        src={msg.media_base64}
                        alt={`Imagem ${msg.horario}`}
                        className="w-full h-40 object-cover rounded-lg border border-dark-border cursor-pointer"
                        onClick={() => setPreviewImagem(msg.media_base64)}
                      />
                      <div className="absolute bottom-2 right-2 flex gap-1">
                        <label className="px-2 py-1 rounded-lg bg-black/60 text-white text-[10px] cursor-pointer hover:bg-black/80 transition flex items-center gap-1">
                          <FaUpload size={8} /> Trocar
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => { if (e.target.files[0]) uploadImagem(msg.id, e.target.files[0]); }}
                          />
                        </label>
                        <button
                          onClick={() => handleRemoveImage(msg.id)}
                          className="px-2 py-1 rounded-lg bg-red-500/80 text-white text-[10px] hover:bg-red-500 transition flex items-center gap-1"
                        >
                          <FaTrash size={8} /> Remover
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-dark-border rounded-lg cursor-pointer hover:border-primary transition bg-dark-cardSoft/30">
                      <FaImage className="text-2xl text-gray-600 mb-2" />
                      <span className="text-[10px] text-gray-500">Clique para enviar imagem</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => { if (e.target.files[0]) uploadImagem(msg.id, e.target.files[0]); }}
                      />
                    </label>
                  )}
                </div>

                {/* Status badge */}
                <div className="px-4 pb-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    msg.active
                      ? "bg-green-400/10 text-green-400"
                      : "bg-dark-cardSoft text-gray-500"
                  }`}>
                    {msg.active ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== Modal Criar Horario ===== */}
      {modalCriar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setModalCriar(false)}>
          <div className="bg-dark-card rounded-2xl shadow-2xl w-full max-w-md p-6 border border-dark-border" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">Novo Horario Programado</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Horario (Brasilia)</label>
                <input
                  type="time"
                  value={formHorario}
                  onChange={(e) => setFormHorario(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-dark-border bg-dark-cardSoft text-sm text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Numeros WhatsApp</label>
                <input
                  type="text"
                  value={formNumbers}
                  onChange={(e) => setFormNumbers(e.target.value)}
                  placeholder="5511999999999,5511888888888"
                  className="w-full px-4 py-2.5 rounded-lg border border-dark-border bg-dark-cardSoft text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Texto da mensagem</label>
                <textarea
                  value={formText}
                  onChange={(e) => setFormText(e.target.value)}
                  placeholder="Texto da mensagem (ou deixe vazio se for enviar apenas imagem)"
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-dark-border bg-dark-cardSoft text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-2">Dias da Semana</label>
                <div className="flex flex-wrap gap-2">
                  {DIAS_SEMANA.map((dia) => {
                    const ativo = formDias.includes(dia.value);
                    return (
                      <button
                        key={dia.value}
                        type="button"
                        onClick={() => toggleDia(formDias, setFormDias, dia.value)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          ativo
                            ? "bg-primary text-white"
                            : "bg-dark-cardSoft text-gray-400 hover:bg-dark-cardSoft/80"
                        }`}
                      >
                        {dia.full}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-3 mt-2">
                  <button type="button" onClick={() => setFormDias([0,1,2,3,4,5,6])} className="text-[10px] text-primary hover:underline">Todos</button>
                  <button type="button" onClick={() => setFormDias([1,2,3,4,5])} className="text-[10px] text-primary hover:underline">Seg-Sex</button>
                  <button type="button" onClick={() => setFormDias([0,6])} className="text-[10px] text-primary hover:underline">Fim de Semana</button>
                  <button type="button" onClick={() => setFormDias([])} className="text-[10px] text-gray-500 hover:underline">Limpar</button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setModalCriar(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-dark-cardSoft transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={criando}
                className="px-6 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primaryLight disabled:opacity-50 transition"
              >
                {criando ? "Criando..." : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal Editar Dias ===== */}
      {editDiasId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setEditDiasId(null)}>
          <div className="bg-dark-card rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-dark-border" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">Editar Dias da Semana</h2>

            <div className="flex flex-wrap gap-2 mb-4">
              {DIAS_SEMANA.map((dia) => {
                const ativo = editDias.includes(dia.value);
                return (
                  <button
                    key={dia.value}
                    type="button"
                    onClick={() => toggleDia(editDias, setEditDias, dia.value)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      ativo
                        ? "bg-primary text-white"
                        : "bg-dark-cardSoft text-gray-400 hover:bg-dark-cardSoft/80"
                    }`}
                  >
                    {dia.full}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3 mb-4">
              <button type="button" onClick={() => setEditDias([0,1,2,3,4,5,6])} className="text-[10px] text-primary hover:underline">Todos</button>
              <button type="button" onClick={() => setEditDias([1,2,3,4,5])} className="text-[10px] text-primary hover:underline">Seg-Sex</button>
              <button type="button" onClick={() => setEditDias([0,6])} className="text-[10px] text-primary hover:underline">Fim de Semana</button>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setEditDiasId(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-dark-cardSoft transition">
                Cancelar
              </button>
              <button onClick={salvarDias} className="px-6 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primaryLight transition">
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal Preview Imagem ===== */}
      {previewImagem && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setPreviewImagem(null)}>
          <div className="relative max-w-3xl max-h-[90vh] p-2" onClick={(e) => e.stopPropagation()}>
            <img src={previewImagem} alt="Preview" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
            <button
              onClick={() => setPreviewImagem(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition"
            >
              <FaTimes />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
