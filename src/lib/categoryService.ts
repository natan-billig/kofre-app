import { supabase } from './supabase'
import type { Category, CategoryType, WalletScope } from './types'

export const DEFAULT_MACRO_PRESETS = [
  'Moradia',
  'Alimentação',
  'Transporte',
  'Lazer',
  'Saúde',
  'Compras',
  'Educação',
  'Serviços',
  'Investimentos',
  'Outros',
]

export const DEFAULT_GROUP_ICONS: Record<string, string> = {
  Moradia: '🏠',
  Alimentação: '🍔',
  Transporte: '🚗',
  Lazer: '🎮',
  Saúde: '💊',
  Compras: '🛍️',
  Educação: '🎓',
  Serviços: '🛠️',
  Investimentos: '📈',
  Renda: '💰',
  Outros: '📁',
  Câmbio: '💱',
  Transferência: '🔄',
  'Pagamento de Fatura': '💳',
}

export function getGroupIcon(groupName: string): string {
  try {
    const custom = localStorage.getItem('kofre_group_icons')
    if (custom) {
      const parsed = JSON.parse(custom)
      if (parsed[groupName]) return parsed[groupName]
    }
  } catch {
    // Ignore JSON errors
  }
  return DEFAULT_GROUP_ICONS[groupName] || '📁'
}

export function setSavedGroupIcon(groupName: string, icon: string): void {
  try {
    const raw = localStorage.getItem('kofre_group_icons')
    const parsed = raw ? JSON.parse(raw) : {}
    parsed[groupName] = icon
    localStorage.setItem('kofre_group_icons', JSON.stringify(parsed))
  } catch (err) {
    console.warn('Could not save group icon:', err)
  }
}

export function migrateSavedGroupIcon(oldName: string, newName: string): void {
  try {
    const raw = localStorage.getItem('kofre_group_icons')
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (parsed[oldName]) {
      parsed[newName] = parsed[oldName]
      delete parsed[oldName]
      localStorage.setItem('kofre_group_icons', JSON.stringify(parsed))
    }
  } catch (err) {
    console.warn('Could not migrate group icon:', err)
  }
}

export const DEFAULT_MACRO_MAP: Record<string, string> = {
  Alimentação: 'Alimentação',
  Supermercado: 'Alimentação',
  Restaurante: 'Alimentação',
  Lanche: 'Alimentação',
  Moradia: 'Moradia',
  Aluguel: 'Moradia',
  Luz: 'Moradia',
  Água: 'Moradia',
  Internet: 'Moradia',
  Condomínio: 'Moradia',
  Transporte: 'Transporte',
  Combustível: 'Transporte',
  Uber: 'Transporte',
  Oficina: 'Transporte',
  Lazer: 'Lazer',
  Cinema: 'Lazer',
  Viagem: 'Lazer',
  Saúde: 'Saúde',
  Farmácia: 'Saúde',
  Médico: 'Saúde',
  Compras: 'Compras',
  Vestuário: 'Compras',
  Eletrônicos: 'Compras',
  Educação: 'Educação',
  Faculdade: 'Educação',
  Curso: 'Educação',
  Serviços: 'Serviços',
  Salário: 'Renda',
  Investimentos: 'Investimentos',
  Câmbio: 'Câmbio',
  Transferência: 'Transferência',
  'Pagamento de Fatura': 'Pagamento de Fatura',
  Outros: 'Outros',
}

const DEFAULT_CATEGORIES: Array<{ name: string; type: CategoryType; macro_category?: string }> = [
  { name: 'Alimentação', type: 'expense', macro_category: 'Alimentação' },
  { name: 'Supermercado', type: 'expense', macro_category: 'Alimentação' },
  { name: 'Moradia', type: 'expense', macro_category: 'Moradia' },
  { name: 'Transporte', type: 'expense', macro_category: 'Transporte' },
  { name: 'Lazer', type: 'expense', macro_category: 'Lazer' },
  { name: 'Saúde', type: 'expense', macro_category: 'Saúde' },
  { name: 'Compras', type: 'expense', macro_category: 'Compras' },
  { name: 'Salário', type: 'income', macro_category: 'Renda' },
  { name: 'Investimentos', type: 'income', macro_category: 'Investimentos' },
  { name: 'Outros', type: 'both', macro_category: 'Outros' },
]

