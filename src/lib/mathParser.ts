/**
 * Parser Aritmético Seguro para o Kofre
 * Avalia expressões aritméticas elementares (+, -, *, /) sem eval() ou new Function().
 */

// Verifica se a string contém operadores aritméticos
export function hasMathExpression(input: string): boolean {
  if (!input || typeof input !== 'string') return false
  // Deve conter pelo menos um operador (+, -, *, /) e pelo menos um dígito
  const hasOperator = /[+\-*xX/]/.test(input)
  const hasDigit = /\d/.test(input)
  return hasOperator && hasDigit
}

/**
 * Avalia de forma segura uma expressão aritmética.
 * Retorna o número resultante ou null caso a expressão seja inválida ou incompleta.
 */
export function evaluateMathExpression(input: string): number | null {
  if (!input || typeof input !== 'string') return null

  // 1. Sanitizar e normalizar caracteres
  // Substituir 'x' ou 'X' por '*', vírgulas decimais por ponto
  const sanitized = input
    .replace(/[xX]/g, '*')
    .replace(/,/g, '.')
    .replace(/\s+/g, '') // remove espaços

  // Permite apenas dígitos, pontos decimais, parênteses e operadores (+, -, *, /)
  if (!/^[0-9.+\-*/()]+$/.test(sanitized)) {
    return null
  }

  // 2. Tokenizar
  const tokens: (number | string)[] = []
  let i = 0
  const n = sanitized.length

  while (i < n) {
    const char = sanitized[i]

    if (char === '+' || char === '*' || char === '/' || char === '(' || char === ')') {
      tokens.push(char)
      i++
    } else if (char === '-') {
      // Diferenciar '-' unário de binário:
      // É unário se for o primeiro token ou vier após outro operador ou '('
      const prev = tokens[tokens.length - 1]
      const isUnary = tokens.length === 0 || (typeof prev === 'string' && prev !== ')')
      if (isUnary) {
        // Ler o número negativo que segue
        i++
        let numStr = '-'
        let dotCount = 0
        while (i < n && /[\d.]/.test(sanitized[i])) {
          if (sanitized[i] === '.') {
            dotCount++
            if (dotCount > 1) return null
          }
          numStr += sanitized[i]
          i++
        }
        if (numStr === '-') return null // '-' isolado no final
        const parsed = parseFloat(numStr)
        if (isNaN(parsed)) return null
        tokens.push(parsed)
      } else {
        tokens.push('-')
        i++
      }
    } else if (/[\d.]/.test(char)) {
      let numStr = ''
      let dotCount = 0
      while (i < n && /[\d.]/.test(sanitized[i])) {
        if (sanitized[i] === '.') {
          dotCount++
          if (dotCount > 1) return null
        }
        numStr += sanitized[i]
        i++
      }
      const parsed = parseFloat(numStr)
      if (isNaN(parsed)) return null
      tokens.push(parsed)
    } else {
      return null
    }
  }

  if (tokens.length === 0) return null

  // 3. Shunting-Yard para RPN (Reverse Polish Notation)
  const outputQueue: (number | string)[] = []
  const operatorStack: string[] = []

  const precedence: Record<string, number> = {
    '+': 1,
    '-': 1,
    '*': 2,
    '/': 2,
  }

  for (const token of tokens) {
    if (typeof token === 'number') {
      outputQueue.push(token)
    } else if (token in precedence) {
      while (
        operatorStack.length > 0 &&
        operatorStack[operatorStack.length - 1] !== '(' &&
        precedence[operatorStack[operatorStack.length - 1]] >= precedence[token]
      ) {
        outputQueue.push(operatorStack.pop()!)
      }
      operatorStack.push(token)
    } else if (token === '(') {
      operatorStack.push(token)
    } else if (token === ')') {
      let foundMatching = false
      while (operatorStack.length > 0) {
        const top = operatorStack.pop()!
        if (top === '(') {
          foundMatching = true
          break
        }
        outputQueue.push(top)
      }
      if (!foundMatching) return null
    }
  }

  while (operatorStack.length > 0) {
    const top = operatorStack.pop()!
    if (top === '(' || top === ')') return null
    outputQueue.push(top)
  }

  // 4. Avaliar RPN
  const evalStack: number[] = []

  for (const token of outputQueue) {
    if (typeof token === 'number') {
      evalStack.push(token)
    } else if (typeof token === 'string' && token in precedence) {
      if (evalStack.length < 2) return null
      const b = evalStack.pop()!
      const a = evalStack.pop()!

      let res: number
      switch (token) {
        case '+':
          res = a + b
          break
        case '-':
          res = a - b
          break
        case '*':
          res = a * b
          break
        case '/':
          if (b === 0) return null // Evitar divisão por zero
          res = a / b
          break
        default:
          return null
      }
      evalStack.push(res)
    } else {
      return null
    }
  }

  if (evalStack.length !== 1) return null

  const result = evalStack[0]
  if (!isFinite(result) || isNaN(result)) return null

  // Arredondamento para evitar resíduos de ponto flutuante (ex.: 0.1 + 0.2 = 0.30000000000000004)
  return Math.round(result * 10000) / 10000
}
