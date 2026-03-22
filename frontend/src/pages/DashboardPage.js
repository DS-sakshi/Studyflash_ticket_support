import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Inbox, Clock, CheckCircle2, AlertTriangle, Users, TrendingUp } from 'lucide-react';

const PRIORITY_COLORS = { urgent: '#ef4444', high: '#f59e0b', medium: '#06b6d4', low: '#6b7280' };
const CATEGORY_COLORS = {
  'refund-request': '#ef4444', 'subscription-cancellation': '#f59e0b',
  'account-issues': '#8b5cf6', 'subscription-info': '#06b6d4',
  'technical-issue': '#ec4899', 'feature-request': '#10b981',
  'garbage': '#6b7280', 'uncategorized': '#374151'
};

export default function DashboardPage() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentTickets, setRecentTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, ticketsRes] = await Promise.all([
          api('get', '/tickets/stats'),
          api('get', '/tickets?limit=5&sort_by=created_at&sort_order=desc')
        ]);
        setStats(statsRes.data);
        setRecentTickets(ticketsRes.data.tickets);
      } catch (err) {
        console.error('Failed to load dashboard', err);
      }
      setLoading(false);
    };
    load();
  }, [api]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[hsl(174,72%,45%)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const catData = Object.entries(stats.categories).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k, value: v, fill: CATEGORY_COLORS[k] || '#6b7280' }));
  const priData = Object.entries(stats.priorities).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k, value: v, fill: PRIORITY_COLORS[k] }));

  const statCards = [
    { label: 'Total Tickets', value: stats.total, icon: Inbox, color: 'text-[hsl(174,72%,45%)]' },
    { label: 'Open', value: stats.open, icon: AlertTriangle, color: 'text-amber-400' },
    { label: 'In Progress', value: stats.in_progress, icon: Clock, color: 'text-blue-400' },
    { label: 'Resolved', value: stats.resolved, icon: CheckCircle2, color: 'text-emerald-400' },
    { label: 'Unassigned', value: stats.unassigned, icon: Users, color: 'text-rose-400' },
  ];

  return (
    <TooltipProvider>
      <div className="space-y-6 animate-fade-in" data-testid="dashboard-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[hsl(210,15%,92%)]">Dashboard</h1>
            <p className="text-sm text-[hsl(210,10%,55%)]">Overview of support operations</p>
          </div>
          <Badge variant="outline" className="border-[hsl(174,72%,45%)]/30 text-[hsl(174,72%,45%)] bg-[hsl(174,72%,45%)]/5">
            <TrendingUp className="w-3 h-3 mr-1" /> Live
          </Badge>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 stagger-children">
          {statCards.map((s, i) => (
            <Card key={i} className="bg-[hsl(220,16%,11%)] border-[hsl(220,14%,18%)] hover:border-[hsl(220,14%,22%)] transition-colors animate-fade-in cursor-pointer"
              onClick={() => navigate('/tickets')} data-testid={`stat-card-${s.label.toLowerCase().replace(/\s/g, '-')}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                  <span className="text-2xl font-bold text-[hsl(210,15%,92%)]">{s.value}</span>
                </div>
                <p className="text-xs text-[hsl(210,10%,55%)]">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Category Chart */}
          <Card className="bg-[hsl(220,16%,11%)] border-[hsl(220,14%,18%)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(210,10%,55%)]">By Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={catData} layout="vertical" margin={{ left: 0, right: 12 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fill: 'hsl(210,10%,55%)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
                      {catData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Priority Pie */}
          <Card className="bg-[hsl(220,16%,11%)] border-[hsl(220,14%,18%)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(210,10%,55%)]">By Priority</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={priData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                      {priData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {priData.map(p => (
                  <div key={p.name} className="flex items-center gap-1.5 text-xs text-[hsl(210,10%,55%)]">
                    <div className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
                    {p.name} ({p.value})
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Team Workload */}
          <Card className="bg-[hsl(220,16%,11%)] border-[hsl(220,14%,18%)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(210,10%,55%)]">Team Workload</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.workload.map(w => (
                <div key={w.id} className="flex items-center gap-3">
                  <Tooltip>
                    <TooltipTrigger>
                      <Avatar className="w-7 h-7">
                        <AvatarFallback style={{ background: w.avatar_color }} className="text-[10px] font-semibold text-white">
                          {w.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent><p>{w.name}</p></TooltipContent>
                  </Tooltip>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[hsl(210,15%,92%)]">{w.name}</span>
                      <span className="text-xs text-[hsl(210,10%,55%)]">{w.count} active</span>
                    </div>
                    <div className="h-1.5 bg-[hsl(220,14%,16%)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(w.count * 20, 100)}%`, background: w.avatar_color }} />
                    </div>
                  </div>
                </div>
              ))}
              {stats.workload.length === 0 && (
                <p className="text-xs text-[hsl(210,10%,55%)] text-center py-4">No team members yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Tickets */}
        <Card className="bg-[hsl(220,16%,11%)] border-[hsl(220,14%,18%)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[hsl(210,10%,55%)]">Recent Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentTickets.map(t => (
                <div key={t.id} onClick={() => navigate(`/tickets/${t.id}`)}
                  className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(220,14%,16%)]/50 hover:bg-[hsl(220,14%,16%)] transition-colors cursor-pointer group"
                  data-testid={`recent-ticket-${t.ticket_number}`}>
                  <div className="w-1.5 h-8 rounded-full" style={{ background: PRIORITY_COLORS[t.priority] || '#6b7280' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-[hsl(210,10%,55%)]">{t.ticket_number}</span>
                      <Badge className="text-[10px] px-1.5 py-0" style={{ background: `${CATEGORY_COLORS[t.category]}20`, color: CATEGORY_COLORS[t.category], border: 'none' }}>
                        {t.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-[hsl(210,15%,92%)] truncate group-hover:text-[hsl(174,72%,45%)] transition-colors">{t.subject}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-[hsl(210,10%,55%)]">{t.sender_name}</p>
                    <p className="text-[10px] text-[hsl(210,10%,40%)]">{new Date(t.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Language Stats */}
        {Object.keys(stats.languages).length > 0 && (
          <Card className="bg-[hsl(220,16%,11%)] border-[hsl(220,14%,18%)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(210,10%,55%)]">Languages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                {Object.entries(stats.languages).map(([lang, count]) => {
                  const names = { de: 'German', nl: 'Dutch', en: 'English', fr: 'French' };
                  const flags = { de: 'DE', nl: 'NL', en: 'EN', fr: 'FR' };
                  return (
                    <div key={lang} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(220,14%,16%)]">
                      <span className="text-xs font-mono font-bold text-[hsl(174,72%,45%)]">{flags[lang] || lang.toUpperCase()}</span>
                      <span className="text-xs text-[hsl(210,10%,55%)]">{names[lang] || lang}</span>
                      <span className="text-xs font-bold text-[hsl(210,15%,92%)]">{count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
