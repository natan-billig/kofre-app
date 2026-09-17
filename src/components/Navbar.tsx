import React from 'react'
import { supabase } from '../lib/supabase'
import { ShieldCheck, LogOut, PlusCircle, UserCircle2, Users2 } from 'lucide-react'

interface NavbarProps {
  userEmail?: string | null
  userName?: string | null
  onOpenCreateAccount: () => void
  onOpenFamilySettings: () => void
  onSignOut: () => void
}

export const Navbar: React.FC<NavbarProps> = ({
  userEmail,
  userName,
  onOpenCreateAccount,
  onOpenFamilySettings,
  onSignOut,
}) => {
  const handleLogout = async () => {
    await supabase.auth.signOut()
    onSignOut()
  }

  const displayName = userName || userEmail?.split('@')[0] || 'Usuário'

  return (
    <header className="w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-bold text-white tracking-tight">Kofre</span>
            <span className="hidden sm:inline-block ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              Fronteira Multi-Moeda
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Family Sharing Modal Button */}
          <button
            onClick={onOpenFamilySettings}
            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs sm:text-sm font-medium text-emerald-300 hover:text-emerald-200 transition-all"
            title="Gestão da Família e Código de Compartilhamento"
          >
            <Users2 className="w-4 h-4 text-emerald-400" />
            <span className="hidden xs:inline sm:inline">Família</span>
          </button>

          <button
            onClick={onOpenCreateAccount}
            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-xs sm:text-sm font-medium text-slate-200 hover:text-white transition-all"
            title="Criar nova conta ou cartão"
          >
            <PlusCircle className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Nova Conta</span>
          </button>

          {/* User Profile */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-950/40 border border-slate-800/80 text-slate-300 text-xs">
            <UserCircle2 className="w-4 h-4 text-slate-400" />
            <span className="font-medium max-w-[130px] truncate" title={displayName}>
              {displayName}
            </span>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="cursor-pointer p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
            title="Sair da conta"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