/**
 * Busca as categorias de um determinado escopo ('personal' ou 'shared').
 * Caso o usuário ou família ainda não possua categorias cadastradas,
 * inicializa o conjunto padrão no Supabase automaticamente.
 */
export async function fetchCategories(
  scope: WalletScope = 'personal',
  familyId?: string | null
): Promise<Category[]> {
  try {
    let query = supabase.from('categories').select('*').eq('scope', scope)

    if (scope === 'shared' && familyId) {
      query = query.eq('family_id', familyId)
    }

    const { data, error } = await query.order('name', { ascending: true })

    if (error) {
      console.error('Erro ao buscar categorias:', error)
      throw error
    }

    const categories = (data as Category[]) || []

    // Inicialização automática das categorias padrão caso não haja nenhuma
    if (categories.length === 0) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const toInsert = DEFAULT_CATEGORIES.map((cat) => ({
          name: cat.name,
          type: cat.type,
          scope,
          family_id: scope === 'shared' ? familyId || null : null,
          user_id: user.id,
          macro_category: cat.macro_category,
        }))

        let { data: inserted, error: insertError } = await supabase
          .from('categories')
          .insert(toInsert)
          .select()

        // Fallback se a coluna macro_category ainda não existir no schema do banco
        if (insertError && (insertError.code === 'PGRST204' || insertError.message?.includes('macro_category'))) {
          const fallbackToInsert = toInsert.map((item) => ({
            name: item.name,
            type: item.type,
            scope: item.scope,
            family_id: item.family_id,
            user_id: item.user_id,
          }))
          const retry = await supabase.from('categories').insert(fallbackToInsert).select()
          inserted = retry.data
          insertError = retry.error
        }

        if (!insertError && inserted && inserted.length > 0) {
          return (inserted as Category[]).sort((a, b) => a.name.localeCompare(b.name))
        }
      }
    }

    return categories
  } catch (err) {
    console.error('Falha em fetchCategories:', err)
    // Fallback gracioso com identificadores temporários em caso de offline/erro
    return DEFAULT_CATEGORIES.map((c, index) => ({
      id: `default-${index}`,
      user_id: '',
      name: c.name,
      type: c.type,
      scope,
      family_id: familyId || null,
      macro_category: c.macro_category,
    }))
  }
}

/**
 * Cria uma nova categoria no Supabase.
 */
export async function createCategory(
  name: string,
  type: CategoryType,
  scope: WalletScope,
  familyId?: string | null,
  macroCategory?: string | null,
  budgetLimit?: number | null
): Promise<Category> {
  const cleanName = name.trim()
  if (!cleanName) {
    throw new Error('Informe o nome da categoria.')
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Usuário não autenticado.')
  }

  const payload: Record<string, unknown> = {
    user_id: user.id,
    name: cleanName,
    type,
    scope,
    family_id: scope === 'shared' ? familyId || null : null,
  }

  if (macroCategory?.trim()) {
    payload.macro_category = macroCategory.trim()
  }

  if (budgetLimit !== undefined && budgetLimit !== null && !isNaN(budgetLimit) && budgetLimit > 0) {
    payload.budget_limit = budgetLimit
  } else if (budgetLimit === null) {
    payload.budget_limit = null
  }

  let { data, error } = await supabase
    .from('categories')
    .insert([payload])
    .select()
    .single()

  // Se a coluna budget_limit ou macro_category não existir no schema (fallback gracioso)
  if (
    error &&
    (error.code === 'PGRST204' ||
      error.message?.includes('budget_limit') ||
      error.message?.includes('macro_category'))
  ) {
    if (error.message?.includes('budget_limit')) {
      delete payload.budget_limit
    }
    if (error.message?.includes('macro_category')) {
      delete payload.macro_category
    }
    const retry = await supabase
      .from('categories')
      .insert([payload])
      .select()
      .single()
    data = retry.data
    error = retry.error
  }

  if (error) {
    console.error('Erro ao criar categoria:', error)
    throw new Error(error.message || 'Erro ao criar categoria.')
  }

  return data as Category
}

