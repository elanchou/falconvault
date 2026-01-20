
import { useState, useEffect, useCallback } from 'react';
import { WalletData, VaultSettings, WalletMetadata } from '../types';
import { hashPassword, generateIntegrityHash } from '../services/cryptoService';

const STORAGE_KEY = 'falconvault_v1_store';

interface VaultStore {
  wallets: WalletData[];
  masterHash: string;
  settings: VaultSettings;
  checksum: string;
}

const DEFAULT_SETTINGS: VaultSettings = {
    autoLockMinutes: 15,
    enableLogging: true,
    attributeDefinitions: [
        { key: 'notes', label: 'Notes', type: 'text' }
    ]
};

export const useVault = () => {
  const [isLocked, setIsLocked] = useState(true);
  const [hasVault, setHasVault] = useState(false);
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [settings, setSettings] = useState<VaultSettings>(DEFAULT_SETTINGS);
  const [masterPassword, setMasterPassword] = useState(''); // Only in memory
  const [loading, setLoading] = useState(true);

  // Initialize
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setHasVault(true);
    }
    setLoading(false);
  }, []);

  // Save to storage helper
  const persist = useCallback(async (newWallets: WalletData[], newSettings: VaultSettings, passHash: string) => {
    const data = { wallets: newWallets, settings: newSettings };
    const checksum = await generateIntegrityHash(data);
    
    const store: VaultStore = {
      wallets: newWallets,
      masterHash: passHash,
      settings: newSettings,
      checksum
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, []);

  const createVault = async (password: string) => {
    const hash = await hashPassword(password);
    setMasterPassword(password);
    setIsLocked(false);
    setHasVault(true);
    setWallets([]);
    await persist([], settings, hash);
  };

  const unlockVault = async (password: string): Promise<boolean> => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;

    try {
      const parsed: VaultStore = JSON.parse(stored);
      const inputHash = await hashPassword(password);

      if (parsed.masterHash === inputHash) {
        // Optional: Verify checksum
        const dataToCheck = { wallets: parsed.wallets, settings: parsed.settings };
        const calculatedChecksum = await generateIntegrityHash(dataToCheck);
        
        if (parsed.checksum && parsed.checksum !== calculatedChecksum) {
          console.warn("Vault Integrity Warning: Data might have been tampered with externally.");
        }

        setWallets(parsed.wallets);
        // Merge with defaults to ensure new fields exist
        setSettings({ ...DEFAULT_SETTINGS, ...parsed.settings });
        setMasterPassword(password);
        setIsLocked(false);
        return true;
      }
    } catch (e) {
      console.error("Vault corruption", e);
    }
    return false;
  };

  const lockVault = useCallback(() => {
    setMasterPassword('');
    setIsLocked(true);
  }, []);

  const addWallet = async (wallet: WalletData) => {
    const newWallets = [...wallets, wallet];
    setWallets(newWallets);
    const hash = await hashPassword(masterPassword);
    await persist(newWallets, settings, hash);
  };

  const removeWallet = async (id: string) => {
    const newWallets = wallets.filter(w => w.id !== id);
    setWallets(newWallets);
    const hash = await hashPassword(masterPassword);
    await persist(newWallets, settings, hash);
  };
  
  const updateWalletMetadata = async (id: string, metadata: WalletMetadata) => {
      const newWallets = wallets.map(w => 
          w.id === id ? { ...w, metadata: { ...w.metadata, ...metadata } } : w
      );
      setWallets(newWallets);
      const hash = await hashPassword(masterPassword);
      await persist(newWallets, settings, hash);
  };

  const updateSettings = async (newSettings: Partial<VaultSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    const hash = await hashPassword(masterPassword);
    await persist(wallets, updated, hash);
  };

  const importVaultData = async (jsonString: string, currentPassword: string) => {
      try {
          const backup = JSON.parse(jsonString);
          // Simple validation
          if (!backup.wallets || !Array.isArray(backup.wallets)) throw new Error("Invalid format");
          
          // Merge logic: Add unique wallets by label/id
          const currentIds = new Set(wallets.map(w => w.id));
          const toAdd = backup.wallets.filter((w: WalletData) => !currentIds.has(w.id));
          
          const newWallets = [...wallets, ...toAdd];
          setWallets(newWallets);
          const hash = await hashPassword(currentPassword);
          await persist(newWallets, settings, hash);
          return { success: true, count: toAdd.length };
      } catch (e) {
          return { success: false, error: e };
      }
  };

  return {
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
  };
};
