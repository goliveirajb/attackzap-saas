import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import {
  FaWhatsapp, FaSearch, FaSpinner, FaPaperPlane, FaCheck, FaCheckDouble,
  FaArrowLeft, FaEllipsisV, FaTimes, FaPhone, FaEnvelope, FaTags,
  FaStickyNote, FaPen, FaImage, FaMicrophone, FaVideo, FaFile,
  FaSmile, FaPaperclip, FaTrash,
  FaBolt, FaPlus, FaUsers, FaChevronDown, FaThumbtack, FaArchive,
} from "react-icons/fa";

// Send sound - short "whoosh" tone
let _sendAudio = null;
function playSendSound() {
  try {
    if (!_sendAudio) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 0.15); // 150ms
      const buf = ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const freq = 600 + t * 3000; // rising sweep 600→1050Hz
        const env = Math.pow(1 - i / len, 2); // quick decay
        d[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.3;
      }
      _sendAudio = { ctx, buf };
    }
    const { ctx, buf } = _sendAudio;
    if (ctx.state === "suspended") ctx.resume();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start();
  } catch {}
}

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
  return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
};

const formatChatDate = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  const now = new Date();
  const diff = now - dt;
  const oneDay = 86400000;
  if (diff < oneDay && dt.getDate() === now.getDate()) return formatTime(d);
  if (diff < oneDay * 2) return "Ontem";
  if (diff < oneDay * 7) return dt.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" });
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
};

// Cache profile pics in memory to avoid re-fetching
const profilePicCache = {};

const AVATAR_SIZES = {
  10: { cls: "w-10 h-10", icon: 16 },
  12: { cls: "w-12 h-12", icon: 18 },
  13: { cls: "w-[52px] h-[52px]", icon: 20 },
  16: { cls: "w-16 h-16", icon: 24 },
};

function ContactAvatar({ contact, size = 12, textSize = "text-sm", authFetch }) {
  const [picUrl, setPicUrl] = useState(profilePicCache[contact.id] || contact.profile_pic_url || null);
  const [failed, setFailed] = useState(false);
  const initials = (contact.name || contact.phone || "?").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const s = AVATAR_SIZES[size] || AVATAR_SIZES[12];

  useEffect(() => {
    // If we already have a cached result, use it
    if (contact.id in profilePicCache) {
      if (profilePicCache[contact.id]) setPicUrl(profilePicCache[contact.id]);
      else setFailed(true);
      return;
    }
    // If contact has a stored URL, try it
    if (contact.profile_pic_url) {
      profilePicCache[contact.id] = contact.profile_pic_url;
      setPicUrl(contact.profile_pic_url);
      return;
    }
    // Fetch from API
    let cancelled = false;
    authFetch(`/api/crm/contacts/${contact.id}/profile-pic`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.url) {
          profilePicCache[contact.id] = data.url;
          setPicUrl(data.url);
        } else {
          profilePicCache[contact.id] = false;
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          profilePicCache[contact.id] = false;
          setFailed(true);
        }
      });
    return () => { cancelled = true; };
  }, [contact.id]);

  if (picUrl && !failed) {
    return (
      <img
        src={picUrl}
        alt=""
        className={`${s.cls} rounded-full object-cover`}
        onError={() => { setFailed(true); profilePicCache[contact.id] = false; }}
      />
    );
  }

  return (
    <div className={`${s.cls} rounded-full flex items-center justify-center text-white font-bold ${textSize} ${
      contact.is_group ? "bg-gradient-to-br from-green-600 to-green-800" : "bg-gradient-to-br from-primary/80 to-primaryDark"
    }`}>
      {contact.is_group ? <FaUsers size={s.icon} /> : initials}
    </div>
  );
}

const msgTypeIcon = (type) => {
  if (type === "image") return <FaImage size={10} className="inline mr-1 text-gray-500" />;
  if (type === "video") return <FaVideo size={10} className="inline mr-1 text-gray-500" />;
  if (type === "audio") return <FaMicrophone size={10} className="inline mr-1 text-gray-500" />;
  if (type === "document") return <FaFile size={10} className="inline mr-1 text-gray-500" />;
  return null;
};

