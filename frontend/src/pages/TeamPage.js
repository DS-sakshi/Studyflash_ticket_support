import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { UserPlus, Trash2, Shield, Users } from 'lucide-react';

export default function TeamPage() {
  const { api, user } = useAuth();
  const [members, setMembers] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'agent' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api('get', '/team').then(r => setMembers(r.data)).catch(() => {});
  }, [api]);

  const addMember = async () => {
    setLoading(true);
    try {
      await api('post', '/auth/register', form);
      const res = await api('get', '/team');
      setMembers(res.data);
      setShowAdd(false);
      setForm({ name: '', email: '', password: '', role: 'agent' });
      toast.success('Team member added');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add member');
    }
    setLoading(false);
  };

  const removeMember = async (id) => {
    try {
      await api('delete', `/team/${id}`);
      setMembers(prev => prev.filter(m => m.id !== id));
      toast.success('Member removed');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to remove member');
    }
  };

  const roleColors = { admin: '#ef4444', lead: '#8b5cf6', agent: '#06b6d4' };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="team-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(210,15%,92%)]">Team</h1>
          <p className="text-sm text-[hsl(210,10%,55%)]">{members.length} members</p>
        </div>
        <Button onClick={() => setShowAdd(true)} data-testid="add-member-btn"
          className="bg-[hsl(174,72%,45%)] hover:bg-[hsl(174,72%,40%)] text-[hsl(220,18%,8%)]">
          <UserPlus className="w-4 h-4 mr-2" /> Add Member
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 stagger-children">
        {members.map(m => (
          <Card key={m.id} className="bg-[hsl(220,16%,11%)] border-[hsl(220,14%,18%)] hover:border-[hsl(220,14%,22%)] transition-colors animate-fade-in"
            data-testid={`team-member-${m.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarFallback style={{ background: m.avatar_color }} className="text-sm font-semibold text-white">
                    {m.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[hsl(210,15%,92%)]">{m.name}</p>
                  <p className="text-xs text-[hsl(210,10%,55%)] truncate">{m.email}</p>
                  <Badge className="mt-1 text-[10px] px-1.5 py-0 border-none" style={{
                    background: `${roleColors[m.role] || '#6b7280'}15`,
                    color: roleColors[m.role] || '#6b7280'
                  }}>
                    <Shield className="w-2.5 h-2.5 mr-0.5" /> {m.role}
                  </Badge>
                </div>
                {user?.role === 'admin' && m.email !== user.email && (
                  <Button variant="ghost" size="sm" onClick={() => removeMember(m.id)}
                    className="text-[hsl(210,10%,55%)] hover:text-rose-400 h-8 w-8 p-0" data-testid={`remove-member-${m.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-[hsl(220,16%,11%)] border-[hsl(220,14%,18%)]" data-testid="add-member-dialog">
          <DialogHeader>
            <DialogTitle className="text-[hsl(210,15%,92%)]">Add Team Member</DialogTitle>
            <DialogDescription className="text-[hsl(210,10%,55%)]">Add a new member to the support team</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[hsl(210,10%,55%)] text-xs">Name</Label>
              <Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
                className="bg-[hsl(220,14%,16%)] border-[hsl(220,14%,18%)] text-[hsl(210,15%,92%)]" data-testid="new-member-name" />
            </div>
            <div>
              <Label className="text-[hsl(210,10%,55%)] text-xs">Email</Label>
              <Input value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))}
                className="bg-[hsl(220,14%,16%)] border-[hsl(220,14%,18%)] text-[hsl(210,15%,92%)]" data-testid="new-member-email" />
            </div>
            <div>
              <Label className="text-[hsl(210,10%,55%)] text-xs">Password</Label>
              <Input type="password" value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))}
                className="bg-[hsl(220,14%,16%)] border-[hsl(220,14%,18%)] text-[hsl(210,15%,92%)]" data-testid="new-member-password" />
            </div>
            <div>
              <Label className="text-[hsl(210,10%,55%)] text-xs">Role</Label>
              <Select value={form.role} onValueChange={v => setForm(p => ({...p, role: v}))}>
                <SelectTrigger className="bg-[hsl(220,14%,16%)] border-[hsl(220,14%,18%)] text-[hsl(210,15%,92%)]" data-testid="new-member-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[hsl(220,16%,11%)] border-[hsl(220,14%,18%)]">
                  <SelectItem value="agent" className="text-[hsl(210,15%,92%)]">Agent</SelectItem>
                  <SelectItem value="lead" className="text-[hsl(210,15%,92%)]">Lead</SelectItem>
                  <SelectItem value="admin" className="text-[hsl(210,15%,92%)]">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}
              className="border-[hsl(220,14%,18%)] text-[hsl(210,10%,55%)] bg-transparent">Cancel</Button>
            <Button onClick={addMember} disabled={loading || !form.name || !form.email || !form.password}
              className="bg-[hsl(174,72%,45%)] hover:bg-[hsl(174,72%,40%)] text-[hsl(220,18%,8%)]" data-testid="confirm-add-member-btn">
              {loading ? 'Adding...' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
