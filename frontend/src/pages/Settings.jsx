import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import { FaCog, FaSave, FaDownload, FaMobileAlt, FaCheckCircle } from "react-icons/fa";

export default function Settings() {
  const { user } = useAuth();
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed as PWA
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || window.navigator.standalone === true;
    setIsInstalled(isStandalone);

    // Listen for install prompt
    if (window.__pwaInstallPrompt) {
      setInstallPrompt(window.__pwaInstallPrompt);
    }
    const handler = () => {
      setInstallPrompt(window.__pwaInstallPrompt);
    };
    window.addEventListener("pwa-install-available", handler);
    return () => window.removeEventListener("pwa-install-available", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) {
      // Fallback instructions
      toast("Abra o menu do navegador e toque em 'Instalar app' ou 'Adicionar a tela inicial'", { duration: 5000 });
      return;
    }
    try {
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === "accepted") {
        setIsInstalled(true);
        toast.success("App instalado!");
      }
      window.__pwaInstallPrompt = null;
      setInstallPrompt(null);
    } catch {
      toast.error("Erro ao instalar");
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Configuracoes</h2>

      <div className="grid gap-4">
        {/* Instalar App */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <FaMobileAlt className="text-green-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Instalar App</p>
              <p className="text-xs text-gray-400">Instale o AttackZap como aplicativo no seu dispositivo</p>
            </div>
          </div>

          {isInstalled ? (
            <div className="flex items-center gap-2 bg-green-500/10 rounded-xl px-4 py-3">
              <FaCheckCircle className="text-green-400" />
              <span className="text-sm text-green-400 font-medium">App ja instalado!</span>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={handleInstall}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primaryLight text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-primary/20"
              >
                <FaDownload size={14} />
                Instalar AttackZap
              </button>
              <div className="bg-dark-cardSoft rounded-xl px-4 py-3 space-y-2">
                <p className="text-[11px] text-gray-400 font-medium">Como instalar manualmente:</p>
                <div className="space-y-1.5">
                  <p className="text-[11px] text-gray-500">
                    <span className="text-primary font-semibold">Android (Chrome):</span> Toque nos 3 pontos (menu) &gt; "Instalar aplicativo" ou "Adicionar a tela inicial"
                  </p>
                  <p className="text-[11px] text-gray-500">
                    <span className="text-primary font-semibold">iPhone (Safari):</span> Toque no botao compartilhar &gt; "Adicionar a Tela de Inicio"
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Perfil */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FaCog className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Minha Conta</p>
              <p className="text-xs text-gray-400">Dados do seu perfil</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-16">Nome:</span>
              <span className="text-sm text-white">{user?.name || "---"}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-16">Email:</span>
              <span className="text-sm text-white">{user?.email || "---"}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-16">Plano:</span>
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg uppercase">
                {user?.plan || "free"}
              </span>
            </div>
          </div>
        </div>

        {/* Integracoes */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5">
          <p className="text-sm font-bold text-white mb-3">Integracoes</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-dark-cardSoft rounded-xl px-4 py-3">
              <div>
                <p className="text-sm text-white font-semibold">Evolution API</p>
                <p className="text-[10px] text-gray-500">Conexao WhatsApp via Evolution</p>
              </div>
              <span className="text-[10px] font-bold text-green-400 bg-green-400/10 px-2 py-1 rounded-lg">Conectado</span>
            </div>
            <div className="flex items-center justify-between bg-dark-cardSoft rounded-xl px-4 py-3">
              <div>
                <p className="text-sm text-white font-semibold">N8N Workflows</p>
                <p className="text-[10px] text-gray-500">Automacao de fluxos</p>
              </div>
              <span className="text-[10px] font-bold text-green-400 bg-green-400/10 px-2 py-1 rounded-lg">Conectado</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
