import React, { useState, useEffect } from 'react'
import type { Category, CategoryType, WalletScope } from '../lib/types'
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  DEFAULT_MACRO_PRESETS,
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
  Target,
} from 'lucide-react'

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

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'expense' | 'income'>('all')

  // New Category form state
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<CategoryType>('expense')
  const [newMacro, setNewMacro] = useState('')
  const [newBudgetLimit, setNewBudgetLimit] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // In-place edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingMacro, setEditingMacro] = useState('')
  const [editingBudgetLimit, setEditingBudgetLimit] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Deletion confirm state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
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

  if (!isOpen) return null

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
    setEditingMacro(cat.macro_category || '')
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

  const filteredCategories = categories.filter((cat) => {
    if (activeTab === 'all') return true
    if (activeTab === 'expense') return cat.type === 'expense' || cat.type === 'both'
    if (activeTab === 'income') return cat.type === 'income' || cat.type === 'both'
    return true
  })

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 dark:border-indigo-500/30 flex items-center justify-center">
              <Tags className="w-5 h-5" />
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

          {/* Macro-categoria / Grupo & Sugestões */}
          <div className="space-y-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-800/60">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                <Folder className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                {t('categoryManager.macroCategory')}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {t('categoryManager.presets')}:
              </span>
            </div>

            <input
              type="text"
              value={newMacro}
              onChange={(e) => setNewMacro(e.target.value)}
              placeholder={t('categoryManager.macroCategoryPlaceholder')}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />

            <div className="flex flex-wrap gap-1 pt-0.5">
              {DEFAULT_MACRO_PRESETS.map((preset) => {
                const isSelected = newMacro.trim().toLowerCase() === preset.toLowerCase()
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setNewMacro(isSelected ? '' : preset)}
                    className={`cursor-pointer px-2 py-0.5 rounded-lg text-xs font-medium border transition-colors ${
                      isSelected
                        ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40'
                        : 'bg-white dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {preset}
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

                    <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                          <Folder className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                          {t('categoryManager.macroCategory')}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={editingMacro}
                        onChange={(e) => setEditingMacro(e.target.value)}
                        placeholder={t('categoryManager.macroCategoryPlaceholder')}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {DEFAULT_MACRO_PRESETS.map((preset) => {
                          const isSelected = editingMacro.trim().toLowerCase() === preset.toLowerCase()
                          return (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setEditingMacro(isSelected ? '' : preset)}
                              className={`cursor-pointer px-1.5 py-0.5 rounded text-xs border transition-colors ${
                                isSelected
                                  ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40'
                                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                              }`}
                            >
                              {preset}
                            </button>
                          )
                        })}
                      </div>
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
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20 font-medium">
                          {cat.macro_category}
                        </span>
                      )}
                      {cat.budget_limit && cat.budget_limit > 0 ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20 font-medium font-mono flex items-center gap-0.5">
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
      </div>
    </div>
  )
}
