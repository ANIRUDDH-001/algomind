'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Users, 
  Cpu, 
  Cloud, 
  ShieldAlert, 
  Settings, 
  BookOpen, 
  // @ts-expect-error -- automated unused local suppression
  BarChart2, 
  UserPlus, 
  // @ts-expect-error -- automated unused local suppression
  Activity, 
  Bot,
  Menu,
  X
} from 'lucide-react'

const sidebarLinks = [
  { group: 'Dashboard' },
  { href: '/owner/overview', label: 'Overview', icon: LayoutDashboard },
  
  { group: 'AI & Models' },
  { href: '/owner/models', label: 'Model Registry', icon: Cpu },
  { href: '/owner/knowledge', label: 'Knowledge Base', icon: BookOpen },
  { href: '/owner/algomind-2o', label: 'Algomind 2.0', icon: Bot },
  
  { group: 'System & Infra' },
  { href: '/owner/aws', label: 'AWS Config', icon: Cloud },
  { href: '/owner/cache', label: 'Cache & Redis', icon: Cloud },
  { href: '/owner/rate-limits', label: 'Rate Limits', icon: ShieldAlert },
  { href: '/owner/flags', label: 'Feature Flags', icon: ShieldAlert },
  
  { group: 'Access Control' },
  { href: '/owner/users', label: 'Users', icon: Users },
  { href: '/owner/co-owners', label: 'Co-Owners', icon: UserPlus },
  { href: '/owner/admins', label: 'Admins', icon: ShieldAlert },
  { href: '/owner/employers', label: 'Employers', icon: Users },
]

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="flex w-full min-h-screen bg-neutral-950 text-white font-sans relative">
      {/* Mobile Menu Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 shrink-0 border-r border-neutral-800 transform transition-transform duration-300 ease-in-out flex flex-col h-screen ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        style={{ backgroundColor: '#171717' }}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-neutral-800 shrink-0">
          <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            Owner Portal
          </span>
          <button 
            className="md:hidden text-neutral-400 hover:text-white"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-thin scrollbar-thumb-neutral-700">
          {sidebarLinks.map((link, idx) => {
            if (link.group) {
              return (
                <div key={`group-${idx}`} className="px-3 pt-4 pb-1">
                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">{link.group}</span>
                </div>
              )
            }
            
            const Icon = link.icon!
            const isActive = pathname.startsWith(link.href!)
            
            return (
              <Link
                key={link.href}
                href={link.href!}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                  isActive 
                    ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' 
                    : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-blue-400' : 'text-neutral-500 group-hover:text-neutral-300'} />
                <span className="font-medium text-sm">{link.label}</span>
              </Link>
            )
          })}
        </nav>
        
        <div className="shrink-0 p-3 border-t border-neutral-800">
          <Link
            href="/owner/settings"
            onClick={() => setIsSidebarOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group mb-2 ${
              pathname.startsWith('/owner/settings')
                ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' 
                : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100'
            }`}
          >
            <Settings size={18} className={pathname.startsWith('/owner/settings') ? 'text-blue-400' : 'text-neutral-500 group-hover:text-neutral-300'} />
            <span className="font-medium text-sm">Settings</span>
          </Link>
          <div className="flex items-center gap-3 px-3 py-2 bg-neutral-950 rounded-lg border border-neutral-800">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold shadow-inner">
              OW
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">Admin User</p>
              <p className="text-xs text-neutral-500 truncate">System Owner</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 bg-neutral-950 flex flex-col min-h-screen" style={{ marginLeft: 0 }} id="main-content">
        <style dangerouslySetInnerHTML={{__html: `
          @media (min-width: 768px) {
            #main-content { margin-left: 16rem !important; }
          }
        `}} />
        <header className="h-16 flex items-center px-4 border-b border-neutral-800 md:hidden bg-neutral-900/50 backdrop-blur-md sticky top-0 z-30">
          <button 
            className="p-2 -ml-2 mr-2 text-neutral-400 hover:text-white rounded-md hover:bg-neutral-800 transition-colors"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
          <span className="font-semibold text-neutral-100">Owner Dashboard</span>
        </header>

        <div className="p-4 md:p-8 flex-1">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
