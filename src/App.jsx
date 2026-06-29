import React, { useEffect, useMemo, useState } from 'react';
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
  Save,
  Settings,
} from 'lucide-react';

const firebaseConfig = {
  apiKey: 'AIzaSyAy8MB5x87RaOFvuimdih6YMU0IQJjcrV0',
  authDomain: 'relatorio-clinica.firebaseapp.com',
  projectId: 'relatorio-clinica',
  storageBucket: 'relatorio-clinica.firebasestorage.app',
  messagingSenderId: '409549348235',
  appId: '1:409549348235:web:891fd4e1ded7ae6509238e',
};

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const appId = 'clinica-app-v1';

const defaultReportData = {
  month: 'JUNHO / 2026',
  deadline: '30/06/2026',
  accountBalance: 24702.19,
  reservePercentage: 30,
  sales: [],
  paymentsMade: [],
  paymentsPending: [],
  partners: [
    { id: '1', name: 'SÓCIO 1', percentage: 50 },
    { id: '2', name: 'SÓCIO 2', percentage: 50 },
  ],
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value) || 0);

const parseMoney = (value) => {
  if (typeof value === 'number') return value;

  const normalized = String(value || '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  return Number(normalized) || 0;
};

function CurrencyInput({ value, onChange }) {
  const [localValue, setLocalValue] = useState('');

  useEffect(() => {
    setLocalValue(
      new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(value) || 0),
    );
  }, [value]);

  const handleChange = (event) => {
    const rawValue = event.target.value;
    setLocalValue(rawValue);
    onChange(parseMoney(rawValue));
  };

  return (
    <div className="relative w-full">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
        R$
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={localValue}
        onChange={handleChange}
        className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${tones[tone] || tones.blue}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="text-xl font-bold text-slate-950">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [reportData, setReportData] = useState(defaultReportData);
  const [view, setView] = useState('login');
  const [role, setRole] = useState(null);
  const [loginError, setLoginError] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const reportRef = useMemo(() => {
    if (!user) return null;
    return doc(db, 'artifacts', appId, 'public', 'data', 'reports', 'current');
  }, [user]);

  const totals = useMemo(() => {
    const salesTotal = reportData.sales.reduce((sum, item) => sum + parseMoney(item.value), 0);
    const paidTotal = reportData.paymentsMade.reduce((sum, item) => sum + parseMoney(item.value), 0);
    const pendingTotal = reportData.paymentsPending.reduce((sum, item) => sum + parseMoney(item.value), 0);
    const reserveValue = (parseMoney(reportData.accountBalance) * parseMoney(reportData.reservePercentage)) / 100;

    return { salesTotal, paidTotal, pendingTotal, reserveValue };
  }, [reportData]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error('Erro ao autenticar no Firebase:', error);
        setStatusMessage('Não foi possível conectar ao Firebase.');
      }
    };

    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!reportRef) return undefined;

    return onSnapshot(
      reportRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setReportData({ ...defaultReportData, ...snapshot.data() });
        }
      },
      (error) => {
        console.error('Erro ao carregar relatório:', error);
        setStatusMessage('Não foi possível carregar os dados do relatório.');
      },
    );
  }, [reportRef]);

  const handleLogin = (event) => {
    event.preventDefault();

    const password = passwordInput.trim();

    if (password === 'Admin@2026') {
      setRole('admin');
      setView('dashboard');
      setLoginError('');
      setPasswordInput('');
      return;
    }

    if (password === 'Dani@2026' || password === 'Mari@2026') {
      setRole('viewer');
      setView('dashboard');
      setLoginError('');
      setPasswordInput('');
      return;
    }

    setLoginError('Senha incorreta.');
  };

  const handleLogout = () => {
    setRole(null);
    setView('login');
    setPasswordInput('');
    setLoginError('');
    setStatusMessage('');
  };

  const updateField = (field, value) => {
    setReportData((current) => ({ ...current, [field]: value }));
  };

  const updatePartner = (index, field, value) => {
    setReportData((current) => ({
      ...current,
      partners: current.partners.map((partner, currentIndex) =>
        currentIndex === index ? { ...partner, [field]: value } : partner,
      ),
    }));
  };

  const saveReport = async () => {
    if (!reportRef) return;

    setIsSaving(true);
    setStatusMessage('');

    try {
      await setDoc(reportRef, reportData, { merge: true });
      setStatusMessage('Relatório salvo com sucesso.');
    } catch (error) {
      console.error('Erro ao salvar relatório:', error);
      setStatusMessage('Não foi possível salvar o relatório.');
    } finally {
      setIsSaving(false);
    }
  };

  if (view === 'login') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <section className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Landmark size={24} />
            </div>
            <h1 className="text-2xl font-bold text-slate-950">Acesso Financeiro</h1>
            <p className="mt-1 text-sm text-slate-500">Relatório da clínica</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={passwordInput}
              onChange={(event) => setPasswordInput(event.target.value)}
              className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Senha"
              autoComplete="current-password"
            />

            {loginError && (
              <p className="flex items-center justify-center gap-2 text-sm font-medium text-red-600">
                <AlertCircle size={16} />
                {loginError}
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 py-3 font-bold text-white hover:bg-blue-700"
            >
              Entrar
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Relatório financeiro
            </p>
            <h1 className="text-2xl font-bold text-slate-950">{reportData.month}</h1>
            <p className="text-sm text-slate-500">Prazo: {reportData.deadline}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {role === 'admin' && (
              <button
                type="button"
                onClick={saveReport}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-70"
              >
                <Save size={18} />
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-100"
            >
              <LogOut size={18} />
              Sair
            </button>
          </div>
        </header>

        {statusMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm font-medium text-blue-800">
            <CheckCircle2 size={18} />
            {statusMessage}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard icon={Landmark} label="Saldo atual" value={formatCurrency(reportData.accountBalance)} tone="green" />
          <StatCard icon={BarChart3} label="Vendas" value={formatCurrency(totals.salesTotal)} tone="blue" />
          <StatCard icon={CreditCard} label="Pagamentos" value={formatCurrency(totals.paidTotal)} tone="slate" />
          <StatCard icon={AlertCircle} label="Pendências" value={formatCurrency(totals.pendingTotal)} tone="amber" />
        </section>

        {role === 'admin' && (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Settings size={20} className="text-blue-700" />
              <h2 className="text-lg font-bold text-slate-950">Edição do relatório</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-600">Mês</span>
                <input
                  value={reportData.month}
                  onChange={(event) => updateField('month', event.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-600">Prazo</span>
                <input
                  value={reportData.deadline}
                  onChange={(event) => updateField('deadline', event.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-600">Saldo atual</span>
                <CurrencyInput
                  value={reportData.accountBalance}
                  onChange={(value) => updateField('accountBalance', value)}
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-600">Reserva (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={reportData.reservePercentage}
                  onChange={(event) => updateField('reservePercentage', Number(event.target.value))}
                  className="w-full rounded-lg border border-slate-300 p-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-950">Resumo dos sócios</h2>

            <div className="space-y-3">
              {reportData.partners.map((partner, index) => {
                const share =
                  (parseMoney(reportData.accountBalance) - totals.reserveValue) *
                  (parseMoney(partner.percentage) / 100);

                return (
                  <div key={partner.id} className="rounded-lg border border-slate-200 p-4">
                    {role === 'admin' ? (
                      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                        <input
                          value={partner.name}
                          onChange={(event) => updatePartner(index, 'name', event.target.value)}
                          className="rounded-lg border border-slate-300 p-2.5 font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={partner.percentage}
                          onChange={(event) => updatePartner(index, 'percentage', Number(event.target.value))}
                          className="rounded-lg border border-slate-300 p-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-semibold text-slate-950">{partner.name}</p>
                        <p className="text-sm font-medium text-slate-500">{partner.percentage}%</p>
                      </div>
                    )}

                    <p className="mt-3 text-2xl font-bold text-emerald-700">{formatCurrency(share)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-950">Reserva financeira</h2>

            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-500">Percentual definido</p>
              <p className="text-2xl font-bold text-slate-950">{reportData.reservePercentage}%</p>
            </div>

            <div className="mt-3 rounded-lg bg-emerald-50 p-4">
              <p className="text-sm font-medium text-emerald-700">Valor reservado</p>
              <p className="text-2xl font-bold text-emerald-800">{formatCurrency(totals.reserveValue)}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
