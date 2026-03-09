import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import { FaUsers, FaSync, FaCopy, FaWhatsapp } from "react-icons/fa";

export default function Groups() {
  const { authFetch } = useAuth();
  const [instances, setInstances] = useState([]);
  const [selectedInstance, setSelectedInstance] = useState("");
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadInstances = async () => {
      try {
        const res = await authFetch("/api/whatsapp/instances");
        const data = await res.json();
        const connected = (Array.isArray(data) ? data : []).filter(
          (i) => i.status === "connected"
        );
        setInstances(connected);
        if (connected.length === 1) setSelectedInstance(connected[0].instance_name);
      } catch {
        toast.error("Erro ao carregar instancias");
      } finally {
        setLoadingInstances(false);
      }
    };
    loadInstances();
  }, []);

  const fetchGroups = async () => {
    if (!selectedInstance) return toast.error("Selecione uma instancia");
    setLoading(true);
    setGroups([]);
    try {
      const res = await authFetch(`/api/whatsapp/instances/${selectedInstance}/groups`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGroups(Array.isArray(data) ? data : []);
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Grupos WhatsApp</h2>
      </div>

      {/* Seleção de instância + buscar */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-5 mb-6">
        <p className="text-sm font-bold text-white mb-3">Buscar grupos de uma instancia conectada</p>
        <div className="flex gap-3">
          <select
            value={selectedInstance}
            onChange={(e) => setSelectedInstance(e.target.value)}
            className="flex-1 rounded-xl bg-dark-cardSoft border border-dark-border px-4 py-2.5 text-sm text-dark-text focus:outline-none focus:border-primary"
          >
            <option value="">
              {loadingInstances ? "Carregando..." : "Selecione a instancia"}
            </option>
            {instances.map((inst) => (
              <option key={inst.id} value={inst.instance_name}>
                {inst.instance_name} ({inst.phone || "conectado"})
              </option>
            ))}
          </select>
          <button
            onClick={fetchGroups}
            disabled={loading || !selectedInstance}
            className="flex items-center gap-2 bg-primary hover:bg-primaryLight text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-50"
          >
            {loading ? <FaSync className="animate-spin" /> : <FaUsers />}
            {loading ? "Buscando..." : "Buscar Grupos"}
          </button>
        </div>
      </div>

      {/* Filtro */}
      {groups.length > 0 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar por nome ou ID..."
          className="w-full rounded-xl bg-dark-card border border-dark-border px-4 py-2.5 text-sm text-dark-text placeholder:text-gray-500 focus:outline-none focus:border-primary mb-4"
        />
      )}

      {/* Lista de grupos */}
      {groups.length === 0 && !loading ? (
        <div className="bg-dark-card border border-dark-border rounded-2xl p-12 text-center">
          <FaUsers className="text-5xl text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Nenhum grupo carregado</p>
          <p className="text-xs text-gray-500 mt-1">
            Selecione uma instancia conectada e clique em "Buscar Grupos"
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          <p className="text-xs text-gray-500 mb-1">
            {filtered.length} grupo(s) {search ? "filtrado(s)" : "encontrado(s)"}
          </p>
          {filtered.map((group) => (
            <div
              key={group.id}
              className="bg-dark-card border border-dark-border rounded-2xl px-5 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-green-400/10 flex items-center justify-center flex-shrink-0">
                  <FaWhatsapp className="text-green-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{group.name}</p>
                  <p className="text-[10px] text-gray-500 font-mono truncate">{group.id}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                {group.size > 0 && (
                  <span className="text-[10px] text-gray-400 bg-dark-cardSoft px-2 py-1 rounded-lg">
                    {group.size} membros
                  </span>
                )}
                <button
                  onClick={() => copyId(group.id)}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primaryLight transition px-2 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20"
                  title="Copiar ID"
                >
                  <FaCopy /> Copiar ID
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
