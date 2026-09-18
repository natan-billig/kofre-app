/**
 * Sugestão Preditiva de Categorias por Descrição
 * Analisa palavras-chave na descrição para sugerir a categoria mais provável.
 */

interface CategoryCandidate {
  primaryTarget: string
  alternativeTargets?: string[]
  keywords: string[]
}

const PREDICTION_RULES: CategoryCandidate[] = [
  {
    primaryTarget: 'Supermercado',
    alternativeTargets: ['Alimentação', 'Compras'],
    keywords: [
      'supermercado',
      'super',
      'mercado',
      'despensa',
      'minimercado',
      'hipermercado',
      'acougue',
      'panaderia',
      'padaria',
      'feira',
    ],
  },
  {
    primaryTarget: 'Alimentação',
    alternativeTargets: ['Lazer', 'Outros'],
    keywords: [
      'pizza',
      'lanche',
      'almoco',
      'jantar',
      'cafe',
      'restaurante',
      'burger',
      'hamburguer',
      'sushi',
      'mcdonalds',
      'burgerking',
      'comida',
      'sorvete',
      'acai',
      'bebida',
      'churrasco',
      'padaria',
      'buffet',
      'bar',
    ],
  },
  {
    primaryTarget: 'Transporte',
    alternativeTargets: ['Serviços', 'Outros'],
    keywords: [
      'combustivel',
      'gasolina',
      'diesel',
      'alcool',
      'uber',
      'bolt',
      'taxi',
      'estacionamento',
      'pedagio',
      'portagem',
      'lavagem',
      'oficina',
      'mecanico',
      'onibus',
      'metro',
      'coletivo',
      'passagem',
      'pneu',
    ],
  },
  {
    primaryTarget: 'Saúde',
    alternativeTargets: ['Serviços', 'Outros'],
    keywords: [
      'farmacia',
      'remedio',
      'medicamento',
      'consulta',
      'dentista',
      'hospital',
      'exame',
      'medico',
      'laboratorio',
      'clinica',
      'terapia',
      'psicologo',
      'oculos',
      'otica',
    ],
  },
  {
    primaryTarget: 'Moradia',
    alternativeTargets: ['Serviços', 'Outros'],
    keywords: [
      'aluguel',
      'renda',
      'condominio',
      'luz',
      'ande',
      'energia',
      'agua',
      'essap',
      'internet',
      'gas',
      'iptu',
      'limpeza',
      'diarista',
      'faxina',
    ],
  },
  {
    primaryTarget: 'Serviços',
    alternativeTargets: ['Moradia', 'Outros'],
    keywords: [
      'servico',
      'assinatura',
      'manutencao',
      'conserto',
      'copel',
      'sanepar',
    ],
  },
  {
    primaryTarget: 'Lazer',
    alternativeTargets: ['Compras', 'Outros'],
    keywords: [
      'cinema',
      'netflix',
      'spotify',
      'espetaculo',
      'show',
      'teatro',
      'viagem',
      'hotel',
      'pousada',
      'jogos',
      'game',
      'steam',
      'playstation',
      'passeio',
      'parque',
    ],
  },
  {
    primaryTarget: 'Salário',
    alternativeTargets: ['Outros'],
    keywords: [
      'salario',
      'remuneracao',
      'pro-labore',
      'honorarios',
      'ordenado',
      'adiantamento',
      '13o',
      'decimo',
      'quinzena',
    ],
  },
  {
    primaryTarget: 'Investimentos',
    alternativeTargets: ['Outros'],
    keywords: [
      'dividendo',
      'rendimento',
      'cdb',
      'fundo',
      'acoes',
      'cripto',
      'bitcoin',
      'juros',
    ],
  },
]

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Prediz a categoria a partir do texto de descrição.
 * Retorna o nome da categoria existente na lista de categorias disponíveis ou null.
 */
export function predictCategory(
  description: string,
  availableCategories: { name: string }[]
): string | null {
  if (!description || description.trim().length < 2) return null

  const normalizedDesc = normalizeText(description)
  // Divide a descrição em palavras
  const words = normalizedDesc.split(/[\s,.-]+/).filter(Boolean)

  if (words.length === 0) return null

  const availableMap = new Map<string, string>()
  for (const cat of availableCategories) {
    availableMap.set(normalizeText(cat.name), cat.name)
  }

  // Avalia cada regra procurando palavras-chave
  for (const rule of PREDICTION_RULES) {
    const matched = rule.keywords.some((kw) => {
      const normalizedKw = normalizeText(kw)
      // Correspondência exata da palavra ou substring de palavra longa (>= 4 chars)
      return words.some(
        (word) => word === normalizedKw || (normalizedKw.length >= 4 && word.includes(normalizedKw))
      )
    })

    if (matched) {
      // Tentar encontrar o primaryTarget nas categorias do usuário
      const primaryNorm = normalizeText(rule.primaryTarget)
      if (availableMap.has(primaryNorm)) {
        return availableMap.get(primaryNorm)!
      }

      // Tentar alternativas
      if (rule.alternativeTargets) {
        for (const alt of rule.alternativeTargets) {
          const altNorm = normalizeText(alt)
          if (availableMap.has(altNorm)) {
            return availableMap.get(altNorm)!
          }
        }
      }
    }
  }

  return null
}
