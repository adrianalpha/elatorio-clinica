import { useEffect, useMemo, useState } from 'react';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { doc, getFirestore, onSnapshot, setDoc } from 'firebase/firestore';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  CreditCard,
  Landmark,
  LogOut,
  RefreshCw,
  Save,
  ShieldCheck,
  Wallet,
} from 'lucide-react';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const appId = import.meta.env.VITE_REPORT_APP_ID || 'clinica-app-v1';

const defaultReport = {
  month: 'JUNHO / 2026',
  deadline: '30/06/2026',
  accountBalance: 24702.19,
  reservePercentage: 30,
  salesTotal: 0,
  paidTotal: 0,
  pendingTotal: 0,
  partners: [
    { id: 'partner-1', name: 'SÓCIO 1', percentage: 50 },
    { id: 'partner-2', name: 'SÓCIO 2', percentage: 50 },
  ],
};

const passwords = {
  admin: 'Admin@2026',
  viewers: ['Dani@2026', 'Mari@2026'],
};

function isFirebaseConfigured() {
  return Object.values(firebaseConfig).every(Boolean);
}

function normalizeReport(data) {
  return {
    ...defaultReport,
    ...data,
    accountBalance: Number(data?.accountBalance ?? defaultReport.accountBalance),
    reservePercentage: Number(data?.reservePercentage ?? defaultReport.reservePercentage),
    salesTotal: Number(data?.salesTotal ?? 0),
    paidTotal: Number(data?.paidTotal ?? 0),
    pendingTotal: Number(data?.pendingTotal ?? 0),
    partners:
      Array.isArray(data?.partners) && data.partners.length > 0
        ? data.partners.map((partner, index) => ({
            id: partner.id || `partner-${index + 1}`,
            name: partner.name || `SÓCIO ${index + 1}`,
            percentage: Number(partner.percentage ?? 0),
          }))
        : defaultReport.partners,
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value) || 0);
}

