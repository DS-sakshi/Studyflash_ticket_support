import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { LayoutDashboard, Inbox, Users, LogOut, Zap, ChevronDown, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/tickets', icon: Inbox, label: 'Tickets' },
  { path: '/team', icon: Users, label: 'Team' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <TooltipProvider>
      <div className="w-56 h-screen flex flex-col bg-[hsl(220,18%,7%)] border-r border-[hsl(220,14%,14%)] shrink-0" data-testid="sidebar">
        {/* Logo */}
        <div className="px-4 py-4 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[hsl(174,72%,45%)] flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-[hsl(220,18%,8%)]" />
          </div>
          <div>
            <span className="text-sm font-bold text-[hsl(210,15%,92%)] tracking-tight">Studyflash</span>
            <p className="text-[10px] text-[hsl(210,10%,40%)] leading-none">Support Hub</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-2 space-y-0.5" data-testid="sidebar-nav">
          {NAV_ITEMS.map(item => {
            const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
            return (
              <NavLink key={item.path} to={item.path} data-testid={`nav-${item.label.toLowerCase()}`}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive
                    ? 'bg-[hsl(174,72%,45%)]/10 text-[hsl(174,72%,45%)]'
                    : 'text-[hsl(210,10%,55%)] hover:text-[hsl(210,15%,92%)] hover:bg-[hsl(220,14%,12%)]'
                }`}>
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-2 py-3 border-t border-[hsl(220,14%,14%)]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[hsl(220,14%,12%)] transition-colors text-left"
                data-testid="user-menu-trigger">
                <Avatar className="w-7 h-7 shrink-0">
                  <AvatarFallback style={{ background: user?.avatar_color || '#06b6d4' }} className="text-[10px] font-semibold text-white">
                    {user?.name?.split(' ').map(n => n[0]).join('') || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[hsl(210,15%,92%)] truncate">{user?.name}</p>
                  <p className="text-[10px] text-[hsl(210,10%,40%)] truncate">{user?.role}</p>
                </div>
                <ChevronDown className="w-3 h-3 text-[hsl(210,10%,40%)] shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 bg-[hsl(220,16%,11%)] border-[hsl(220,14%,18%)]" align="start" side="top">
              <DropdownMenuItem className="text-[hsl(210,15%,92%)] text-xs focus:bg-[hsl(220,14%,16%)]">
                <Settings className="w-3.5 h-3.5 mr-2" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[hsl(220,14%,18%)]" />
              <DropdownMenuItem onClick={logout} className="text-rose-400 text-xs focus:bg-[hsl(220,14%,16%)] focus:text-rose-400" data-testid="logout-btn">
                <LogOut className="w-3.5 h-3.5 mr-2" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </TooltipProvider>
  );
}
