import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import {
  FaUsers,
  FaPlus,
  FaTrash,
  FaPen,
  FaTimes,
  FaPhone,
  FaEnvelope,
  FaWhatsapp,
  FaSearch,
  FaSpinner,
  FaArrowRight,
  FaArrowLeft,
  FaComments,
  FaTags,
  FaStickyNote,
  FaColumns,
  FaList,
  FaUserPlus,
} from "react-icons/fa";

export default function CRM() {
  const { authFetch } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("kanban"); // kanban | list

  // Modal contato
  const [modalContato, setModalContato] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formStageId, setFormStageId] = useState(null);
  const [salvando, setSalvando] = useState(false);

  // Modal mensagens
  const [modalMsgs, setModalMsgs] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  // Modal novo stage
  const [modalStage, setModalStage] = useState(false);
  const [stageName, setStageName] = useState("");
  const [stageColor, setStageColor] = useState("#0a6fbe");

  const load = async () => {
    try {
      const [resContacts, resStages] = await Promise.all([
        authFetch("/api/crm/contacts"),
        authFetch("/api/crm/stages"),
      ]);
      const c = await resContacts.json();
      const s = await resStages.json();
      setContacts(Array.isArray(c) ? c : []);
      setStages(Array.isArray(s) ? s : []);
    } catch {
      toast.error("Erro ao carregar CRM");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredContacts = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        c.phone.includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.tags && c.tags.toLowerCase().includes(q))
    );
  }, [contacts, search]);

  const contactsByStage = useMemo(() => {
    const map = {};
    stages.forEach((s) => { map[s.id] = []; });
    map["none"] = [];
    filteredContacts.forEach((c) => {
      if (c.stage_id && map[c.stage_id]) {
        map[c.stage_id].push(c);
      } else {
        map["none"].push(c);
      }
    });
    return map;
  }, [filteredContacts, stages]);

  // CRUD contatos
  const openNewContact = (stageId = null) => {
    setEditingContact(null);
    setFormName("");
    setFormPhone("");
    setFormEmail("");
    setFormNotes("");
    setFormTags("");
    setFormStageId(stageId || (stages[0]?.id ?? null));
    setModalContato(true);
  };

  const openEditContact = (c) => {
    setEditingContact(c);
    setFormName(c.name || "");
    setFormPhone(c.phone || "");
    setFormEmail(c.email || "");
    setFormNotes(c.notes || "");
    setFormTags(c.tags || "");
    setFormStageId(c.stage_id);
    setModalContato(true);
  };

  const handleSaveContact = async () => {
    if (!formPhone.trim()) return toast.error("Informe o telefone");
    setSalvando(true);
    try {
      const payload = {
        name: formName || null,
        phone: formPhone.trim(),
        email: formEmail || null,
        notes: formNotes || null,
        tags: formTags || null,
        stage_id: formStageId,
      };

      if (editingContact) {
        const res = await authFetch(`/api/crm/contacts/${editingContact.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        toast.success("Contato atualizado!");
      } else {
        const res = await authFetch("/api/crm/contacts", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        toast.success("Contato criado!");
      }
      setModalContato(false);
      load();
    } catch {
      toast.error("Erro ao salvar contato");
    } finally {
      setSalvando(false);
    }
  };

  const handleDeleteContact = async (id) => {
    if (!window.confirm("Excluir este contato?")) return;
    try {
      await authFetch(`/api/crm/contacts/${id}`, { method: "DELETE" });
      toast.success("Contato removido");
      load();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const handleMoveContact = async (contactId, stageId) => {
    try {
      await authFetch(`/api/crm/contacts/${contactId}/move`, {
        method: "PUT",
        body: JSON.stringify({ stage_id: stageId }),
      });
      // Update locally for instant feedback
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contactId
            ? { ...c, stage_id: stageId, stage_name: stages.find((s) => s.id === stageId)?.name }
            : c
        )
      );
    } catch {
      toast.error("Erro ao mover contato");
    }
  };

  // Messages
  const openMessages = async (contact) => {
    setModalMsgs(contact);
    setLoadingMsgs(true);
    try {
      const res = await authFetch(`/api/crm/contacts/${contact.id}/messages`);
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Erro ao carregar mensagens");
    } finally {
      setLoadingMsgs(false);
    }
  };

  // Stages
  const handleCreateStage = async () => {
    if (!stageName.trim()) return toast.error("Nome obrigatorio");
    try {
      await authFetch("/api/crm/stages", {
        method: "POST",
        body: JSON.stringify({ name: stageName, color: stageColor }),
      });
      toast.success("Etapa criada!");
      setStageName("");
      setStageColor("#0a6fbe");
      setModalStage(false);
      load();
    } catch {
      toast.error("Erro ao criar etapa");
    }
  };

  const handleDeleteStage = async (id) => {
    if (!window.confirm("Excluir esta etapa? Os contatos serao movidos para 'Sem etapa'.")) return;
    try {
      await authFetch(`/api/crm/stages/${id}`, { method: "DELETE" });
      toast.success("Etapa removida");
      load();
    } catch {
      toast.error("Erro ao remover etapa");
    }
  };

  const formatDate = (d) => {
    if (!d) return "-";
    const dt = new Date(d);
    return dt.toLocaleDateString("pt-BR") + " " + dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FaSpinner className="animate-spin text-primary text-2xl mr-3" />
        <span className="text-gray-400">Carregando CRM...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FaUsers className="text-primary" /> CRM
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {contacts.length} contato{contacts.length !== 1 ? "s" : ""} cadastrado{contacts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar contato..."
              className="pl-8 pr-4 py-2 rounded-lg border border-dark-border bg-dark-cardSoft text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary w-56"
            />
          </div>

          {/* View toggle */}
          <div className="flex bg-dark-cardSoft rounded-lg border border-dark-border overflow-hidden">
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-3 py-2 text-xs ${viewMode === "kanban" ? "bg-primary text-white" : "text-gray-400 hover:text-white"}`}
              title="Kanban"
            >
              <FaColumns />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-2 text-xs ${viewMode === "list" ? "bg-primary text-white" : "text-gray-400 hover:text-white"}`}
              title="Lista"
            >
              <FaList />
            </button>
          </div>

          <button
            onClick={() => setModalStage(true)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-primary border border-dark-border px-3 py-2 rounded-lg transition"
          >
            <FaPlus size={10} /> Etapa
          </button>
          <button
            onClick={() => openNewContact()}
            className="flex items-center gap-2 bg-primary hover:bg-primaryLight text-white text-xs font-medium px-4 py-2 rounded-lg transition"
          >
            <FaUserPlus size={12} /> Novo Contato
          </button>
        </div>
      </div>

      {/* ===== KANBAN VIEW ===== */}
      {viewMode === "kanban" && (
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex gap-4 min-h-[500px]" style={{ minWidth: stages.length * 300 }}>
            {stages.map((stage) => (
              <div key={stage.id} className="flex-shrink-0 w-72 flex flex-col">
                {/* Stage header */}
                <div
                  className="flex items-center justify-between px-3 py-2.5 rounded-t-xl border border-b-0 border-dark-border"
                  style={{ backgroundColor: stage.color + "15", borderColor: stage.color + "40" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="text-sm font-semibold text-white">{stage.name}</span>
                    <span className="text-[10px] text-gray-500 bg-dark-cardSoft px-1.5 py-0.5 rounded-full">
                      {(contactsByStage[stage.id] || []).length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openNewContact(stage.id)}
                      className="text-gray-500 hover:text-primary transition p-1"
                      title="Adicionar contato"
                    >
                      <FaPlus size={10} />
                    </button>
                    <button
                      onClick={() => handleDeleteStage(stage.id)}
                      className="text-gray-600 hover:text-red-400 transition p-1"
                      title="Remover etapa"
                    >
                      <FaTrash size={9} />
                    </button>
                  </div>
                </div>

                {/* Cards area */}
                <div
                  className="flex-1 bg-dark-cardSoft/30 border border-dark-border rounded-b-xl p-2 space-y-2 overflow-y-auto"
                  style={{ maxHeight: "calc(100vh - 220px)" }}
                >
                  {(contactsByStage[stage.id] || []).map((contact) => (
                    <ContactCard
                      key={contact.id}
                      contact={contact}
                      stages={stages}
                      currentStageIndex={stages.findIndex((s) => s.id === stage.id)}
                      onEdit={() => openEditContact(contact)}
                      onDelete={() => handleDeleteContact(contact.id)}
                      onMove={(stageId) => handleMoveContact(contact.id, stageId)}
                      onMessages={() => openMessages(contact)}
                      formatDate={formatDate}
                    />
                  ))}

                  {(contactsByStage[stage.id] || []).length === 0 && (
                    <div className="py-8 text-center">
                      <p className="text-[10px] text-gray-600">Nenhum contato</p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Sem etapa */}
            {(contactsByStage["none"] || []).length > 0 && (
              <div className="flex-shrink-0 w-72 flex flex-col">
                <div className="flex items-center justify-between px-3 py-2.5 rounded-t-xl border border-b-0 border-dark-border bg-dark-cardSoft/50">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-600" />
                    <span className="text-sm font-semibold text-gray-400">Sem Etapa</span>
                    <span className="text-[10px] text-gray-500 bg-dark-cardSoft px-1.5 py-0.5 rounded-full">
                      {contactsByStage["none"].length}
                    </span>
                  </div>
                </div>
                <div className="flex-1 bg-dark-cardSoft/30 border border-dark-border rounded-b-xl p-2 space-y-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 220px)" }}>
                  {contactsByStage["none"].map((contact) => (
                    <ContactCard
                      key={contact.id}
                      contact={contact}
                      stages={stages}
                      currentStageIndex={-1}
                      onEdit={() => openEditContact(contact)}
                      onDelete={() => handleDeleteContact(contact.id)}
                      onMove={(stageId) => handleMoveContact(contact.id, stageId)}
                      onMessages={() => openMessages(contact)}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== LIST VIEW ===== */}
      {viewMode === "list" && (
        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-border">
                <th className="text-left px-4 py-3 text-[10px] text-gray-500 uppercase font-medium">Contato</th>
                <th className="text-left px-4 py-3 text-[10px] text-gray-500 uppercase font-medium">Telefone</th>
                <th className="text-left px-4 py-3 text-[10px] text-gray-500 uppercase font-medium">Etapa</th>
                <th className="text-left px-4 py-3 text-[10px] text-gray-500 uppercase font-medium">Tags</th>
                <th className="text-left px-4 py-3 text-[10px] text-gray-500 uppercase font-medium">Ultima Msg</th>
                <th className="text-right px-4 py-3 text-[10px] text-gray-500 uppercase font-medium">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map((c) => (
                <tr key={c.id} className="border-b border-dark-border/50 hover:bg-dark-cardSoft/30 transition">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-white font-medium">{c.name || "Sem nome"}</p>
                      {c.email && <p className="text-[10px] text-gray-500">{c.email}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{c.phone}</td>
                  <td className="px-4 py-3">
                    {c.stage_name ? (
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{ backgroundColor: (c.stage_color || "#666") + "20", color: c.stage_color || "#999" }}
                      >
                        {c.stage_name}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-600">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.tags ? (
                      <div className="flex flex-wrap gap-1">
                        {c.tags.split(",").map((t, i) => (
                          <span key={i} className="bg-dark-cardSoft text-gray-400 text-[10px] px-1.5 py-0.5 rounded">
                            {t.trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-600">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[10px] text-gray-500">{formatDate(c.last_message_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openMessages(c)} className="text-gray-500 hover:text-primary transition" title="Mensagens">
                        <FaComments size={13} />
                      </button>
                      <button onClick={() => openEditContact(c)} className="text-gray-500 hover:text-primary transition" title="Editar">
                        <FaPen size={11} />
                      </button>
                      <button onClick={() => handleDeleteContact(c.id)} className="text-gray-600 hover:text-red-400 transition" title="Excluir">
                        <FaTrash size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredContacts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500 text-sm">
                    Nenhum contato encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== Modal Contato ===== */}
      {modalContato && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setModalContato(false)}>
          <div className="bg-dark-card rounded-2xl shadow-2xl w-full max-w-md p-6 border border-dark-border" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">
              {editingContact ? "Editar Contato" : "Novo Contato"}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Nome</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nome do contato"
                  className="w-full px-4 py-2.5 rounded-lg border border-dark-border bg-dark-cardSoft text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Telefone WhatsApp *</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="5511999999999"
                  className="w-full px-4 py-2.5 rounded-lg border border-dark-border bg-dark-cardSoft text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Email</label>
                <input
                  type="text"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full px-4 py-2.5 rounded-lg border border-dark-border bg-dark-cardSoft text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Etapa</label>
                <select
                  value={formStageId || ""}
                  onChange={(e) => setFormStageId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-4 py-2.5 rounded-lg border border-dark-border bg-dark-cardSoft text-sm text-white focus:outline-none focus:border-primary"
                >
                  <option value="">Sem etapa</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Tags (separadas por virgula)</label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="cliente, vip, novo"
                  className="w-full px-4 py-2.5 rounded-lg border border-dark-border bg-dark-cardSoft text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Observacoes</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Anotacoes sobre o contato..."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-dark-border bg-dark-cardSoft text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setModalContato(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-dark-cardSoft transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveContact}
                disabled={salvando}
                className="px-6 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primaryLight disabled:opacity-50 transition"
              >
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal Mensagens ===== */}
      {modalMsgs && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setModalMsgs(null)}>
          <div className="bg-dark-card rounded-2xl shadow-2xl w-full max-w-lg border border-dark-border flex flex-col" style={{ maxHeight: "80vh" }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border">
              <div>
                <p className="text-white font-semibold">{modalMsgs.name || modalMsgs.phone}</p>
                <p className="text-[10px] text-gray-500 font-mono">{modalMsgs.phone}</p>
              </div>
              <button onClick={() => setModalMsgs(null)} className="text-gray-500 hover:text-white transition">
                <FaTimes />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loadingMsgs ? (
                <div className="flex items-center justify-center py-12">
                  <FaSpinner className="animate-spin text-primary mr-2" />
                  <span className="text-sm text-gray-400">Carregando...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12">
                  <FaComments className="text-3xl text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Nenhuma mensagem registrada</p>
                  <p className="text-[10px] text-gray-600 mt-1">
                    As mensagens aparecerao automaticamente quando o webhook da Evolution estiver configurado.
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                      msg.direction === "outgoing"
                        ? "ml-auto bg-primary/20 text-white rounded-br-sm"
                        : "bg-dark-cardSoft text-gray-200 rounded-bl-sm"
                    }`}
                  >
                    <p className="break-words">{msg.message_text || `[${msg.message_type}]`}</p>
                    <p className={`text-[9px] mt-1 ${msg.direction === "outgoing" ? "text-primary/60" : "text-gray-500"}`}>
                      {formatDate(msg.created_at)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal Nova Etapa ===== */}
      {modalStage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setModalStage(false)}>
          <div className="bg-dark-card rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-dark-border" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">Nova Etapa do Funil</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Nome da etapa</label>
                <input
                  type="text"
                  value={stageName}
                  onChange={(e) => setStageName(e.target.value)}
                  placeholder="Ex: Qualificado, Proposta Enviada..."
                  className="w-full px-4 py-2.5 rounded-lg border border-dark-border bg-dark-cardSoft text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Cor</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={stageColor}
                    onChange={(e) => setStageColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-dark-border bg-transparent cursor-pointer"
                  />
                  <span className="text-xs text-gray-500">{stageColor}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setModalStage(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-dark-cardSoft transition">
                Cancelar
              </button>
              <button onClick={handleCreateStage} className="px-6 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primaryLight transition">
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Contact Card Component =====
function ContactCard({ contact, stages, currentStageIndex, onEdit, onDelete, onMove, onMessages, formatDate }) {
  const prevStage = currentStageIndex > 0 ? stages[currentStageIndex - 1] : null;
  const nextStage = currentStageIndex < stages.length - 1 ? stages[currentStageIndex + 1] : null;

  return (
    <div className="bg-dark-card rounded-xl border border-dark-border p-3 hover:border-primary/30 transition group">
      {/* Name + Phone */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">{contact.name || "Sem nome"}</p>
          <p className="text-[10px] text-gray-500 font-mono flex items-center gap-1 mt-0.5">
            <FaWhatsapp size={9} className="text-green-400" />
            {contact.phone}
          </p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button onClick={onMessages} className="text-gray-500 hover:text-primary transition p-1" title="Mensagens">
            <FaComments size={11} />
          </button>
          <button onClick={onEdit} className="text-gray-500 hover:text-primary transition p-1" title="Editar">
            <FaPen size={10} />
          </button>
          <button onClick={onDelete} className="text-gray-600 hover:text-red-400 transition p-1" title="Excluir">
            <FaTrash size={10} />
          </button>
        </div>
      </div>

      {/* Tags */}
      {contact.tags && (
        <div className="flex flex-wrap gap-1 mb-2">
          {contact.tags.split(",").map((tag, i) => (
            <span key={i} className="bg-primary/10 text-primary text-[9px] px-1.5 py-0.5 rounded font-medium">
              {tag.trim()}
            </span>
          ))}
        </div>
      )}

      {/* Notes preview */}
      {contact.notes && (
        <p className="text-[10px] text-gray-500 mb-2 line-clamp-2">{contact.notes}</p>
      )}

      {/* Last message */}
      {contact.last_message_at && (
        <p className="text-[9px] text-gray-600 mb-2">
          Ultima msg: {formatDate(contact.last_message_at)}
        </p>
      )}

      {/* Move arrows */}
      <div className="flex items-center justify-between pt-2 border-t border-dark-border/50">
        {prevStage ? (
          <button
            onClick={() => onMove(prevStage.id)}
            className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-primary transition"
            title={`Mover para ${prevStage.name}`}
          >
            <FaArrowLeft size={8} /> {prevStage.name}
          </button>
        ) : (
          <span />
        )}
        {nextStage ? (
          <button
            onClick={() => onMove(nextStage.id)}
            className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-primary transition"
            title={`Mover para ${nextStage.name}`}
          >
            {nextStage.name} <FaArrowRight size={8} />
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
