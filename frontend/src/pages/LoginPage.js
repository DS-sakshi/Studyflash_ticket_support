import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Zap, Mail, Lock, User } from 'lucide-react';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(loginForm.email, loginForm.password);
      toast.success('Welcome back!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed');
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(registerForm.name, registerForm.email, registerForm.password, 'agent');
      toast.success('Account created!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    }
    setLoading(false);
  };

  const handleSeedAndLogin = async () => {
    setLoading(true);
    try {
      const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
      await fetch(`${API}/seed`, { method: 'POST' });
      await login('admin@studyflash.com', 'admin123');
      toast.success('Demo data loaded! Logged in as Admin.');
    } catch (err) {
      toast.error('Failed to load demo data');
    }
    setLoading(false);
  };

  return (
    <div className="dark min-h-screen bg-[hsl(220,18%,8%)] flex items-center justify-center p-6" data-testid="login-page">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[hsl(174,72%,45%)] flex items-center justify-center">
              <Zap className="w-5 h-5 text-[hsl(220,18%,8%)]" />
            </div>
            <span className="text-2xl font-bold text-[hsl(210,15%,92%)] tracking-tight">Studyflash</span>
          </div>
          <p className="text-[hsl(210,10%,55%)] text-sm">Internal Support Platform</p>
        </div>

        <Card className="dark border-[hsl(220,14%,18%)] bg-[hsl(220,16%,11%)]">
          <Tabs defaultValue="login">
            <CardHeader className="pb-3">
              <TabsList className="w-full bg-[hsl(220,14%,16%)]">
                <TabsTrigger value="login" className="flex-1 data-[state=active]:bg-[hsl(220,16%,11%)] data-[state=active]:text-[hsl(210,15%,92%)] text-[hsl(210,10%,55%)]" data-testid="login-tab">Sign In</TabsTrigger>
                <TabsTrigger value="register" className="flex-1 data-[state=active]:bg-[hsl(220,16%,11%)] data-[state=active]:text-[hsl(210,15%,92%)] text-[hsl(210,10%,55%)]" data-testid="register-tab">Register</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent>
              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[hsl(210,10%,55%)] text-xs uppercase tracking-wider">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 w-4 h-4 text-[hsl(210,10%,55%)]" />
                      <Input data-testid="login-email" placeholder="admin@studyflash.com" value={loginForm.email}
                        onChange={e => setLoginForm(p => ({...p, email: e.target.value}))}
                        className="pl-10 bg-[hsl(220,14%,16%)] border-[hsl(220,14%,18%)] text-[hsl(210,15%,92%)] placeholder:text-[hsl(210,10%,40%)] focus:border-[hsl(174,72%,45%)]" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[hsl(210,10%,55%)] text-xs uppercase tracking-wider">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 w-4 h-4 text-[hsl(210,10%,55%)]" />
                      <Input data-testid="login-password" type="password" placeholder="admin123" value={loginForm.password}
                        onChange={e => setLoginForm(p => ({...p, password: e.target.value}))}
                        className="pl-10 bg-[hsl(220,14%,16%)] border-[hsl(220,14%,18%)] text-[hsl(210,15%,92%)] placeholder:text-[hsl(210,10%,40%)] focus:border-[hsl(174,72%,45%)]" />
                    </div>
                  </div>
                  <Button data-testid="login-submit-btn" type="submit" disabled={loading}
                    className="w-full bg-[hsl(174,72%,45%)] hover:bg-[hsl(174,72%,40%)] text-[hsl(220,18%,8%)] font-semibold">
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register" className="mt-0">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[hsl(210,10%,55%)] text-xs uppercase tracking-wider">Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 w-4 h-4 text-[hsl(210,10%,55%)]" />
                      <Input data-testid="register-name" placeholder="Your Name" value={registerForm.name}
                        onChange={e => setRegisterForm(p => ({...p, name: e.target.value}))}
                        className="pl-10 bg-[hsl(220,14%,16%)] border-[hsl(220,14%,18%)] text-[hsl(210,15%,92%)] placeholder:text-[hsl(210,10%,40%)]" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[hsl(210,10%,55%)] text-xs uppercase tracking-wider">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 w-4 h-4 text-[hsl(210,10%,55%)]" />
                      <Input data-testid="register-email" placeholder="you@studyflash.com" value={registerForm.email}
                        onChange={e => setRegisterForm(p => ({...p, email: e.target.value}))}
                        className="pl-10 bg-[hsl(220,14%,16%)] border-[hsl(220,14%,18%)] text-[hsl(210,15%,92%)] placeholder:text-[hsl(210,10%,40%)]" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[hsl(210,10%,55%)] text-xs uppercase tracking-wider">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 w-4 h-4 text-[hsl(210,10%,55%)]" />
                      <Input data-testid="register-password" type="password" placeholder="Choose a password" value={registerForm.password}
                        onChange={e => setRegisterForm(p => ({...p, password: e.target.value}))}
                        className="pl-10 bg-[hsl(220,14%,16%)] border-[hsl(220,14%,18%)] text-[hsl(210,15%,92%)] placeholder:text-[hsl(210,10%,40%)]" />
                    </div>
                  </div>
                  <Button data-testid="register-submit-btn" type="submit" disabled={loading}
                    className="w-full bg-[hsl(174,72%,45%)] hover:bg-[hsl(174,72%,40%)] text-[hsl(220,18%,8%)] font-semibold">
                    {loading ? 'Creating...' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>

              <div className="mt-4 pt-4 border-t border-[hsl(220,14%,18%)]">
                <Button data-testid="demo-login-btn" variant="outline" onClick={handleSeedAndLogin} disabled={loading}
                  className="w-full border-[hsl(220,14%,18%)] text-[hsl(210,10%,55%)] hover:text-[hsl(174,72%,45%)] hover:border-[hsl(174,72%,45%)] bg-transparent">
                  <Zap className="w-4 h-4 mr-2" /> Load Demo Data & Login
                </Button>
                <p className="text-xs text-[hsl(210,10%,40%)] text-center mt-2">Seeds 12 sample tickets with multilingual data</p>
              </div>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
