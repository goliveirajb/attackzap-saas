import { useEffect, useState, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import { FaWhatsapp, FaPlus, FaTrash, FaSync, FaQrcode, FaPen, FaCheck, FaTimes, FaPlug } from "react-icons/fa";

export default function Instances() {
  const { authFetch } = useAuth();
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [qrModal, setQrModal] = useState(null); // { instanceName, qrcode, status }
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const pollRef = useRef(null);

  const load = async () => {
    try {
      const res = await authFetch("/api/whatsapp/instances");
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setInstances(list);

      // Sync real status from Evolution for each instance (background)
      list.forEach(async (inst) => {
        try {
          const sRes = await authFetch(`/api/whatsapp/instances/${inst.instance_name}/status`);
          const sData = await sRes.json();
          if (sData.status && sData.status !== inst.status) {
            setInstances((prev) => prev.map((i) =>
              i.id === inst.id ? { ...i, status: sData.status } : i
            ));
          }
        } catch {}
      });
    } catch {
      toast.error("Erro ao carregar instancias");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => clearInterval(pollRef.current);
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return toast.error("Digite um nome");
    setCreating(true);
    try {
      const res = await authFetch("/api/whatsapp/instances", {
        method: "POST",
        body: JSON.stringify({ instanceName: newName.trim() }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success("Instancia criada!");
      setNewName("");
      setShowCreate(false);
      load();

      // Abre QR Code automaticamente
      if (data.qrcode) {
        openQrModal(data.instanceName || newName.trim(), data.qrcode);
      } else {
        fetchQrCode(data.instanceName || newName.trim());
      }
    } catch {
      toast.error("Erro ao criar instancia");
    } finally {
      setCreating(false);
    }
  };

  const fetchQrCode = async (name) => {
    try {
      const res = await authFetch(`/api/whatsapp/instances/${name}/qrcode`);
      const data = await res.json();
      openQrModal(name, data.qrcode, data.status);
    } catch {
      toast.error("Erro ao buscar QR Code");
    }
  };

  const openQrModal = (instanceName, qrcode, status = "connecting") => {
    setQrModal({ instanceName, qrcode, status });

    // Poll status a cada 3s
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await authFetch(`/api/whatsapp/instances/${instanceName}/status`);
        const data = await res.json();

        if (data.status === "connected") {
          clearInterval(pollRef.current);
          setQrModal(null);
          toast.success(`${instanceName} conectado!`);
          load();
        } else {
          // Atualiza QR Code
          const qrRes = await authFetch(`/api/whatsapp/instances/${instanceName}/qrcode`);
          const qrData = await qrRes.json();
          setQrModal((prev) =>
            prev ? { ...prev, qrcode: qrData.qrcode, status: qrData.status } : null
          );
        }
      } catch {}
    }, 3000);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Excluir instancia "${name}"?`)) return;
    try {
      await authFetch(`/api/whatsapp/instances/${id}/${name}`, { method: "DELETE" });
      toast.success("Instancia removida");
      load();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const startEdit = (inst) => {
    setEditingId(inst.id);
    setEditName(inst.display_name || inst.instance_name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const handleRename = async (id) => {
    if (!editName.trim()) return toast.error("Digite um nome");
    try {
      const res = await authFetch(`/api/whatsapp/instances/${id}/rename`, {
        method: "PUT",
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (!res.ok) throw new Error();
      toast.success("Nome atualizado!");
      setEditingId(null);
      setEditName("");
      load();
    } catch {
      toast.error("Erro ao renomear");
    }
  };

  const [fixingWebhook, setFixingWebhook] = useState(null);

  const handleFixWebhook = async (name) => {
    setFixingWebhook(name);
    try {
      const res = await authFetch(`/api/whatsapp/instances/${name}/fix-webhook`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success(`Webhook reconfigurado para ${name}!`);
    } catch {
      toast.error("Erro ao reconfigurar webhook");
    } finally {
      setFixingWebhook(null);
    }
  };

  const statusColor = {
    connected: "bg-green-400",
    connecting: "bg-yellow-400 animate-pulse",
    disconnected: "bg-red-400",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Instancias WhatsApp</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-primary hover:bg-primaryLight text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition"
        >
          <FaPlus /> Nova Instancia
        </button>
      </div>

      {/* Criar instancia */}
      {showCreate && (
        <div className="bg-dark-card border border-dark-border rounded-2xl p-4 mb-6 flex gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome da instancia (ex: meu-whatsapp)"
            className="flex-1 rounded-xl bg-dark-cardSoft border border-dark-border px-4 py-2.5 text-sm text-dark-text placeholder:text-gray-500 focus:outline-none focus:border-primary"
          />
          <button
            onClick={handleCreate}
            disabled={creating}
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-50"
          >
            {creating ? "Criando..." : "Criar"}
          </button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : instances.length === 0 ? (
        <div className="bg-dark-card border border-dark-border rounded-2xl p-12 text-center">
          <FaWhatsapp className="text-5xl text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Nenhuma instancia criada</p>
          <p className="text-xs text-gray-500 mt-1">Clique em "Nova Instancia" para comecar</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {instances.map((inst) => (
            <div
              key={inst.id}
              className="bg-dark-card border border-dark-border rounded-2xl px-5 py-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-green-400/10 flex items-center justify-center flex-shrink-0">
                  <FaWhatsapp className="text-green-400" />
                </div>
                <div>
                  {editingId === inst.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleRename(inst.id); if (e.key === "Escape") cancelEdit(); }}
                        className="px-2 py-1 rounded-lg bg-dark-cardSoft border border-primary text-sm text-white focus:outline-none w-40"
                        autoFocus
                      />
                      <button onClick={() => handleRename(inst.id)} className="text-green-400 hover:text-green-300 transition" title="Salvar">
                        <FaCheck size={12} />
                      </button>
                      <button onClick={cancelEdit} className="text-gray-500 hover:text-gray-300 transition" title="Cancelar">
                        <FaTimes size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">{inst.instance_display || inst.instance_name}</p>
                      <button onClick={() => startEdit(inst)} className="text-gray-600 hover:text-primary transition" title="Editar nome">
                        <FaPen size={10} />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`h-2 w-2 rounded-full ${statusColor[inst.status] || statusColor.disconnected}`} />
                    <span className="text-xs text-gray-400 capitalize">{inst.status}</span>
                    {inst.phone && (
                      <span className="text-xs text-gray-500">| {inst.phone}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {inst.status !== "connected" && (
                  <button
                    onClick={() => fetchQrCode(inst.instance_name)}
                    className="flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold px-3 py-2 rounded-lg hover:bg-primary/20 transition"
                  >
                    <FaQrcode /> QR Code
                  </button>
                )}
                <button
                  onClick={() => handleFixWebhook(inst.instance_name)}
                  disabled={fixingWebhook === inst.instance_name}
                  className="flex items-center gap-1.5 bg-yellow-500/10 text-yellow-400 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-yellow-500/20 transition disabled:opacity-50"
                  title="Reconfigurar webhook (corrige problemas de recebimento)"
                >
                  <FaPlug /> {fixingWebhook === inst.instance_name ? "Corrigindo..." : "Fix Webhook"}
                </button>
                <button
                  onClick={() => fetchQrCode(inst.instance_name)}
                  className="text-gray-500 hover:text-primary p-2 transition"
                  title="Atualizar status"
                >
                  <FaSync className="text-xs" />
                </button>
                <button
                  onClick={() => handleDelete(inst.id, inst.instance_name)}
                  className="text-gray-500 hover:text-red-400 p-2 transition"
                  title="Excluir"
                >
                  <FaTrash className="text-xs" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal QR Code */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-card border border-dark-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white text-center mb-1">
              Escanear QR Code
            </h3>
            <p className="text-xs text-gray-400 text-center mb-4">
              {qrModal.instanceName}
            </p>

            <div className="bg-white rounded-xl p-4 flex items-center justify-center min-h-[280px]">
              {qrModal.qrcode && typeof qrModal.qrcode === "string" ? (
                <img
                  src={
                    qrModal.qrcode.startsWith("data:")
                      ? qrModal.qrcode
                      : `data:image/png;base64,${qrModal.qrcode}`
                  }
                  alt="QR Code"
                  className="w-64 h-64 object-contain"
                />
              ) : (
                <div className="text-center text-gray-400">
                  <FaSync className="animate-spin text-2xl mx-auto mb-2" />
                  <p className="text-sm">Gerando QR Code...</p>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-400 text-center mt-3">
              Abra o WhatsApp no celular &gt; Dispositivos Conectados &gt; Conectar dispositivo
            </p>

            <button
              onClick={() => {
                clearInterval(pollRef.current);
                setQrModal(null);
              }}
              className="w-full mt-4 bg-dark-cardSoft text-gray-300 text-sm font-semibold py-2.5 rounded-xl hover:bg-dark-border transition"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
