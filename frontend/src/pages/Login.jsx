import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        await register(name, email, password);
        toast.success("Conta criada!");
      } else {
        await login(email, password);
        toast.success("Login realizado!");
      }
      navigate("/");
    } catch (err) {
      toast.error(err.message || "Erro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-body px-4">
      <div className="w-full max-w-sm bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl">
        <h1 className="text-2xl font-extrabold text-primary text-center mb-1">
          ATTACKZAP
        </h1>
        <p className="text-xs text-gray-400 text-center mb-6">
          {isRegister ? "Crie sua conta" : "Acesse sua conta"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <input
              type="text"
              placeholder="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl bg-dark-cardSoft border border-dark-border px-4 py-3 text-sm text-dark-text placeholder:text-gray-500 focus:outline-none focus:border-primary"
              required
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl bg-dark-cardSoft border border-dark-border px-4 py-3 text-sm text-dark-text placeholder:text-gray-500 focus:outline-none focus:border-primary"
            required
          />

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl bg-dark-cardSoft border border-dark-border px-4 py-3 text-sm text-dark-text placeholder:text-gray-500 focus:outline-none focus:border-primary"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primaryLight text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
          >
            {loading ? "..." : isRegister ? "Registrar" : "Entrar"}
          </button>
        </form>

        <button
          onClick={() => setIsRegister(!isRegister)}
          className="w-full text-center text-xs text-gray-400 hover:text-primary mt-4 transition"
        >
          {isRegister ? "Ja tem conta? Entrar" : "Nao tem conta? Registrar"}
        </button>

        <button
          onClick={() => navigate("/home")}
          className="w-full text-center text-xs text-gray-500 hover:text-primary mt-2 transition"
        >
          Ver planos e precos
        </button>
      </div>
    </div>
  );
}
