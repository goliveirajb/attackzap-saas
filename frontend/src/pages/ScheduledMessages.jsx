import { useEffect, useState, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import {
  FaClock,
  FaPlus,
  FaTrash,
  FaToggleOn,
  FaToggleOff,
  FaImage,
  FaEdit,
  FaSave,
  FaTimes,
  FaSpinner,
} from "react-icons/fa";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

// Pode ser usado standalone (sem props) ou embutido em Automations (com automationId)
export default function ScheduledMessages({ automationId = null }) {
  const { authFetch } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const fileRef = useRef(null);
  const [uploadingId, setUploadingId] = useState(null);

  // Form create
  const [formHorario, setFormHorario] = useState("08:00");
  const [formText, setFormText] = useState("");
  const [formNumbers, setFormNumbers] = useState("");
  const [formDias, setFormDias] = useState([0, 1, 2, 3, 4, 5, 6]);

  // Form edit
  const [editHorario, setEditHorario] = useState("");
  const [editText, setEditText] = useState("");
  const [editNumbers, setEditNumbers] = useState("");
  const [editDias, setEditDias] = useState([]);

  const load = async () => {
    try {
      const res = await authFetch("/api/scheduled-messages");
      const data = await res.json();
      let msgs = Array.isArray(data) ? data : [];
      // Filtrar por automationId se fornecido
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

  const toggleDia = (dia, list, setter) => {
    setter(list.includes(dia) ? list.filter((d) => d !== dia) : [...list, dia].sort());
  };

  const handleCreate = async () => {
    if (!formHorario) return toast.error("Defina o horario");
    if (!formNumbers.trim()) return toast.error("Informe os numeros");

    setCreating(true);
    try {
      const res = await authFetch("/api/scheduled-messages", {
        method: "POST",
        body: JSON.stringify({
          automationId: automationId,
          horario: formHorario + ":00",
          messageText: formText,
          targetNumbers: formNumbers.trim(),
          diasSemana: formDias.join(","),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Mensagem programada criada!");
      setFormText("");
      setFormNumbers("");
      setFormHorario("08:00");
      setFormDias([0, 1, 2, 3, 4, 5, 6]);
      setShowCreate(false);
      load();
    } catch {
      toast.error("Erro ao criar mensagem");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (msg) => {
    setEditingId(msg.id);
    setEditHorario(String(msg.horario).slice(0, 5));
    setEditText(msg.message_text || "");
    setEditNumbers(msg.target_numbers || "");
    setEditDias((msg.dias_semana || "0,1,2,3,4,5,6").split(",").map(Number));
  };

  const handleSaveEdit = async () => {
    try {
      await authFetch(`/api/scheduled-messages/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({
          horario: editHorario + ":00",
          message_text: editText,
          target_numbers: editNumbers,
          dias_semana: editDias.join(","),
        }),
      });
      toast.success("Atualizado!");
      setEditingId(null);
      load();
    } catch {
      toast.error("Erro ao atualizar");
    }
  };

  const handleToggle = async (id, active) => {
    try {
      await authFetch(`/api/scheduled-messages/${id}`, {
        method: "PUT",
        body: JSON.stringify({ active: active ? 0 : 1 }),
      });
      toast.success(active ? "Desativada" : "Ativada");
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

  const handleUpload = async (id, file) => {
    setUploadingId(id);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(",")[1];
        const res = await authFetch(`/api/scheduled-messages/${id}/upload`, {
          method: "POST",
          body: JSON.stringify({ base64, filename: file.name }),
        });
        if (!res.ok) throw new Error();
        toast.success("Imagem salva!");
        load();
      } catch {
        toast.error("Erro no upload");
      } finally {
        setUploadingId(null);
      }
    };
    reader.readAsDataURL(file);
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold text-white">Mensagens Programadas</p>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-primary hover:bg-primaryLight text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
        >
          <FaPlus className="text-[10px]" /> Nova Mensagem
        </button>
      </div>

      {/* Criar */}
      {showCreate && (
        <div className="bg-dark-cardSoft border border-dark-border rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Horario (Brasilia)</label>
              <input
                type="time"
                value={formHorario}
                onChange={(e) => setFormHorario(e.target.value)}
                className="w-full rounded-lg bg-dark-card border border-dark-border px-3 py-2 text-sm text-dark-text focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Dias da semana</label>
              <div className="flex gap-1 flex-wrap">
                {DIAS.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => toggleDia(i, formDias, setFormDias)}
                    className={`px-2 py-1 text-[10px] font-bold rounded-lg transition ${
                      formDias.includes(i)
                        ? "bg-primary text-white"
                        : "bg-dark-card text-gray-500 border border-dark-border"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <input
            type="text"
            value={formNumbers}
            onChange={(e) => setFormNumbers(e.target.value)}
            placeholder="Numeros WhatsApp (ex: 5511999999999,5511888888888)"
            className="w-full rounded-lg bg-dark-card border border-dark-border px-3 py-2 text-sm text-dark-text placeholder:text-gray-500 focus:outline-none focus:border-primary"
          />

          <textarea
            value={formText}
            onChange={(e) => setFormText(e.target.value)}
            placeholder="Texto da mensagem..."
            rows={3}
            className="w-full rounded-lg bg-dark-card border border-dark-border px-3 py-2 text-sm text-dark-text placeholder:text-gray-500 focus:outline-none focus:border-primary resize-none"
          />

          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {creating ? <><FaSpinner className="animate-spin" /> Criando...</> : <><FaClock /> Criar Mensagem</>}
          </button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <p className="text-gray-400 text-xs">Carregando...</p>
      ) : messages.length === 0 ? (
        <div className="bg-dark-cardSoft border border-dark-border rounded-xl p-8 text-center">
          <FaClock className="text-3xl text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-400">Nenhuma mensagem programada</p>
          <p className="text-[10px] text-gray-500 mt-1">Clique em "Nova Mensagem" para criar</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {messages.map((msg) => {
            const isEditing = editingId === msg.id;

            return (
              <div key={msg.id} className="bg-dark-cardSoft border border-dark-border rounded-xl px-4 py-3">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Horario</label>
                        <input
                          type="time"
                          value={editHorario}
                          onChange={(e) => setEditHorario(e.target.value)}
                          className="w-full rounded-lg bg-dark-card border border-dark-border px-3 py-2 text-sm text-dark-text focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Dias</label>
                        <div className="flex gap-1 flex-wrap">
                          {DIAS.map((d, i) => (
                            <button
                              key={i}
                              onClick={() => toggleDia(i, editDias, setEditDias)}
                              className={`px-2 py-1 text-[10px] font-bold rounded-lg transition ${
                                editDias.includes(i)
                                  ? "bg-primary text-white"
                                  : "bg-dark-card text-gray-500 border border-dark-border"
                              }`}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={editNumbers}
                      onChange={(e) => setEditNumbers(e.target.value)}
                      placeholder="Numeros..."
                      className="w-full rounded-lg bg-dark-card border border-dark-border px-3 py-2 text-sm text-dark-text focus:outline-none focus:border-primary"
                    />
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg bg-dark-card border border-dark-border px-3 py-2 text-sm text-dark-text focus:outline-none focus:border-primary resize-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleSaveEdit} className="flex items-center gap-1 bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded-lg"><FaSave /> Salvar</button>
                      <button onClick={() => setEditingId(null)} className="flex items-center gap-1 bg-gray-700 text-gray-300 text-xs font-semibold px-3 py-2 rounded-lg"><FaTimes /> Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${msg.active ? "bg-blue-400/10" : "bg-gray-700/30"}`}>
                          <FaClock className={`text-sm ${msg.active ? "text-blue-400" : "text-gray-500"}`} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">
                            {String(msg.horario).slice(0, 5)}
                            <span className="text-[10px] text-gray-400 font-normal ml-2">
                              {(msg.dias_semana || "0,1,2,3,4,5,6").split(",").map((d) => DIAS[Number(d)]).join(", ")}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(msg)} className="text-gray-500 hover:text-primary p-1.5 transition" title="Editar"><FaEdit className="text-xs" /></button>
                        <button onClick={() => handleToggle(msg.id, !!msg.active)} className="p-1.5 transition" title={msg.active ? "Desativar" : "Ativar"}>
                          {msg.active ? <FaToggleOn className="text-lg text-green-400" /> : <FaToggleOff className="text-lg text-gray-500" />}
                        </button>
                        <button onClick={() => handleDelete(msg.id)} className="text-gray-500 hover:text-red-400 p-1.5 transition"><FaTrash className="text-xs" /></button>
                      </div>
                    </div>

                    {msg.message_text && (
                      <p className="text-xs text-gray-300 bg-dark-card rounded-lg px-3 py-2 mb-2">{msg.message_text}</p>
                    )}

                    <p className="text-[10px] text-gray-500 font-mono mb-2">
                      Para: {msg.target_numbers}
                    </p>

                    <div className="flex items-center gap-2">
                      {msg.media_base64 ? (
                        <div className="flex items-center gap-2">
                          <img src={msg.media_base64} alt="" className="h-10 w-10 rounded-lg object-cover border border-dark-border" />
                          <button onClick={() => handleRemoveImage(msg.id)} className="text-[10px] text-red-400 hover:underline">
                            Remover imagem
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setUploadingId(msg.id); fileRef.current?.click(); }}
                          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-primary transition"
                        >
                          <FaImage /> {uploadingId === msg.id ? "Enviando..." : "Adicionar imagem"}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadingId) handleUpload(uploadingId, file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
