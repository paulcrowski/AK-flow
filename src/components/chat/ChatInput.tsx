/**
 * ChatInput - Message input component
 * 
 * @module components/chat/ChatInput
 */

import React from 'react';
import { Send, Moon, Sun, Paperclip, Loader2 } from 'lucide-react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onUploadFile?: (file: File) => void;
  onToggleSleep: () => void;
  disabled: boolean;
  isSleeping: boolean;
  isFatigued: boolean;
  isCritical: boolean;
  isUploading?: boolean;
  uploadError?: string;
  uploadStatus?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  onUploadFile,
  onToggleSleep,
  disabled,
  isSleeping,
  isFatigued,
  isCritical,
  isUploading,
  uploadError,
  uploadStatus
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const canUpload = Boolean(onUploadFile) && !disabled && !isUploading;
  const statusText = uploadError || uploadStatus || '';
  const placeholder = isSleeping 
    ? "System is Dreaming (REM Cycle active)..."
    : isCritical 
      ? "Consciousness fading..."
      : isFatigued 
        ? "Alberto is tired..."
        : "Inject data into the cognitive stream...";

  const sleepButtonLabel = isSleeping
    ? "WAKE UP"
    : isCritical
      ? "DRIFTING..."
      : isFatigued
        ? "ALLOW REST"
        : "FORCE SLEEP";

  return (
    <div className={`p-4 border-t transition-colors duration-1000 ${isFatigued ? 'bg-[#151010] border-red-900/20' : 'bg-brain-dark border-gray-700'}`}>
      <div className="relative flex items-center">
        {onUploadFile && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.json,.png,.jpg,.jpeg,.webp,text/plain,text/markdown,application/json,image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                e.target.value = '';
                if (file) onUploadFile(file);
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!canUpload}
              title="Upload file"
              className={`absolute left-2 p-2 rounded-full text-gray-300 transition-all ${
                canUpload ? 'hover:text-white hover:bg-gray-800/60' : 'opacity-50 cursor-not-allowed'
              }`}
            >
              {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
            </button>
          </>
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSend()}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full bg-gray-900/80 text-white rounded-2xl py-5 pr-16 pl-14 focus:outline-none focus:ring-2 border placeholder-gray-600 shadow-2xl transition-all text-lg ${
            isSleeping
              ? 'border-indigo-500/30 opacity-50 cursor-not-allowed italic'
              : isFatigued
                ? 'border-orange-900/50 focus:ring-orange-800'
                : 'border-gray-700 focus:ring-brain-accent hover:border-gray-500'
          }`}
        />
        <button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className={`absolute right-2 p-2 rounded-full text-brain-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            isFatigued ? 'bg-orange-600 hover:bg-orange-500' : 'bg-brain-accent hover:bg-white'
          }`}
        >
          <Send size={20} />
        </button>
      </div>
      {statusText && (
        <div className={`mt-2 px-2 text-xs font-mono ${uploadError ? 'text-red-400' : 'text-emerald-300'}`}>
          {statusText}
        </div>
      )}
      <div className="flex justify-end mt-2 px-2">
        <button
          onClick={onToggleSleep}
          className={`text-xs flex items-center gap-1 hover:text-white transition-all duration-300 border px-3 py-1 rounded-full ${
            isSleeping
              ? "border-indigo-500/50 text-indigo-300 bg-indigo-900/20 animate-pulse"
              : isFatigued
                ? "border-orange-500/50 text-orange-400 bg-orange-900/20 animate-pulse"
                : "border-gray-700 text-gray-500 hover:bg-gray-800"
          }`}
        >
          {isSleeping ? <Sun size={12} /> : <Moon size={12} />}
          {sleepButtonLabel}
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
