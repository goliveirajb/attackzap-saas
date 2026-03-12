import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import {
  FaUsers, FaPlus, FaTrash, FaPen, FaTimes, FaWhatsapp, FaSearch,
  FaSpinner, FaComments, FaColumns, FaList, FaUserPlus, FaPaperPlane,
  FaPhone, FaEnvelope, FaTags, FaStickyNote, FaGripVertical, FaCheck,
  FaCheckDouble, FaArrowLeft, FaEllipsisV, FaSmile,
} from "react-icons/fa";

// ======================== MAIN CRM COMPONENT ========================
export default function CRM() {
  const { authFetch } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("kanban");

  // Chat
  const [chatContact, setChatContact] = useState(null);

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

  // Modal novo stage
  const [modalStage, setModalStage] = useState(false);
  const [stageName, setStageName] = useState("");
  const [stageColor, setStageColor] = useState("#0a6fbe");

  // Drag & Drop
  const [draggedContact, setDraggedContact] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  const load = async () => {
    try {
      const [resC, resS] = await Promise.all([
        authFetch("/api/crm/contacts"),
        authFetch("/api/crm/stages"),
      ]);
      const c = await resC.json();
      const s = await resS.json();
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
      if (c.stage_id && map[c.stage_id]) map[c.stage_id].push(c);
      else map["none"].push(c);
    });
    return map;
  }, [filteredContacts, stages]);

  // ---- CRUD ----
  const openNewContact = (stageId = null) => {
    setEditingContact(null);
    setFormName(""); setFormPhone(""); setFormEmail("");
    setFormNotes(""); setFormTags("");
    setFormStageId(stageId || (stages[0]?.id ?? null));
    setModalContato(true);
  };

  const openEditContact = (c) => {
    setEditingContact(c);
    setFormName(c.name || ""); setFormPhone(c.phone || "");
    setFormEmail(c.email || ""); setFormNotes(c.notes || "");
    setFormTags(c.tags || ""); setFormStageId(c.stage_id);
    setModalContato(true);
  };

  const handleSaveContact = async () => {
    if (!formPhone.trim()) return toast.error("Informe o telefone");
    setSalvando(true);
    try {
      const payload = {
        name: formName || null, phone: formPhone.trim(),
        email: formEmail || null, notes: formNotes || null,
        tags: formTags || null, stage_id: formStageId,
      };
      if (editingContact) {
        const res = await authFetch(`/api/crm/contacts/${editingContact.id}`, {
          method: "PUT", body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        toast.success("Contato atualizado!");
      } else {
        const res = await authFetch("/api/crm/contacts", {
          method: "POST", body: JSON.stringify(payload),
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
    } catch { toast.error("Erro ao remover"); }
  };

  // ---- DRAG & DROP ----
  const handleDragStart = (e, contact) => {
    setDraggedContact(contact);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", contact.id);
    // Ghost image
    const ghost = e.target.cloneNode(true);
    ghost.style.opacity = "0.8";
    ghost.style.transform = "rotate(2deg)";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleDragOver = (e, stageId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStage(stageId);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = async (e, stageId) => {
    e.preventDefault();
    setDragOverStage(null);
    if (!draggedContact || draggedContact.stage_id === stageId) {
      setDraggedContact(null);
      return;
    }
    // Optimistic update
    setContacts((prev) =>
      prev.map((c) =>
        c.id === draggedContact.id
          ? { ...c, stage_id: stageId, stage_name: stages.find((s) => s.id === stageId)?.name }
          : c
      )
    );
    setDraggedContact(null);
    try {
      await authFetch(`/api/crm/contacts/${draggedContact.id}/move`, {
        method: "PUT", body: JSON.stringify({ stage_id: stageId }),
      });
    } catch {
      toast.error("Erro ao mover contato");
      load();
    }
  };

  // ---- STAGES ----
  const handleCreateStage = async () => {
    if (!stageName.trim()) return toast.error("Nome obrigatorio");
    try {
      await authFetch("/api/crm/stages", {
        method: "POST",
        body: JSON.stringify({ name: stageName, color: stageColor }),
      });
      toast.success("Etapa criada!");
      setStageName(""); setStageColor("#0a6fbe"); setModalStage(false);
      load();
    } catch { toast.error("Erro ao criar etapa"); }
  };

  const handleDeleteStage = async (id) => {
    if (!window.confirm("Excluir esta etapa?")) return;
    try {
      await authFetch(`/api/crm/stages/${id}`, { method: "DELETE" });
      toast.success("Etapa removida");
      load();
    } catch { toast.error("Erro ao remover etapa"); }
  };

  const formatDate = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    return dt.toLocaleDateString("pt-BR") + " " + dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatTime = (d) => {
    if (!d) return "";
    return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  // ---- CHAT OPEN ----
  const openChat = (contact) => {
    setChatContact(contact);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FaSpinner className="animate-spin text-primary text-2xl mr-3" />
        <span className="text-gray-400">Carregando CRM...</span>
      </div>
    );
  }

  // ======================== CHAT VIEW ========================
  if (chatContact) {
    return (
      <ChatView
        contact={chatContact}
        authFetch={authFetch}
        onBack={() => { setChatContact(null); load(); }}
        onEdit={() => openEditContact(chatContact)}
        stages={stages}
        formatTime={formatTime}
        formatDate={formatDate}
      />
    );
  }

  // ======================== CRM VIEW ========================
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
            <FaUsers className="text-primary" /> CRM
          </h1>
          <p className="text-[10px] md:text-xs text-gray-500 mt-0.5">
            {contacts.length} contato{contacts.length !== 1 ? "s" : ""} | Arraste os cards entre as etapas
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 md:flex-none">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-8 pr-4 py-2 rounded-lg border border-dark-border bg-dark-cardSoft text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary w-full md:w-48"
            />
          </div>
          <div className="flex bg-dark-cardSoft rounded-lg border border-dark-border overflow-hidden">
            <button onClick={() => setViewMode("kanban")}
              className={`px-3 py-2 text-xs transition ${viewMode === "kanban" ? "bg-primary text-white" : "text-gray-400 hover:text-white"}`}>
              <FaColumns />
            </button>
            <button onClick={() => setViewMode("list")}
              className={`px-3 py-2 text-xs transition ${viewMode === "list" ? "bg-primary text-white" : "text-gray-400 hover:text-white"}`}>
              <FaList />
            </button>
          </div>
          <button onClick={() => setModalStage(true)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-primary border border-dark-border px-3 py-2 rounded-lg transition">
            <FaPlus size={10} /> <span className="hidden sm:inline">Etapa</span>
          </button>
          <button onClick={() => openNewContact()}
            className="flex items-center gap-2 bg-primary hover:bg-primaryLight text-white text-xs font-medium px-3 md:px-4 py-2 rounded-lg transition">
            <FaUserPlus size={12} /> <span className="hidden sm:inline">Novo Contato</span>
          </button>
        </div>
      </div>

      {/* ===== KANBAN ===== */}
      {viewMode === "kanban" && (
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex gap-3" style={{ minWidth: stages.length * 260 }}>
            {stages.map((stage) => {
              const stageContacts = contactsByStage[stage.id] || [];
              const isDragOver = dragOverStage === stage.id;
              return (
                <div key={stage.id} className="flex-shrink-0 w-[240px] md:w-[280px] flex flex-col">
                  {/* Stage header */}
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-t-xl border border-b-0"
                    style={{
                      backgroundColor: stage.color + "12",
                      borderColor: stage.color + "40",
                    }}>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                      <span className="text-sm font-semibold text-white">{stage.name}</span>
                      <span className="text-[10px] text-gray-500 bg-dark-card/80 px-1.5 py-0.5 rounded-full ml-1">
                        {stageContacts.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openNewContact(stage.id)}
                        className="text-gray-500 hover:text-primary transition p-1" title="Adicionar">
                        <FaPlus size={10} />
                      </button>
                      <button onClick={() => handleDeleteStage(stage.id)}
                        className="text-gray-600 hover:text-red-400 transition p-1" title="Remover etapa">
                        <FaTrash size={9} />
                      </button>
                    </div>
                  </div>

                  {/* Drop zone */}
                  <div
                    className={`flex-1 rounded-b-xl p-2 space-y-2 overflow-y-auto transition-all duration-200 border ${
                      isDragOver
                        ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                        : "border-dark-border bg-dark-cardSoft/20"
                    }`}
                    style={{ maxHeight: "calc(100vh - 200px)", minHeight: 120 }}
                    onDragOver={(e) => handleDragOver(e, stage.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, stage.id)}
                  >
                    {stageContacts.map((contact) => (
                      <div
                        key={contact.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, contact)}
                        onDragEnd={() => { setDraggedContact(null); setDragOverStage(null); }}
                        className={`bg-dark-card rounded-xl border border-dark-border p-3 cursor-grab active:cursor-grabbing hover:border-primary/40 transition-all group ${
                          draggedContact?.id === contact.id ? "opacity-40 scale-95" : ""
                        }`}
                      >
                        {/* Grip + Name */}
                        <div className="flex items-start gap-2">
                          <FaGripVertical className="text-gray-600 mt-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition" size={10} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-white truncate">
                                {contact.name || "Sem nome"}
                              </p>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition ml-2">
                                <button onClick={() => openChat(contact)}
                                  className="text-green-400 hover:text-green-300 transition p-0.5" title="Conversar">
                                  <FaWhatsapp size={13} />
                                </button>
                                <button onClick={() => openEditContact(contact)}
                                  className="text-gray-500 hover:text-primary transition p-0.5" title="Editar">
                                  <FaPen size={10} />
                                </button>
                                <button onClick={() => handleDeleteContact(contact.id)}
                                  className="text-gray-600 hover:text-red-400 transition p-0.5" title="Excluir">
                                  <FaTrash size={10} />
                                </button>
                              </div>
                            </div>
                            <p className="text-[11px] text-gray-500 font-mono flex items-center gap-1 mt-0.5">
                              <FaPhone size={8} className="text-gray-600" />
                              {contact.phone}
                            </p>
                          </div>
                        </div>

                        {/* Tags */}
                        {contact.tags && (
                          <div className="flex flex-wrap gap-1 mt-2 ml-4">
                            {contact.tags.split(",").slice(0, 3).map((tag, i) => (
                              <span key={i} className="bg-primary/10 text-primary text-[9px] px-1.5 py-0.5 rounded font-medium">
                                {tag.trim()}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Last message time */}
                        {contact.last_message_at && (
                          <p className="text-[9px] text-gray-600 mt-2 ml-4">
                            {formatDate(contact.last_message_at)}
                          </p>
                        )}
                      </div>
                    ))}

                    {stageContacts.length === 0 && (
                      <div className={`py-8 text-center rounded-lg border-2 border-dashed transition-all ${
                        isDragOver ? "border-primary/40 bg-primary/5" : "border-transparent"
                      }`}>
                        <p className="text-[10px] text-gray-600">
                          {isDragOver ? "Solte aqui" : "Arraste contatos aqui"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== LIST VIEW ===== */}
      {viewMode === "list" && (
        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          {/* Mobile: cards | Desktop: table */}
          <div className="md:hidden space-y-2 p-2">
            {filteredContacts.map((c) => (
              <div key={c.id} onClick={() => openChat(c)}
                className="bg-dark-cardSoft/50 rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-dark-cardSoft transition">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-primaryDark flex-shrink-0 flex items-center justify-center text-white font-bold text-xs">
                  {(c.name || c.phone || "?").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white truncate">{c.name || c.phone}</p>
                    {c.stage_name && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full ml-2 flex-shrink-0 font-medium"
                        style={{ backgroundColor: (c.stage_color || "#666") + "20", color: c.stage_color }}>
                        {c.stage_name}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 font-mono">{c.phone}</p>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => openEditContact(c)} className="text-gray-500 hover:text-primary transition p-1"><FaPen size={11} /></button>
                  <button onClick={() => handleDeleteContact(c.id)} className="text-gray-600 hover:text-red-400 transition p-1"><FaTrash size={11} /></button>
                </div>
              </div>
            ))}
            {filteredContacts.length === 0 && (
              <div className="py-12 text-center text-gray-500 text-sm">Nenhum contato encontrado.</div>
            )}
          </div>

          <table className="w-full text-sm hidden md:table">
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
                <tr key={c.id} className="border-b border-dark-border/50 hover:bg-dark-cardSoft/30 transition cursor-pointer"
                  onClick={() => openChat(c)}>
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{c.name || "Sem nome"}</p>
                    {c.email && <p className="text-[10px] text-gray-500">{c.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{c.phone}</td>
                  <td className="px-4 py-3">
                    {c.stage_name ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{ backgroundColor: (c.stage_color || "#666") + "20", color: c.stage_color || "#999" }}>
                        {c.stage_name}
                      </span>
                    ) : <span className="text-[10px] text-gray-600">-</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.tags ? (
                      <div className="flex flex-wrap gap-1">
                        {c.tags.split(",").map((t, i) => (
                          <span key={i} className="bg-dark-cardSoft text-gray-400 text-[10px] px-1.5 py-0.5 rounded">{t.trim()}</span>
                        ))}
                      </div>
                    ) : <span className="text-[10px] text-gray-600">-</span>}
                  </td>
                  <td className="px-4 py-3 text-[10px] text-gray-500">{formatDate(c.last_message_at)}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openChat(c)} className="text-green-400 hover:text-green-300 transition" title="Conversar">
                        <FaWhatsapp size={14} />
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
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500 text-sm">Nenhum contato encontrado.</td></tr>
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
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nome do contato"
                  className="w-full px-4 py-2.5 rounded-lg border border-dark-border bg-dark-cardSoft text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Telefone WhatsApp *</label>
                <input type="text" value={formPhone} onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="5511999999999"
                  className="w-full px-4 py-2.5 rounded-lg border border-dark-border bg-dark-cardSoft text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Email</label>
                <input type="text" value={formEmail} onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full px-4 py-2.5 rounded-lg border border-dark-border bg-dark-cardSoft text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Etapa</label>
                <select value={formStageId || ""} onChange={(e) => setFormStageId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-4 py-2.5 rounded-lg border border-dark-border bg-dark-cardSoft text-sm text-white focus:outline-none focus:border-primary">
                  <option value="">Sem etapa</option>
                  {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Tags (separadas por virgula)</label>
                <input type="text" value={formTags} onChange={(e) => setFormTags(e.target.value)}
                  placeholder="cliente, vip, novo"
                  className="w-full px-4 py-2.5 rounded-lg border border-dark-border bg-dark-cardSoft text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Observacoes</label>
                <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Anotacoes sobre o contato..." rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-dark-border bg-dark-cardSoft text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setModalContato(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-dark-cardSoft transition">Cancelar</button>
              <button onClick={handleSaveContact} disabled={salvando}
                className="px-6 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primaryLight disabled:opacity-50 transition">
                {salvando ? "Salvando..." : "Salvar"}
              </button>
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
                <input type="text" value={stageName} onChange={(e) => setStageName(e.target.value)}
                  placeholder="Ex: Qualificado, Proposta..."
                  className="w-full px-4 py-2.5 rounded-lg border border-dark-border bg-dark-cardSoft text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Cor</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={stageColor} onChange={(e) => setStageColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-dark-border bg-transparent cursor-pointer" />
                  {["#6366f1","#0a6fbe","#10b981","#f59e0b","#ef4444","#ec4899","#8b5cf6"].map((c) => (
                    <button key={c} onClick={() => setStageColor(c)}
                      className={`w-6 h-6 rounded-full transition-all ${stageColor === c ? "ring-2 ring-white ring-offset-2 ring-offset-dark-card" : ""}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setModalStage(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-dark-cardSoft transition">Cancelar</button>
              <button onClick={handleCreateStage}
                className="px-6 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primaryLight transition">Criar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ======================== CHAT VIEW COMPONENT ========================
function ChatView({ contact, authFetch, onBack, onEdit, stages, formatTime, formatDate }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const pollRef = useRef(null);

  const loadMessages = useCallback(async () => {
    try {
      const res = await authFetch(`/api/crm/contacts/${contact.id}/messages?limit=100`);
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch {} finally {
      setLoading(false);
    }
  }, [contact.id]);

  useEffect(() => {
    loadMessages();
    // Poll every 3s for new messages
    pollRef.current = setInterval(loadMessages, 3000);
    return () => clearInterval(pollRef.current);
  }, [loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    const msg = text.trim();
    setText("");
    setSending(true);

    // Optimistic
    const tempMsg = {
      id: Date.now(),
      direction: "outgoing",
      message_text: msg,
      message_type: "text",
      created_at: new Date().toISOString(),
      _sending: true,
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await authFetch(`/api/crm/contacts/${contact.id}/send`, {
        method: "POST",
        body: JSON.stringify({ text: msg }),
      });
      if (!res.ok) throw new Error();
      // Replace optimistic with real
      setMessages((prev) => prev.map((m) => m.id === tempMsg.id ? { ...m, _sending: false } : m));
      loadMessages();
    } catch {
      toast.error("Erro ao enviar mensagem");
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups = [];
    let currentDate = "";
    messages.forEach((msg) => {
      const date = new Date(msg.created_at).toLocaleDateString("pt-BR");
      if (date !== currentDate) {
        currentDate = date;
        groups.push({ type: "date", date });
      }
      groups.push({ type: "msg", ...msg });
    });
    return groups;
  }, [messages]);

  const initials = (contact.name || contact.phone || "?")
    .split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="h-[calc(100vh-48px)] flex rounded-2xl overflow-hidden border border-dark-border">
      {/* ---- Chat Area ---- */}
      <div className="flex-1 flex flex-col bg-dark-body">
        {/* Chat header */}
        <div className="flex items-center justify-between px-5 py-3 bg-dark-card border-b border-dark-border">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-gray-400 hover:text-white transition mr-1">
              <FaArrowLeft size={14} />
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primaryDark flex items-center justify-center text-white font-bold text-sm">
              {initials}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{contact.name || contact.phone}</p>
              <p className="text-[10px] text-gray-500 flex items-center gap-1">
                <FaWhatsapp size={9} className="text-green-400" />
                {contact.phone}
                {contact.instance_name && <span className="text-gray-600 ml-1">via {contact.instance_name}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowInfo(!showInfo)}
              className={`p-2 rounded-lg transition ${showInfo ? "bg-primary/10 text-primary" : "text-gray-400 hover:text-white"}`}
              title="Info do contato">
              <FaEllipsisV size={14} />
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-3"
          style={{
            backgroundImage: "radial-gradient(circle at 20% 50%, rgba(10,111,190,0.03) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(99,102,241,0.03) 0%, transparent 50%)",
          }}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <FaSpinner className="animate-spin text-primary text-xl mr-2" />
              <span className="text-gray-400 text-sm">Carregando conversa...</span>
            </div>
          ) : groupedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="w-20 h-20 rounded-full bg-dark-cardSoft flex items-center justify-center mb-4">
                <FaWhatsapp className="text-3xl text-green-400/40" />
              </div>
              <p className="text-gray-500 text-sm">Nenhuma mensagem ainda</p>
              <p className="text-gray-600 text-[10px] mt-1">Envie a primeira mensagem para iniciar a conversa</p>
            </div>
          ) : (
            <div className="space-y-1 max-w-3xl mx-auto">
              {groupedMessages.map((item, i) => {
                if (item.type === "date") {
                  return (
                    <div key={`date-${i}`} className="flex justify-center py-3">
                      <span className="bg-dark-card/80 backdrop-blur-sm text-gray-400 text-[10px] px-3 py-1 rounded-full border border-dark-border/50">
                        {item.date}
                      </span>
                    </div>
                  );
                }
                const isOut = item.direction === "outgoing";
                return (
                  <div key={item.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] px-3.5 py-2 rounded-2xl relative ${
                      isOut
                        ? "bg-primary/90 text-white rounded-br-md"
                        : "bg-dark-card text-gray-200 rounded-bl-md border border-dark-border/50"
                    }`}>
                      <p className="text-[13px] leading-relaxed break-words whitespace-pre-wrap">
                        {item.message_text || `[${item.message_type}]`}
                      </p>
                      <div className={`flex items-center justify-end gap-1 mt-1 ${isOut ? "text-white/50" : "text-gray-500"}`}>
                        <span className="text-[9px]">{formatTime(item.created_at)}</span>
                        {isOut && (
                          item._sending
                            ? <FaCheck size={8} className="text-white/30" />
                            : <FaCheckDouble size={8} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="px-4 py-3 bg-dark-card border-t border-dark-border">
          <div className="flex items-end gap-2 max-w-3xl mx-auto">
            <div className="flex-1 bg-dark-cardSoft border border-dark-border rounded-2xl px-4 py-2.5 flex items-end">
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite uma mensagem..."
                rows={1}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-600 focus:outline-none resize-none max-h-32"
                style={{ minHeight: "20px" }}
                onInput={(e) => {
                  e.target.style.height = "20px";
                  e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
                }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                text.trim()
                  ? "bg-primary hover:bg-primaryLight text-white shadow-lg shadow-primary/30"
                  : "bg-dark-cardSoft text-gray-600"
              }`}
            >
              {sending
                ? <FaSpinner className="animate-spin" size={14} />
                : <FaPaperPlane size={14} className={text.trim() ? "" : ""} />
              }
            </button>
          </div>
        </div>
      </div>

      {/* ---- Contact Info Sidebar ---- */}
      {showInfo && (
        <div className="w-80 bg-dark-card border-l border-dark-border flex flex-col overflow-y-auto">
          {/* Avatar + Name */}
          <div className="flex flex-col items-center py-6 border-b border-dark-border">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primaryDark flex items-center justify-center text-white font-bold text-2xl mb-3">
              {initials}
            </div>
            <p className="text-white font-semibold text-base">{contact.name || "Sem nome"}</p>
            <p className="text-gray-500 text-xs font-mono mt-0.5">{contact.phone}</p>
            {contact.stage_name && (
              <span className="mt-2 px-3 py-1 rounded-full text-[10px] font-medium"
                style={{ backgroundColor: (contact.stage_color || "#666") + "20", color: contact.stage_color }}>
                {contact.stage_name}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="p-4 space-y-4">
            {contact.email && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase font-medium mb-1 flex items-center gap-1">
                  <FaEnvelope size={8} /> Email
                </p>
                <p className="text-xs text-gray-300">{contact.email}</p>
              </div>
            )}

            {contact.tags && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase font-medium mb-1.5 flex items-center gap-1">
                  <FaTags size={8} /> Tags
                </p>
                <div className="flex flex-wrap gap-1">
                  {contact.tags.split(",").map((tag, i) => (
                    <span key={i} className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-medium">
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {contact.notes && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase font-medium mb-1 flex items-center gap-1">
                  <FaStickyNote size={8} /> Observacoes
                </p>
                <p className="text-xs text-gray-400 leading-relaxed">{contact.notes}</p>
              </div>
            )}

            {contact.instance_name && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase font-medium mb-1 flex items-center gap-1">
                  <FaWhatsapp size={8} /> Instancia
                </p>
                <p className="text-xs text-gray-300">{contact.instance_name}</p>
              </div>
            )}

            <div>
              <p className="text-[10px] text-gray-500 uppercase font-medium mb-1">Criado em</p>
              <p className="text-xs text-gray-400">{formatDate(contact.created_at)}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 mt-auto border-t border-dark-border space-y-2">
            <button onClick={onEdit}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-dark-cardSoft text-gray-300 text-xs font-medium hover:bg-dark-cardSoft/80 transition">
              <FaPen size={10} /> Editar Contato
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
