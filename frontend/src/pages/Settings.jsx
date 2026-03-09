import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import { FaCog, FaSave } from "react-icons/fa";

export default function Settings() {
  const { user } = useAuth();

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Configuracoes</h2>

      <div className="grid gap-4">
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
