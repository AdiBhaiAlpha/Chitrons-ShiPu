import React, { useState } from 'react';
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  Check,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Sparkles,
  Users2,
  MessageSquare,
  Pin,
  Bell,
  BellOff,
  Tag,
  FileText,
  Activity,
  Smile,
  Download,
  ExternalLink
} from 'lucide-react';
import { ShiPuThread, ShiPuMessage, MessengerService } from '../lib/MessengerService';

interface ActiveConversationViewProps {
  selectedItem: ShiPuThread & { messages?: ShiPuMessage[]; aiActive?: boolean; tag?: string; notes?: string; reminder?: string; isPinned?: boolean; isMuted?: boolean };
  onActionComplete: (action: string, updatedItem: any) => void;
  showToast: (type: 'success' | 'error', text: string) => void;
}

export const ActiveConversationView: React.FC<ActiveConversationViewProps> = ({
  selectedItem,
  onActionComplete,
  showToast
}) => {
  const [replyText, setReplyText] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<ShiPuMessage[]>(selectedItem.messages || []);

  const handleSendMessage = async () => {
    if (!replyText.trim()) return;
    setActionLoading(true);
    try {
      const res = await MessengerService.performAction(selectedItem.accountId, selectedItem.threadID, 'send_message', replyText);
      if (res.success) {
        const newMsg: ShiPuMessage = {
          messageID: `msg_${Date.now()}`,
          senderID: 'admin',
          senderName: 'Admin / Bot',
          body: replyText,
          timestamp: Date.now(),
          isBot: true
        };
        const updatedMessages = [...messages, newMsg];
        setMessages(updatedMessages);
        setReplyText('');
        showToast('success', `Reply sent to ${selectedItem.name}!`);
        onActionComplete('send_message', { ...selectedItem, messages: updatedMessages });
      } else {
        showToast('error', res.diagnostic?.errorStack || 'Failed to send message');
      }
    } catch (e: any) {
      showToast('error', e.message || 'Failed to send message');
    } finally {
      setActionLoading(false);
    }
  };

  const handleThreadAction = async (action: string) => {
    setActionLoading(true);
    try {
      let res;
      if (action === 'accept_request') {
        res = await MessengerService.approvePendingThread(selectedItem.accountId, selectedItem.threadID);
      } else if (action === 'archive') {
        res = await MessengerService.archiveThread(selectedItem.accountId, selectedItem.threadID);
      } else if (action === 'restore') {
        res = await MessengerService.unarchiveThread(selectedItem.accountId, selectedItem.threadID);
      } else if (action === 'mark_read') {
        res = await MessengerService.markAsRead(selectedItem.accountId, selectedItem.threadID);
      } else {
        res = await MessengerService.performAction(selectedItem.accountId, selectedItem.threadID, action);
      }

      if (res && res.success) {
        showToast('success', `Action "${action}" completed successfully!`);
        onActionComplete(action, selectedItem);
      } else {
        showToast('error', res?.diagnostic?.errorStack || 'Action failed');
      }
    } catch (e: any) {
      showToast('error', e.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Chat Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md ${
            selectedItem.category === 'spam'
              ? 'bg-rose-600'
              : selectedItem.category === 'request'
              ? 'bg-amber-600'
              : 'bg-indigo-600 shadow-indigo-600/20'
          }`}>
            {selectedItem.threadIcon ? (
              <img src={selectedItem.threadIcon} alt="" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
            ) : selectedItem.isGroup ? (
              <Users2 className="w-5 h-5" />
            ) : (
              <MessageSquare className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 truncate max-w-[220px]">
              {selectedItem.name}
            </h3>
            <p className="text-[10px] text-slate-400 truncate max-w-[220px]">
              ID: <code className="text-indigo-300">{selectedItem.threadID}</code> • {selectedItem.accountName} {selectedItem.participantCount ? `• ${selectedItem.participantCount} members` : ''}
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleThreadAction('mark_read')}
            title="Mark as Read"
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-[11px] font-semibold transition"
          >
            Mark Read
          </button>
          <button
            onClick={() => handleThreadAction(selectedItem.category === 'archived' ? 'restore' : 'archive')}
            title={selectedItem.category === 'archived' ? 'Unarchive' : 'Archive'}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-[11px] font-semibold transition"
          >
            {selectedItem.category === 'archived' ? 'Unarchive' : 'Archive'}
          </button>
        </div>
      </div>

      {/* Request / Spam Action Banners */}
      {selectedItem.category === 'request' && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs text-amber-300 font-medium">Pending Message Request</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleThreadAction('accept_request')}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow transition"
            >
              Accept & Connect
            </button>
            <button
              onClick={() => handleThreadAction('decline_request')}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold rounded-xl transition"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {selectedItem.category === 'spam' && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="text-xs text-rose-300 font-medium">Flagged as Spam / Suspicious</span>
          </div>
          <button
            onClick={() => handleThreadAction('unspam')}
            disabled={actionLoading}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow transition"
          >
            Restore to Inbox
          </button>
        </div>
      )}

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-3">
        {messages.length === 0 ? (
          <div className="py-20 text-center text-slate-500 text-xs">No message history available in view. Type below to send first reply.</div>
        ) : (
          messages.map(msg => {
            const isBot = msg.isBot || msg.senderID === 'admin';
            return (
              <div key={msg.messageID || Math.random()} className={`flex items-start gap-2.5 ${isBot ? 'justify-end' : 'justify-start'}`}>
                {!isBot && (
                  <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 font-bold flex items-center justify-center text-[10px] shrink-0">
                    {(msg.senderName || 'U')[0]}
                  </div>
                )}
                <div className={`space-y-1 max-w-[80%] ${isBot ? 'text-right' : 'text-left'}`}>
                  <div className={`flex items-center gap-2 ${isBot ? 'justify-end' : 'justify-start'}`}>
                    <span className="text-[10px] font-semibold text-slate-300">{msg.senderName || 'User'}</span>
                    <span className="text-[9px] text-slate-500">
                      {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={`p-3 text-xs rounded-2xl border ${
                    isBot
                      ? 'bg-indigo-600 text-white border-indigo-500 rounded-tr-sm shadow-md'
                      : 'bg-slate-800 text-slate-200 border-slate-700 rounded-tl-sm'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.body}</p>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2 space-y-1.5 pt-2 border-t border-slate-700/50">
                        {msg.attachments.map((att: any, idx: number) => (
                          <a
                            key={idx}
                            href={att.url || att.previewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 p-1.5 bg-slate-900/60 rounded-xl text-[11px] text-indigo-300 hover:underline"
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                            <span className="truncate">Attachment {idx + 1}</span>
                            <ExternalLink className="w-3 h-3 ml-auto" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {isBot && (
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px] shadow-sm shrink-0">
                    🤖
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Message Input & Actions */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder={`Reply to ${selectedItem.name} via FCA API...`}
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && replyText.trim()) {
                handleSendMessage();
              }
            }}
            className="flex-1 bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition"
          />
          <button
            onClick={handleSendMessage}
            disabled={actionLoading || !replyText.trim()}
            className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/25"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </div>
      </div>
    </div>
  );
};
