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
  macroCategory?: string | null
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

  let { data, error } = await supabase
    .from('categories')
    .insert([payload])
    .select()
    .single()

  // Se a coluna macro_category não existir no schema (fallback gracioso)
  if (error && (error.code === 'PGRST204' || error.message?.includes('macro_category'))) {
    delete payload.macro_category
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
 * Atualiza uma categoria no Supabase (nome e macro_category),
 * propagando alteração de nome para os lançamentos passados via RPC rename_category se houver.
 */
export async function updateCategory(
  id: string,
  oldName: string,
  newName: string,
  scope: WalletScope,
  familyId?: string | null,
  macroCategory?: string | null
): Promise<void> {
  const cleanNewName = newName.trim()
  if (!cleanNewName) {
    throw new Error('O novo nome da categoria não pode ficar vazio.')
  }

  // 1. Atualizar macro_category se informado
  if (macroCategory !== undefined) {
    try {
      await supabase
        .from('categories')
        .update({ macro_category: macroCategory?.trim() || null })
        .eq('id', id)
    } catch (err) {
      console.warn('Could not update macro_category:', err)
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
