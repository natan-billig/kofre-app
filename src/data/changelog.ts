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

export const CURRENT_APP_VERSION = '1.8.4'

export const CHANGELOG_DATA: ChangelogRelease[] = [
  {
    version: '1.8.4',
    releaseDate: '2026-09-18',
    title: {
      pt: 'Projeção Dinâmica com Salário/Entradas, Parser Sudameris e Ajustes Visuais v1.8.4',
      es: 'Proyección Dinámica con Salario/Ingresos, Parser Sudameris y Ajustes Visuales v1.8.4',
    },
    highlights: [
      {
        icon: 'Calendar',
        title: {
          pt: 'Projeção Dinâmica de Caixa com Entradas e Salário',
          es: 'Proyección Dinámica de Caja con Ingresos y Sueldo',
        },
        description: {
          pt: 'O Calendário de Vencimentos agora projeta a evolução diária do saldo considerando o salário base do perfil, receitas fixas e entradas agendadas, com alerta estrito em caso de risco de saldo negativo.',
          es: 'El Calendario de Vencimientos proyecta ahora la evolución diaria del saldo considerando el sueldo base, ingresos fijos y cobros programados, con alerta estricta ante riesgo de sobregiro.',
        },
      },
      {
        icon: 'CreditCard',
        title: {
          pt: 'Suporte a Receitas Fixas no Gestor Recorrente',
          es: 'Soporte a Ingresos Fijos en el Gestor Recurrente',
        },
        description: {
          pt: 'Cadastre salários e rendas fixas no gestor recorrente com alternador Despesa vs. Receita e sincronização resiliente em cache local.',
          es: 'Registra sueldos e ingresos fijos en el gestor recurrente con selector Gasto vs. Ingreso y sincronización resiliente en caché local.',
        },
      },
      {
        icon: 'ClipboardPaste',
        title: {
          pt: 'Parser Bancário Sudameris e Suporte a Vírgulas',
          es: 'Parser Bancario Sudameris y Soporte de Comas',
        },
        description: {
          pt: 'Reconhecimento automático de pagamentos de fatura de cartão Sudameris como transferência e suporte a moedas com pontuação colada e vírgulas em Guaranis.',
          es: 'Reconocimiento automático de pagos de tarjeta Sudameris como transferencia y soporte de monedas con puntuación pegada y comas en Guaraníes.',
        },
      },
    ],
  },
  {
    version: '1.8.3',
    releaseDate: '2026-09-18',
    title: {
      pt: 'Despesas Agendadas, Drilldown de Categorias e Atalhos v1.8.3',
      es: 'Gastos Programados, Drilldown de Categorías y Accesos Directos v1.8.3',
    },
    highlights: [
      {
        icon: 'CalendarClock',
        title: {
          pt: 'Trava de Data e Despesas Agendadas',
          es: 'Bloqueo de Fecha y Gastos Programados',
        },
        description: {
          pt: 'Bloqueio de datas futuras em dinheiro e contas correntes para manter o saldo líquido real, com comutador para agendar contas a pagar sem debitar o saldo de imediato.',
          es: 'Bloqueo de fechas futuras en efectivo y cuentas corrientes para mantener la liquidez real, con opción de programar pagos futuros sin descontar el saldo al instante.',
        },
      },
      {
        icon: 'Calendar',
        title: {
          pt: 'Contas Agendadas no Calendário e Baixa Rápida',
          es: 'Cuentas Programadas en Calendario y Pago Rápido',
        },
        description: {
          pt: 'As despesas agendadas agora constam no Calendário de Vencimentos com badge "A Vencer" e botão de baixa em 1 clique para debitar quando efetivamente pagas.',
          es: 'Los gastos programados ahora figuran en el Calendario de Vencimientos con etiqueta "Por Vencer" y botón de pago en 1 clic para debitar cuando se paguen.',
        },
      },
      {
        icon: 'PieChart',
        title: {
          pt: 'Filtro Interativo e Detalhe de Categorias',
          es: 'Filtro Interactivo y Detalle de Categorías',
        },
        description: {
          pt: 'Clique em qualquer grupo ou categoria para abrir o modal de lançamentos do mês e aceder diretamente ao extrato filtrado com 1 toque.',
          es: 'Haz clic en cualquier grupo o categoría para abrir el modal con los movimientos del mes y acceder directamente al extracto filtrado con 1 toque.',
        },
      },
      {
        icon: 'Settings',
        title: {
          pt: 'Atalhos Rápidos de Gastos Fixos e Grupos',
          es: 'Accesos Directos a Gastos Fijos y Grupos',
        },
        description: {
          pt: 'Botão de Gastos Fixos na barra do Desktop, atalho de Grupos & Categorias no menu do telemóvel e card de boas-vindas com botão de cadastro quando a lista estiver vazia.',
          es: 'Botón de Gastos Fijos en la barra Desktop, acceso a Grupos y Categorías en el menú móvil y tarjeta de bienvenida con botón de registro cuando la lista esté vacía.',
        },
      },
    ],
  },
  {
    version: '1.8.2',
    releaseDate: '2026-09-18',
    title: {
      pt: 'Ergonomia Móvel em Abas, Gestão Familiar e Sincronização v1.8.2',
      es: 'Ergonomía Móvil en Pestañas, Gestión Familiar y Sincronización v1.8.2',
    },
    highlights: [
      {
        icon: 'Smartphone',
        title: {
          pt: 'Feed Móvel em 3 Abas Ergonómicas',
          es: 'Feed Móvil en 3 Pestañas Ergonómicas',
        },
        description: {
          pt: 'Navegação segmentada no telemóvel dividida em Carteira (saldos e faturas), Planeamento (DTI, orçamentos e vencimentos) e Extrato (pesquisa e lançamentos), com seletor de escopo no topo fixo.',
          es: 'Navegación segmentada en móviles dividida en Billetera (saldos y tarjetas), Planificación (DTI, presupuestos y vencimientos) y Extracto (búsqueda y movimientos), con selector de alcance en la barra fija.',
        },
      },
      {
        icon: 'Users',
        title: {
          pt: 'Sincronização Fiel da Família',
          es: 'Sincronización Fiel de la Familia',
        },
        description: {
          pt: 'Consulta vinculada ao grupo familiar ativo em todos os dispositivos, mapeamento correto de Administrador e Membros e bloqueio inteligente da secção redundante de entrada.',
          es: 'Consulta vinculada al grupo familiar activo en todos los dispositivos, asignación correcta de Administrador y Miembros y bloqueo inteligente de la sección redundante de unión.',
        },
      },
      {
        icon: 'Trash2',
        title: {
          pt: 'Exclusão Bilateral de Dívidas e Realtime',
          es: 'Eliminación Bilateral de Deudas y Realtime',
        },
        description: {
          pt: 'A exclusão de uma dívida ou empréstimo apaga automaticamente o registo recíproco espelho e transações associadas, sincronizando em tempo real com os demais utilizadores conectados.',
          es: 'La eliminación de una deuda o préstamo borra automáticamente el registro recíproco espejo y transacciones asociadas, sincronizándose en tiempo real con los demás usuarios conectados.',
        },
      },
      {
        icon: 'Layout',
        title: {
          pt: 'Barra Superior Desktop Otimizada',
          es: 'Barra Superior Desktop Optimizada',
        },
        description: {
          pt: 'Botões ergonómicos com texto e ícones claros para Leitor de Notificação, Câmbio e Dividir Conta, eliminando botões soltos redundantes.',
          es: 'Botones ergonómicos con texto e íconos claros para Lector de Notificaciones, Cambio y Dividir Cuenta, eliminando botones sueltos redundantes.',
        },
      },
    ],
  },
  {
    version: '1.8.1',
    releaseDate: '2026-09-18',
    title: {
      pt: 'Cotações Automáticas e Ajustes Visuais v1.8.1',
      es: 'Cotizaciones Automáticas y Ajustes Visuales v1.8.1',
    },
    highlights: [
      {
        icon: 'Coins',
        title: {
          pt: 'Cotações em Tempo Real via API',
          es: 'Cotizaciones en Tiempo Real por API',
        },
        description: {
          pt: 'Busca instantânea de taxas oficiais do dia para USD/PYG e USD/BRL no simulador de câmbio, com cache local de 12 horas e modo offline.',
          es: 'Consulta instantánea de tasas oficiales del día para USD/PYG y USD/BRL en el simulador de cambio, con caché local de 12 horas y modo offline.',
        },
      },
      {
        icon: 'Sparkles',
        title: {
          pt: 'Notificações Restritas a Versões Principais',
          es: 'Notificaciones Restringidas a Versiones Principales',
        },
        description: {
          pt: 'O modal automático e o badge numérico só alertam sobre lançamentos de funcionalidades (vX.Y.0), mantendo correções menores discretas no histórico.',
          es: 'El modal automático y el contador solo alertan sobre lanzamientos de funciones (vX.Y.0), manteniendo correcciones menores discretas en el historial.',
        },
      },
      {
        icon: 'CheckCircle2',
        title: {
          pt: 'Correção Integral de Traduções',
          es: 'Corrección Integral de Traducciones',
        },
        description: {
          pt: 'Ajuste de chaves em falta no termômetro DTI, botão rápido de notificações bancárias e botões de ação em português e espanhol.',
          es: 'Ajuste de claves faltantes en el termómetro DTI, botón rápido de notificaciones bancarias y botones de acción en portugués y español.',
        },
      },
    ],
  },
  {
    version: '1.8.0',
    releaseDate: '2026-09-18',
    title: {
      pt: 'Termômetro DTI, Calendário de Vencimentos, Leitor Bancário, Câmbio e Racha de Contas v1.8.0',
      es: 'Termómetro DTI, Calendario de Vencimientos, Lector Bancario, Cambio y Vaca v1.8.0',
    },
    highlights: [
      {
        icon: 'Activity',
        title: {
          pt: 'Termômetro DTI (% Endividamento) e Margem Segura',
          es: 'Termómetro DTI (% Endeudamiento) y Margen Seguro',
        },
        description: {
          pt: 'Monitore o percentual de comprometimento da sua renda (faturas de cartão, contas fixas e dívidas) com cálculo isolado para Minhas Contas ou Caixa da Família e sinalização de margem livre segura.',
          es: 'Monitoree el porcentaje de compromiso de su ingreso (tarjetas, gastos fijos y deudas) con cálculo aislado para Mis Cuentas o Caja Familiar y visualización del margen libre seguro.',
        },
      },
      {
        icon: 'Calendar',
        title: {
          pt: 'Calendário de Vencimentos e Projeção de Caixa',
          es: 'Calendario de Vencimientos y Proyección de Caja',
        },
        description: {
          pt: 'Linha do tempo cronológica com todos os compromissos futuros do mês (cartões, fixas e dívidas), comparando saídas acumuladas contra sua liquidez e alertando para risco de sobregiro.',
          es: 'Línea de tiempo cronológica con todos los compromisos futuros del mes (tarjetas, gastos fijos y deudas), comparando salidas acumuladas contra su liquidez y alertando sobre riesgo de sobregiro.',
        },
      },
      {
        icon: 'ClipboardPaste',
        title: {
          pt: 'Leitor Inteligente de Notificações Bancárias',
          es: 'Lector Inteligente de Notificaciones Bancarias',
        },
        description: {
          pt: 'Cole SMS ou push de bancos paraguaios (Itaú PY, Continental, Ueno, Familiar, Sudameris, SIPAP) e brasileiros (Nubank, PIX, Itaú, Bradesco, Inter) para preencher novos lançamentos com 1 toque.',
          es: 'Pegue SMS o alertas de bancos paraguayos (Itaú PY, Continental, Ueno, Familiar, Sudameris, SIPAP) y brasileños (Nubank, PIX, Itaú, Bradesco, Inter) para cargar transacciones con 1 toque.',
        },
      },
      {
        icon: 'Coins',
        title: {
          pt: 'Simulador de Câmbio & Cotações da Fronteira',
          es: 'Simulador de Cambio y Cotizaciones de Frontera',
        },
        description: {
          pt: 'Conversor simultâneo entre Guaranis (PYG), Dólares (USD) e Reais (BRL) com taxas base e comparador de compras que identifica a forma de pagamento mais econômica.',
          es: 'Conversor simultáneo entre Guaraníes (PYG), Dólares (USD) y Reales (BRL) con tasas base y comparador de compras que detecta la forma de pago más económica.',
        },
      },
      {
        icon: 'Share2',
        title: {
          pt: 'Divisão Rápida de Despesas (Racha de Conta)',
          es: 'División Rápida de Gastos (Vaca / Racha)',
        },
        description: {
          pt: 'Divida contas e gorjetas com amigos e gere mensagens formatadas para WhatsApp com sua Chave PIX (para gastos em BRL) ou Alias SIPAP (para PYG/USD) e botão para lançar sua parte.',
          es: 'Divida cuentas y propinas con amigos y genere mensajes para WhatsApp con su Clave PIX (para gastos en BRL) o Alias SIPAP (para PYG/USD) y botón para registrar su parte.',
        },
      },
    ],
  },
  {
    version: '1.7.1',
    releaseDate: '2026-09-18',
    title: {
      pt: 'Cabeçalho Flutuante Fixo (Sticky) e Navegação Aprimorada v1.7.1',
      es: 'Encabezado Fijo (Sticky) y Navegación Mejorada v1.7.1',
    },
    highlights: [
      {
        icon: 'Pin',
        title: {
          pt: 'Cabeçalho Sempre Visível',
          es: 'Encabezado Siempre Visible',
        },
        description: {
          pt: 'Aceda ao menu lateral, atalhos rápidos e ao logótipo a partir de qualquer ponto da página com efeito translúcido (Glassmorphism).',
          es: 'Acceda al menú lateral, accesos rápidos y al logotipo desde cualquier punto de la página con efecto translúcido (Glassmorphism).',
        },
      },
      {
        icon: 'MessageCircle',
        title: {
          pt: 'Suporte Direto Oficial',
          es: 'Soporte Directo Oficial',
        },
        description: {
          pt: 'Ligação direta do WhatsApp atualizada para o contacto oficial de assistência e melhorias do Kofre.',
          es: 'Enlace directo de WhatsApp actualizado para el contacto oficial de soporte y mejoras de Kofre.',
        },
      },
    ],
  },
  {
    version: '1.7.0',
    releaseDate: '2026-09-18',
    title: {
      pt: 'Menu Lateral Móvel, Dashboard Limpo e Zero Transbordo Lateral',
      es: 'Menú Lateral Móvil, Dashboard Limpio y Cero Desbordamiento Lateral',
    },
    highlights: [
      {
        icon: 'Smartphone',
        title: {
          pt: 'Menu Lateral Ergonómico (Drawer)',
          es: 'Menú Lateral Ergonómico (Drawer)',
        },
        description: {
          pt: 'Painel deslizante no telemóvel reunindo atalhos financeiros, alternador de tema e idioma, guia de início e suporte em um só lugar.',
          es: 'Panel deslizable en móviles reuniendo accesos directos financieros, alternador de tema e idioma, guía de inicio y soporte en un solo lugar.',
        },
      },
      {
        icon: 'Layout',
        title: {
          pt: 'Ocultação Inteligente de Cards Vazios',
          es: 'Ocultación Inteligente de Tarjetas Vacías',
        },
        description: {
          pt: 'Os widgets de Contas Fixas e Dívidas só são renderizados se contiverem pendências no escopo selecionado, deixando a tela limpa.',
          es: 'Los widgets de Gastos Fijos y Deudas solo se muestran si tienen movimientos en el alcance actual, manteniendo la vista despejada.',
        },
      },
      {
        icon: 'ShieldCheck',
        title: {
          pt: 'Zero Transbordo Horizontal no Telemóvel',
          es: 'Cero Desbordamiento Horizontal en Móviles',
        },
        description: {
          pt: 'Eliminação definitiva de margens e larguras que causavam deslocamento horizontal involuntário na navegação em ecrãs pequenos.',
          es: 'Eliminación definitiva de márgenes y anchos que causaban deslizamiento horizontal involuntario en pantallas pequeñas.',
        },
      },
    ],
  },
  {
    version: '1.6.0',
    releaseDate: '2026-09-18',
    title: {
      pt: 'Calculadora no Montante, Sugestão de Categorias e Ciclo Flexível',
      es: 'Calculadora en Monto, Sugerencia de Categorías y Ciclo Flexible',
    },
    highlights: [
      {
        icon: 'Calculator',
        title: {
          pt: 'Calculadora no Campo de Valor',
          es: 'Calculadora en el Campo de Monto',
        },
        description: {
          pt: 'Efetue somas, subtrações e multiplicações diretamente ao lançar transações com pré-visualização instantânea.',
          es: 'Realice sumas, restas y multiplicaciones directamente al registrar transacciones con vista previa en tiempo real.',
        },
      },
      {
        icon: 'Sparkles',
        title: {
          pt: 'Sugestão Preditiva de Categorias',
          es: 'Sugerencia Predictiva de Categorías',
        },
        description: {
          pt: 'Deteção e seleção automática de categorias com base nas palavras-chave da descrição digitada.',
          es: 'Detección y selección automática de categorías basada en las palabras clave de la descripción ingresada.',
        },
      },
      {
        icon: 'Calendar',
        title: {
          pt: 'Ciclo Mensal Flexível',
          es: 'Ciclo Mensual Flexible',
        },
        description: {
          pt: 'Defina no perfil o dia de corte do seu mês orçamental para acompanhar seus gastos alinhados ao seu salário.',
          es: 'Defina en su perfil el día de corte de su mes presupuestario para controlar sus gastos alineados a su salario.',
        },
      },
      {
        icon: 'ShieldCheck',
        title: {
          pt: 'Interface Refinada',
          es: 'Interfaz Refinada',
        },
        description: {
          pt: 'Cabeçalho simplificado e ampliado para melhor leitura, com botão direto para retornar ao topo do Dashboard.',
          es: 'Encabezado simplificado y ampliado para mejor lectura, con acceso directo para volver arriba en el Dashboard.',
        },
      },
    ],
  },
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

export function isFeatureVersion(version: string): boolean {
  const parts = version.split('.')
  return parts.length >= 3 && parts[2] === '0'
}

export function getBranchVersion(version: string): string {
  const parts = version.split('.')
  return `${parts[0]}.${parts[1] || '0'}.0`
}

export function getLatestFeatureRelease(): ChangelogRelease {
  const featureRelease = CHANGELOG_DATA.find((r) => isFeatureVersion(r.version))
  return featureRelease || CHANGELOG_DATA[0]
}

export function getLastSeenFeatureVersion(): string | null {
  try {
    const featureVer = localStorage.getItem('kofre_last_seen_feature_version')
    if (featureVer) return featureVer

    const legacyVer = localStorage.getItem('kofre_last_seen_version')
    if (legacyVer) {
      return getBranchVersion(legacyVer)
    }
  } catch {
    // Falha ao ler localStorage
  }
  return null
}

export function getUnseenFeatureReleases(): ChangelogRelease[] {
  try {
    const lastSeen = getLastSeenFeatureVersion()
    const featureReleases = CHANGELOG_DATA.filter((r) => isFeatureVersion(r.version))
    if (featureReleases.length === 0) return []

    const latestFeature = featureReleases[0]

    // Se nunca viu antes, exibe o destaque da versão de funcionalidades atual
    if (!lastSeen) {
      return [latestFeature]
    }

    // Se já viu a versão de funcionalidades do ramo atual (ou posterior)
    if (lastSeen === latestFeature.version) {
      return []
    }

    const index = featureReleases.findIndex((r) => r.version === lastSeen)
    if (index === -1) {
      return [latestFeature]
    }

    return featureReleases.slice(0, index)
  } catch {
    return []
  }
}

export function getUnseenReleases(): ChangelogRelease[] {
  return getUnseenFeatureReleases()
}

export function getUnseenCount(): number {
  return getUnseenFeatureReleases().length
}
