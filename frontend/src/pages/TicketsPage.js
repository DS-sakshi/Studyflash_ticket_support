import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Search, Filter, SortAsc, SortDesc, ChevronLeft, ChevronRight, MoreVertical, UserPlus, Tag } from 'lucide-react';

const PRIORITY_COLORS = { urgent: '#ef4444', high: '#f59e0b', medium: '#06b6d4', low: '#6b7280' };
const STATUS_STYLES = {
  open: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  resolved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  closed: 'bg-[hsl(210,10%,55%)]/10 text-[hsl(210,10%,55%)] border-[hsl(210,10%,55%)]/20',
};
const CATEGORY_COLORS = {
  'refund-request': '#ef4444', 'subscription-cancellation': '#f59e0b',
  'account-issues': '#8b5cf6', 'subscription-info': '#06b6d4',
  'technical-issue': '#ec4899', 'feature-request': '#10b981',
  'garbage': '#6b7280', 'uncategorized': '#374151'
};

export default function TicketsPage() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState([]);
  const [filters, setFilters] = useState({
    status: 'all', category: 'all', priority: 'all', assigned_to: 'all',
    search: '', sort_by: 'created_at', sort_order: 'desc', page: 1
  });

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
      const res = await api('get', `/tickets?${params.toString()}`);
      setTickets(res.data.tickets);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [api, filters]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  useEffect(() => {
    api('get', '/team').then(res => setTeam(res.data)).catch(() => {});
  }, [api]);

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  return (
    <TooltipProvider>
    <div className="space-y-4 animate-fade-in" data-testid="tickets-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(210,15%,92%)]">Tickets</h1>
          <p className="text-sm text-[hsl(210,10%,55%)]">{total} total tickets</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2" data-testid="ticket-filters">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-[hsl(210,10%,55%)]" />
          <Input data-testid="search-input" placeholder="Search tickets..." value={filters.search}
            onChange={e => updateFilter('search', e.target.value)}
            className="pl-9 bg-[hsl(220,16%,11%)] border-[hsl(220,14%,18%)] text-[hsl(210,15%,92%)] placeholder:text-[hsl(210,10%,40%)] h-9" />
        </div>
        <Select value={filters.status} onValueChange={v => updateFilter('status', v)}>
          <SelectTrigger className="w-[130px] h-9 bg-[hsl(220,16%,11%)] border-[hsl(220,14%,18%)] text-[hsl(210,15%,92%)]" data-testid="filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-[hsl(220,16%,11%)] border-[hsl(220,14%,18%)]">
            <SelectItem value="all" className="text-[hsl(210,15%,92%)]">All Status</SelectItem>
            <SelectItem value="open" className="text-[hsl(210,15%,92%)]">Open</SelectItem>
            <SelectItem value="in_progress" className="text-[hsl(210,15%,92%)]">In Progress</SelectItem>
            <SelectItem value="resolved" className="text-[hsl(210,15%,92%)]">Resolved</SelectItem>
            <SelectItem value="closed" className="text-[hsl(210,15%,92%)]">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.category} onValueChange={v => updateFilter('category', v)}>
          <SelectTrigger className="w-[160px] h-9 bg-[hsl(220,16%,11%)] border-[hsl(220,14%,18%)] text-[hsl(210,15%,92%)]" data-testid="filter-category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="bg-[hsl(220,16%,11%)] border-[hsl(220,14%,18%)]">
            <SelectItem value="all" className="text-[hsl(210,15%,92%)]">All Categories</SelectItem>
            {Object.keys(CATEGORY_COLORS).map(c => (
              <SelectItem key={c} value={c} className="text-[hsl(210,15%,92%)]">{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.priority} onValueChange={v => updateFilter('priority', v)}>
          <SelectTrigger className="w-[130px] h-9 bg-[hsl(220,16%,11%)] border-[hsl(220,14%,18%)] text-[hsl(210,15%,92%)]" data-testid="filter-priority">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent className="bg-[hsl(220,16%,11%)] border-[hsl(220,14%,18%)]">
            <SelectItem value="all" className="text-[hsl(210,15%,92%)]">All Priority</SelectItem>
            <SelectItem value="urgent" className="text-[hsl(210,15%,92%)]">Urgent</SelectItem>
            <SelectItem value="high" className="text-[hsl(210,15%,92%)]">High</SelectItem>
            <SelectItem value="medium" className="text-[hsl(210,15%,92%)]">Medium</SelectItem>
            <SelectItem value="low" className="text-[hsl(210,15%,92%)]">Low</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" data-testid="sort-toggle-btn"
          onClick={() => updateFilter('sort_order', filters.sort_order === 'desc' ? 'asc' : 'desc')}
          className="text-[hsl(210,10%,55%)] hover:text-[hsl(174,72%,45%)]">
          {filters.sort_order === 'desc' ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}
        </Button>
      </div>

      {/* Ticket List */}
      <div className="space-y-1" data-testid="ticket-list">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-[hsl(174,72%,45%)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[hsl(210,10%,55%)]">No tickets found</p>
          </div>
        ) : tickets.map((t, i) => (
          <div key={t.id} onClick={() => navigate(`/tickets/${t.id}`)}
            className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(220,16%,11%)] border border-[hsl(220,14%,18%)] hover:border-[hsl(220,14%,22%)] transition-all cursor-pointer group animate-fade-in"
            style={{ animationDelay: `${i * 30}ms` }}
            data-testid={`ticket-row-${t.ticket_number}`}>
            {/* Priority indicator */}
            <div className="w-1 h-10 rounded-full shrink-0" style={{ background: PRIORITY_COLORS[t.priority] || '#6b7280' }} />
            
            {/* Main content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-mono text-[hsl(210,10%,55%)]">{t.ticket_number}</span>
                <Badge className="text-[10px] px-1.5 py-0 border" style={{
                  background: `${CATEGORY_COLORS[t.category]}15`,
                  color: CATEGORY_COLORS[t.category],
                  borderColor: `${CATEGORY_COLORS[t.category]}30`
                }}>
                  {t.category}
                </Badge>
                <Badge className={`text-[10px] px-1.5 py-0 border ${STATUS_STYLES[t.status] || ''}`}>
                  {t.status.replace('_', ' ')}
                </Badge>
                {t.language && t.language !== 'en' && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[hsl(220,14%,16%)] text-[hsl(174,72%,45%)]">
                    {t.language.toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-sm text-[hsl(210,15%,92%)] truncate group-hover:text-[hsl(174,72%,45%)] transition-colors">
                {t.subject}
              </p>
            </div>

            {/* Sender */}
            <div className="text-right shrink-0 hidden md:block">
              <p className="text-xs text-[hsl(210,15%,92%)]">{t.sender_name}</p>
              <p className="text-[10px] text-[hsl(210,10%,40%)]">{new Date(t.created_at).toLocaleDateString()}</p>
            </div>

            {/* Assigned */}
            <div className="shrink-0">
              {t.assigned_to ? (() => {
                const member = team.find(m => m.id === t.assigned_to);
                return (
                  <Tooltip>
                    <TooltipTrigger>
                      <Avatar className="w-7 h-7">
                        <AvatarFallback className="text-[9px] font-semibold text-white" style={{ background: member?.avatar_color || '#06b6d4' }}>
                          {member?.name?.split(' ').map(n => n[0]).join('') || '?'}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent side="left"><p className="text-xs">Assigned to <strong>{member?.name || 'Unknown'}</strong></p></TooltipContent>
                  </Tooltip>
                );
              })() : (
                <Tooltip>
                  <TooltipTrigger>
                    <div className="w-7 h-7 rounded-full border border-dashed border-[hsl(220,14%,18%)] flex items-center justify-center">
                      <UserPlus className="w-3 h-3 text-[hsl(210,10%,40%)]" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left"><p className="text-xs">Unassigned</p></TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2" data-testid="pagination">
          <Button variant="ghost" size="sm" disabled={filters.page <= 1}
            onClick={() => setFilters(p => ({...p, page: p.page - 1}))}
            className="text-[hsl(210,10%,55%)]">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-[hsl(210,10%,55%)]">Page {filters.page} of {pages}</span>
          <Button variant="ghost" size="sm" disabled={filters.page >= pages}
            onClick={() => setFilters(p => ({...p, page: p.page + 1}))}
            className="text-[hsl(210,10%,55%)]">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}
