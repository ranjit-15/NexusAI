import React, { useState } from 'react';
import { UserProfile } from '../types';
import { X, User, Copy, Check, LogOut, Key, Trash2, Moon, Sun } from 'lucide-react';
import { saveUserProfile, logoutUser } from '../src/userService';
import { checkUsernameExists, loadProfileFromFirestore, saveProfileToFirestore } from '../src/firestoreService';

interface UserProfileModalProps {
  profile: UserProfile;
  onClose: () => void;
  onUpdate: (newProfile: UserProfile) => void;
  onDeleteAllChats: () => void;
}

export default function UserProfileModal({ profile, onClose, onUpdate, onDeleteAllChats }: UserProfileModalProps) {
  const [copied, setCopied] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState(profile.displayName);
  const [usernameInput, setUsernameInput] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState(profile.apiKey || '');
  const [theme, setTheme] = useState(profile.theme || 'dark');

  const handleCopy = () => {
    navigator.clipboard.writeText(profile.username);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveName = async () => {
    if (displayNameInput.trim() && displayNameInput !== profile.displayName) {
      const newProfile = { ...profile, displayName: displayNameInput.trim() };
      saveUserProfile(newProfile);
      await saveProfileToFirestore(newProfile);
      onUpdate(newProfile);
    }
    setIsEditingName(false);
  };

  const handleAccountSwitch = async () => {
    const newUsername = usernameInput.trim();
    if (newUsername && newUsername !== profile.username) {
      const exists = await checkUsernameExists(newUsername);
      if (!exists) {
        alert('This username does not exist. Please check and try again.');
        return;
      }
      
      const newProfile = await loadProfileFromFirestore(newUsername);
      if (newProfile) {
        saveUserProfile(newProfile);
        window.location.reload(); // Reload to fetch the new account's chats
      } else {
        alert('Failed to load profile. Please try again.');
      }
    }
  };

  const handleSaveApiKey = async () => {
    const newProfile = { ...profile, apiKey: apiKeyInput.trim() };
    saveUserProfile(newProfile);
    await saveProfileToFirestore(newProfile);
    onUpdate(newProfile);
    alert('API Key saved successfully!');
  };

  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    const newProfile = { ...profile, theme: newTheme };
    saveUserProfile(newProfile);
    await saveProfileToFirestore(newProfile);
    onUpdate(newProfile);
    
    // Apply theme to document
    if (newTheme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  };

  const handleDeleteAll = () => {
    if (confirm('Are you sure you want to delete all chats? This cannot be undone.')) {
      onDeleteAllChats();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl animate-fade-in relative overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Avatar & Display Name */}
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 bg-gradient-to-tr from-[#10a37f] to-teal-500 rounded-full flex items-center justify-center text-3xl text-white font-bold mb-4 shadow-lg">
              {profile.displayName.charAt(0).toUpperCase()}
            </div>
            
            {isEditingName ? (
              <div className="flex items-center gap-2 w-full">
                <input
                  type="text"
                  autoFocus
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => e.key === 'Enter' && saveName()}
                  className="flex-1 bg-[#2a2a2a] border border-[#10a37f] rounded-lg px-3 py-1.5 text-white text-center outline-none"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setIsEditingName(true)}>
                <h3 className="text-xl font-bold text-white group-hover:text-gray-200">{profile.displayName}</h3>
                <span className="text-xs px-2 py-0.5 bg-white/10 rounded text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
              </div>
            )}
          </div>

          <div className="space-y-6">
            
            {/* Unique Username & Switch Account */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Unique Username
                </label>
                {!isSwitchingAccount && (
                  <button 
                    onClick={() => setIsSwitchingAccount(true)}
                    className="text-xs text-[#10a37f] hover:text-white transition-colors"
                  >
                    Switch Account
                  </button>
                )}
              </div>

              {isSwitchingAccount ? (
                <div className="flex flex-col gap-2 animate-fade-in">
                  <div className="flex items-center bg-[#2a2a2a] border border-[#10a37f] rounded-lg p-1 pr-2">
                    <div className="pl-3 pr-2 text-[#10a37f]">
                      <User size={16} />
                    </div>
                    <input
                      type="text"
                      autoFocus
                      placeholder="Enter existing username..."
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAccountSwitch()}
                      className="flex-1 bg-transparent border-none text-white outline-none font-mono text-sm py-2"
                    />
                    <button
                      onClick={handleAccountSwitch}
                      className="px-3 py-1 bg-[#10a37f] hover:bg-emerald-500 rounded text-xs text-white transition-colors ml-2 font-medium"
                    >
                      Login
                    </button>
                  </div>
                  <button 
                    onClick={() => setIsSwitchingAccount(false)}
                    className="text-[10px] text-gray-500 hover:text-gray-300 self-start"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center bg-[#2a2a2a] border border-white/10 rounded-lg p-1 pr-2">
                    <div className="pl-3 pr-2 text-gray-500">
                      <User size={16} />
                    </div>
                    <input
                      type="text"
                      readOnly
                      value={profile.username}
                      className="flex-1 bg-transparent border-none text-white outline-none cursor-default font-mono text-sm py-2"
                    />
                    <button
                      onClick={handleCopy}
                      title="Copy username"
                      className="p-2 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-colors"
                    >
                      {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1.5">
                    This username acts as your account. Save it to log in on other devices.
                  </p>
                </>
              )}
            </div>

            {/* Custom API Key */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">
                Custom Gemini API Key
              </label>
              <div className="flex items-center bg-[#2a2a2a] border border-white/10 rounded-lg p-1 pr-2">
                <div className="pl-3 pr-2 text-gray-500">
                  <Key size={16} />
                </div>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="flex-1 bg-transparent border-none text-white outline-none font-mono text-sm py-2"
                />
                <button
                  onClick={handleSaveApiKey}
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-white transition-colors ml-2"
                >
                  Save
                </button>
              </div>
              <p className="text-[10px] text-gray-500 mt-1.5">
                Get your free API key from <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-[#10a37f] hover:underline">Google AI Studio</a>.
              </p>
            </div>

            {/* Theme Toggle */}
            <div className="flex items-center justify-between py-2 border-t border-white/10">
              <div>
                <div className="text-sm text-white font-medium">Appearance</div>
                <div className="text-xs text-gray-500">Toggle light and dark mode</div>
              </div>
              <button 
                onClick={toggleTheme}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white transition-colors"
              >
                {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
            </div>

            {/* Danger Zone */}
            <div className="pt-2 border-t border-white/10">
              <button 
                onClick={handleDeleteAll}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium"
              >
                <Trash2 size={16} />
                Delete All Chats
              </button>
            </div>

          </div>
          
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-black/20">
          <button
            onClick={logoutUser}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-red-400 hover:bg-red-400/10 hover:text-red-300 transition-colors font-medium text-sm"
          >
            <LogOut size={16} />
            Log Out
          </button>
        </div>

      </div>
    </div>
  );
}
