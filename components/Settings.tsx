
import React, { useRef, useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { Download, AlertTriangle, Shield, Clock, Upload, Check, ListPlus, Trash2, Plus } from 'lucide-react';
import { AttributeDefinition, AttributeType, VaultSettings } from '../types';

interface SettingsProps {
  settings?: VaultSettings;
  onUpdateSettings?: (s: Partial<VaultSettings>) => void;
  onExport: () => void;
  onImport: (json: string) => Promise<{success: boolean; error?: any; count?: number}>;
  onClear: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, onUpdateSettings, onExport, onImport, onClear }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string>('');
  
  // New Attribute State
  const [newAttrLabel, setNewAttrLabel] = useState('');
  const [newAttrType, setNewAttrType] = useState<AttributeType>('text');
  const [newAttrOptions, setNewAttrOptions] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
          const content = evt.target?.result as string;
          if (content) {
              const result = await onImport(content);
              if (result.success) {
                  setImportStatus(`Successfully imported ${result.count} wallets.`);
                  setTimeout(() => setImportStatus(''), 3000);
              } else {
                  setImportStatus(`Error: ${result.error?.message || 'Invalid format'}`);
              }
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const addAttribute = () => {
      if (!newAttrLabel.trim() || !settings || !onUpdateSettings) return;
      
      const key = newAttrLabel.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Math.floor(Math.random() * 1000);
      const newDef: AttributeDefinition = {
          key,
          label: newAttrLabel.trim(),
          type: newAttrType,
          options: newAttrType === 'select' ? newAttrOptions.split(',').map(s => s.trim()).filter(Boolean) : undefined
      };

      onUpdateSettings({
          attributeDefinitions: [...settings.attributeDefinitions, newDef]
      });

      setNewAttrLabel('');
      setNewAttrOptions('');
      setNewAttrType('text');
  };

  const removeAttribute = (key: string) => {
      if (!settings || !onUpdateSettings) return;
      onUpdateSettings({
          attributeDefinitions: settings.attributeDefinitions.filter(d => d.key !== key)
      });
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 max-w-4xl mx-auto pb-12">
      <div className="flex items-center space-x-3 mb-6">
         <h2 className="text-2xl font-bold text-white">Settings & Administration</h2>
      </div>

      <div className="grid grid-cols-1 gap-6">
        
        {/* Custom Attributes Configuration */}
        {settings && onUpdateSettings && (
             <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
                <h3 className="text-lg font-medium text-white mb-4 flex items-center">
                    <ListPlus className="w-5 h-5 mr-2 text-sky-500" />
                    Wallet Attribute Configuration
                </h3>
                <p className="text-slate-400 text-sm mb-6">
                    Define custom fields for your wallets. These can be text fields or dropdown selections.
                </p>

                {/* List Existing */}
                <div className="space-y-3 mb-6">
                    {settings.attributeDefinitions.length === 0 && <p className="text-sm text-slate-600 italic">No custom attributes defined.</p>}
                    {settings.attributeDefinitions.map((attr) => (
                        <div key={attr.key} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg">
                            <div>
                                <span className="text-white font-medium mr-2">{attr.label}</span>
                                <span className="text-xs text-sky-400 bg-sky-900/20 px-1.5 py-0.5 rounded border border-sky-900/50 uppercase">{attr.type}</span>
                                {attr.type === 'select' && (
                                    <div className="text-xs text-slate-500 mt-1">Options: {attr.options?.join(', ')}</div>
                                )}
                            </div>
                            <button 
                                onClick={() => removeAttribute(attr.key)}
                                className="text-slate-500 hover:text-red-400 transition-colors p-2"
                                title="Remove Attribute"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Add New */}
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                    <h4 className="text-sm font-bold text-slate-300 mb-3">Add New Attribute</h4>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="md:col-span-4">
                            <Input 
                                placeholder="Label (e.g. Risk Level)" 
                                value={newAttrLabel}
                                onChange={(e) => setNewAttrLabel(e.target.value)}
                            />
                        </div>
                        <div className="md:col-span-3">
                             <select 
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 outline-none focus:border-sky-500 h-[42px]"
                                value={newAttrType}
                                onChange={(e) => setNewAttrType(e.target.value as AttributeType)}
                             >
                                 <option value="text">Text Input</option>
                                 <option value="select">Dropdown Select</option>
                                 <option value="date">Date Picker</option>
                             </select>
                        </div>
                        {newAttrType === 'select' && (
                            <div className="md:col-span-3">
                                <Input 
                                    placeholder="Options (Low, Med, High)" 
                                    value={newAttrOptions}
                                    onChange={(e) => setNewAttrOptions(e.target.value)}
                                />
                            </div>
                        )}
                        <div className="md:col-span-2">
                            <Button onClick={addAttribute} className="w-full h-[42px]" disabled={!newAttrLabel}>
                                <Plus className="w-4 h-4" /> Add
                            </Button>
                        </div>
                    </div>
                </div>
             </div>
        )}

        {/* Security Policies */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
           <h3 className="text-lg font-medium text-white mb-4 flex items-center">
              <Shield className="w-5 h-5 mr-2 text-sky-500" />
              Security Policies
           </h3>
           <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
                 <div className="flex items-center space-x-3">
                    <Clock className="w-5 h-5 text-slate-400" />
                    <div>
                       <p className="text-slate-200 font-medium">Auto-Lock Timer</p>
                       <p className="text-xs text-slate-500">System locks after 15 minutes of inactivity (Fixed).</p>
                    </div>
                 </div>
                 <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">ACTIVE</span>
              </div>
           </div>
        </div>

        {/* Data Management */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
           <h3 className="text-lg font-medium text-white mb-4 flex items-center">
              <Download className="w-5 h-5 mr-2 text-sky-500" />
              Vault Data Management
           </h3>
           <p className="text-slate-400 text-sm mb-6">
              Backup your encrypted vault. The backup file contains encrypted keys and your custom attribute configurations.
              <br/>
              <strong className="text-sky-500">You must use the same master password to decrypt imported wallets.</strong>
           </p>
           
           <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={onExport} variant="secondary">
                 <Download className="w-4 h-4 mr-2" />
                 Download Backup (.json)
              </Button>

              <div className="relative">
                  <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".json"
                      className="hidden"
                  />
                  <Button onClick={() => fileInputRef.current?.click()} variant="primary">
                    <Upload className="w-4 h-4 mr-2" />
                    Import Backup
                  </Button>
              </div>
           </div>
           {importStatus && (
               <div className={`mt-4 text-sm ${importStatus.includes('Error') ? 'text-red-400' : 'text-emerald-400'} flex items-center`}>
                   {importStatus.includes('Success') && <Check className="w-4 h-4 mr-2" />}
                   {importStatus}
               </div>
           )}
        </div>

        {/* Danger Zone */}
        <div className="bg-red-950/20 border border-red-900/50 p-6 rounded-xl">
           <h3 className="text-lg font-medium text-red-500 mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Danger Zone
           </h3>
           <p className="text-red-400/80 text-sm mb-6">
              This action will permanently delete all encrypted keys stored in this browser. 
              Ensure you have downloaded a backup first.
           </p>
           
           <Button onClick={onClear} variant="danger">
              Reset Vault & Erase Data
           </Button>
        </div>

      </div>
    </div>
  );
};
