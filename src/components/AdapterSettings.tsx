import React, { useState } from 'react';
import {
  Settings,
  Key,
  Globe,
  Radio,
  Cpu,
  Save,
  CheckCircle2,
  Shield,
  Bot,
  Brain
} from 'lucide-react';
import { BotConfig } from '../types/shipu';

interface AdapterSettingsProps {
  config: BotConfig;
  onUpdateConfig: (newConfig: Partial<BotConfig>) => void;
}

export const AdapterSettings: React.FC<AdapterSettingsProps> = React.memo(({
  config,
  onUpdateConfig
}) => {
  const [botName, setBotName] = useState(config?.botName || 'ShiPu Ai🤖');
  const [globalPrefix, setGlobalPrefix] = useState(config?.globalPrefix || '#');
  const [webhookUrl, setWebhookUrl] = useState(config?.webhookUrl || '');
  const [appState, setAppState] = useState(config?.facebookAppState || '[]');
  const [enableAI, setEnableAI] = useState(config?.enableAI ?? true);
  const [maintenanceMode, setMaintenanceMode] = useState(config?.maintenanceMode ?? false);

  const [savedSuccess, setSavedSuccess] = useState(false);

  React.useEffect(() => {
    if (config) {
      setBotName(config.botName || 'ShiPu Ai🤖');
      setGlobalPrefix(config.globalPrefix || '#');
      setWebhookUrl(config.webhookUrl || '');
      setAppState(config.facebookAppState || '[]');
      setEnableAI(config.enableAI ?? true);
      setMaintenanceMode(config.maintenanceMode ?? false);
    }
  }, [config]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConfig({
      botName,
      globalPrefix,
      webhookUrl,
      facebookAppState: appState,
      enableAI,
      maintenanceMode
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Settings className="w-6 h-6 text-indigo-400" /> Messenger Adapter & System Configuration
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure Facebook Graph API / Webhook endpoints, FCA App State cookie secrets, and AI Engine settings.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Basic Bot Info */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
            <Bot className="w-4 h-4 text-indigo-400" /> General Bot Profile
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Bot Name</label>
              <input
                type="text"
                value={botName || ''}
                onChange={e => setBotName(e.target.value)}
                className="w-full bg-slate-950 text-slate-100 px-3.5 py-2.5 rounded-xl border border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Global Default Prefix</label>
              <input
                type="text"
                value={globalPrefix || ''}
                onChange={e => setGlobalPrefix(e.target.value)}
                maxLength={5}
                className="w-full bg-slate-950 text-slate-100 px-3.5 py-2.5 rounded-xl border border-slate-800 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Messenger Webhook & FCA Credentials */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
            <Globe className="w-4 h-4 text-indigo-400" /> Facebook Messenger Connection Adapter
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Graph API Webhook URL</label>
            <input
              type="text"
              value={webhookUrl || ''}
              onChange={e => setWebhookUrl(e.target.value)}
              className="w-full bg-slate-950 text-slate-100 px-3.5 py-2.5 rounded-xl border border-slate-800 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Facebook App State JSON (Cookie Authentication)
            </label>
            <textarea
              value={appState || ''}
              onChange={e => setAppState(e.target.value)}
              rows={4}
              className="w-full bg-slate-950 text-slate-200 p-3 rounded-2xl border border-slate-800 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            ></textarea>
            <span className="text-[10px] text-slate-400 block mt-1">
              Encrypted JSON cookie state used by MessengerAdapter interface to listen for Messenger group events.
            </span>
          </div>
        </div>

        {/* Feature Switches */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
            <Brain className="w-4 h-4 text-purple-400" /> Feature Toggles & System Mode
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-200 text-xs">Gemini AI Assistant</h4>
                <p className="text-[10px] text-slate-400">Server-Side Gemini 3.6 Flash Integration</p>
              </div>
              <button
                type="button"
                onClick={() => setEnableAI(!enableAI)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  enableAI ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-slate-800 text-slate-500'
                }`}
              >
                {enableAI ? 'ENABLED ✅' : 'DISABLED 🛑'}
              </button>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-200 text-xs">System Maintenance Mode</h4>
                <p className="text-[10px] text-slate-400">Restrict commands to Bot Admins & Owners</p>
              </div>
              <button
                type="button"
                onClick={() => setMaintenanceMode(!maintenanceMode)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  maintenanceMode ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-500'
                }`}
              >
                {maintenanceMode ? 'ACTIVE ⚠️' : 'OFF ✅'}
              </button>
            </div>

          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between pt-2">
          {savedSuccess && (
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> ShiPu Ai Configuration Saved Successfully!
            </span>
          )}
          <button
            type="submit"
            className="ml-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-2xl shadow-xl shadow-indigo-600/25 transition flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </div>

      </form>

    </div>
  );
});