export default function Conversations() {
  const { authFetch, subscribeEvents, resetUnread } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState(null); // null = all, stage_id, "none", or "groups"
  const [instanceFilter, setInstanceFilter] = useState(null); // null = all, instance_id
  const [showArchived, setShowArchived] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const activeChatRef = useRef(null);
  const [dropdownId, setDropdownId] = useState(null);

  const load = async () => {
    try {
      const res = await authFetch("/api/crm/contacts");
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => {
        const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return tb - ta;
      });
      setContacts(list);

      // Sync group names in background - fix groups showing phone numbers
      const hasGroupsWithPhoneName = list.some((c) => c.is_group && (c.name === c.phone || !c.name));
      if (hasGroupsWithPhoneName) {
        authFetch("/api/crm/sync-group-names", { method: "POST" })
          .then(() => load())
          .catch(() => {});
      }
    } catch {
      toast.error("Erro ao carregar conversas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); resetUnread(); }, []);

  // Reload when tab/app becomes visible again (user returns from another page or app)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    // Also reload on window focus (covers switching tabs/apps)
    window.addEventListener("focus", load);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
    };
  }, []);

  // Real-time updates via SSE - instant contact list update without refetch
  useEffect(() => {
    if (!subscribeEvents) return;
    return subscribeEvents((event) => {
      if (event.type === "new_message") {
        const isActiveChat = activeChatRef.current?.id === event.contactId;

        setContacts((prev) => {
          const idx = prev.findIndex((c) => c.id === event.contactId);
          if (idx >= 0) {
            const updated = [...prev];
            const contact = {
              ...updated[idx],
              last_message_at: event.createdAt,
              last_message_text: event.messageText || `[${event.messageType}]`,
              last_message_type: event.messageType,
              last_message_direction: event.direction,
            };
            // Only increment unread if chat is NOT currently open
            if (event.direction === "incoming" && !isActiveChat) {
              contact.unread_count = (Number(contact.unread_count) || 0) + 1;
            }
            updated.splice(idx, 1);
            updated.unshift(contact);
            return updated;
          }
          load();
          return prev;
        });

        // Show in-app toast for incoming messages from other contacts
        if (event.direction === "incoming" && !isActiveChat) {
          toast(
            `${event.contactName || event.phone}: ${event.messageText?.slice(0, 60) || `[${event.messageType}]`}`,
            { icon: "💬", duration: 4000, style: { background: "#202c33", color: "#e9edef", fontSize: "13px" } }
          );
        }
      }
    });
  }, [subscribeEvents]);

  // Fallback poll every 30s (SSE handles real-time)
  useEffect(() => {
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  // Extract unique instances from contacts
  const instances = useMemo(() => {
    const map = new Map();
    contacts.forEach((c) => {
      if (c.instance_id && c.instance_name) {
        map.set(c.instance_id, { id: c.instance_id, name: c.instance_name });
      }
    });
    return Array.from(map.values());
  }, [contacts]);

  // Extract unique stages from contacts
  const stages = useMemo(() => {
    const map = new Map();
    contacts.forEach((c) => {
      if (c.stage_id && c.stage_name) {
        map.set(c.stage_id, { id: c.stage_id, name: c.stage_name, color: c.stage_color });
      }
    });
    return Array.from(map.values());
  }, [contacts]);

  // Count archived per instance
  const archivedCount = useMemo(() => {
    if (instanceFilter !== null) {
      return contacts.filter((c) => c.archived && c.instance_id === instanceFilter).length;
    }
    return contacts.filter((c) => c.archived).length;
  }, [contacts, instanceFilter]);

  const filtered = useMemo(() => {
    let list = contacts;
    // Instance filter
    if (instanceFilter !== null) {
      list = list.filter((c) => c.instance_id === instanceFilter);
    }
    // Archived filter
    if (showArchived) {
      list = list.filter((c) => c.archived);
    } else {
      list = list.filter((c) => !c.archived);
    }
    // Stage filter
    if (stageFilter === "groups") {
      list = list.filter((c) => c.is_group);
    } else if (stageFilter === "none") {
      list = list.filter((c) => !c.stage_id && !c.is_group);
    } else if (stageFilter !== null) {
      list = list.filter((c) => c.stage_id === stageFilter);
    }
    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) => (c.name && c.name.toLowerCase().includes(q)) || c.phone.includes(q)
      );
    }
    // Sort pinned first, then by last_message_at
    list.sort((a, b) => {
      const pa = a.pinned ? 1 : 0;
      const pb = b.pinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return tb - ta;
    });
    return list;
  }, [contacts, search, stageFilter, instanceFilter, showArchived]);

  const openChat = (c) => {
    setActiveChat(c);
    activeChatRef.current = c;
    if (Number(c.unread_count) > 0) {
      setContacts((prev) => prev.map((ct) => ct.id === c.id ? { ...ct, unread_count: 0 } : ct));
    }
    // Push history state so native back button closes chat
    window.history.pushState({ chatOpen: true }, "");
  };
  const closeChat = useCallback(() => {
    setActiveChat(null);
    activeChatRef.current = null;
    load();
  }, []);

  // Handle browser/mobile back button
  useEffect(() => {
    const onPopState = (e) => {
      if (activeChatRef.current) {
        setActiveChat(null);
        activeChatRef.current = null;
        load();
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const togglePin = async (contactId, currentPinned) => {
    const pinned = !currentPinned;
    setContacts((prev) => prev.map((c) => c.id === contactId ? { ...c, pinned } : c));
    setDropdownId(null);
    try {
      await authFetch(`/api/crm/contacts/${contactId}/pin`, {
        method: "PUT",
        body: JSON.stringify({ pinned }),
      });
    } catch {
      setContacts((prev) => prev.map((c) => c.id === contactId ? { ...c, pinned: currentPinned } : c));
    }
  };

  const toggleArchive = async (contactId, currentArchived) => {
    const archived = !currentArchived;
    setContacts((prev) => prev.map((c) => c.id === contactId ? { ...c, archived } : c));
    setDropdownId(null);
    try {
      await authFetch(`/api/crm/contacts/${contactId}/archive`, {
        method: "PUT",
        body: JSON.stringify({ archived }),
      });
    } catch {
      setContacts((prev) => prev.map((c) => c.id === contactId ? { ...c, archived: currentArchived } : c));
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownId) return;
    const close = () => setDropdownId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [dropdownId]);

  // Hide/show bottom nav + mobile header when chat is open (mobile)
  useEffect(() => {
    const nav = document.getElementById("bottom-nav");
    const header = document.getElementById("mobile-header");
    const main = document.getElementById("main-content");
    if (activeChat) {
      if (nav) nav.style.display = "none";
      if (header) header.style.display = "none";
      if (main) { main.style.padding = "0"; main.style.overflow = "hidden"; }
    } else {
      if (nav) nav.style.display = "";
      if (header) header.style.display = "";
      if (main) { main.style.padding = ""; main.style.overflow = ""; }
    }
    return () => {
      if (nav) nav.style.display = "";
      if (header) header.style.display = "";
      if (main) { main.style.padding = ""; main.style.overflow = ""; }
    };
  }, [activeChat]);

  return (
    <div className={`flex overflow-hidden bg-dark-card h-full ${activeChat ? "fixed inset-0 z-40 md:static md:z-auto" : ""}`}>
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
              {instanceFilter !== null || stageFilter !== null || search.trim() ? `${filtered.length}/${contacts.length}` : contacts.length}
            </span>
          </div>

          {/* Instance tabs */}
          {instances.length > 1 && (
            <div className="flex gap-1 mb-2">
              <button
                onClick={() => setInstanceFilter(null)}
                className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all flex-1 text-center ${
                  instanceFilter === null
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : "bg-dark-cardSoft text-gray-500 hover:text-white border border-transparent"
                }`}
              >
                Todas
              </button>
              {instances.map((inst) => (
                <button
                  key={inst.id}
                  onClick={() => setInstanceFilter(instanceFilter === inst.id ? null : inst.id)}
                  className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all flex-1 text-center truncate ${
                    instanceFilter === inst.id
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "bg-dark-cardSoft text-gray-500 hover:text-white border border-transparent"
                  }`}
                >
                  <FaWhatsapp size={10} className="inline mr-1" />{inst.name}
                </button>
              ))}
            </div>
          )}

          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversa..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-dark-cardSoft border border-dark-border text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary"
            />
          </div>

          {/* Stage filter chips */}
          {(stages.length > 0 || contacts.some((c) => c.is_group)) && (
            <div className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setStageFilter(null)}
                className={`text-[10px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                  stageFilter === null
                    ? "bg-primary text-white"
                    : "bg-dark-cardSoft text-gray-400 hover:text-white"
                }`}
              >
                Todas
              </button>
              {stages.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStageFilter(stageFilter === s.id ? null : s.id)}
                  className={`text-[10px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                    stageFilter === s.id
                      ? "text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                  style={
                    stageFilter === s.id
                      ? { backgroundColor: s.color || "#0a6fbe" }
                      : { backgroundColor: (s.color || "#666") + "15", color: stageFilter === s.id ? "#fff" : s.color }
                  }
                >
                  {s.name}
                </button>
              ))}
              <button
                onClick={() => setStageFilter(stageFilter === "none" ? null : "none")}
                className={`text-[10px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                  stageFilter === "none"
                    ? "bg-gray-600 text-white"
                    : "bg-dark-cardSoft text-gray-500 hover:text-white"
                }`}
              >
                Sem etapa
              </button>
              <button
                onClick={() => setStageFilter(stageFilter === "groups" ? null : "groups")}
                className={`text-[10px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition-all flex-shrink-0 flex items-center gap-1 ${
                  stageFilter === "groups"
                    ? "bg-green-600 text-white"
                    : "bg-dark-cardSoft text-gray-500 hover:text-white"
                }`}
              >
                <FaUsers size={8} /> Grupos
              </button>
            </div>
          )}
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto">
          {/* Archived toggle */}
          {!showArchived && archivedCount > 0 && (
            <button
              onClick={() => setShowArchived(true)}
              className="w-full flex items-center gap-3 px-5 py-3 text-sm text-gray-400 hover:bg-dark-cardSoft transition border-b border-dark-border"
            >
              <FaArchive size={14} className="text-green-500" />
              <span>Arquivadas</span>
              <span className="ml-auto text-xs bg-dark-cardSoft px-2 py-0.5 rounded-full text-gray-500">{archivedCount}</span>
            </button>
          )}
          {showArchived && (
            <button
              onClick={() => setShowArchived(false)}
              className="w-full flex items-center gap-3 px-5 py-3 text-sm text-green-400 bg-green-500/10 hover:bg-green-500/15 transition border-b border-dark-border"
            >
              <FaArrowLeft size={12} />
              <span>Voltar das arquivadas</span>
              <span className="ml-auto text-xs text-gray-500">{filtered.length}</span>
            </button>
          )}
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
              const unread = Number(c.unread_count) || 0;
              return (
                <div
                  key={c.id}
                  onClick={() => openChat(c)}
                  className={`group flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all border-b border-dark-border/30 relative ${
                    isActive
                      ? "bg-primary/10 border-l-2 border-l-primary"
                      : "hover:bg-dark-cardSoft/50"
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative w-[52px] h-[52px] flex-shrink-0">
                    <ContactAvatar contact={c} size={13} textSize="text-base" authFetch={authFetch} />
                    {unread > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center bg-green-500 text-white text-[10px] font-bold rounded-full px-1">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-[17px] leading-tight truncate ${unread > 0 ? "font-medium text-white" : "font-normal text-white"}`}>
                        {c.name || c.phone}
                        {c.instance_name && <span className="text-[10px] text-gray-500 ml-1.5 font-normal">({c.instance_name})</span>}
                      </p>
                      {formatChatDate(c.last_message_at) && (
                        <span className={`text-[13px] flex-shrink-0 ml-2 ${
                          unread > 0 ? "text-green-400 font-medium" : "text-gray-500"
                        }`}>
                          {formatChatDate(c.last_message_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className={`text-[15px] truncate ${unread > 0 ? "text-gray-300" : "text-gray-500"}`}>
                        {c.last_message_direction === "outgoing" && <FaCheck size={10} className="inline mr-1 text-gray-500" />}
                        {c.last_message_type && c.last_message_type !== "text"
                          ? <>{msgTypeIcon(c.last_message_type)}{c.last_message_text || `[${c.last_message_type}]`}</>
                          : (c.last_message_text || (c.name ? c.phone : "Toque para abrir"))
                        }
                      </p>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                        {!!c.pinned && <FaThumbtack size={10} className="text-gray-500" />}
                        {c.stage_name && (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: (c.stage_color || "#666") + "20", color: c.stage_color }}>
                            {c.stage_name}
                          </span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setDropdownId(dropdownId === c.id ? null : c.id); }}
                          className="w-5 h-5 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-dark-cardSoft opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <FaChevronDown size={8} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Dropdown menu */}
                  {dropdownId === c.id && (
                    <div
                      className="absolute right-3 top-12 z-50 bg-dark-card border border-dark-border rounded-lg shadow-xl py-1 min-w-[160px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => togglePin(c.id, c.pinned)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-dark-cardSoft transition"
                      >
                        <FaThumbtack size={12} className={c.pinned ? "text-primary" : ""} />
                        {c.pinned ? "Desafixar conversa" : "Fixar conversa"}
                      </button>
                      <button
                        onClick={() => toggleArchive(c.id, c.archived)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-dark-cardSoft transition"
                      >
                        <FaArchive size={12} className={c.archived ? "text-green-400" : ""} />
                        {c.archived ? "Desarquivar conversa" : "Arquivar conversa"}
                      </button>
                    </div>
                  )}
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
            subscribeEvents={subscribeEvents}
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
function ChatPanel({ contact: initialContact, authFetch, onBack, subscribeEvents }) {
  const [contact, setContact] = useState(initialContact);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [editing, setEditing] = useState(false);
  const [stages, setStages] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [quickReplies, setQuickReplies] = useState([]);
  const [newQrTitle, setNewQrTitle] = useState("");
  const [newQrMessage, setNewQrMessage] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
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

  // Load quick replies
  const loadQuickReplies = useCallback(() => {
    authFetch("/api/crm/quick-replies").then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setQuickReplies(d);
    }).catch(() => {});
  }, []);
  useEffect(() => { loadQuickReplies(); }, []);

  // Mark conversation as read when opening
  useEffect(() => {
    authFetch(`/api/crm/contacts/${contact.id}/read`, { method: "PUT" }).catch(() => {});
  }, [contact.id]);

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
    // Mark as read
    authFetch(`/api/crm/contacts/${contact.id}/read`, { method: "PUT" }).catch(() => {});
    // Fallback poll every 30s (SSE handles real-time)
    pollRef.current = setInterval(loadMessages, 30000);
    return () => clearInterval(pollRef.current);
  }, [loadMessages]);

  // Reload messages when tab/app becomes visible again
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        loadMessages();
        authFetch(`/api/crm/contacts/${contact.id}/read`, { method: "PUT" }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", loadMessages);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", loadMessages);
    };
  }, [loadMessages, contact.id]);

  // Real-time: instantly insert new messages from SSE without refetch
  useEffect(() => {
    if (!subscribeEvents) return;
    return subscribeEvents((event) => {
      if (event.type === "new_message" && event.contactId === contact.id) {
        const isMediaMsg = ["image", "video", "audio", "document"].includes(event.messageType);

        if (isMediaMsg) {
          // Media messages need real DB id for fetching base64 - reload from server
          loadMessages();
        } else {
          // Text messages: insert directly for instant display
          const newMsg = {
            id: Date.now() + Math.random(),
            contact_id: contact.id,
            direction: event.direction,
            message_text: event.messageText,
            message_type: event.messageType,
            created_at: event.createdAt || new Date().toISOString(),
            has_media: 0,
          };
          setMessages((prev) => {
            const isDuplicate = prev.some((m) =>
              m.message_text === newMsg.message_text &&
              m.direction === newMsg.direction &&
              Math.abs(new Date(m.created_at).getTime() - new Date(newMsg.created_at).getTime()) < 3000
            );
            if (isDuplicate) return prev;
            return [...prev, newMsg];
          });
        }
        // Mark as read since we're viewing
        authFetch(`/api/crm/contacts/${contact.id}/read`, { method: "PUT" }).catch(() => {});
      }
    });
  }, [subscribeEvents, contact.id, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Do NOT auto-focus the input on mobile to prevent keyboard from opening
  // Only auto-focus on desktop
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (!isMobile) {
      inputRef.current?.focus();
    }
  }, [contact.id]);

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

    playSendSound();
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
    playSendSound();
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Erro ${res.status}`);
      }

      setText("");
      toast.success(`${isVideo ? "Video" : "Imagem"} enviado!`);
      loadMessages();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err.message || "Erro ao enviar arquivo");
    } finally {
      setUploadingMedia(false);
    }
  };

  const [recentEmojis, setRecentEmojis] = useState(() => {
    try { return JSON.parse(localStorage.getItem("recentEmojis") || "[]"); } catch { return []; }
  });

  const insertEmoji = (emoji) => {
    setText((prev) => prev + emoji);
    setShowEmoji(false);
    inputRef.current?.focus();
    // Update recent emojis
    setRecentEmojis((prev) => {
      const updated = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, 16);
      localStorage.setItem("recentEmojis", JSON.stringify(updated));
      return updated;
    });
  };

  const selectQuickReply = (qr) => {
    setText(qr.message);
    setShowQuickReplies(false);
    inputRef.current?.focus();
  };

  const addQuickReply = async () => {
    if (!newQrTitle.trim() || !newQrMessage.trim()) return;
    try {
      const res = await authFetch("/api/crm/quick-replies", {
        method: "POST",
        body: JSON.stringify({ title: newQrTitle.trim(), message: newQrMessage.trim() }),
      });
      if (!res.ok) throw new Error();
      setNewQrTitle("");
      setNewQrMessage("");
      loadQuickReplies();
      toast.success("Resposta rapida salva!");
    } catch { toast.error("Erro ao salvar"); }
  };

  const deleteQuickReply = async (id) => {
    try {
      await authFetch(`/api/crm/quick-replies/${id}`, { method: "DELETE" });
      setQuickReplies((prev) => prev.filter((q) => q.id !== id));
    } catch { toast.error("Erro ao excluir"); }
  };

  // ========== AUDIO RECORDING ==========
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Prefer mp4/ogg for better WhatsApp compatibility, fallback to webm
      const mimeType = ["audio/mp4", "audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"]
        .find((m) => MediaRecorder.isTypeSupported(m)) || "";
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(recordingTimerRef.current);
        setRecordingTime(0);

        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || "audio/webm" });
        if (blob.size < 1000) return; // too short, discard

        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });

        // Send audio
        setUploadingMedia(true);
        playSendSound();
        const toastId = toast.loading("Enviando audio...");
        try {
          const res = await authFetch(`/api/crm/contacts/${contact.id}/send-media`, {
            method: "POST",
            body: JSON.stringify({ base64, caption: "", mediaType: "audio" }),
          });
          toast.dismiss(toastId);
          if (!res.ok) throw new Error();
          toast.success("Audio enviado!");
          loadMessages();
        } catch {
          toast.dismiss(toastId);
          toast.error("Erro ao enviar audio");
        } finally {
          setUploadingMedia(false);
        }
      };

      mediaRecorder.start(250);
      setRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      toast.error("Permissao de microfone negada");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current.stop();
    }
    clearInterval(recordingTimerRef.current);
    setRecording(false);
    setRecordingTime(0);
    audioChunksRef.current = [];
  };

  const formatRecTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

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
      const date = new Date(msg.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      if (date !== currentDate) { currentDate = date; groups.push({ type: "date", date }); }
      groups.push({ type: "msg", ...msg });
    });
    return groups;
  }, [messages]);



  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-3 md:px-5 py-2 bg-[#202c33] border-b border-[#2a3942]" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition md:mr-1 flex-shrink-0">
            <FaArrowLeft size={14} />
          </button>
          <div
            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition"
            onClick={() => { setShowInfo(true); setEditing(false); }}
          >
            <div className="flex-shrink-0">
              <ContactAvatar contact={contact} size={10} textSize="text-sm" authFetch={authFetch} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate flex items-center gap-1.5">
                {!!contact.is_group && <FaUsers size={10} className="text-green-400 flex-shrink-0" />}
                {contact.name || contact.phone}
              </p>
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
        </div>
        <button onClick={() => { setShowInfo(!showInfo); setEditing(false); }}
          className={`p-2 rounded-lg transition flex-shrink-0 ${showInfo ? "bg-primary/10 text-primary" : "text-gray-400 hover:text-white"}`}>
          <FaEllipsisV size={14} />
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Messages */}
        <div className={`flex-1 flex flex-col ${showInfo ? "hidden md:flex" : "flex"}`}>
          <div className="flex-1 overflow-y-auto px-3 md:px-6 lg:px-12 py-3"
            style={{ backgroundColor: "#0b141a", backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}>
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
              <div className="space-y-1 max-w-4xl mx-auto">
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
                  const isMedia = ["image", "video", "audio"].includes(item.message_type) && item.has_media;
                  return (
                    <div key={item.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] md:max-w-[65%] px-3 py-1.5 rounded-lg shadow-sm ${
                        isOut
                          ? "bg-[#005c4b] text-white rounded-tr-none"
                          : "bg-[#202c33] text-gray-100 rounded-tl-none"
                      }`}>
                        {/* Media content */}
                        {isMedia && item.message_type === "image" && (
                          <MediaImage msgId={item.id} authFetch={authFetch} />
                        )}
                        {isMedia && item.message_type === "video" && (
                          <MediaVideo msgId={item.id} authFetch={authFetch} />
                        )}
                        {isMedia && item.message_type === "audio" && (
                          <MediaAudio msgId={item.id} authFetch={authFetch} isOut={isOut} />
                        )}
                        {/* Text content */}
                        {(() => {
                          const txt = item.message_text;
                          const isBracketOnly = txt === `[${item.message_type}]`;
                          if (isMedia && (!txt || isBracketOnly)) return null;
                          if (isMedia && txt && !isBracketOnly) return (
                            <p className="text-[13px] leading-relaxed break-words whitespace-pre-wrap">{txt}</p>
                          );
                          return (
                            <p className="text-[13px] leading-relaxed break-words whitespace-pre-wrap">
                              {item.message_type !== "text" && msgTypeIcon(item.message_type)}
                              {txt || `[${item.message_type}]`}
                            </p>
                          );
                        })()}
                        <div className={`flex items-center justify-end gap-1 mt-0.5 ${isOut ? "text-[#ffffff80]" : "text-[#8696a0]"}`}>
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
            <div className="px-3 md:px-6 lg:px-12 py-2 bg-[#202c33] border-t border-[#2a3942]">
              <div className="max-w-4xl mx-auto max-h-40 overflow-y-auto">
                {recentEmojis.length > 0 && (
                  <>
                    <p className="text-[9px] text-gray-500 uppercase font-semibold mb-1">Recentes</p>
                    <div className="grid grid-cols-10 gap-1 mb-2">
                      {recentEmojis.map((e, i) => (
                        <button key={`r-${i}`} onClick={() => insertEmoji(e)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-dark-cardSoft transition text-lg">
                          {e}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <div className="grid grid-cols-10 gap-1">
                  {EMOJI_LIST.map((e, i) => (
                    <button key={i} onClick={() => insertEmoji(e)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-dark-cardSoft transition text-lg">
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Quick Replies Panel */}
          {showQuickReplies && (
            <div className="px-3 md:px-6 lg:px-12 py-2 bg-[#202c33] border-t border-[#2a3942]">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1"><FaBolt size={8} /> Respostas Rapidas</p>
                  <button onClick={() => setShowQuickReplies(false)} className="text-gray-500 hover:text-white"><FaTimes size={10} /></button>
                </div>
                {quickReplies.length > 0 ? (
                  <div className="space-y-1 max-h-40 overflow-y-auto mb-2">
                    {quickReplies.map((qr) => (
                      <div key={qr.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-cardSoft hover:bg-dark-cardSoft/80 cursor-pointer group transition"
                        onClick={() => selectQuickReply(qr)}>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-primary font-semibold truncate">{qr.title}</p>
                          <p className="text-[10px] text-gray-400 truncate">{qr.message}</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); deleteQuickReply(qr.id); }}
                          className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                          <FaTrash size={9} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-600 mb-2">Nenhuma resposta rapida cadastrada</p>
                )}
                {/* Add new */}
                <div className="flex gap-1.5 items-end">
                  <input value={newQrTitle} onChange={(e) => setNewQrTitle(e.target.value)} placeholder="Titulo"
                    className="w-24 px-2 py-1.5 rounded-lg border border-dark-border bg-dark-body text-[10px] text-white placeholder:text-gray-600 focus:outline-none focus:border-primary" />
                  <input value={newQrMessage} onChange={(e) => setNewQrMessage(e.target.value)} placeholder="Mensagem..."
                    onKeyDown={(e) => { if (e.key === "Enter") addQuickReply(); }}
                    className="flex-1 px-2 py-1.5 rounded-lg border border-dark-border bg-dark-body text-[10px] text-white placeholder:text-gray-600 focus:outline-none focus:border-primary" />
                  <button onClick={addQuickReply}
                    className="px-2.5 py-1.5 rounded-lg bg-primary text-white text-[10px] font-medium hover:bg-primaryLight transition flex-shrink-0">
                    <FaPlus size={9} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-3 md:px-6 lg:px-12 py-2 bg-[#202c33]" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
            <div className="flex items-end gap-2 max-w-4xl mx-auto">
              {recording ? (
                /* Recording mode */
                <>
                  <button onClick={cancelRecording}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-red-400 hover:text-red-300 transition flex-shrink-0"
                    title="Cancelar">
                    <FaTrash size={14} />
                  </button>
                  <div className="flex-1 flex items-center gap-3 bg-dark-cardSoft border border-red-500/30 rounded-2xl px-4 py-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                    <span className="text-sm text-red-400 font-mono">{formatRecTime(recordingTime)}</span>
                    <span className="text-xs text-gray-500">Gravando...</span>
                  </div>
                  <button onClick={stopRecording}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-500/30 transition-all flex-shrink-0"
                    title="Enviar audio">
                    <FaPaperPlane size={13} />
                  </button>
                </>
              ) : (
                /* Normal input mode */
                <>
                  <div className="flex-1 bg-[#2a3942] rounded-lg px-2 md:px-3 py-1.5 flex items-end gap-1">
                    <button onClick={() => { setShowEmoji(!showEmoji); setShowQuickReplies(false); }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition flex-shrink-0 ${
                        showEmoji ? "text-primary" : "text-gray-500 hover:text-gray-300"
                      }`} title="Emojis">
                      <FaSmile size={20} />
                    </button>

                    <button onClick={() => fileInputRef.current?.click()} disabled={uploadingMedia}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-300 transition flex-shrink-0"
                      title="Enviar imagem ou video">
                      <FaPaperclip size={18} />
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden"
                      onChange={(e) => { if (e.target.files[0]) handleMediaUpload(e.target.files[0]); e.target.value = ""; }} />

                    <button onClick={() => { setShowQuickReplies(!showQuickReplies); setShowEmoji(false); }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition flex-shrink-0 ${
                        showQuickReplies ? "text-yellow-400" : "text-gray-500 hover:text-gray-300"
                      }`} title="Respostas rapidas">
                      <FaBolt size={16} />
                    </button>

                    <textarea
                      ref={inputRef} value={text}
                      onChange={(e) => { setText(e.target.value); setShowEmoji(false); }}
                      onKeyDown={handleKeyDown}
                      placeholder="Mensagem..."
                      rows={1}
                      className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none resize-none max-h-28 py-1.5"
                      style={{ minHeight: "24px" }}
                      onInput={(e) => { e.target.style.height = "24px"; e.target.style.height = Math.min(e.target.scrollHeight, 112) + "px"; }}
                    />
                  </div>

                  {text.trim() ? (
                    <button
                      onMouseDown={(e) => { e.preventDefault(); handleSend(); }}
                      disabled={sending}
                      className="w-12 h-12 rounded-full flex items-center justify-center bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30 transition-all flex-shrink-0">
                      {sending ? <FaSpinner className="animate-spin" size={16} /> : <FaPaperPlane size={16} />}
                    </button>
                  ) : (
                    <button
                      onMouseDown={(e) => { e.preventDefault(); startRecording(); }}
                      disabled={uploadingMedia}
                      className="w-12 h-12 rounded-full flex items-center justify-center bg-dark-cardSoft text-gray-400 hover:text-green-400 hover:bg-green-500/10 transition-all flex-shrink-0"
                      title="Gravar audio">
                      {uploadingMedia ? <FaSpinner className="animate-spin" size={16} /> : <FaMicrophone size={18} />}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ---- Contact Info / Edit Sidebar ---- */}
        {showInfo && (
          <div className="fixed inset-0 z-50 md:static md:z-auto w-full md:w-80 flex flex-col bg-dark-card border-l border-dark-border overflow-y-auto">
            {/* Profile header with back button */}
            <div className="flex items-center gap-3 px-4 py-3 bg-[#202c33] border-b border-[#2a3942]" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
              <button onClick={() => setShowInfo(false)} className="text-gray-400 hover:text-white transition">
                <FaArrowLeft size={14} />
              </button>
              <p className="text-sm font-semibold text-white">{editing ? "Editar contato" : "Dados do contato"}</p>
            </div>
            {/* Avatar + basic info */}
            <div className="flex flex-col items-center py-5 border-b border-dark-border">
              <div className="mb-2">
                <ContactAvatar contact={contact} size={16} textSize="text-xl" authFetch={authFetch} />
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


// ======================== MEDIA COMPONENTS ========================

function MediaImage({ msgId, authFetch }) {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authFetch(`/api/crm/messages/${msgId}/media`).then((r) => r.json()).then((data) => {
      if (!cancelled && data?.base64) setSrc(data.base64);
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [msgId]);

  if (loading) return <div className="w-48 h-32 rounded-xl bg-dark-cardSoft/50 animate-pulse flex items-center justify-center mb-1"><FaImage className="text-gray-600" /></div>;
  if (!src) return <p className="text-[13px] text-gray-400 flex items-center gap-1 mb-1"><FaImage size={12} /> [imagem]</p>;

  return (
    <>
      <img src={src} alt="" onClick={() => setFullscreen(true)}
        className="max-w-full max-h-60 rounded-xl mb-1 cursor-pointer hover:opacity-90 transition" />
      {fullscreen && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setFullscreen(false)}>
          <img src={src} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setFullscreen(false)}>
            <FaTimes size={24} />
          </button>
        </div>
      )}
    </>
  );
}

function MediaVideo({ msgId, authFetch }) {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    authFetch(`/api/crm/messages/${msgId}/media`).then((r) => r.json()).then((data) => {
      if (!cancelled && data?.base64) setSrc(data.base64);
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [msgId]);

  if (loading) return <div className="w-48 h-32 rounded-xl bg-dark-cardSoft/50 animate-pulse flex items-center justify-center mb-1"><FaVideo className="text-gray-600" /></div>;
  if (!src) return <p className="text-[13px] text-gray-400 flex items-center gap-1 mb-1"><FaVideo size={12} /> [video]</p>;

  return <video src={src} controls className="max-w-full max-h-60 rounded-xl mb-1" />;
}

function MediaAudio({ msgId, authFetch, isOut }) {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    authFetch(`/api/crm/messages/${msgId}/media`).then((r) => r.json()).then((data) => {
      if (!cancelled && data?.base64) setSrc(data.base64);
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [msgId]);

  if (loading) return <div className="w-48 h-10 rounded-xl bg-dark-cardSoft/50 animate-pulse flex items-center justify-center mb-1"><FaMicrophone className="text-gray-600" size={12} /></div>;
  if (!src) return <p className="text-[13px] text-gray-400 flex items-center gap-1 mb-1"><FaMicrophone size={12} /> [audio]</p>;

  return (
    <audio src={src} controls className={`max-w-[240px] h-10 mb-1 ${isOut ? "[&::-webkit-media-controls-panel]:bg-primary/30" : ""}`}
      style={{ filter: isOut ? "invert(0)" : "none" }} />
  );
}