/**
 * Atualiza uma categoria no Supabase (nome, macro_category e budget_limit),
 * propagando alteração de nome para os lançamentos passados via RPC rename_category se houver.
 */
export async function updateCategory(
  id: string,
  oldName: string,
  newName: string,
  scope: WalletScope,
  familyId?: string | null,
  macroCategory?: string | null,
  budgetLimit?: number | null
): Promise<void> {
  const cleanNewName = newName.trim()
  if (!cleanNewName) {
    throw new Error('O novo nome da categoria não pode ficar vazio.')
  }

  // 1. Atualizar macro_category e budget_limit se informados
  const updatePayload: Record<string, unknown> = {}
  if (macroCategory !== undefined) {
    updatePayload.macro_category = macroCategory?.trim() || null
  }
  if (budgetLimit !== undefined) {
    updatePayload.budget_limit = budgetLimit !== null && !isNaN(budgetLimit) && budgetLimit > 0 ? budgetLimit : null
  }

  if (Object.keys(updatePayload).length > 0) {
    try {
      const { error: updErr } = await supabase
        .from('categories')
        .update(updatePayload)
        .eq('id', id)

      if (updErr && updErr.code === 'PGRST204') {
        if (updErr.message?.includes('budget_limit')) {
          delete updatePayload.budget_limit
          if (Object.keys(updatePayload).length > 0) {
            await supabase.from('categories').update(updatePayload).eq('id', id)
          }
        }
      }
    } catch (err) {
      console.warn('Could not update category fields (macro/budget):', err)
    }
  }

  // 2. Se o nome mudou, executa a renomeação de lançamentos via RPC
  if (cleanNewName !== oldName.trim()) {
    const { error } = await supabase.rpc('rename_category', {
      p_category_id: id,
      p_old_name: oldName.trim(),
      p_new_name: cleanNewName,
      p_scope: scope,
      p_family_id: familyId || null,
    })

    if (error) {
      // Fallback: se a RPC der erro ou não existir, atualiza diretamente o nome na tabela
      const { error: directErr } = await supabase
        .from('categories')
        .update({ name: cleanNewName })
        .eq('id', id)

      if (directErr) {
        console.error('Erro ao renomear categoria:', error)
        throw new Error(error.message || directErr.message || 'Erro ao renomear categoria.')
      }
    }
  }
}

/**
 * Exclui uma categoria do banco de dados.
 * O histórico das movimentações passadas permanece preservado.
 */
export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id)

  if (error) {
    console.error('Erro ao excluir categoria:', error)
    throw new Error(error.message || 'Erro ao excluir categoria.')
  }
}

/**
 * Renomeia uma macro-categoria (grupo) em cascata para todas as categorias vinculadas.
 */
