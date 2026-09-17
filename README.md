# Kofre Web

Aplicação web construída com **React**, **TypeScript**, **Vite**, estilizada com **Tailwind CSS v4**, integrada com a biblioteca de ícones **Lucide React** e o cliente oficial do **Supabase**.

---

## 🚀 Tecnologias

- [React 19](https://react.dev/)
- [Vite](https://vite.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/) com `@tailwindcss/vite`
- [Lucide React](https://lucide.dev/)
- [@supabase/supabase-js](https://supabase.com/docs/reference/javascript/introduction)

---

## 🛠️ Comandos Disponíveis

```bash
# Iniciar o servidor de desenvolvimento com HMR
npm run dev

# Compilar para produção (TypeScript check + Vite build)
npm run build

# Pré-visualizar o build de produção localmente
npm run preview

# Executar o linter de código (Oxlint)
npm run lint
```

---

## 🔑 Configuração do Supabase

O projeto já inclui um utilitário configurado em `src/lib/supabase.ts`.

1. Crie seu projeto no [Supabase](https://supabase.com/).
2. Obtenha a URL do projeto e a chave anônima (anon key).
3. Preencha o arquivo `.env`:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui
```

Para usar o Supabase nos seus componentes:

```tsx
import { supabase } from './lib/supabase'

// Exemplo de consulta
const { data, error } = await supabase.from('tabela').select('*')
```
