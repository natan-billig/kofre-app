import { supabase } from './supabase'
import type { Category, CategoryType, WalletScope } from './types'

const DEFAULT_CATEGORIES: Array<{ name: string; type: CategoryType }> = [
  { name: 'Alimentação', type: 'expense' },
  { name: 'Supermercado', type: 'expense' },
  { name: 'Moradia', type: 'expense' },
  { name: 'Transporte', type: 'expense' },
  { name: 'Lazer', type: 'expense' },
  { name: 'Saúde', type: 'expense' },
  { name: 'Compras', type: 'expense' },
  { name: 'Salário', type: 'income' },
  { name: 'Investimentos', type: 'income' },
  { name: 'Outros', type: 'both' },
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
        }))

        const { data: inserted, error: insertError } = await supabase
          .from('categories')
          .insert(toInsert)
          .select()

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
  familyId?: string | null
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

  const payload = {
    user_id: user.id,
    name: cleanName,
    type,
    scope,
    family_id: scope === 'shared' ? familyId || null : null,
  }

  const { data, error } = await supabase
    .from('categories')
    .insert([payload])
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar categoria:', error)
    throw new Error(error.message || 'Erro ao criar categoria.')
  }

  return data as Category
}

/**
 * Renomeia uma categoria através da RPC rename_category,
 * propagando a alteração para todos os lançamentos passados.
 */
export async function updateCategory(
  id: string,
  oldName: string,
  newName: string,
  scope: WalletScope,
  familyId?: string | null
): Promise<void> {
  const cleanNewName = newName.trim()
  if (!cleanNewName) {
    throw new Error('O novo nome da categoria não pode ficar vazio.')
  }

  const { error } = await supabase.rpc('rename_category', {
    p_category_id: id,
    p_old_name: oldName.trim(),
    p_new_name: cleanNewName,
    p_scope: scope,
    p_family_id: familyId || null,
  })

  if (error) {
    console.error('Erro ao renomear categoria via RPC rename_category:', error)
    throw new Error(error.message || 'Erro ao renomear categoria.')
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