export async function renameMacroCategory(
  oldName: string,
  newName: string,
  scope: WalletScope,
  familyId?: string | null
): Promise<void> {
  const cleanOld = oldName.trim()
  const cleanNew = newName.trim()

  if (!cleanNew) {
    throw new Error('O novo nome do grupo não pode ficar vazio.')
  }
  if (cleanOld.toLowerCase() === cleanNew.toLowerCase()) return

  const {
    data: { user },
  } = await supabase.auth.getUser()

  try {
    // 1. Atualizar todas as categorias que possuem explicitamente macro_category = cleanOld
    let query = supabase
      .from('categories')
      .update({ macro_category: cleanNew })
      .eq('scope', scope)
      .eq('macro_category', cleanOld)

    if (scope === 'shared' && familyId) {
      query = query.eq('family_id', familyId)
    } else if (user) {
      query = query.eq('user_id', user.id)
    }

    const { error } = await query
    if (error && error.code !== 'PGRST204') {
      console.error('Erro ao renomear macro-categoria em cascata:', error)
      throw new Error(error.message || 'Erro ao renomear grupo.')
    }

    // 2. Atualizar categorias legadas cujo macro_category seja nulo e que mapeiam para cleanOld
    const matchingLegacyNames = Object.entries(DEFAULT_MACRO_MAP)
      .filter(([, macro]) => macro.toLowerCase() === cleanOld.toLowerCase())
      .map(([catName]) => catName)

    if (matchingLegacyNames.length > 0) {
      let legacyQuery = supabase
        .from('categories')
        .update({ macro_category: cleanNew })
        .eq('scope', scope)
        .is('macro_category', null)
        .in('name', matchingLegacyNames)

      if (scope === 'shared' && familyId) {
        legacyQuery = legacyQuery.eq('family_id', familyId)
      } else if (user) {
        legacyQuery = legacyQuery.eq('user_id', user.id)
      }

      await legacyQuery
    }

    // 3. Migrar ícone personalizado se existir
    migrateSavedGroupIcon(cleanOld, cleanNew)
  } catch (err: unknown) {
    console.error('Falha em renameMacroCategory:', err)
    throw err instanceof Error ? err : new Error('Erro ao renomear grupo.')
  }
}

/**
 * Exclui um grupo reatribuindo em lote todas as suas categorias para outro grupo (padrão: 'Outros').
 */
export async function deleteMacroCategory(
  groupName: string,
  reassignTo: string = 'Outros',
  scope: WalletScope,
  familyId?: string | null
): Promise<void> {
  const cleanGroup = groupName.trim()
  const cleanTarget = reassignTo.trim() || 'Outros'

  const {
    data: { user },
  } = await supabase.auth.getUser()

  try {
    // 1. Atualizar categorias com macro_category = cleanGroup
    let query = supabase
      .from('categories')
      .update({ macro_category: cleanTarget })
      .eq('scope', scope)
      .eq('macro_category', cleanGroup)

    if (scope === 'shared' && familyId) {
      query = query.eq('family_id', familyId)
    } else if (user) {
      query = query.eq('user_id', user.id)
    }

    const { error } = await query
    if (error && error.code !== 'PGRST204') {
      console.error('Erro ao reatribuir categorias do grupo:', error)
      throw new Error(error.message || 'Erro ao excluir grupo.')
    }

    // 2. Atualizar categorias legadas cujo macro_category seja nulo e correspondam ao cleanGroup
    const matchingLegacyNames = Object.entries(DEFAULT_MACRO_MAP)
      .filter(([, macro]) => macro.toLowerCase() === cleanGroup.toLowerCase())
      .map(([catName]) => catName)

    if (matchingLegacyNames.length > 0) {
      let legacyQuery = supabase
        .from('categories')
        .update({ macro_category: cleanTarget })
        .eq('scope', scope)
        .is('macro_category', null)
        .in('name', matchingLegacyNames)

      if (scope === 'shared' && familyId) {
        legacyQuery = legacyQuery.eq('family_id', familyId)
      } else if (user) {
        legacyQuery = legacyQuery.eq('user_id', user.id)
      }

      await legacyQuery
    }
  } catch (err: unknown) {
    console.error('Falha em deleteMacroCategory:', err)
    throw err instanceof Error ? err : new Error('Erro ao excluir grupo.')
  }
}

/**
 * Cria um novo grupo criando uma categoria inicial no Supabase com o nome do grupo e respectivo teto.
 */
export async function createMacroCategory(
  groupName: string,
  scope: WalletScope,
  familyId?: string | null,
  budgetLimit?: number | null,
  initialCategoryName?: string,
  icon?: string
): Promise<Category> {
  const cleanGroup = groupName.trim()
  if (!cleanGroup) {
    throw new Error('Informe o nome do grupo.')
  }
  const catName = (initialCategoryName || cleanGroup).trim()
  if (icon) {
    setSavedGroupIcon(cleanGroup, icon)
  }
  return createCategory(catName, 'expense', scope, familyId, cleanGroup, budgetLimit)
}

