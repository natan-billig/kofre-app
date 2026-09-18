export interface ChangelogHighlight {
  icon: string
  title: { pt: string; es: string }
  description: { pt: string; es: string }
}

export interface ChangelogRelease {
  version: string
  releaseDate: string
  title: { pt: string; es: string }
  highlights: ChangelogHighlight[]
}

export const CURRENT_APP_VERSION = '1.5.0'

export const CHANGELOG_DATA: ChangelogRelease[] = [
  {
    version: '1.5.0',
    releaseDate: '2026-09-18',
    title: {
      pt: 'Compras Parceladas (Cuotas), Reintegros Bancários e Exclusão Inteligente',
      es: 'Compras en Cuotas, Reintegros Bancarios y Eliminación Inteligente',
    },
    highlights: [
      {
        icon: 'Layers',
        title: {
          pt: 'Compras Parceladas (Cuotas)',
          es: 'Compras en Cuotas',
        },
        description: {
          pt: 'Parcele compras em cartões de crédito em até 48x com projeção mensal no extrato e dedução fiel do limite de crédito.',
          es: 'Divide compras con tarjeta de crédito en hasta 48 cuotas con proyección mensual en extracto y deducción real del límite.',
        },
      },
      {
        icon: 'Sparkles',
        title: {
          pt: 'Reintegro Bancário & Promoções',
          es: 'Reintegro Bancario y Promociones',
        },
        description: {
          pt: 'Aplique cashback em porcentagem ou valor fixo com tope máximo em qualquer despesa, na criação ou edição retroativa.',
          es: 'Aplica cashback en porcentaje o monto fijo con tope máximo en cualquier gasto, al crear o editar retroactivamente.',
        },
      },
      {
        icon: 'Trash2',
        title: {
          pt: 'Exclusão Inteligente e em Cascata',
          es: 'Eliminación Inteligente en Cascada',
        },
        description: {
          pt: 'Escolha entre excluir apenas uma parcela ou o grupo todo, com estorno automático de transações de reintegro vinculadas.',
          es: 'Elige entre eliminar solo una cuota o todo el grupo, con limpieza automática de reintegros vinculados.',
        },
      },
    ],
  },
  {
    version: '1.4.0',
    releaseDate: '2026-09-17',
    title: {
      pt: 'Contas Poupança com Metas, Sobregiro Bancário e Dívida Inicial',
      es: 'Cuentas de Ahorro con Metas, Sobregiro y Deuda Inicial de Tarjeta',
    },
    highlights: [
      {
        icon: 'PiggyBank',
        title: {
          pt: 'Cofre de Reservas & Metas',
          es: 'Caja de Reservas y Metas',
        },
        description: {
          pt: 'Contas poupança isoladas da liquidez diária com barra de progresso visual para acompanhar seus objetivos financeiros.',
          es: 'Cuentas de ahorro aisladas de la liquidez diaria con barra de progreso visual para seguir tus objetivos financieros.',
        },
      },
      {
        icon: 'CreditCard',
        title: {
          pt: 'Dívida Acumulada Inicial em Cartões',
          es: 'Deuda Acumulada Inicial de Tarjeta',
        },
        description: {
          pt: 'Comece a controlar faturas de cartões informando o saldo devedor atual sem precisar cadastrar compras passadas.',
          es: 'Empieza a controlar extractos de tarjetas ingresando la deuda acumulada sin cargar compras históricas.',
        },
      },
      {
        icon: 'ShieldAlert',
        title: {
          pt: 'Limite de Sobregiro / Cheque Especial',
          es: 'Límite de Sobregiro / Cuenta Corriente',
        },
        description: {
          pt: 'Linha emergencial autorizada em contas correntes sem inflar artificialmente seus recursos disponíveis próprios.',
          es: 'Línea de crédito autorizada en cuentas corrientes sin inflar artificialmente tus recursos disponibles propios.',
        },
      },
    ],
  },
  {
    version: '1.3.0',
    releaseDate: '2026-09-16',
    title: {
      pt: 'Vínculo Contábil de Dívidas, Estorno em Cascata e Performance',
      es: 'Vínculo Contable de Deudas, Extorno en Cascada y Rendimiento',
    },
    highlights: [
      {
        icon: 'ArrowRightLeft',
        title: {
          pt: 'Empréstimos Integrados ao Caixa',
          es: 'Préstamos Integrados a Caja',
        },
        description: {
          pt: 'Empréstimos tomados ou concedidos creditam e debitam suas contas automaticamente com total rastreabilidade.',
          es: 'Préstamos tomados u otorgados acreditan y debitan tus cuentas automáticamente con total trazabilidad.',
        },
      },
      {
        icon: 'Trash2',
        title: {
          pt: 'Estorno Seguro em Cascata',
          es: 'Extorno Seguro en Cascada',
        },
        description: {
          pt: 'Ao excluir um registro de dívida, quaisquer lançamentos criados no caixa são removidos sem deixar resíduos.',
          es: 'Al eliminar un registro de deuda, cualquier movimiento generado en caja se borra sin dejar residuos.',
        },
      },
      {
        icon: 'Zap',
        title: {
          pt: 'Code-Splitting e Otimização Vite',
          es: 'Code-Splitting y Optimización Vite',
        },
        description: {
          pt: 'Carregamento instantâneo do aplicativo e economia de dados móveis em conexões de fronteira.',
          es: 'Carga instantánea de la aplicación y ahorro de datos móviles en conexiones de frontera.',
        },
      },
    ],
  },
  {
    version: '1.2.0',
    releaseDate: '2026-09-15',
    title: {
      pt: 'Datas Retroativas em Empréstimos e Liquidação Flexível',
      es: 'Fechas Retroactivas en Préstamos y Liquidación Flexible',
    },
    highlights: [
      {
        icon: 'Calendar',
        title: {
          pt: 'Empréstimos com Data de Origem',
          es: 'Préstamos con Fecha de Origen',
        },
        description: {
          pt: 'Lance empréstimos passados informando a data real do evento e data de vencimento personalizada.',
          es: 'Registra préstamos pasados indicando la fecha real del acuerdo y fecha límite personalizada.',
        },
      },
      {
        icon: 'CheckCircle2',
        title: {
          pt: 'Liquidação com ou sem Movimentação',
          es: 'Liquidación Flexible',
        },
        description: {
          pt: 'Opção de liquidar movimentando a conta financeira ou apenas marcando o acerto formal entre as partes.',
          es: 'Opción de liquidar moviendo fondos de la cuenta o solo marcando el acuerdo saldado.',
        },
      },
    ],
  },
  {
    version: '1.1.0',
    releaseDate: '2026-09-14',
    title: {
      pt: 'Teto de Gastos Orçamentários e Intervalo de Datas no Extrato',
      es: 'Topes de Gasto Presupuestarios e Intervalo de Fechas en Extracto',
    },
    highlights: [
      {
        icon: 'PieChart',
        title: {
          pt: 'Teto Mensal por Categoria',
          es: 'Tope Mensual por Categoría',
        },
        description: {
          pt: 'Defina limites de orçamento e visualize barras dinâmicas com avisos visuais de consumo.',
          es: 'Define límites de presupuesto y visualiza barras dinámicas con alertas visuales de consumo.',
        },
      },
      {
        icon: 'CalendarRange',
        title: {
          pt: 'Período Customizado no Extrato',
          es: 'Período Personalizado en Extracto',
        },
        description: {
          pt: 'Filtre movimentações entre datas personalizadas além do filtro tradicional por mês de competência.',
          es: 'Filtra movimientos entre fechas personalizadas además del filtro tradicional por mes.',
        },
      },
    ],
  },
  {
    version: '1.0.0',
    releaseDate: '2026-09-13',
    title: {
      pt: 'Lançamento Oficial: Gestão Pessoal e Familiar Multi-moeda',
      es: 'Lanzamiento Oficial: Gestión Personal y Familiar Multidivisa',
    },
    highlights: [
      {
        icon: 'Users',
        title: {
          pt: 'Minhas Contas & Caixa da Família',
          es: 'Mis Cuentas y Caja Familiar',
        },
        description: {
          pt: 'Segregação rigorosa entre finanças individuais e a carteira compartilhada familiar sincronizada em tempo real.',
          es: 'Separación estricta entre finanzas personales y la caja familiar sincronizada en tiempo real.',
        },
      },
      {
        icon: 'Coins',
        title: {
          pt: 'PYG, USD e BRL Integrados',
          es: 'PYG, USD y BRL Integrados',
        },
        description: {
          pt: 'Saldos em Guaranis, Dólares e Reais com taxa de câmbio implícita e despesas bimoeda de fronteira.',
          es: 'Saldos en Guaraníes, Dólares y Reales con cotización implícita y compras bimoneda de frontera.',
        },
      },
      {
        icon: 'Search',
        title: {
          pt: 'Extrato com Busca Rápida e Exportação',
          es: 'Extracto con Búsqueda Rápida y Exportación',
        },
        description: {
          pt: 'Localize lançamentos instantaneamente e exporte planilhas formatadas para Excel e CSV.',
          es: 'Encuentra movimientos al instante y exporta planillas formateadas para Excel y CSV.',
        },
      },
    ],
  },
]
