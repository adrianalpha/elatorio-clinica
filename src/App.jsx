import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { BarChart3, Calendar, Landmark, CreditCard, CheckCircle2, AlertCircle, Users, Settings, LogOut, Plus, Trash2, Save, Info } from 'lucide-react';

// ============================================================================
// CONFIGURAÇÃO FIREBASE (Chaves oficiais do seu print)
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyAy8MB5x87RaOFvuimdih6YMU0IQJjcrV0",
  authDomain: "relatorio-clinica.firebaseapp.com",
  projectId: "relatorio-clinica",
  storageBucket: "relatorio-clinica.firebasestorage.app",
  messagingSenderId: "409549348235",
  appId: "1:409549348235:web:891fd4e1ded7ae6509238e"
};

// Inicialização segura para evitar erros de re-inicialização
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'clinica-app-v1';

// ============================================================================
// COMPONENTE DE MÁSCARA DE MOEDA
// ============================================================================
const CurrencyInput = ({ value, onChange, className, placeholder }) => {
  const displayValue = new Intl.NumberFormat('pt-BR', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).format(value || 0);

  const handleChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (!val) {
      onChange(0);
      return;
    }
    const numValue = parseInt(val, 10) / 100;
    onChange(numValue);
  };

  return (
    <div className="relative w-full">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold pointer-events-none">R$</span>
      <input
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={`${className} pl-8`}
      />
    </div>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function App() {
  const [user, setUser] = useState(null);
  const [reportData, setReportData] = useState({
    month: "JUNHO / 2025",
    deadline: "30/06/2026",
    accountBalance: 24702.19,
    reservePercentage: 30,
    sales: [],
    paymentsMade: [],
    paymentsPending: [],
    partners: [{ id: '1', name: "SÓCIO 1", percentage: 50 }, { id: '2', name: "SÓCIO 2", percentage: 50 }]
  });
  const [view, setView] = useState('login'); 
  const [role, setRole] = useState(null);
  const [loginError, setLoginError] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Autenticação Firebase
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Erro de autenticação:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Dados do Firestore
  useEffect(() => {
    if (!user) return;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'reports', 'current');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) setReportData(docSnap.data());
    });
    return () => unsubscribe();
  }, [user]);

  const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const handleLogin = (e) => {
    e.preventDefault();
    const pwd = passwordInput.trim();
    if (pwd === 'Dani@2026' || pwd === 'Mari@2026') {
      setRole('viewer'); setView('dashboard'); setPasswordInput('');
    } else if (pwd === 'Admin@2026') {
      setRole('admin'); setView('dashboard'); setPasswordInput('');
    } else {
      setLoginError('Senha incorreta.');
    }
  };

  if (view === 'login') return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-center text-[#0f1b29] mb-6">Acesso Financeiro</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full p-3 border rounded" placeholder="Senha" />
          {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded">Entrar</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-6xl mx-auto bg-white shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center mb-6">Relatório Financeiro</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           <div className="p-4 bg-green-50 rounded-lg">
             <h2 className="text-lg font-bold">Saldo Atual</h2>
             <p className="text-2xl">{formatCurrency(reportData.accountBalance)}</p>
           </div>
        </div>
        <button onClick={() => setView('login')} className="mt-8 bg-slate-600 text-white px-6 py-3 rounded">Sair</button>
      </div>
    </div>
  );
}
