import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { 
  LayoutDashboard, 
  Mail, 
  FileText, 
  Calculator, 
  Users,
  Brain,
  LogOut,
  User,
  TrendingUp
} from 'lucide-react';

export const Navigation = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/emails', label: 'Email Management', icon: Mail },
    { path: '/leads', label: 'Lead Management', icon: TrendingUp },
    { path: '/email-analytics', label: 'Email Analytics', icon: Brain },
    { path: '/templates', label: 'Email Templates', icon: FileText },
    { path: '/quote-generator', label: 'Quote Generator', icon: Calculator },
    { path: '/quotes', label: 'Quote Management', icon: Calculator },
    { path: '/ai-crm', label: 'AI CRM', icon: Brain },
    { path: '/email-processing', label: 'Email Processing', icon: Brain },
    { path: '/crm', label: 'CRM Integration', icon: Users },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  if (!user) {
    return null;
  }

  return (
    <nav className="bg-card border-r border-border h-screen w-64 fixed left-0 top-0 p-4">
      <div className="flex flex-col h-full">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-foreground">CRM System</h1>
        </div>
        
        <div className="flex-1 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
        
        <div className="border-t border-border pt-4 space-y-2">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center space-x-3 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{user.email}</span>
            </div>
            <NotificationCenter />
          </div>
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full justify-start"
          >
            <LogOut className="h-4 w-4 mr-3" />
            Sign Out
          </Button>
        </div>
      </div>
    </nav>
  );
};