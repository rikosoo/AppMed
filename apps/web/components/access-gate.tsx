'use client';
import { useEffect, useState, type ReactNode, type FormEvent } from 'react';
import { Activity, ArrowRight, Eye, EyeOff, Leaf, LockKeyhole, LogOut } from 'lucide-react';

const sessionKey = 'financemed.demo-session';
export default function AccessGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try { setSignedIn(sessionStorage.getItem(sessionKey) === 'active'); } catch { /* Memory-only login still works. */ }
    setReady(true);
  }, []);
  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (data.get('username') !== '123456' || data.get('password') !== '123456') {
      setError('Usuário ou senha incorretos. Confira e tente novamente.');
      return;
    }
    try { sessionStorage.setItem(sessionKey, 'active'); } catch { /* No persistent session in restricted browsers. */ }
    setError('');
    setSignedIn(true);
  }
  function logout() {
    try { sessionStorage.removeItem(sessionKey); } catch { /* In-memory state is cleared below. */ }
    setSignedIn(false);
    setVisible(false);
  }
  if (!ready) return <div className="loading"><Activity size={34}/><p>Preparando seu espaço…</p></div>;
  if (signedIn) return <><div className="session-controls"><button onClick={logout}><LogOut size={15}/> Sair</button></div>{children}</>;
  return <main className="welcome-shell">
    <section className="welcome-story" aria-label="FinanceMed AI">
      <a className="brand" href="/"><span className="brand-icon"><Activity size={25}/></span><span>FinanceMed<span className="ai">AI</span></span></a>
      <div className="welcome-copy"><span className="section-kicker"><Leaf size={17}/> MAIS EQUILÍBRIO PARA SUA ROTINA</span><h1>Você cuida de vidas.<br/>Seu futuro também<br/>merece cuidado.</h1><p>Organize seus trabalhos, conheça sua renda e encontre um caminho para os seus objetivos.</p></div>
      <span className="welcome-caption">Seu dinheiro, com propósito.</span>
    </section>
    <section className="welcome-form"><div className="login-mark"><LockKeyhole size={25}/></div><div className="eyebrow">BEM-VINDO AO FINANCEMED</div><h2>Entre no seu espaço.</h2><p>Seu planejamento começa com você.</p>
      <form onSubmit={login}>
        <label>Usuário<input name="username" autoComplete="username" required autoFocus placeholder="Digite seu usuário" onChange={()=>setError('')}/></label>
        <label>Senha<div className="password-field"><input name="password" type={visible?'text':'password'} autoComplete="current-password" required placeholder="Digite sua senha" onChange={()=>setError('')}/><button type="button" onClick={()=>setVisible(!visible)} aria-label={visible?'Ocultar senha':'Mostrar senha'}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
        {error && <div className="alert error" role="alert">{error}</div>}
        <button className="primary-button full" type="submit">Entrar <ArrowRight size={17}/></button>
      </form>
      <div className="login-disclaimer"><LockKeyhole size={15}/><span>Acesso de demonstração local. Não substitui uma conta segura para uso online.</span></div>
    </section>
  </main>;
}
