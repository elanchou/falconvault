
import React, { useState, useEffect } from 'react';
import { ViewState, LogEntry } from './types';
import { useVault } from './hooks/useVault';
import { useAutoLock } from './hooks/useAutoLock';
import { Dashboard } from './components/Dashboard';
import { WalletManager } from './components/WalletManager';
import { SignerTool } from './components/SignerTool';
import { TransferHub } from './components/TransferHub';
import { Settings } from './components/Settings';
import { Documentation } from './components/Documentation';
import { Button } from './components/Button';
import { Input } from './components/Input';
import { logger } from './services/systemLogger';
import { Shield, Lock, Unlock, LogOut, LayoutDashboard, Wallet, PenTool, Settings as SettingsIcon, Bird, Eye, BookOpen, Send } from 'lucide-react';

export default function App() {
  const [inputPassword, setInputPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [view, setView] = useState<ViewState>('dashboard');
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Subscribe to system logs
  useEffect(() => {
    const unsubscribe = logger.subscribe((entry) => {
      setLogs(prev => [...prev, entry].slice(-100)); // Keep last 100 logs
    });
    return unsubscribe;
  }, []);

  // Custom Hooks managing Business Logic
  const { 
    isLocked, 
    hasVault, 
    wallets, 
    settings,
    masterPassword,
    loading, 
    createVault, 
    unlockVault, 
    lockVault, 
    addWallet, 
    removeWallet, 
    updateWalletMetadata,
    updateSettings,
    importVaultData
  } = useVault();

  // Auto-lock security
  useAutoLock(isLocked, () => {
      lockVault();
      logger.log('Vault auto-locked due to inactivity', 'warning', 'Security');
  }, settings.autoLockMinutes);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const success = await unlockVault(inputPassword);
    if (success) {
      setInputPassword('');
      logger.log('Vault unlocked successfully', 'success', 'Auth');
    } else {
      setLoginError('Incorrect Master Password');
      logger.log('Failed unlock attempt', 'error', 'Auth');
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPassword.length < 6) {
      setLoginError('Password must be at least 6 characters');
      return;
    }
    await createVault(inputPassword);
    setInputPassword('');
    logger.log('New Vault initialized', 'success', 'System');
  };

  const exportVault = () => {
    const exportData = { wallets, settings };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `falconvault_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    logger.log('Vault backup exported', 'info', 'System');
  };

  const clearVault = () => {
    if(confirm('CRITICAL WARNING: ALL WALLETS WILL BE DELETED PERMANENTLY. \n\nAre you sure?')) {
        localStorage.removeItem('falconvault_v1_store');
        logger.log('Vault reset performed', 'warning', 'System');
        window.location.reload();
    }
  };

  const handleManualLock = () => {
      lockVault();
      logger.log('Vault locked manually', 'info', 'Auth');
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-950 text-slate-500 animate-pulse">Initializing Secure Environment...</div>;

  // --- Lock Screen ---
  if (isLocked) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950 p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-sky-500/10 rounded-full ring-1 ring-sky-500/50">
              <Bird className="w-12 h-12 text-sky-500" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-center text-white mb-2">
            {hasVault ? 'FalconVault Secure' : 'Initialize Vault'}
          </h1>
          <p className="text-center text-slate-400 mb-8 text-sm">
            {hasVault 
              ? 'Enter your master password to decrypt the local keystore.' 
              : 'Create a strong master password to encrypt your keys locally.'}
          </p>

          <form onSubmit={hasVault ? handleUnlock : handleSetup} className="space-y-4">
            <Input 
              type="password" 
              placeholder="Master Password" 
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value)}
              autoFocus
              className="text-center"
            />
            {loginError && <p className="text-red-500 text-xs text-center font-mono">{loginError}</p>}
            
            <Button type="submit" className="w-full" size="lg">
              {hasVault ? (
                <>
                  <Unlock className="w-4 h-4 mr-2" /> Unlock Vault
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" /> Encrypt & Create
                </>
              )}
            </Button>
          </form>
          
          {hasVault && (
            <div className="mt-8 pt-6 border-t border-slate-800 flex justify-center">
              <button 
                className="text-xs text-red-900/50 hover:text-red-500 transition-colors"
                onClick={clearVault}
              >
                Emergency Reset
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Main Interface ---
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex z-20">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 space-x-3">
          <Bird className="w-6 h-6 text-sky-500" />
          <span className="font-bold text-lg tracking-tight text-white">FalconVault</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-4 mt-2">Platform</div>
          <NavItem 
            icon={<LayoutDashboard />} 
            label="Overview" 
            isActive={view === 'dashboard'} 
            onClick={() => setView('dashboard')} 
          />
          <NavItem 
            icon={<Wallet />} 
            label="Wallets" 
            isActive={view === 'wallets'} 
            onClick={() => setView('wallets')} 
          />
          
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-4 mt-6">Operations</div>
          <NavItem 
            icon={<Send />} 
            label="Transfer Hub" 
            isActive={view === 'transfer'} 
            onClick={() => setView('transfer')} 
          />
          <NavItem 
            icon={<PenTool />} 
            label="Signer Tool" 
            isActive={view === 'signer'} 
            onClick={() => setView('signer')} 
          />

          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-4 mt-6">Developer</div>
          <NavItem 
            icon={<BookOpen />} 
            label="API Docs" 
            isActive={view === 'docs'} 
            onClick={() => setView('docs')} 
          />

          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-4 mt-6">System</div>
          <NavItem 
            icon={<SettingsIcon />} 
            label="Settings" 
            isActive={view === 'settings'} 
            onClick={() => setView('settings')} 
          />
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <button 
            onClick={handleManualLock}
            className="flex items-center w-full px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all group"
          >
            <LogOut className="w-4 h-4 mr-3 group-hover:text-sky-500" />
            Lock Vault
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 relative">
        {/* Header */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-md">
          <div className="flex items-center">
             <h1 className="text-lg font-semibold capitalize text-white flex items-center">
                {view === 'dashboard' ? 'Overview' : view.replace('-', ' ')}
             </h1>
          </div>
          <div className="flex items-center space-x-4">
             <div className="hidden md:flex items-center px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
               <Shield className="w-3 h-3 mr-2 text-emerald-500" />
               <span className="text-xs text-emerald-400 font-mono">ENCRYPTED</span>
             </div>
          </div>
        </header>

        {/* Scrollable View */}
        <div className="flex-1 overflow-auto p-6 md:p-8 scroll-smooth">
          <div className="max-w-6xl mx-auto min-h-full">
            {view === 'dashboard' && (
              <Dashboard wallets={wallets} settings={settings} logs={logs} onNavigate={setView} />
            )}
            
            {view === 'wallets' && (
              <WalletManager 
                wallets={wallets} 
                password={masterPassword}
                settings={settings}
                onNavigate={setView}
                onAddWallet={(w) => {
                    addWallet(w);
                    logger.log(`Wallet imported: ${w.name}`, 'success', 'WalletMgr');
                }}
                onRemoveWallet={(id) => {
                    removeWallet(id);
                    logger.log(`Wallet removed: ${id}`, 'warning', 'WalletMgr');
                }}
                onUpdateWallet={(id, meta) => {
                    updateWalletMetadata(id, meta);
                    logger.log(`Wallet updated: ${id}`, 'info', 'WalletMgr');
                }}
              />
            )}

            {view === 'transfer' && (
              <TransferHub 
                wallets={wallets} 
                password={masterPassword}
              />
            )}

            {view === 'signer' && (
              <SignerTool 
                wallets={wallets} 
                password={masterPassword}
                onAddWallet={(w) => {
                    addWallet(w);
                    logger.log(`Wallet imported via API: ${w.name}`, 'success', 'API');
                }}
              />
            )}

            {view === 'docs' && (
              <Documentation />
            )}

            {view === 'settings' && (
              <Settings 
                settings={settings}
                onUpdateSettings={(s) => {
                    updateSettings(s);
                    logger.log('System settings updated', 'info', 'Settings');
                }}
                onExport={exportVault} 
                onClear={clearVault} 
                onImport={(json) => importVaultData(json, masterPassword)}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// Nav Helper
const NavItem = ({ icon, label, isActive, onClick }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 mb-1 ${
      isActive 
        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-sm shadow-sky-900/20' 
        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent'
    }`}
  >
    {React.cloneElement(icon, { className: `w-4 h-4 mr-3 ${isActive ? 'text-sky-500' : 'text-slate-500 group-hover:text-slate-300'}` })}
    {label}
  </button>
);
