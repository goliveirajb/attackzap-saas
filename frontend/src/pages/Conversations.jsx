import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import {
  FaWhatsapp, FaSearch, FaSpinner, FaPaperPlane, FaCheck, FaCheckDouble,
  FaArrowLeft, FaEllipsisV, FaTimes, FaPhone, FaEnvelope, FaTags,
  FaStickyNote, FaPen, FaImage, FaMicrophone, FaVideo, FaFile,
  FaSmile, FaPaperclip,
} from "react-icons/fa";

const EMOJI_LIST = [
  "😀","😂","🤣","😊","😍","🥰","😘","😜","🤔","😎",
  "🤩","🥳","😇","🤗","🤭","😏","😌","😴","🤮","😷",
  "👍","👎","👏","🙌","🤝","💪","🙏","❤️","🔥","⭐",
  "💯","✅","❌","⚡","🎉","🎯","💰","📱","💬","📞",
  "🕐","📅","📍","🏠","🚗","✈️","🎁","🛒","📦","💼",
  "👋","🤞","✌️","🤙","👀","💡","🔑","📝","💳","🏷️",
];

const formatTime = (d) => {
  if (!d) return "";
  return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

const formatChatDate = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  const now = new Date();
  const diff = now - dt;
  const oneDay = 86400000;
  if (diff < oneDay && dt.getDate() === now.getDate()) return formatTime(d);
  if (diff < oneDay * 2) return "Ontem";
  if (diff < oneDay * 7) return dt.toLocaleDateString("pt-BR", { weekday: "short" });
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

const formatFullDate = (d) => {
  if (!d) return "";
  return new Date(d).toLocaleDateString("pt-BR") + " " + formatTime(d);
};

const msgTypeIcon = (type) => {
  if (type === "image") return <FaImage size={10} className="inline mr-1 text-gray-500" />;
  if (type === "video") return <FaVideo size={10} className="inline mr-1 text-gray-500" />;
  if (type === "audio") return <FaMicrophone size={10} className="inline mr-1 text-gray-500" />;
  if (type === "document") return <FaFile size={10} className="inline mr-1 text-gray-500" />;
  return null;
};

export default function Conversations() {
  const { authFetch } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeChat, setActiveChat] = useState(null);
  const [lastMessages, setLastMessages] = useState({});

  const load = async () => {
    try {
      const res = await authFetch("/api/crm/contacts");
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      // Sort by last_message_at desc
      list.sort((a, b) => {
        const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return tb - ta;
      });
      setContacts(list);
    } catch {
      toast.error("Erro ao carregar conversas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Poll contacts every 5s
  useEffect(() => {
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) => (c.name && c.name.toLowerCase().includes(q)) || c.phone.includes(q)
    );
  }, [contacts, search]);

  const getInitials = (c) =>
    (c.name || c.phone || "?").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const openChat = (c) => setActiveChat(c);
  const closeChat = () => { setActiveChat(null); load(); };

  // ===================== MOBILE: show chat or list =====================
  // Desktop: side by side | Mobile: one at a time
  return (
    <div className="h-[calc(100vh-48px)] md:h-[calc(100vh-48px)] flex rounded-2xl overflow-hidden border border-dark-border bg-dark-card">
      {/* ===== CHAT LIST (left panel) ===== */}
      <div className={`w-full md:w-[360px] lg:w-[400px] flex-shrink-0 flex flex-col border-r border-dark-border bg-dark-card
        ${activeChat ? "hidden md:flex" : "flex"}`}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-dark-border">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <FaWhatsapp className="text-green-400" /> Conversas
            </h1>
            <span className="text-[10px] text-gray-500 bg-dark-cardSoft px-2 py-1 rounded-full">
              {contacts.length}
            </span>
          </div>
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversa..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-dark-cardSoft border border-dark-border text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <FaSpinner className="animate-spin text-primary mr-2" />
              <span className="text-sm text-gray-400">Carregando...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <FaWhatsapp className="text-3xl text-gray-600 mb-3" />
              <p className="text-sm text-gray-500">
                {search ? "Nenhum resultado" : "Nenhuma conversa"}
              </p>
            </div>
          ) : (
            filtered.map((c) => {
              const isActive = activeChat?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => openChat(c)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all border-b border-dark-border/30 ${
                    isActive
                      ? "bg-primary/10 border-l-2 border-l-primary"
                      : "hover:bg-dark-cardSoft/50"
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/80 to-primaryDark flex-shrink-0 flex items-center justify-center text-white font-bold text-sm">
                    {getInitials(c)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white truncate">
                        {c.name || c.phone}
                      </p>
                      <span className={`text-[10px] flex-shrink-0 ml-2 ${
                        c.last_message_at ? "text-primary" : "text-gray-600"
                      }`}>
                        {formatChatDate(c.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-gray-500 truncate">
                        {c.name ? c.phone : "Toque para abrir"}
                      </p>
                      {c.stage_name && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded-full flex-shrink-0 ml-2 font-medium"
                          style={{ backgroundColor: (c.stage_color || "#666") + "20", color: c.stage_color }}>
                          {c.stage_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ===== CHAT AREA (right panel) ===== */}
      <div className={`flex-1 flex flex-col bg-dark-body ${activeChat ? "flex" : "hidden md:flex"}`}>
        {activeChat ? (
          <ChatPanel
            contact={activeChat}
            authFetch={authFetch}
            onBack={closeChat}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-dark-cardSoft flex items-center justify-center mb-4">
              <FaWhatsapp className="text-4xl text-green-400/30" />
            </div>
            <p className="text-gray-500 text-sm font-medium">AttackZap CRM</p>
            <p className="text-gray-600 text-xs mt-1">Selecione uma conversa para comecar</p>
          </div>
        )}
      </div>
    </div>
  );
}


// ======================== CHAT PANEL ========================
function ChatPanel({ contact: initialContact, authFetch, onBack }) {
  const [contact, setContact] = useState(initialContact);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [editing, setEditing] = useState(false);
  const [stages, setStages] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const pollRef = useRef(null);

  // Edit form
  const [editName, setEditName] = useState(contact.name || "");
  const [editPhone, setEditPhone] = useState(contact.phone || "");
  const [editEmail, setEditEmail] = useState(contact.email || "");
  const [editTags, setEditTags] = useState(contact.tags || "");
  const [editNotes, setEditNotes] = useState(contact.notes || "");
  const [editStageId, setEditStageId] = useState(contact.stage_id || null);
  const [savingContact, setSavingContact] = useState(false);

  // Load stages for the dropdown
  useEffect(() => {
    authFetch("/api/crm/stages").then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setStages(d);
    }).catch(() => {});
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const res = await authFetch(`/api/crm/contacts/${contact.id}/messages?limit=100`);
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  }, [contact.id]);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    loadMessages();
    pollRef.current = setInterval(loadMessages, 3000);
    return () => clearInterval(pollRef.current);
  }, [loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => { inputRef.current?.focus(); }, [contact.id]);

  // Sync edit form when contact changes
  useEffect(() => {
    setContact(initialContact);
    setEditName(initialContact.name || "");
    setEditPhone(initialContact.phone || "");
    setEditEmail(initialContact.email || "");
    setEditTags(initialContact.tags || "");
    setEditNotes(initialContact.notes || "");
    setEditStageId(initialContact.stage_id || null);
  }, [initialContact]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    const msg = text.trim();
    setText("");
    setSending(true);

    const tempMsg = {
      id: Date.now(), direction: "outgoing", message_text: msg,
      message_type: "text", created_at: new Date().toISOString(), _sending: true,
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await authFetch(`/api/crm/contacts/${contact.id}/send`, {
        method: "POST", body: JSON.stringify({ text: msg }),
      });
      if (!res.ok) throw new Error();
      setMessages((prev) => prev.map((m) => m.id === tempMsg.id ? { ...m, _sending: false } : m));
      loadMessages();
    } catch {
      toast.error("Erro ao enviar");
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleMediaUpload = async (file) => {
    if (!file) return;
    const maxSize = 15 * 1024 * 1024; // 15MB
    if (file.size > maxSize) return toast.error("Arquivo muito grande (max 15MB)");

    setUploadingMedia(true);
    const toastId = toast.loading("Enviando arquivo...");

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const isVideo = file.type.startsWith("video/");
      const mediaType = isVideo ? "video" : "image";

      const res = await authFetch(`/api/crm/contacts/${contact.id}/send-media`, {
        method: "POST",
        body: JSON.stringify({ base64, caption: text.trim() || "", mediaType }),
      });
      toast.dismiss(toastId);
      if (!res.ok) throw new Error();

      setText("");
      toast.success(`${isVideo ? "Video" : "Imagem"} enviado!`);
      loadMessages();
    } catch {
      toast.dismiss(toastId);
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploadingMedia(false);
    }
  };

  const insertEmoji = (emoji) => {
    setText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const handleSaveContact = async () => {
    if (!editPhone.trim()) return toast.error("Telefone obrigatorio");
    setSavingContact(true);
    try {
      const res = await authFetch(`/api/crm/contacts/${contact.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editName || null,
          phone: editPhone.trim(),
          email: editEmail || null,
          tags: editTags || null,
          notes: editNotes || null,
          stage_id: editStageId,
        }),
      });
      if (!res.ok) throw new Error();
      // Update local contact
      const stageDef = stages.find((s) => s.id === editStageId);
      setContact((prev) => ({
        ...prev,
        name: editName, phone: editPhone.trim(), email: editEmail,
        tags: editTags, notes: editNotes, stage_id: editStageId,
        stage_name: stageDef?.name || prev.stage_name,
        stage_color: stageDef?.color || prev.stage_color,
      }));
      setEditing(false);
      toast.success("Contato atualizado!");
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSavingContact(false);
    }
  };

  const groupedMessages = useMemo(() => {
    const groups = [];
    let currentDate = "";
    messages.forEach((msg) => {
      const date = new Date(msg.created_at).toLocaleDateString("pt-BR");
      if (date !== currentDate) { currentDate = date; groups.push({ type: "date", date }); }
      groups.push({ type: "msg", ...msg });
    });
    return groups;
  }, [messages]);

  const initials = (contact.name || contact.phone || "?")
    .split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-3 md:px-5 py-3 bg-dark-card border-b border-dark-border">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition md:mr-1">
            <FaArrowLeft size={14} />
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primaryDark flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{contact.name || contact.phone}</p>
            <p className="text-[10px] text-gray-500 flex items-center gap-1 truncate">
              <FaWhatsapp size={9} className="text-green-400 flex-shrink-0" />
              {contact.phone}
              {contact.stage_name && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[8px] font-medium"
                  style={{ backgroundColor: (contact.stage_color || "#666") + "20", color: contact.stage_color }}>
                  {contact.stage_name}
                </span>
              )}
            </p>
          </div>
        </div>
        <button onClick={() => { setShowInfo(!showInfo); setEditing(false); }}
          className={`p-2 rounded-lg transition ${showInfo ? "bg-primary/10 text-primary" : "text-gray-400 hover:text-white"}`}>
          <FaEllipsisV size={14} />
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Messages */}
        <div className={`flex-1 flex flex-col ${showInfo ? "hidden md:flex" : "flex"}`}>
          <div className="flex-1 overflow-y-auto px-3 md:px-4 py-3"
            style={{ backgroundImage: "radial-gradient(circle at 20% 50%, rgba(10,111,190,0.03) 0%, transparent 50%)" }}>
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <FaSpinner className="animate-spin text-primary text-xl mr-2" />
                <span className="text-gray-400 text-sm">Carregando...</span>
              </div>
            ) : groupedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <FaWhatsapp className="text-3xl text-green-400/30 mb-3" />
                <p className="text-gray-500 text-sm">Nenhuma mensagem</p>
                <p className="text-gray-600 text-[10px] mt-1">Envie a primeira mensagem</p>
              </div>
            ) : (
              <div className="space-y-1 max-w-2xl mx-auto">
                {groupedMessages.map((item, i) => {
                  if (item.type === "date") {
                    return (
                      <div key={`d-${i}`} className="flex justify-center py-3">
                        <span className="bg-dark-card/80 backdrop-blur-sm text-gray-400 text-[10px] px-3 py-1 rounded-full border border-dark-border/50">
                          {item.date}
                        </span>
                      </div>
                    );
                  }
                  const isOut = item.direction === "outgoing";
                  return (
                    <div key={item.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] md:max-w-[70%] px-3 py-2 rounded-2xl ${
                        isOut
                          ? "bg-primary/90 text-white rounded-br-md"
                          : "bg-dark-card text-gray-200 rounded-bl-md border border-dark-border/50"
                      }`}>
                        <p className="text-[13px] leading-relaxed break-words whitespace-pre-wrap">
                          {msgTypeIcon(item.message_type)}
                          {item.message_text || `[${item.message_type}]`}
                        </p>
                        <div className={`flex items-center justify-end gap-1 mt-0.5 ${isOut ? "text-white/50" : "text-gray-500"}`}>
                          <span className="text-[9px]">{formatTime(item.created_at)}</span>
                          {isOut && (item._sending ? <FaCheck size={7} className="text-white/30" /> : <FaCheckDouble size={7} />)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Emoji Picker */}
          {showEmoji && (
            <div className="px-3 md:px-4 py-2 bg-dark-card border-t border-dark-border">
              <div className="max-w-2xl mx-auto grid grid-cols-10 gap-1 max-h-32 overflow-y-auto">
                {EMOJI_LIST.map((e, i) => (
                  <button key={i} onClick={() => insertEmoji(e)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-dark-cardSoft transition text-lg">
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-3 md:px-4 py-2.5 bg-dark-card border-t border-dark-border">
            <div className="flex items-end gap-1.5 md:gap-2 max-w-2xl mx-auto">
              <button onClick={() => setShowEmoji(!showEmoji)}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition flex-shrink-0 ${
                  showEmoji ? "bg-primary/10 text-primary" : "text-gray-500 hover:text-gray-300"
                }`} title="Emojis">
                <FaSmile size={16} />
              </button>

              <button onClick={() => fileInputRef.current?.click()} disabled={uploadingMedia}
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-300 transition flex-shrink-0"
                title="Enviar imagem ou video">
                <FaPaperclip size={15} />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden"
                onChange={(e) => { if (e.target.files[0]) handleMediaUpload(e.target.files[0]); e.target.value = ""; }} />

              <div className="flex-1 bg-dark-cardSoft border border-dark-border rounded-2xl px-3 md:px-4 py-2 flex items-end">
                <textarea
                  ref={inputRef} value={text}
                  onChange={(e) => { setText(e.target.value); setShowEmoji(false); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Mensagem..."
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-600 focus:outline-none resize-none max-h-28"
                  style={{ minHeight: "20px" }}
                  onInput={(e) => { e.target.style.height = "20px"; e.target.style.height = Math.min(e.target.scrollHeight, 112) + "px"; }}
                />
              </div>

              <button onClick={handleSend} disabled={(!text.trim() && !uploadingMedia) || sending}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                  text.trim() ? "bg-primary hover:bg-primaryLight text-white shadow-lg shadow-primary/30" : "bg-dark-cardSoft text-gray-600"
                }`}>
                {sending || uploadingMedia ? <FaSpinner className="animate-spin" size={13} /> : <FaPaperPlane size={13} />}
              </button>
            </div>
          </div>
        </div>

        {/* ---- Contact Info / Edit Sidebar ---- */}
        {showInfo && (
          <div className="w-full md:w-80 flex flex-col bg-dark-card border-l border-dark-border overflow-y-auto">
            {/* Avatar + basic info */}
            <div className="flex flex-col items-center py-5 border-b border-dark-border">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primaryDark flex items-center justify-center text-white font-bold text-xl mb-2">
                {initials}
              </div>
              <p className="text-white font-semibold">{contact.name || "Sem nome"}</p>
              <p className="text-gray-500 text-xs font-mono mt-0.5">{contact.phone}</p>
              {contact.stage_name && !editing && (
                <span className="mt-2 px-3 py-1 rounded-full text-[10px] font-medium"
                  style={{ backgroundColor: (contact.stage_color || "#666") + "20", color: contact.stage_color }}>
                  {contact.stage_name}
                </span>
              )}
            </div>

            {/* Toggle edit/view */}
            {!editing ? (
              <>
                {/* View mode */}
                <div className="p-4 space-y-3 text-xs flex-1">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase font-medium mb-0.5"><FaPhone size={8} className="inline mr-1" />Telefone</p>
                    <p className="text-gray-300 font-mono">{contact.phone}</p>
                  </div>
                  {contact.email && (
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase font-medium mb-0.5"><FaEnvelope size={8} className="inline mr-1" />Email</p>
                      <p className="text-gray-300">{contact.email}</p>
                    </div>
                  )}
                  {contact.tags && (
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase font-medium mb-1"><FaTags size={8} className="inline mr-1" />Tags</p>
                      <div className="flex flex-wrap gap-1">
                        {contact.tags.split(",").map((t, i) => (
                          <span key={i} className="bg-primary/10 text-primary text-[9px] px-1.5 py-0.5 rounded-full">{t.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {contact.notes && (
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase font-medium mb-0.5"><FaStickyNote size={8} className="inline mr-1" />Observacoes</p>
                      <p className="text-gray-400 leading-relaxed">{contact.notes}</p>
                    </div>
                  )}
                  {contact.instance_name && (
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase font-medium mb-0.5"><FaWhatsapp size={8} className="inline mr-1" />Instancia</p>
                      <p className="text-gray-300">{contact.instance_name}</p>
                    </div>
                  )}
                </div>
                <div className="p-3 border-t border-dark-border flex gap-2">
                  <button onClick={() => setEditing(true)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition">
                    <FaPen size={10} /> Editar Cadastro
                  </button>
                  <button onClick={() => setShowInfo(false)}
                    className="px-3 py-2.5 rounded-xl bg-dark-cardSoft text-gray-400 text-xs hover:bg-dark-cardSoft/80 transition md:hidden">
                    <FaTimes size={12} />
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Edit mode */}
                <div className="p-4 space-y-3 flex-1">
                  <p className="text-xs font-semibold text-white flex items-center gap-1.5 mb-1">
                    <FaPen size={10} className="text-primary" /> Editar Cadastro
                  </p>

                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase mb-0.5">Nome</label>
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                      placeholder="Nome do contato"
                      className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-cardSoft text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-primary" />
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase mb-0.5">Telefone *</label>
                    <input type="text" value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="5511999999999"
                      className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-cardSoft text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-primary" />
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase mb-0.5">Email</label>
                    <input type="text" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="email@exemplo.com"
                      className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-cardSoft text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-primary" />
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase mb-0.5">Etapa</label>
                    <select value={editStageId || ""} onChange={(e) => setEditStageId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-cardSoft text-xs text-white focus:outline-none focus:border-primary">
                      <option value="">Sem etapa</option>
                      {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase mb-0.5">Tags</label>
                    <input type="text" value={editTags} onChange={(e) => setEditTags(e.target.value)}
                      placeholder="cliente, vip, novo"
                      className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-cardSoft text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-primary" />
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase mb-0.5">Observacoes</label>
                    <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Anotacoes..." rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-cardSoft text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-primary resize-none" />
                  </div>
                </div>

                <div className="p-3 border-t border-dark-border flex gap-2">
                  <button onClick={() => setEditing(false)}
                    className="flex-1 py-2.5 rounded-xl bg-dark-cardSoft text-gray-400 text-xs font-medium hover:bg-dark-cardSoft/80 transition">
                    Cancelar
                  </button>
                  <button onClick={handleSaveContact} disabled={savingContact}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primaryLight disabled:opacity-50 transition">
                    {savingContact ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
