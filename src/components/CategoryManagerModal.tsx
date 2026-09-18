import React, { useState, useEffect, useMemo } from 'react'
import type { Category, CategoryType, WalletScope } from '../lib/types'
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  renameMacroCategory,
  deleteMacroCategory,
  createMacroCategory,
  DEFAULT_MACRO_PRESETS,
  DEFAULT_MACRO_MAP,
  getGroupIcon,
  setSavedGroupIcon,
} from '../lib/categoryService'
import { useTranslation } from '../lib/i18n/LanguageContext'
import {
  X,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Check,
  Tags,
  Tag,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  Folder,
  FolderPlus,
  Target,
  ChevronRight,
  Sparkles,
} from 'lucide-react'

const SUGGESTED_EMOJIS = ['🏠', '🍔', '🚗', '🎮', '💊', '🛍️', '🎓', '💼', '📈', '📁', '⚡', '✈️', '🛠️', '🛒', '🎁', '🐶', '💡', '💻']

interface CategoryManagerModalProps {
  isOpen: boolean
  onClose: () => void
  scope: WalletScope
  familyId?: string | null
  onCategoriesChanged?: () => void
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  scope,
  familyId,
  onCategoriesChanged,
}) => {
  const { t } = useTranslation()

  // Tab: Categories vs Groups
  const [modalTab, setModalTab] = useState<'categories' | 'groups'>('categories')

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'expense' | 'income'>('all')

  // New Category form state
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<CategoryType>('expense')
  const [newMacro, setNewMacro] = useState('')
  const [isCustomMacro, setIsCustomMacro] = useState(false)
  const [newBudgetLimit, setNewBudgetLimit] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // In-place category edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingMacro, setEditingMacro] = useState('')
  const [isCustomEditMacro, setIsCustomEditMacro] = useState(false)
  const [editingBudgetLimit, setEditingBudgetLimit] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Category deletion confirm state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Group creation state
  const [isAddingGroup, setIsAddingGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupIcon, setNewGroupIcon] = useState('📁')
  const [newGroupBudget, setNewGroupBudget] = useState('')
  const [newGroupInitialCat, setNewGroupInitialCat] = useState('')
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false)
  const [groupAddError, setGroupAddError] = useState<string | null>(null)

  // Group editing state (rename cascade)
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null)
  const [editedGroupNameVal, setEditedGroupNameVal] = useState('')
  const [editedGroupIconVal, setEditedGroupIconVal] = useState('📁')
  const [isSavingGroupEdit, setIsSavingGroupEdit] = useState(false)
  const [groupEditError, setGroupEditError] = useState<string | null>(null)

  // Group deletion state (cascade reassignment)
  const [deletingGroupName, setDeletingGroupName] = useState<string | null>(null)
  const [reassignTargetGroup, setReassignTargetGroup] = useState('Outros')
  const [isDeletingGroup, setIsDeletingGroup] = useState(false)
  const [groupDeleteError, setGroupDeleteError] = useState<string | null>(null)

  // Expanded group categories in groups tab
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  // Feedback notification
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let isMounted = true
    if (isOpen) {
      queueMicrotask(() => {
        if (isMounted) {
          setLoading(true)
          setAddError(null)
          setEditError(null)
          setDeleteError(null)
          setEditingId(null)
          setConfirmDeleteId(null)
          setEditingGroupName(null)
          setDeletingGroupName(null)
          setIsAddingGroup(false)
        }
      })
      fetchCategories(scope, familyId)
        .then((data) => {
          if (isMounted) setCategories(data)
        })
        .catch((err) => {
          console.error('Erro ao carregar categorias no modal:', err)
        })
        .finally(() => {
          if (isMounted) setLoading(false)
        })
    }
    return () => {
      isMounted = false
    }
  }, [isOpen, scope, familyId, version])

  // Compute all unique group names across categories and presets
  const allGroups = useMemo(() => {
    const set = new Set<string>()
    categories.forEach((c) => {
      const macro = c.macro_category?.trim() || DEFAULT_MACRO_MAP[c.name] || 'Outros'
      if (macro) set.add(macro)
    })
    DEFAULT_MACRO_PRESETS.forEach((p) => set.add(p))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [categories])

  // Compute groups breakdown with counts, linked categories, and consolidated budgets
  const groupStats = useMemo(() => {
    const groupsMap = new Map<string, { name: string; categories: Category[]; totalBudget: number }>()

    categories.forEach((cat) => {
      const groupName = cat.macro_category?.trim() || DEFAULT_MACRO_MAP[cat.name] || 'Outros'
      if (!groupsMap.has(groupName)) {
        groupsMap.set(groupName, { name: groupName, categories: [], totalBudget: 0 })
      }
      const entry = groupsMap.get(groupName)!
      entry.categories.push(cat)
      if (cat.budget_limit && cat.budget_limit > 0) {
        entry.totalBudget += cat.budget_limit
      }
    })

    // Also include default presets if not yet represented
    DEFAULT_MACRO_PRESETS.forEach((preset) => {
      if (!groupsMap.has(preset)) {
        groupsMap.set(preset, { name: preset, categories: [], totalBudget: 0 })
      }
    })

    return Array.from(groupsMap.values()).sort((a, b) => {
      if (b.categories.length !== a.categories.length) {
        return b.categories.length - a.categories.length
      }
      return a.name.localeCompare(b.name)
    })
  }, [categories])

  if (!isOpen) return null

  // --- Handlers for Category Management ---
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed) {
      setAddError(t('categoryManager.fillName'))
      return
    }

    setIsAdding(true)
    setAddError(null)
    try {
      const budgetNum = newBudgetLimit.trim() ? parseFloat(newBudgetLimit.replace(/\./g, '').replace(',', '.')) : null
      await createCategory(trimmed, newType, scope, familyId, newMacro.trim() || null, budgetNum)
      setNewName('')
      setNewMacro('')
      setIsCustomMacro(false)
      setNewBudgetLimit('')
      setVersion((v) => v + 1)
      onCategoriesChanged?.()
    } catch (err: unknown) {
      console.error('Erro ao adicionar categoria:', err)
      setAddError(err instanceof Error ? err.message : 'Erro ao criar categoria.')
    } finally {
      setIsAdding(false)
    }
  }

  const handleStartEdit = (cat: Category) => {
    setEditingId(cat.id)
    setEditingName(cat.name)
    const currentMacro = cat.macro_category || ''
    setEditingMacro(currentMacro)
    setIsCustomEditMacro(false)
    setEditingBudgetLimit(cat.budget_limit ? String(cat.budget_limit) : '')
    setEditError(null)
    setConfirmDeleteId(null)
  }

  const handleSaveEdit = async (cat: Category) => {
    const trimmed = editingName.trim()
    if (!trimmed) {
      setEditError(t('categoryManager.fillName'))
      return
    }

    const trimmedMacro = editingMacro.trim()
    const budgetNum = editingBudgetLimit.trim() ? parseFloat(editingBudgetLimit.replace(/\./g, '').replace(',', '.')) : null
    const oldBudget = cat.budget_limit || null

    if (trimmed === cat.name && trimmedMacro === (cat.macro_category || '') && budgetNum === oldBudget) {
      setEditingId(null)
      return
    }

    setIsSavingEdit(true)
    setEditError(null)
    try {
      await updateCategory(cat.id, cat.name, trimmed, scope, familyId, trimmedMacro || null, budgetNum)
      setEditingId(null)
      setVersion((v) => v + 1)
      onCategoriesChanged?.()
    } catch (err: unknown) {
      console.error('Erro ao editar categoria:', err)
      setEditError(err instanceof Error ? err.message : 'Erro ao renomear categoria.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDelete = async (catId: string) => {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await deleteCategory(catId)
      setConfirmDeleteId(null)
      setVersion((v) => v + 1)
      onCategoriesChanged?.()
    } catch (err: unknown) {
      console.error('Erro ao excluir categoria:', err)
      setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir categoria.')
    } finally {
      setIsDeleting(false)
    }
  }

  // --- Handlers for Group Management ---
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newGroupName.trim()
    if (!trimmed) {
      setGroupAddError(t('categoryManager.fillName'))
      return
    }

    setIsSubmittingGroup(true)
    setGroupAddError(null)
    try {
      const budgetNum = newGroupBudget.trim()
        ? parseFloat(newGroupBudget.replace(/\./g, '').replace(',', '.'))
        : null
      await createMacroCategory(
        trimmed,
        scope,
        familyId,
        budgetNum,
        newGroupInitialCat.trim() || undefined,
        newGroupIcon
      )
      setNewGroupName('')
      setNewGroupBudget('')
      setNewGroupInitialCat('')
      setIsAddingGroup(false)
      setVersion((v) => v + 1)
      onCategoriesChanged?.()
      setFeedbackMessage(t('categoryManager.cascadeSuccess'))
      setTimeout(() => setFeedbackMessage(null), 3000)
    } catch (err: unknown) {
      console.error('Erro ao criar grupo:', err)
      setGroupAddError(err instanceof Error ? err.message : 'Erro ao criar grupo.')
    } finally {
      setIsSubmittingGroup(false)
    }
  }

  const handleStartGroupEdit = (groupName: string) => {
    setEditingGroupName(groupName)
    setEditedGroupNameVal(groupName)
    setEditedGroupIconVal(getGroupIcon(groupName))
    setGroupEditError(null)
    setDeletingGroupName(null)
  }

  const handleSaveGroupEdit = async (oldName: string) => {
    const trimmed = editedGroupNameVal.trim()
    if (!trimmed) {
      setGroupEditError(t('categoryManager.fillName'))
      return
    }

    setIsSavingGroupEdit(true)
    setGroupEditError(null)
    try {
      if (trimmed !== oldName) {
        await renameMacroCategory(oldName, trimmed, scope, familyId)
        // Update local state immediately for instant feedback
        setCategories((prev) =>
          prev.map((c) => {
            const m = c.macro_category?.trim() || DEFAULT_MACRO_MAP[c.name] || 'Outros'
            return m === oldName ? { ...c, macro_category: trimmed } : c
          })
        )
      }
      if (editedGroupIconVal) {
        setSavedGroupIcon(trimmed, editedGroupIconVal)
      }
      setEditingGroupName(null)
      setVersion((v) => v + 1)
      onCategoriesChanged?.()
      setFeedbackMessage(t('categoryManager.cascadeSuccess'))
      setTimeout(() => setFeedbackMessage(null), 3000)
    } catch (err: unknown) {
      console.error('Erro ao renomear grupo:', err)
      setGroupEditError(err instanceof Error ? err.message : 'Erro ao renomear grupo.')
    } finally {
      setIsSavingGroupEdit(false)
    }
  }

  const handleDeleteGroup = async (groupName: string) => {
    setIsDeletingGroup(true)
    setGroupDeleteError(null)
    try {
      await deleteMacroCategory(groupName, reassignTargetGroup, scope, familyId)
      // Update local state immediately
      setCategories((prev) =>
        prev.map((c) => {
          const m = c.macro_category?.trim() || DEFAULT_MACRO_MAP[c.name] || 'Outros'
          return m === groupName ? { ...c, macro_category: reassignTargetGroup } : c
        })
      )
      setDeletingGroupName(null)
      setVersion((v) => v + 1)
      onCategoriesChanged?.()
      setFeedbackMessage(t('categoryManager.cascadeSuccess'))
      setTimeout(() => setFeedbackMessage(null), 3000)
    } catch (err: unknown) {
      console.error('Erro ao excluir grupo:', err)
      setGroupDeleteError(err instanceof Error ? err.message : 'Erro ao excluir grupo.')
    } finally {
      setIsDeletingGroup(false)
    }
  }

  const toggleGroupExpanded = (groupName: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }))
  }

  const filteredCategories = categories.filter((cat) => {
    if (activeTab === 'all') return true
    if (activeTab === 'expense') return cat.type === 'expense' || cat.type === 'both'
    if (activeTab === 'income') return cat.type === 'income' || cat.type === 'both'
    return true
  })

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 dark:border-indigo-500/30 flex items-center justify-center">
              {modalTab === 'categories' ? <Tags className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  {t('categoryManager.title')}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">
                  {scope === 'shared' ? t('categoryManager.scopeShared') : t('categoryManager.scopePersonal')}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('categoryManager.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Navigation Tabs: [ 🏷️ Categorias ] & [ 📁 Grupos ] */}
        <div className="flex p-1 bg-slate-100 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 flex-shrink-0">
          <button
            type="button"
            onClick={() => setModalTab('categories')}
            className={`cursor-pointer flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              modalTab === 'categories'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/60 dark:border-slate-800'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Tags className="w-3.5 h-3.5" />
            <span>🏷️ {t('categoryManager.tabCategories')}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {categories.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setModalTab('groups')}
            className={`cursor-pointer flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              modalTab === 'groups'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/60 dark:border-slate-800'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>📁 {t('categoryManager.tabGroups')}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {groupStats.length}
            </span>
          </button>
        </div>

        {/* Feedback Message banner */}
        {feedbackMessage && (
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in flex-shrink-0">
            <Sparkles className="w-4 h-4 flex-shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
        )}

        {/* --- VIEW 1: CATEGORIES TAB --- */}
        {modalTab === 'categories' && (
          <>
            {/* Add New Category Form */}
            <form
              onSubmit={handleAddCategory}
              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2.5 flex-shrink-0"
            >
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                {t('categoryManager.newCategory')}
              </span>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value)
                    setAddError(null)
                  }}
                  placeholder={t('categoryManager.namePlaceholder')}
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />

                <div className="flex gap-1.5">
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as CategoryType)}
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-xl px-2.5 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="expense">{t('categoryManager.expenses')}</option>
                    <option value="income">{t('categoryManager.incomes')}</option>
                    <option value="both">{t('categoryManager.both')}</option>
                  </select>

                  <button
                    type="submit"
                    disabled={isAdding || !newName.trim()}
                    className="cursor-pointer px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm flex-shrink-0"
                  >
                    {isAdding ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t('categoryManager.add')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Group / Macro-category Selector with Free Text Option */}
              <div className="space-y-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-800/60">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                    <Folder className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                    {t('categoryManager.macroCategory')}
                  </span>
                  {isCustomMacro ? (
                    <button
                      type="button"
                      onClick={() => setIsCustomMacro(false)}
                      className="cursor-pointer text-indigo-600 dark:text-indigo-400 hover:underline text-[10px] font-medium"
                    >
                      {t('categoryManager.backToGroupSelect')}
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {t('categoryManager.presets')}:
                    </span>
                  )}
                </div>

                {isCustomMacro ? (
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      autoFocus
                      value={newMacro}
                      onChange={(e) => setNewMacro(e.target.value)}
                      placeholder={t('categoryManager.groupNamePlaceholder')}
                      className="w-full bg-white dark:bg-slate-900 border border-indigo-400 dark:border-indigo-500/60 rounded-xl pl-3 pr-8 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomMacro(false)
                        setNewMacro('')
                      }}
                      className="cursor-pointer absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      title={t('categoryManager.cancel')}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <select
                    value={newMacro}
                    onChange={(e) => {
                      if (e.target.value === '__NEW_GROUP__') {
                        setIsCustomMacro(true)
                        setNewMacro('')
                      } else {
                        setNewMacro(e.target.value)
                      }
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">{t('categoryManager.selectGroup')}</option>
                    {allGroups.map((group) => (
                      <option key={group} value={group}>
                        {getGroupIcon(group)} {group}
                      </option>
                    ))}
                    <option value="__NEW_GROUP__" className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {t('categoryManager.createNewGroupOption')}
                    </option>
                  </select>
                )}

                {/* Preset suggestions chips */}
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {DEFAULT_MACRO_PRESETS.slice(0, 8).map((preset) => {
                    const isSelected = newMacro.trim().toLowerCase() === preset.toLowerCase()
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setIsCustomMacro(false)
                          setNewMacro(isSelected ? '' : preset)
                        }}
                        className={`cursor-pointer px-2 py-0.5 rounded-lg text-[11px] font-medium border transition-colors ${
                          isSelected
                            ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40'
                            : 'bg-white dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        {getGroupIcon(preset)} {preset}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Teto Mensal / Limite de Gastos (Opcional) */}
              <div className="space-y-1 pt-1.5 border-t border-slate-200 dark:border-slate-800/60">
                <label className="flex items-center gap-1 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  <Target className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  <span>{t('categoryManager.budgetLimit')}</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newBudgetLimit}
                  onChange={(e) => setNewBudgetLimit(e.target.value)}
                  placeholder={t('categoryManager.budgetLimitPlaceholder')}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono transition-colors"
                />
              </div>

              {addError && (
                <p className="text-[11px] text-rose-500 dark:text-rose-400 font-medium">{addError}</p>
              )}
            </form>

            {/* Filter Tabs: Todas / Despesas / Receitas */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 flex-shrink-0">
              <div className="flex gap-1 bg-slate-100 dark:bg-slate-950/60 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`cursor-pointer px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'all'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {t('categoryManager.all')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('expense')}
                  className={`cursor-pointer px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'expense'
                      ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {t('categoryManager.expenses')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('income')}
                  className={`cursor-pointer px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'income'
                      ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {t('categoryManager.incomes')}
                </button>
              </div>

              <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                {filteredCategories.length}
              </span>
            </div>

            {/* Categories List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px]">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                </div>
              ) : filteredCategories.length === 0 ? (
                <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs">
                  {t('categoryManager.empty')}
                </div>
              ) : (
                filteredCategories.map((cat) => {
                  const isEditingThis = editingId === cat.id
                  const isConfirmingDelete = confirmDeleteId === cat.id

                  if (isEditingThis) {
                    return (
                      <div
                        key={cat.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-indigo-400 dark:border-indigo-500/50 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            autoFocus
                            className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            disabled={isSavingEdit || !editingName.trim()}
                            onClick={() => handleSaveEdit(cat)}
                            className="cursor-pointer p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                            title={t('categoryManager.save')}
                          >
                            {isSavingEdit ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="cursor-pointer p-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                            title={t('categoryManager.cancel')}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Edit Group with Free Text Toggle */}
                        <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-slate-800">
                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                              <Folder className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                              {t('categoryManager.macroCategory')}
                            </span>
                            {isCustomEditMacro ? (
                              <button
                                type="button"
                                onClick={() => setIsCustomEditMacro(false)}
                                className="cursor-pointer text-indigo-600 dark:text-indigo-400 hover:underline text-[10px] font-medium"
                              >
                                {t('categoryManager.backToGroupSelect')}
                              </button>
                            ) : null}
                          </div>

                          {isCustomEditMacro ? (
                            <div className="relative flex items-center">
                              <input
                                type="text"
                                autoFocus
                                value={editingMacro}
                                onChange={(e) => setEditingMacro(e.target.value)}
                                placeholder={t('categoryManager.groupNamePlaceholder')}
                                className="w-full bg-white dark:bg-slate-900 border border-indigo-400 dark:border-indigo-500 rounded-lg pl-3 pr-8 py-1 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setIsCustomEditMacro(false)
                                  setEditingMacro(cat.macro_category || '')
                                }}
                                className="cursor-pointer absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                title={t('categoryManager.cancel')}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <select
                              value={editingMacro}
                              onChange={(e) => {
                                if (e.target.value === '__NEW_GROUP__') {
                                  setIsCustomEditMacro(true)
                                  setEditingMacro('')
                                } else {
                                  setEditingMacro(e.target.value)
                                }
                              }}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                            >
                              <option value="">{t('categoryManager.selectGroup')}</option>
                              {allGroups.map((group) => (
                                <option key={group} value={group}>
                                  {getGroupIcon(group)} {group}
                                </option>
                              ))}
                              <option value="__NEW_GROUP__" className="font-semibold text-indigo-600 dark:text-indigo-400">
                                {t('categoryManager.createNewGroupOption')}
                              </option>
                            </select>
                          )}
                        </div>

                        <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-slate-800">
                          <label className="flex items-center gap-1 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                            <Target className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                            <span>{t('categoryManager.budgetLimit')}</span>
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editingBudgetLimit}
                            onChange={(e) => setEditingBudgetLimit(e.target.value)}
                            placeholder={t('categoryManager.budgetLimitPlaceholder')}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                          />
                        </div>

                        {editError && (
                          <p className="text-xs text-rose-500 dark:text-rose-400 font-medium">{editError}</p>
                        )}
                      </div>
                    )
                  }

                  if (isConfirmingDelete) {
                    return (
                      <div
                        key={cat.id}
                        className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30 space-y-2"
                      >
                        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-medium">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                          <span>{t('categoryManager.deleteConfirm')}</span>
                        </div>
                        {deleteError && (
                          <p className="text-xs text-rose-500 dark:text-rose-400">{deleteError}</p>
                        )}
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="cursor-pointer px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs hover:bg-slate-300 dark:hover:bg-slate-700 font-medium"
                          >
                            {t('categoryManager.cancel')}
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => handleDelete(cat.id)}
                            className="cursor-pointer px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1"
                          >
                            {isDeleting ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <Trash2 className="w-3 h-3" />
                                <span>{t('categoryManager.delete')}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={cat.id}
                      className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-slate-200/80 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 flex-shrink-0">
                          <Tag className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                            {t(`categories.${cat.name}`, cat.name)}
                          </span>
                          {cat.macro_category && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20 font-medium flex items-center gap-1">
                              <span>{getGroupIcon(cat.macro_category)}</span>
                              <span>{cat.macro_category}</span>
                            </span>
                          )}
                          {cat.budget_limit && cat.budget_limit > 0 ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20 font-medium font-mono flex items-center gap-0.5">
                              <Target className="w-2.5 h-2.5" />
                              <span>{cat.budget_limit.toLocaleString()}</span>
                            </span>
                          ) : null}
                        </div>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border flex-shrink-0 ${
                            cat.type === 'expense'
                              ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/20'
                              : cat.type === 'income'
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20'
                              : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/20'
                          }`}
                        >
                          {cat.type === 'expense' ? (
                            <span className="flex items-center gap-0.5">
                              <ArrowUpRight className="w-2.5 h-2.5" />
                              <span>{t('categoryManager.expenses')}</span>
                            </span>
                          ) : cat.type === 'income' ? (
                            <span className="flex items-center gap-0.5">
                              <ArrowDownLeft className="w-2.5 h-2.5" />
                              <span>{t('categoryManager.incomes')}</span>
                            </span>
                          ) : (
                            <span>{t('categoryManager.both')}</span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(cat)}
                          className="cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
                          title={t('categoryManager.edit')}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(cat.id)}
                          className="cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
                          title={t('categoryManager.delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}

        {/* --- VIEW 2: GROUPS TAB --- */}
        {modalTab === 'groups' && (
          <div className="flex-1 flex flex-col space-y-3 min-h-[220px] overflow-hidden">
            {/* Top Toolbar: Group count & Novo Grupo button */}
            <div className="flex items-center justify-between flex-shrink-0">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Folder className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>{groupStats.length} {t('categoryManager.activeGroups')}</span>
              </span>

              <button
                type="button"
                onClick={() => setIsAddingGroup(!isAddingGroup)}
                className="cursor-pointer px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
              >
                {isAddingGroup ? <X className="w-3.5 h-3.5" /> : <FolderPlus className="w-3.5 h-3.5" />}
                <span>{isAddingGroup ? t('categoryManager.cancel') : t('categoryManager.newGroup')}</span>
              </button>
            </div>

            {/* Novo Grupo Form */}
            {isAddingGroup && (
              <form
                onSubmit={handleCreateGroup}
                className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-slate-950/80 border border-indigo-200 dark:border-indigo-500/30 space-y-2.5 flex-shrink-0 animate-in fade-in"
              >
                <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                  <span className="flex items-center gap-1.5">
                    <FolderPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    {t('categoryManager.newGroup')}
                  </span>
                  <span className="text-base">{newGroupIcon}</span>
                </div>

                <div className="space-y-1">
                  <input
                    type="text"
                    autoFocus
                    value={newGroupName}
                    onChange={(e) => {
                      setNewGroupName(e.target.value)
                      setGroupAddError(null)
                    }}
                    placeholder={t('categoryManager.groupNamePlaceholder')}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Emoji Icon Picker */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block">
                    {t('categoryManager.groupIcon')}:
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {SUGGESTED_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewGroupIcon(emoji)}
                        className={`cursor-pointer w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all ${
                          newGroupIcon === emoji
                            ? 'bg-indigo-600 text-white shadow-sm scale-110'
                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Budget Limit & Optional initial category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/60">
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <Target className="w-2.5 h-2.5 text-indigo-500" />
                      <span>{t('categoryManager.budgetLimit')}</span>
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={newGroupBudget}
                      onChange={(e) => setNewGroupBudget(e.target.value)}
                      placeholder={t('categoryManager.budgetLimitPlaceholder')}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-white font-mono placeholder-slate-400"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[10px] font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <Tag className="w-2.5 h-2.5 text-indigo-500" />
                      <span>{t('categoryManager.initialCategoryPlaceholder')}</span>
                    </label>
                    <input
                      type="text"
                      value={newGroupInitialCat}
                      onChange={(e) => setNewGroupInitialCat(e.target.value)}
                      placeholder={newGroupName || 'Geral'}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-white placeholder-slate-400"
                    />
                  </div>
                </div>

                {groupAddError && (
                  <p className="text-[11px] text-rose-500 font-medium">{groupAddError}</p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingGroup(false)}
                    className="cursor-pointer px-3 py-1 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium"
                  >
                    {t('categoryManager.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingGroup || !newGroupName.trim()}
                    className="cursor-pointer px-3.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    {isSubmittingGroup ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{t('categoryManager.createGroup')}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Groups List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px]">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                </div>
              ) : groupStats.length === 0 ? (
                <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs">
                  {t('categoryManager.empty')}
                </div>
              ) : (
                groupStats.map((item) => {
                  const isEditingThis = editingGroupName === item.name
                  const isDeletingThis = deletingGroupName === item.name
                  const isExpanded = expandedGroups[item.name]

                  // In-place group edit card
                  if (isEditingThis) {
                    return (
                      <div
                        key={item.name}
                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-indigo-400 dark:border-indigo-500/50 space-y-2.5 animate-in fade-in"
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                          <span>{t('categoryManager.editGroup')}</span>
                          <span className="text-base">{editedGroupIconVal}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            autoFocus
                            value={editedGroupNameVal}
                            onChange={(e) => setEditedGroupNameVal(e.target.value)}
                            placeholder={t('categoryManager.groupName')}
                            className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            disabled={isSavingGroupEdit || !editedGroupNameVal.trim()}
                            onClick={() => handleSaveGroupEdit(item.name)}
                            className="cursor-pointer p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                            title={t('categoryManager.save')}
                          >
                            {isSavingGroupEdit ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingGroupName(null)}
                            className="cursor-pointer p-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                            title={t('categoryManager.cancel')}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Quick emoji selector */}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {SUGGESTED_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => setEditedGroupIconVal(emoji)}
                              className={`cursor-pointer w-6 h-6 rounded-md text-xs flex items-center justify-center transition-all ${
                                editedGroupIconVal === emoji
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>

                        {groupEditError && (
                          <p className="text-xs text-rose-500 font-medium">{groupEditError}</p>
                        )}
                      </div>
                    )
                  }

                  // In-place group deletion & reassignment card
                  if (isDeletingThis) {
                    return (
                      <div
                        key={item.name}
                        className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30 space-y-2.5 animate-in fade-in"
                      >
                        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                          <span>{t('categoryManager.deleteGroupConfirm')}</span>
                        </div>

                        {item.categories.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[11px] text-slate-600 dark:text-slate-300">
                              O grupo <strong className="text-slate-900 dark:text-white">"{item.name}"</strong> possui{' '}
                              <strong>{item.categories.length}</strong> {t('categoryManager.linkedCategories')}.
                            </p>
                            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                              {t('categoryManager.reassignTo')}
                            </label>
                            <select
                              value={reassignTargetGroup}
                              onChange={(e) => setReassignTargetGroup(e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                            >
                              <option value="Outros">📁 Outros</option>
                              {allGroups
                                .filter((g) => g !== item.name && g !== 'Outros')
                                .map((g) => (
                                  <option key={g} value={g}>
                                    {getGroupIcon(g)} {g}
                                  </option>
                                ))}
                            </select>
                          </div>
                        )}

                        {groupDeleteError && (
                          <p className="text-xs text-rose-500 font-medium">{groupDeleteError}</p>
                        )}

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setDeletingGroupName(null)}
                            className="cursor-pointer px-3 py-1 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium"
                          >
                            {t('categoryManager.cancel')}
                          </button>
                          <button
                            type="button"
                            disabled={isDeletingGroup}
                            onClick={() => handleDeleteGroup(item.name)}
                            className="cursor-pointer px-3.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5"
                          >
                            {isDeletingGroup ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{t('categoryManager.reassignAndDelete')}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )
                  }

                  // Normal Group item row
                  return (
                    <div
                      key={item.name}
                      className="p-3 rounded-2xl bg-slate-50/90 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-2 hover:border-slate-300 dark:hover:border-slate-700 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-500/20 text-base flex items-center justify-center flex-shrink-0">
                            {getGroupIcon(item.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                                {item.name}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                                {item.categories.length}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                              {item.totalBudget > 0 ? (
                                <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-mono font-medium">
                                  <Target className="w-2.5 h-2.5" />
                                  <span>{t('categoryManager.consolidatedBudget')}: {item.totalBudget.toLocaleString()}</span>
                                </span>
                              ) : (
                                <span>{t('categoryManager.noLimit')}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          {item.categories.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleGroupExpanded(item.name)}
                              className="cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                              title="Ver categorias"
                            >
                              <ChevronRight
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                  isExpanded ? 'rotate-90' : ''
                                }`}
                              />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleStartGroupEdit(item.name)}
                            className="cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                            title={t('categoryManager.edit')}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeletingGroupName(item.name)
                              setReassignTargetGroup('Outros')
                            }}
                            className="cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                            title={t('categoryManager.delete')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Linked Categories Preview Pills */}
                      {item.categories.length > 0 && (
                        <div
                          className={`flex flex-wrap gap-1 pt-1 border-t border-slate-200/60 dark:border-slate-800/60 ${
                            isExpanded ? '' : 'max-h-6 overflow-hidden'
                          }`}
                        >
                          {item.categories.map((cat) => (
                            <span
                              key={cat.id}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                            >
                              {t(`categories.${cat.name}`, cat.name)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
