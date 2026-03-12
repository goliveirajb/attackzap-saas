import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import {
  FaWhatsapp, FaRobot, FaUsers, FaChartLine, FaCheck, FaRocket,
  FaBolt, FaCrown, FaArrowRight, FaShieldAlt, FaHeadset, FaInfinity,
} from "react-icons/fa";

const PLANS = [
  {
    id: "basico",
    name: "Basico",
    price: "99,90",
    icon: FaBolt,
    color: "from-blue-500 to-blue-600",
    border: "border-blue-500/30",
    badge: null,
    features: [
      "1 Instancia WhatsApp",
      "500 Contatos CRM",
      "Mensagens ilimitadas",
      "Kanban de vendas",
      "Suporte por email",
    ],
  },
  {
    id: "medio",
    name: "Profissional",
    price: "299,90",
    icon: FaRocket,
    color: "from-purple-500 to-purple-600",
    border: "border-purple-500/30",
    badge: "POPULAR",
    features: [
      "5 Instancias WhatsApp",
      "5.000 Contatos CRM",
      "Mensagens ilimitadas",
      "Kanban de vendas",
      "Automacoes avancadas",
      "Envio de midia",
      "Suporte prioritario",
    ],
  },
  {
    id: "completo",
    name: "Empresarial",
    price: "499,00",
    icon: FaCrown,
    color: "from-amber-500 to-orange-500",
    border: "border-amber-500/30",
    badge: "COMPLETO",
    features: [
      "Instancias ilimitadas",
      "Contatos ilimitados",
      "Mensagens ilimitadas",
      "Kanban personalizado",
      "Automacoes avancadas",
      "API + Webhooks",
      "Envio de midia",
      "Suporte 24/7 dedicado",
      "Treinamento incluso",
    ],
  },
];