function moneyFromInput(value) {
  const cleaned = String(value || '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  return Number(cleaned) || 0;
}

function MoneyInput({ value, onChange }) {
  const [text, setText] = useState('');

  useEffect(() => {
    setText(
      new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(value) || 0),
    );
  }, [value]);

  return (
    <div className="money-input">
      <span>R$</span>
      <input
        value={text}
        inputMode="decimal"
        onChange={(event) => {
          setText(event.target.value);
          onChange(moneyFromInput(event.target.value));
        }}
      />
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function MetricCard({ icon: Icon, label, value, tone }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}>
        <Icon size={22} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function StatusMessage({ type, children }) {
  if (!children) return null;

  const Icon = type === 'success' ? CheckCircle2 : AlertCircle;

  return (
    <div className={`status ${type}`}>
      <Icon size={18} />
      <span>{children}</span>
    </div>
  );
}

export default function App() {
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [user, setUser] = useState(null);
  const [report, setReport] = useState(defaultReport);
  const [screen, setScreen] = useState('login');
  const [role, setRole] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [status, setStatus] = useState({ type: 'info', text: '' });
  const [saving, setSaving] = useState(false);

  const firebase = useMemo(() => {
    if (!isFirebaseConfigured()) return null;

    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

    return {
      auth: getAuth(app),
      db: getFirestore(app),
    };
  }, []);

  const reportRef = useMemo(() => {
    if (!firebase?.db || !user) return null;
    return doc(firebase.db, 'artifacts', appId, 'public', 'data', 'reports', 'current');
  }, [firebase, user]);

  const calculations = useMemo(() => {
    const reserve = (Number(report.accountBalance) * Number(report.reservePercentage)) / 100;
    const distributable = Number(report.accountBalance) - reserve;

    return {
      reserve,
      distributable,
      partners: report.partners.map((partner) => ({
        ...partner,
        value: distributable * (Number(partner.percentage) / 100),
      })),
    };
  }, [report]);

  useEffect(() => {
    if (!firebase) {
      setStatus({
        type: 'error',
        text: 'Firebase não configurado. Preencha as variáveis VITE_FIREBASE no Netlify ou no arquivo .env local.',
      });
      return undefined;
    }

    let unsubscribeAuth = () => {};

    async function connect() {
      try {
        await signInAnonymously(firebase.auth);

        unsubscribeAuth = onAuthStateChanged(firebase.auth, (currentUser) => {
          setUser(currentUser);
          setFirebaseReady(Boolean(currentUser));
        });
      } catch (error) {
        setStatus({
          type: 'error',
          text: `Erro no Firebase Auth: ${error.code || 'sem-codigo'}. Ative o login anônimo no Firebase.`,
        });
      }
    }

    connect();

    return () => unsubscribeAuth();
  }, [firebase]);

  useEffect(() => {
    if (!reportRef) return undefined;

    return onSnapshot(
      reportRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setReport(normalizeReport(snapshot.data()));
        }
      },
      (error) => {
        setStatus({
          type: 'error',
          text: `Erro no Firestore: ${error.code || 'sem-codigo'}. Confira as regras do Firestore.`,
        });
      },
    );
  }, [reportRef]);

  function login(event) {
    event.preventDefault();

    const typedPassword = password.trim();

    if (typedPassword === passwords.admin) {
      setRole('admin');
      setScreen('dashboard');
      setPassword('');
      setLoginError('');
      return;
    }

    if (passwords.viewers.includes(typedPassword)) {
      setRole('viewer');
      setScreen('dashboard');
      setPassword('');
      setLoginError('');
      return;
    }

    setLoginError('Senha incorreta.');
  }

  function logout() {
    setRole('');
    setScreen('login');
    setPassword('');
    setLoginError('');
  }

  function updateReport(field, value) {
    setReport((current) => ({ ...current, [field]: value }));
  }

  function updatePartner(index, field, value) {
    setReport((current) => ({
      ...current,
      partners: current.partners.map((partner, currentIndex) =>
        currentIndex === index ? { ...partner, [field]: value } : partner,
      ),
    }));
  }

  async function saveReport() {
    if (!reportRef) {
      setStatus({
        type: 'error',
        text: 'A conexão com o Firebase ainda não está pronta. Aguarde e tente novamente.',
      });
      return;
    }

    setSaving(true);
    setStatus({ type: 'info', text: '' });

    try {
      await setDoc(reportRef, normalizeReport(report), { merge: true });
      setStatus({ type: 'success', text: 'Relatório salvo com sucesso.' });
    } catch (error) {
      setStatus({
        type: 'error',
        text: `Erro ao salvar: ${error.code || 'sem-codigo'}. Confira as regras do Firestore.`,
      });
    } finally {
      setSaving(false);
    }
  }

  if (screen === 'login') {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="brand-mark">
            <Landmark size={28} />
          </div>

          <h1>Acesso financeiro</h1>
          <p>Relatório da clínica</p>

          <StatusMessage type={status.type}>{status.text}</StatusMessage>

          <form onSubmit={login}>
            <input
              type="password"
              value={password}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
            />

            {loginError && <span className="login-error">{loginError}</span>}

            <button type="submit">Entrar</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-page">
      <section className="app-shell">
        <header className="topbar">
          <div>
            <span className="eyebrow">Relatório financeiro</span>
            <h1>{report.month}</h1>
            <p>Prazo: {report.deadline}</p>
          </div>

          <div className="topbar-actions">
            {role === 'admin' && (
              <button
                className="primary-button"
                type="button"
                onClick={saveReport}
                disabled={saving || !firebaseReady}
              >
                {saving ? <RefreshCw size={18} className="spin" /> : <Save size={18} />}
                {saving ? 'Salvando' : 'Salvar'}
              </button>
            )}

            <button className="secondary-button" type="button" onClick={logout}>
              <LogOut size={18} />
              Sair
            </button>
          </div>
        </header>

        <StatusMessage type={status.type}>{status.text}</StatusMessage>

        <section className="metrics-grid">
          <MetricCard icon={Wallet} label="Saldo atual" value={formatCurrency(report.accountBalance)} tone="green" />
          <MetricCard icon={BarChart3} label="Vendas" value={formatCurrency(report.salesTotal)} tone="blue" />
          <MetricCard icon={CreditCard} label="Pagamentos" value={formatCurrency(report.paidTotal)} tone="slate" />
          <MetricCard icon={AlertCircle} label="Pendências" value={formatCurrency(report.pendingTotal)} tone="orange" />
        </section>

        {role === 'admin' && (
          <section className="panel">
            <div className="panel-title">
              <ShieldCheck size={20} />
              <h2>Edição do relatório</h2>
            </div>

            <div className="form-grid">
              <Field label="Mês">
                <input value={report.month} onChange={(event) => updateReport('month', event.target.value)} />
              </Field>

              <Field label="Prazo">
                <input value={report.deadline} onChange={(event) => updateReport('deadline', event.target.value)} />
              </Field>

              <Field label="Saldo atual">
                <MoneyInput value={report.accountBalance} onChange={(value) => updateReport('accountBalance', value)} />
              </Field>

              <Field label="Reserva (%)">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={report.reservePercentage}
                  onChange={(event) => updateReport('reservePercentage', Number(event.target.value))}
                />
              </Field>

              <Field label="Vendas">
                <MoneyInput value={report.salesTotal} onChange={(value) => updateReport('salesTotal', value)} />
              </Field>

              <Field label="Pagamentos feitos">
                <MoneyInput value={report.paidTotal} onChange={(value) => updateReport('paidTotal', value)} />
              </Field>

              <Field label="Pagamentos pendentes">
                <MoneyInput value={report.pendingTotal} onChange={(value) => updateReport('pendingTotal', value)} />
              </Field>
            </div>
          </section>
        )}

        <section className="content-grid">
          <article className="panel">
            <div className="panel-title">
              <h2>Resumo dos sócios</h2>
            </div>

            <div className="partner-list">
              {calculations.partners.map((partner, index) => (
                <div className="partner-card" key={partner.id}>
                  {role === 'admin' ? (
                    <div className="partner-editor">
                      <input value={partner.name} onChange={(event) => updatePartner(index, 'name', event.target.value)} />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={partner.percentage}
                        onChange={(event) => updatePartner(index, 'percentage', Number(event.target.value))}
                      />
                    </div>
                  ) : (
                    <div className="partner-row">
                      <strong>{partner.name}</strong>
                      <span>{partner.percentage}%</span>
                    </div>
                  )}

                  <strong className="partner-value">{formatCurrency(partner.value)}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-title">
              <h2>Reserva financeira</h2>
            </div>

            <div className="reserve-box">
              <span>Percentual definido</span>
              <strong>{report.reservePercentage}%</strong>
            </div>

            <div className="reserve-box green">
              <span>Valor reservado</span>
              <strong>{formatCurrency(calculations.reserve)}</strong>
            </div>

            <div className="reserve-box dark">
              <span>Valor distribuível</span>
              <strong>{formatCurrency(calculations.distributable)}</strong>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
