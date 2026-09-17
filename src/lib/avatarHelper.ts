import React from 'react'
import {
  User,
  Vault,
  Wallet,
  PiggyBank,
  Rocket,
  Crown,
  Gem,
  Shield,
  Sparkles,
  Flame,
} from 'lucide-react'

export interface AvatarOption {
  id: string
  label: string
  icon: React.ElementType
  color: string
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: 'user', label: 'User', icon: User, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' },
  { id: 'vault', label: 'Vault', icon: Vault, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  { id: 'wallet', label: 'Wallet', icon: Wallet, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  { id: 'piggy', label: 'Piggy', icon: PiggyBank, color: 'text-pink-400 bg-pink-500/10 border-pink-500/30' },
  { id: 'rocket', label: 'Rocket', icon: Rocket, color: 'text-violet-400 bg-violet-500/10 border-violet-500/30' },
  { id: 'crown', label: 'Crown', icon: Crown, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { id: 'gem', label: 'Gem', icon: Gem, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  { id: 'shield', label: 'Shield', icon: Shield, color: 'text-teal-400 bg-teal-500/10 border-teal-500/30' },
  { id: 'sparkles', label: 'Sparkles', icon: Sparkles, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  { id: 'flame', label: 'Flame', icon: Flame, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
]

export function getAvatarIcon(avatarId?: string | null): React.ElementType {
  const found = AVATAR_OPTIONS.find((a) => a.id === avatarId)
  return found ? found.icon : User
}

export function getAvatarColor(avatarId?: string | null): string {
  const found = AVATAR_OPTIONS.find((a) => a.id === avatarId)
  return found ? found.color : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30'
}

export const AvatarRenderer: React.FC<{
  avatarId?: string | null
  className?: string
}> = ({ avatarId, className = 'w-4 h-4' }) => {
  const IconComponent = getAvatarIcon(avatarId)
  return React.createElement(IconComponent, { className })
}