const FEATURES = [
  { icon: FaWhatsapp, title: "Multi WhatsApp", desc: "Conecte varias instancias e gerencie tudo em um lugar" },
  { icon: FaUsers, title: "CRM Inteligente", desc: "Kanban de vendas com drag & drop e historico completo" },
  { icon: FaRobot, title: "Automacoes", desc: "Mensagens programadas, respostas automaticas e fluxos" },
  { icon: FaChartLine, title: "Dashboard", desc: "Metricas e insights para escalar suas vendas" },
  { icon: FaShieldAlt, title: "Seguro", desc: "Dados protegidos com criptografia e backups" },
  { icon: FaHeadset, title: "Suporte", desc: "Equipe especializada pronta para ajudar" },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [showRegister, setShowRegister] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  if (token) {
    return <Navigate to="/app" replace />;
  }

  const handleSelectPlan = (planId) => {
    setSelectedPlan(planId);
    setShowRegister(true);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      toast.error("Preencha todos os campos");
      return;
    }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password, selectedPlan);
      toast.success("Conta criada com sucesso!");
      navigate("/app");
    } catch (err) {
      toast.error(err.message || "Erro ao registrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white" style={{ background: "#0a0a0f" }}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
              <FaWhatsapp className="text-white text-sm" />
            </div>
            <span className="text-xl font-extrabold tracking-wider">ATTACKZAP</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/login")}
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition"
            >
              Entrar
            </button>
            <button
              onClick={() => {
                setSelectedPlan("basico");
                setShowRegister(true);
              }}
              className="px-5 py-2 text-sm font-semibold bg-gradient-to-r from-green-500 to-green-600 rounded-xl hover:from-green-400 hover:to-green-500 transition"
            >
              Comecar gratis
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 mb-6">
            <FaWhatsapp className="text-green-400 text-sm" />
            <span className="text-green-400 text-sm font-medium">Plataforma #1 de CRM WhatsApp</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight mb-6">
            Transforme seu WhatsApp em uma
            <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent"> maquina de vendas</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-8">
            CRM completo, automacoes inteligentes e gestao de contatos. Tudo que voce precisa para escalar suas vendas via WhatsApp.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => document.getElementById("pricing").scrollIntoView({ behavior: "smooth" })}
              className="w-full sm:w-auto px-8 py-4 text-lg font-bold bg-gradient-to-r from-green-500 to-green-600 rounded-2xl hover:from-green-400 hover:to-green-500 transition shadow-lg shadow-green-500/25 flex items-center justify-center gap-2"
            >
              Ver planos <FaArrowRight />
            </button>
            <button
              onClick={() => navigate("/login")}
              className="w-full sm:w-auto px-8 py-4 text-lg font-semibold border border-white/10 rounded-2xl hover:bg-white/5 transition"
            >
              Ja tenho conta
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">Tudo que voce precisa</h2>
            <p className="text-gray-400 text-lg">Ferramentas profissionais para dominar suas vendas</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 hover:border-green-500/20 transition group">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4 group-hover:bg-green-500/20 transition">
                  <f.icon className="text-green-400 text-xl" />
                </div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 sm:px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">Escolha seu plano</h2>
            <p className="text-gray-400 text-lg">Comece agora e escale quando quiser</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative bg-white/[0.03] border ${plan.border} rounded-2xl p-6 lg:p-8 hover:border-opacity-60 transition flex flex-col ${
                  plan.badge === "POPULAR" ? "ring-2 ring-purple-500/30 scale-[1.02]" : ""
                }`}
              >
                {plan.badge && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${plan.color} text-white`}>
                    {plan.badge}
                  </div>
                )}
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center`}>
                    <plan.icon className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                </div>
                <div className="mb-6">
                  <span className="text-sm text-gray-400">R$</span>
                  <span className="text-4xl font-extrabold ml-1">{plan.price}</span>
                  <span className="text-gray-400 text-sm">/mes</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                      <FaCheck className="text-green-400 text-xs flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  className={`w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r ${plan.color} hover:opacity-90 transition`}
                >
                  Comecar agora
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">Pronto para comecar?</h2>
          <p className="text-gray-400 text-lg mb-8">
            Junte-se a centenas de empresas que ja usam o AttackZap para vender mais
          </p>
          <button
            onClick={() => document.getElementById("pricing").scrollIntoView({ behavior: "smooth" })}
            className="px-10 py-4 text-lg font-bold bg-gradient-to-r from-green-500 to-green-600 rounded-2xl hover:from-green-400 hover:to-green-500 transition shadow-lg shadow-green-500/25"
          >
            Escolher meu plano
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-gray-500">AttackZap - CRM WhatsApp Profissional</span>
          <span className="text-sm text-gray-500">Todos os direitos reservados</span>
        </div>
      </footer>

      {/* Register Modal */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setShowRegister(false)}>
          <div className="bg-[#12121a] border border-white/10 rounded-2xl p-6 sm:p-8 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-extrabold mb-1">Criar conta</h2>
              <p className="text-gray-400 text-sm">
                Plano selecionado: <span className="text-green-400 font-semibold">{PLANS.find(p => p.id === selectedPlan)?.name}</span>
                {" - "}
                <span className="text-white font-bold">R$ {PLANS.find(p => p.id === selectedPlan)?.price}/mes</span>
              </p>
            </div>

            {/* Plan switcher */}
            <div className="flex gap-2 mb-6">
              {PLANS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlan(p.id)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                    selectedPlan === p.id
                      ? "bg-gradient-to-r " + p.color + " text-white"
                      : "bg-white/5 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <input
                type="text"
                placeholder="Seu nome"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-green-500/50"
                required
              />
              <input
                type="email"
                placeholder="Seu email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-green-500/50"
                required
              />
              <input
                type="password"
                placeholder="Crie uma senha"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-green-500/50"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 transition disabled:opacity-50"
              >
                {loading ? "Criando..." : "Criar minha conta"}
              </button>
            </form>

            <p className="text-center text-xs text-gray-500 mt-4">
              Ja tem conta?{" "}
              <button onClick={() => { setShowRegister(false); navigate("/login"); }} className="text-green-400 hover:underline">
                Fazer login
              </button>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
