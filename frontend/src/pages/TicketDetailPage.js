import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  ArrowLeft, Send, Sparkles, Languages, UserPlus, Mail, Clock, Tag,
  AlertTriangle, Bug, Activity, Database, Video, ChevronDown, Loader2,
  CheckCircle2, XCircle, Globe, Wand2
} from 'lucide-react';

const PRIORITY_COLORS = { urgent: '#ef4444', high: '#f59e0b', medium: '#06b6d4', low: '#6b7280' };
const CATEGORY_COLORS = {
  'refund-request': '#ef4444', 'subscription-cancellation': '#f59e0b',
  'account-issues': '#8b5cf6', 'subscription-info': '#06b6d4',
  'technical-issue': '#ec4899', 'feature-request': '#10b981',
  'garbage': '#6b7280', 'uncategorized': '#374151'
};

export default function TicketDetailPage() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { api, user } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [team, setTeam] = useState([]);
  const [enrichment, setEnrichment] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [aiLoading, setAiLoading] = useState({});
  const [translation, setTranslation] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [ticketRes, messagesRes, teamRes, enrichRes] = await Promise.all([
          api('get', `/tickets/${ticketId}`),
          api('get', `/tickets/${ticketId}/messages`),
          api('get', '/team'),
          api('get', `/enrichment/${ticketId}`)
        ]);
        setTicket(ticketRes.data);
        setMessages(messagesRes.data);
        setTeam(teamRes.data);
        setEnrichment(enrichRes.data);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load ticket');
      }
    };
    load();
  }, [api, ticketId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendReply = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      const res = await api('post', `/tickets/${ticketId}/messages`, {
        body: replyText, sender_type: 'agent', source: 'platform'
      });
      setMessages(prev => [...prev, res.data]);
      setReplyText('');
      toast.success('Reply sent & synced to Outlook');
    } catch (err) {
      toast.error('Failed to send reply');
    }
    setSending(false);
  };

  const updateTicket = async (field, value) => {
    try {
      const res = await api('patch', `/tickets/${ticketId}`, { [field]: value });
      setTicket(res.data);
      toast.success(`Ticket ${field} updated`);
    } catch (err) {
      toast.error('Update failed');
    }
  };

  const runAI = async (action) => {
    setAiLoading(prev => ({ ...prev, [action]: true }));
    try {
      if (action === 'categorize') {
        const res = await api('post', '/ai/categorize', { text: ticket.body, ticket_id: ticketId });
        setTicket(prev => ({
          ...prev,
          category: res.data.category, priority: res.data.priority,
          ai_category: res.data.category, ai_sentiment: res.data.sentiment,
          ai_summary: res.data.summary, language: res.data.language
        }));
        toast.success(`Categorized: ${res.data.category} | ${res.data.priority}`);
      } else if (action === 'draft') {
        const res = await api('post', '/ai/draft', { text: ticket.body, ticket_id: ticketId });
        setReplyText(res.data.draft);
        toast.success('AI draft ready');
      } else if (action === 'translate') {
        const res = await api('post', '/ai/translate', { text: ticket.body, ticket_id: ticketId });
        setTranslation(res.data.translation);
        toast.success('Translation ready');
      } else if (action === 'assign') {
        const res = await api('post', '/ai/auto-assign', { text: ticket.body, ticket_id: ticketId });
        if (res.data.assigned_to) {
          setTicket(prev => ({ ...prev, assigned_to: res.data.assigned_to }));
          const member = team.find(m => m.id === res.data.assigned_to);
          toast.success(`Assigned to ${member?.name || 'team member'}: ${res.data.reason}`);
        }
      }
    } catch (err) {
      toast.error(`AI ${action} failed: ${err.response?.data?.detail || err.message}`);
    }
    setAiLoading(prev => ({ ...prev, [action]: false }));
  };

  if (!ticket) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[hsl(174,72%,45%)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="animate-fade-in h-[calc(100vh-80px)] flex flex-col" data-testid="ticket-detail-page">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => navigate('/tickets')} data-testid="back-to-tickets-btn"
            className="text-[hsl(210,10%,55%)] hover:text-[hsl(174,72%,45%)]">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[hsl(210,10%,55%)]">{ticket.ticket_number}</span>
              <Badge className="text-[10px] border" style={{
                background: `${CATEGORY_COLORS[ticket.category]}15`,
                color: CATEGORY_COLORS[ticket.category],
                borderColor: `${CATEGORY_COLORS[ticket.category]}30`
              }}>{ticket.category}</Badge>
              <div className="w-2 h-2 rounded-full" style={{ background: PRIORITY_COLORS[ticket.priority] }} />
              <span className="text-[10px] text-[hsl(210,10%,55%)]">{ticket.priority}</span>
              {ticket.language && ticket.language !== 'en' && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[hsl(220,14%,16%)] text-[hsl(174,72%,45%)]">
                  <Globe className="w-3 h-3 inline mr-0.5" />{ticket.language.toUpperCase()}
                </span>
              )}
            </div>
            <h1 className="text-lg font-semibold text-[hsl(210,15%,92%)] truncate">{ticket.subject}</h1>
          </div>

          {/* Outlook sync indicator */}
          <Tooltip>
            <TooltipTrigger>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/20">
                <Mail className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[10px] text-blue-400 font-mono">{ticket.outlook_thread_id}</span>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
              </div>
            </TooltipTrigger>
            <TooltipContent><p>Synced with Outlook thread</p></TooltipContent>
          </Tooltip>
        </div>

        {/* Main content */}
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Left: Conversation */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* AI Actions Bar */}
            <div className="flex items-center gap-2 mb-3 shrink-0 flex-wrap" data-testid="ai-actions-bar">
              <span className="text-[10px] uppercase tracking-wider text-[hsl(210,10%,55%)] mr-1">AI Actions</span>
              <Button size="sm" variant="outline" onClick={() => runAI('categorize')} disabled={aiLoading.categorize}
                className="h-7 text-xs border-[hsl(220,14%,18%)] text-[hsl(210,10%,55%)] hover:text-[hsl(174,72%,45%)] hover:border-[hsl(174,72%,45%)] bg-transparent"
                data-testid="ai-categorize-btn">
                {aiLoading.categorize ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Tag className="w-3 h-3 mr-1" />}
                Categorize
              </Button>
              <Button size="sm" variant="outline" onClick={() => runAI('draft')} disabled={aiLoading.draft}
                className="h-7 text-xs border-[hsl(220,14%,18%)] text-[hsl(210,10%,55%)] hover:text-[hsl(174,72%,45%)] hover:border-[hsl(174,72%,45%)] bg-transparent"
                data-testid="ai-draft-btn">
                {aiLoading.draft ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Wand2 className="w-3 h-3 mr-1" />}
                Draft Reply
              </Button>
              <Button size="sm" variant="outline" onClick={() => runAI('translate')} disabled={aiLoading.translate}
                className="h-7 text-xs border-[hsl(220,14%,18%)] text-[hsl(210,10%,55%)] hover:text-[hsl(174,72%,45%)] hover:border-[hsl(174,72%,45%)] bg-transparent"
                data-testid="ai-translate-btn">
                {aiLoading.translate ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Languages className="w-3 h-3 mr-1" />}
                Translate
              </Button>
              <Button size="sm" variant="outline" onClick={() => runAI('assign')} disabled={aiLoading.assign}
                className="h-7 text-xs border-[hsl(220,14%,18%)] text-[hsl(210,10%,55%)] hover:text-[hsl(174,72%,45%)] hover:border-[hsl(174,72%,45%)] bg-transparent"
                data-testid="ai-assign-btn">
                {aiLoading.assign ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <UserPlus className="w-3 h-3 mr-1" />}
                Auto-Assign
              </Button>
            </div>

            {/* AI Summary */}
            {ticket.ai_summary && (
              <div className="mb-3 p-2.5 rounded-lg bg-[hsl(174,72%,45%)]/5 border border-[hsl(174,72%,45%)]/20 shrink-0" data-testid="ai-summary">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-3 h-3 text-[hsl(174,72%,45%)]" />
                  <span className="text-[10px] uppercase tracking-wider text-[hsl(174,72%,45%)]">AI Summary</span>
                  {ticket.ai_sentiment && (
                    <Badge className="text-[10px] px-1.5 py-0 ml-auto bg-[hsl(220,14%,16%)] text-[hsl(210,10%,55%)] border-none">
                      {ticket.ai_sentiment}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-[hsl(210,15%,92%)]">{ticket.ai_summary}</p>
              </div>
            )}

            {/* Translation */}
            {translation && (
              <div className="mb-3 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20 shrink-0" data-testid="translation-panel">
                <div className="flex items-center gap-1.5 mb-1">
                  <Languages className="w-3 h-3 text-blue-400" />
                  <span className="text-[10px] uppercase tracking-wider text-blue-400">English Translation</span>
                  <Button size="sm" variant="ghost" onClick={() => setTranslation(null)} className="ml-auto h-5 text-[10px] text-[hsl(210,10%,55%)]">
                    <XCircle className="w-3 h-3" />
                  </Button>
                </div>
                <p className="text-xs text-[hsl(210,15%,92%)]">{translation}</p>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0" ref={scrollRef} data-testid="message-thread">
              {messages.map((msg, i) => (
                <div key={msg.id} className={`flex ${msg.sender_type === 'agent' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                  style={{ animationDelay: `${i * 50}ms` }} data-testid={`message-${msg.id}`}>
                  <div className={`max-w-[80%] rounded-lg p-3 ${
                    msg.sender_type === 'agent'
                      ? 'bg-[hsl(174,72%,45%)]/10 border border-[hsl(174,72%,45%)]/20'
                      : 'bg-[hsl(220,16%,11%)] border border-[hsl(220,14%,18%)]'
                  }`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-xs font-medium ${msg.sender_type === 'agent' ? 'text-[hsl(174,72%,45%)]' : 'text-[hsl(210,15%,92%)]'}`}>
                        {msg.sender_name}
                      </span>
                      <span className="text-[10px] text-[hsl(210,10%,40%)]">{new Date(msg.created_at).toLocaleString()}</span>
                      <Badge className="text-[9px] px-1 py-0 border-none" style={{
                        background: msg.source === 'email' ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)',
                        color: msg.source === 'email' ? '#60a5fa' : '#34d399'
                      }}>
                        {msg.source === 'email' ? 'Outlook' : 'Platform'}
                      </Badge>
                    </div>
                    <p className="text-sm text-[hsl(210,15%,92%)] whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Reply box */}
            <div className="mt-3 shrink-0" data-testid="reply-box">
              <div className="flex gap-2">
                <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                  placeholder="Type your reply... (syncs to Outlook thread)"
                  className="flex-1 min-h-[80px] max-h-[200px] p-3 rounded-lg bg-[hsl(220,16%,11%)] border border-[hsl(220,14%,18%)] text-sm text-[hsl(210,15%,92%)] placeholder:text-[hsl(210,10%,40%)] focus:outline-none focus:border-[hsl(174,72%,45%)] resize-y"
                  data-testid="reply-textarea"
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply(); }}
                />
                <div className="flex flex-col gap-2">
                  <Button onClick={sendReply} disabled={sending || !replyText.trim()} data-testid="send-reply-btn"
                    className="bg-[hsl(174,72%,45%)] hover:bg-[hsl(174,72%,40%)] text-[hsl(220,18%,8%)] h-10">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => runAI('draft')} disabled={aiLoading.draft}
                    className="border-[hsl(220,14%,18%)] text-[hsl(210,10%,55%)] hover:text-[hsl(174,72%,45%)] bg-transparent h-8"
                    data-testid="ai-draft-inline-btn">
                    <Wand2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-[hsl(210,10%,40%)] mt-1">Ctrl+Enter to send. Replies sync to Outlook thread {ticket.outlook_thread_id}</p>
            </div>
          </div>

          {/* Right: Sidebar */}
          <div className="w-72 shrink-0 space-y-3 overflow-y-auto" data-testid="ticket-sidebar">
            {/* Ticket Properties */}
            <Card className="bg-[hsl(220,16%,11%)] border-[hsl(220,14%,18%)]">
              <CardHeader className="py-2.5 px-3">
                <CardTitle className="text-xs font-medium text-[hsl(210,10%,55%)] uppercase tracking-wider">Properties</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-3">
                <div>
                  <label className="text-[10px] text-[hsl(210,10%,40%)] mb-1 block">Status</label>
                  <Select value={ticket.status} onValueChange={v => updateTicket('status', v)}>
                    <SelectTrigger className="h-8 text-xs bg-[hsl(220,14%,16%)] border-[hsl(220,14%,18%)] text-[hsl(210,15%,92%)]" data-testid="status-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[hsl(220,16%,11%)] border-[hsl(220,14%,18%)]">
                      {['open', 'in_progress', 'resolved', 'closed'].map(s => (
                        <SelectItem key={s} value={s} className="text-[hsl(210,15%,92%)] text-xs">{s.replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-[hsl(210,10%,40%)] mb-1 block">Priority</label>
                  <Select value={ticket.priority} onValueChange={v => updateTicket('priority', v)}>
                    <SelectTrigger className="h-8 text-xs bg-[hsl(220,14%,16%)] border-[hsl(220,14%,18%)] text-[hsl(210,15%,92%)]" data-testid="priority-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[hsl(220,16%,11%)] border-[hsl(220,14%,18%)]">
                      {['urgent', 'high', 'medium', 'low'].map(p => (
                        <SelectItem key={p} value={p} className="text-[hsl(210,15%,92%)] text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: PRIORITY_COLORS[p] }} />
                            {p}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-[hsl(210,10%,40%)] mb-1 block">Assigned To</label>
                  <Select value={ticket.assigned_to || 'unassigned'} onValueChange={v => updateTicket('assigned_to', v === 'unassigned' ? '' : v)}>
                    <SelectTrigger className="h-8 text-xs bg-[hsl(220,14%,16%)] border-[hsl(220,14%,18%)] text-[hsl(210,15%,92%)]" data-testid="assignee-select">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent className="bg-[hsl(220,16%,11%)] border-[hsl(220,14%,18%)]">
                      <SelectItem value="unassigned" className="text-[hsl(210,15%,92%)] text-xs">Unassigned</SelectItem>
                      {team.map(m => (
                        <SelectItem key={m.id} value={m.id} className="text-[hsl(210,15%,92%)] text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: m.avatar_color }} />
                            {m.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-[hsl(210,10%,40%)] mb-1 block">Category</label>
                  <Select value={ticket.category} onValueChange={v => updateTicket('category', v)}>
                    <SelectTrigger className="h-8 text-xs bg-[hsl(220,14%,16%)] border-[hsl(220,14%,18%)] text-[hsl(210,15%,92%)]" data-testid="category-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[hsl(220,16%,11%)] border-[hsl(220,14%,18%)]">
                      {Object.keys(CATEGORY_COLORS).map(c => (
                        <SelectItem key={c} value={c} className="text-[hsl(210,15%,92%)] text-xs">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="pt-1 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[hsl(210,10%,40%)]">From</span>
                    <span className="text-[hsl(210,15%,92%)]">{ticket.sender_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[hsl(210,10%,40%)]">Email</span>
                    <span className="text-[hsl(210,15%,92%)] text-[11px]">{ticket.sender_email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[hsl(210,10%,40%)]">Created</span>
                    <span className="text-[hsl(210,15%,92%)]">{new Date(ticket.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Enrichment Tabs */}
            {enrichment && (
              <Card className="bg-[hsl(220,16%,11%)] border-[hsl(220,14%,18%)]" data-testid="enrichment-panel">
                <Tabs defaultValue="user">
                  <CardHeader className="py-2 px-3">
                    <TabsList className="w-full bg-[hsl(220,14%,16%)] h-7">
                      <TabsTrigger value="user" className="text-[10px] flex-1 h-5 data-[state=active]:bg-[hsl(220,16%,11%)]">
                        <Database className="w-3 h-3 mr-1" /> User
                      </TabsTrigger>
                      <TabsTrigger value="sentry" className="text-[10px] flex-1 h-5 data-[state=active]:bg-[hsl(220,16%,11%)]">
                        <Bug className="w-3 h-3 mr-1" /> Sentry
                      </TabsTrigger>
                      <TabsTrigger value="posthog" className="text-[10px] flex-1 h-5 data-[state=active]:bg-[hsl(220,16%,11%)]">
                        <Activity className="w-3 h-3 mr-1" /> PostHog
                      </TabsTrigger>
                    </TabsList>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <TabsContent value="user" className="mt-0 space-y-1.5">
                      {Object.entries(enrichment.user).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-[11px]">
                          <span className="text-[hsl(210,10%,40%)]">{k.replace(/_/g, ' ')}</span>
                          <span className="text-[hsl(210,15%,92%)] font-mono text-right max-w-[120px] truncate">{String(v)}</span>
                        </div>
                      ))}
                    </TabsContent>
                    <TabsContent value="sentry" className="mt-0 space-y-2">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[hsl(210,10%,40%)]">Error rate</span>
                        <span className="text-rose-400 font-mono">{enrichment.sentry.error_rate}%</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[hsl(210,10%,40%)]">Sessions w/ errors</span>
                        <span className="text-[hsl(210,15%,92%)] font-mono">{enrichment.sentry.sessions_with_errors}</span>
                      </div>
                      {enrichment.sentry.recent_errors.map((e, i) => (
                        <div key={i} className="p-2 rounded bg-[hsl(220,14%,16%)]">
                          <p className="text-[10px] text-rose-400 font-mono leading-tight">{e.title}</p>
                          <div className="flex justify-between mt-1">
                            <span className="text-[10px] text-[hsl(210,10%,40%)]">Count: {e.count}</span>
                            <Badge className="text-[9px] px-1 py-0 border-none" style={{
                              background: e.level === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                              color: e.level === 'error' ? '#ef4444' : '#f59e0b'
                            }}>{e.level}</Badge>
                          </div>
                        </div>
                      ))}
                      {enrichment.sentry.recent_errors.length === 0 && (
                        <div className="text-center py-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                          <p className="text-[10px] text-[hsl(210,10%,55%)]">No recent errors</p>
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="posthog" className="mt-0 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 rounded bg-[hsl(220,14%,16%)]">
                          <p className="text-[10px] text-[hsl(210,10%,40%)]">Sessions</p>
                          <p className="text-sm font-bold text-[hsl(210,15%,92%)]">{enrichment.posthog.total_sessions}</p>
                        </div>
                        <div className="p-2 rounded bg-[hsl(220,14%,16%)]">
                          <p className="text-[10px] text-[hsl(210,10%,40%)]">Avg Duration</p>
                          <p className="text-sm font-bold text-[hsl(210,15%,92%)]">{enrichment.posthog.avg_session_duration}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-[hsl(210,10%,40%)] mb-1">Key Events</p>
                        {enrichment.posthog.key_events.map((e, i) => (
                          <div key={i} className="flex justify-between text-[11px] py-0.5">
                            <span className="text-[hsl(210,15%,92%)] font-mono">{e.event}</span>
                            <span className="text-[hsl(174,72%,45%)]">{e.count}x</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="text-[10px] text-[hsl(210,10%,40%)] mb-1">Recordings</p>
                        {enrichment.posthog.recordings.map((r, i) => (
                          <div key={i} className="flex items-center gap-2 text-[11px] py-0.5">
                            <Video className="w-3 h-3 text-[hsl(174,72%,45%)]" />
                            <span className="text-[hsl(210,15%,92%)]">{r.duration}</span>
                            <span className="text-[hsl(210,10%,40%)]">{r.date}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="text-[10px] text-[hsl(210,10%,40%)] mb-1">Feature Flags</p>
                        <div className="flex flex-wrap gap-1">
                          {enrichment.posthog.feature_flags.map(f => (
                            <Badge key={f} className="text-[9px] px-1.5 py-0 bg-emerald-500/10 text-emerald-400 border-none">{f}</Badge>
                          ))}
                        </div>
                      </div>
                    </TabsContent>
                  </CardContent>
                </Tabs>
              </Card>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
