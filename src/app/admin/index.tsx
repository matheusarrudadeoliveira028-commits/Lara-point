import { Redirect } from 'expo-router';
import {
    Ban,
    CheckCircle2,
    LogOut,
    RefreshCw,
    RotateCcw,
    ShieldAlert,
    Sliders,
    Store,
    Ticket,
    TrendingUp,
    Users,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

interface LojaAdmin {
  id: string;
  nome: string;
  segmento: string;
  cidade: string | null;
  assinatura_status: 'ativa' | 'pendente' | 'bloqueada';
  valor_mensalidade: number;
  vencimento_assinatura: string | null;
  cota_mensal_pontos: number;
  max_pontos_por_lancamento: number;
  max_lancamentos_dia_cliente: number;
  perfis?: {
    nome: string;
    email: string | null;
    telefone: string | null;
  } | null;
}

interface MovAuditoria {
  id: string;
  loja_id: string | null;
  tipo: 'ganho' | 'resgate' | 'estorno';
  pontos: number;
  descricao: string;
  estornada: boolean;
  alerta_fraude: boolean;
  criado_em: string;
  lojas?: { nome: string } | null;
  perfis?: { nome: string; codigo_cliente: string } | null;
}

interface ResgateAdmin {
  id: string;
  codigo_voucher: string;
  pontos_usados: number;
  status: 'pendente' | 'validado' | 'cancelado';
  criado_em: string;
  validado_em: string | null;
  lojas?: { nome: string } | null;
  produtos?: { titulo: string } | null;
  perfis?: { nome: string; codigo_cliente: string } | null;
}

export default function AdminHomeScreen() {
  const { session, perfil, loading: authLoading, sair } = useAuth();

  const [aba, setAba] = useState<'lojas' | 'auditoria' | 'vouchers'>('lojas');
  const [filtroAuditoria, setFiltroAuditoria] = useState<'todos' | 'alertas'>('todos');

  const [lojas, setLojas] = useState<LojaAdmin[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<MovAuditoria[]>([]);
  const [resgates, setResgates] = useState<ResgateAdmin[]>([]);
  const [totalClientes, setTotalClientes] = useState(0);
  const [usoMensalPorLoja, setUsoMensalPorLoja] = useState<Record<string, number>>({});

  // Edição de limites anti-fraude de uma loja
  const [editandoLojaId, setEditandoLojaId] = useState<string | null>(null);
  const [editTeto, setEditTeto] = useState('');
  const [editCota, setEditCota] = useState('');
  const [editDia, setEditDia] = useState('');
  const [editMensalidade, setEditMensalidade] = useState('');

  // Confirmação de estorno
  const [confirmEstornoId, setConfirmEstornoId] = useState<string | null>(null);

  const [carregando, setCarregando] = useState(true);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [saindo, setSaindo] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const carregarTudo = useCallback(async () => {
    if (!perfil || perfil.tipo !== 'admin') return;
    setCarregando(true);

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const [lojasRes, movRes, resgRes, clientesRes] = await Promise.all([
      supabase
        .from('lojas')
        .select(
          'id, nome, segmento, cidade, assinatura_status, valor_mensalidade, vencimento_assinatura, cota_mensal_pontos, max_pontos_por_lancamento, max_lancamentos_dia_cliente, perfis(nome, email, telefone)'
        )
        .order('criado_em', { ascending: false }),

      supabase
        .from('movimentacoes_pontos')
        .select(
          'id, loja_id, tipo, pontos, descricao, estornada, alerta_fraude, criado_em, lojas(nome), perfis(nome, codigo_cliente)'
        )
        .eq('tipo', 'ganho')
        .order('criado_em', { ascending: false })
        .limit(80),

      supabase
        .from('resgates')
        .select(
          'id, codigo_voucher, pontos_usados, status, criado_em, validado_em, lojas(nome), produtos(titulo), perfis(nome, codigo_cliente)'
        )
        .order('criado_em', { ascending: false })
        .limit(50),

      supabase
        .from('perfis')
        .select('id', { count: 'exact', head: true })
        .eq('tipo', 'cliente'),
    ]);

    if (lojasRes.data) setLojas(lojasRes.data as unknown as LojaAdmin[]);

    if (movRes.data) {
      const lista = movRes.data as unknown as MovAuditoria[];
      setMovimentacoes(lista);

      const mapa: Record<string, number> = {};
      lista.forEach((m) => {
        if (m.loja_id && !m.estornada && new Date(m.criado_em) >= inicioMes) {
          mapa[m.loja_id] = (mapa[m.loja_id] ?? 0) + m.pontos;
        }
      });
      setUsoMensalPorLoja(mapa);
    }

    if (resgRes.data) setResgates(resgRes.data as unknown as ResgateAdmin[]);
    setTotalClientes(clientesRes.count ?? 0);
    setCarregando(false);
  }, [perfil]);

  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  async function handleSair() {
    if (saindo) return;
    setSaindo(true);
    try {
      await sair();
    } finally {
      setSaindo(false);
    }
  }

  async function atualizarAssinatura(
    loja: LojaAdmin,
    novoStatus: 'ativa' | 'bloqueada'
  ) {
    setMsg(null);
    setProcessandoId(loja.id);

    const payload: Record<string, unknown> = { assinatura_status: novoStatus };
    if (novoStatus === 'ativa') {
      const base =
        loja.vencimento_assinatura && new Date(loja.vencimento_assinatura) > new Date()
          ? new Date(loja.vencimento_assinatura)
          : new Date();
      base.setDate(base.getDate() + 30);
      payload.vencimento_assinatura = base.toISOString();
    }

    const { error } = await supabase.from('lojas').update(payload).eq('id', loja.id);
    setProcessandoId(null);

    if (error) {
      setMsg({ tipo: 'erro', texto: error.message });
      return;
    }

    setMsg({
      tipo: 'ok',
      texto:
        novoStatus === 'ativa'
          ? `${loja.nome} ativada / renovada por +30 dias!`
          : `${loja.nome} bloqueada com sucesso.`,
    });
    await carregarTudo();
  }

  function abrirEdicaoLimites(loja: LojaAdmin) {
    if (editandoLojaId === loja.id) {
      setEditandoLojaId(null);
      return;
    }
    setEditandoLojaId(loja.id);
    setEditTeto(String(loja.max_pontos_por_lancamento));
    setEditCota(String(loja.cota_mensal_pontos));
    setEditDia(String(loja.max_lancamentos_dia_cliente));
    setEditMensalidade(String(loja.valor_mensalidade));
  }

  async function salvarLimites(lojaId: string) {
    setMsg(null);
    const teto = parseInt(editTeto, 10);
    const cota = parseInt(editCota, 10);
    const dia = parseInt(editDia, 10);
    const mensal = Number(editMensalidade.replace(',', '.'));

    if (!teto || !cota || !dia || !mensal) {
      setMsg({ tipo: 'erro', texto: 'Preencha todos os campos de limite com valores válidos.' });
      return;
    }

    setProcessandoId(lojaId);
    const { error } = await supabase
      .from('lojas')
      .update({
        max_pontos_por_lancamento: teto,
        cota_mensal_pontos: cota,
        max_lancamentos_dia_cliente: dia,
        valor_mensalidade: mensal,
      })
      .eq('id', lojaId);
    setProcessandoId(null);

    if (error) {
      setMsg({ tipo: 'erro', texto: error.message });
      return;
    }

    setEditandoLojaId(null);
    setMsg({ tipo: 'ok', texto: 'Limites anti-fraude e mensalidade atualizados!' });
    await carregarTudo();
  }

  async function handleEstornar(movId: string) {
    setMsg(null);
    setProcessandoId(movId);
    const { error } = await supabase.rpc('estornar_movimentacao', {
      p_mov_id: movId,
      p_motivo: 'Auditoria anti-fraude',
    });
    setProcessandoId(null);
    setConfirmEstornoId(null);

    if (error) {
      setMsg({ tipo: 'erro', texto: error.message });
      return;
    }

    setMsg({ tipo: 'ok', texto: 'Lançamento estornado! Pontos removidos da conta do cliente.' });
    await carregarTudo();
  }

  function formatarData(iso: string | null) {
    if (!iso) return 'Não definido';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatarDataCurta(iso: string | null) {
    if (!iso) return 'Sem vencimento';
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  if (authLoading || saindo) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#C94A29" />
      </SafeAreaView>
    );
  }

  if (!session) return <Redirect href="/" />;
  if (perfil && perfil.tipo !== 'admin') return <Redirect href="/" />;

  const lojasAtivas = lojas.filter((l) => l.assinatura_status === 'ativa');
  const receitaMensal = lojasAtivas.reduce(
    (acc, l) => acc + Number(l.valor_mensalidade || 0),
    0
  );
  const totalAlertas = movimentacoes.filter((m) => m.alerta_fraude && !m.estornada).length;
  const movsExibidas =
    filtroAuditoria === 'alertas'
      ? movimentacoes.filter((m) => m.alerta_fraude)
      : movimentacoes;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>GESTÃO LARA PONT</Text>
              </View>
              <Text style={styles.title}>Painel Admin</Text>
            </View>

            <View style={styles.headerActions}>
              <Pressable style={styles.iconBtn} onPress={carregarTudo}>
                <RefreshCw size={16} color="#141414" />
              </Pressable>
              <Pressable style={styles.logoutBtn} onPress={handleSair}>
                <LogOut size={16} color="#141414" />
                <Text style={styles.logoutText}>Sair</Text>
              </Pressable>
            </View>
          </View>

          {/* KPIs */}
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCardDark}>
              <View style={styles.kpiTop}>
                <TrendingUp size={15} color="#C94A29" />
                <Text style={styles.kpiLabelDark}>Receita mensal</Text>
              </View>
              <Text style={styles.kpiValueDark}>
                R$ {receitaMensal.toFixed(2).replace('.', ',')}
              </Text>
              <Text style={styles.kpiSubDark}>
                {lojasAtivas.length} de {lojas.length} lojas ativas
              </Text>
            </View>

            <View style={styles.kpiCard}>
              <View style={styles.kpiTop}>
                <Users size={15} color="#141414" />
                <Text style={styles.kpiLabel}>Base e Segurança</Text>
              </View>
              <Text style={styles.kpiValue}>{totalClientes} clientes</Text>
              <Text
                style={[
                  styles.kpiSub,
                  totalAlertas > 0 && { color: '#B42318', fontWeight: '700' },
                ]}
              >
                {totalAlertas > 0
                  ? `${totalAlertas} alerta(s) anti-fraude`
                  : 'Nenhum alerta aberto'}
              </Text>
            </View>
          </View>

          {/* Abas */}
          <View style={styles.tabBar}>
            <Pressable
              style={[styles.tabBtn, aba === 'lojas' && styles.tabBtnActive]}
              onPress={() => setAba('lojas')}
            >
              <Store size={15} color={aba === 'lojas' ? '#FFFFFF' : '#141414'} />
              <Text style={[styles.tabText, aba === 'lojas' && styles.tabTextActive]}>
                Lojas ({lojas.length})
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tabBtn, aba === 'auditoria' && styles.tabBtnActive]}
              onPress={() => setAba('auditoria')}
            >
              <ShieldAlert size={15} color={aba === 'auditoria' ? '#FFFFFF' : '#141414'} />
              <Text style={[styles.tabText, aba === 'auditoria' && styles.tabTextActive]}>
                Anti-Fraude {totalAlertas > 0 ? `(${totalAlertas})` : ''}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tabBtn, aba === 'vouchers' && styles.tabBtnActive]}
              onPress={() => setAba('vouchers')}
            >
              <Ticket size={15} color={aba === 'vouchers' ? '#FFFFFF' : '#141414'} />
              <Text style={[styles.tabText, aba === 'vouchers' && styles.tabTextActive]}>
                Vouchers
              </Text>
            </Pressable>
          </View>

          {msg ? (
            <View
              style={[
                styles.msgBox,
                msg.tipo === 'erro' ? styles.msgErro : styles.msgOk,
              ]}
            >
              <Text
                style={[
                  styles.msgText,
                  msg.tipo === 'erro' ? styles.msgTextErro : styles.msgTextOk,
                ]}
              >
                {msg.texto}
              </Text>
            </View>
          ) : null}

          {carregando ? (
            <ActivityIndicator size="large" color="#C94A29" style={{ marginTop: 40 }} />
          ) : null}

          {/* ABA 1: LOJAS E MENSALIDADES */}
          {!carregando && aba === 'lojas' ? (
            lojas.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Nenhuma loja cadastrada</Text>
                <Text style={styles.emptyDesc}>
                  Assim que estabelecimentos se cadastrarem como Loja Parceira, eles aparecerão aqui para aprovação e controle de mensalidade.
                </Text>
              </View>
            ) : (
              lojas.map((l) => {
                const ativa = l.assinatura_status === 'ativa';
                const emitidoMes = usoMensalPorLoja[l.id] ?? 0;
                const percCota = Math.min(
                  (emitidoMes / Math.max(l.cota_mensal_pontos, 1)) * 100,
                  100
                );
                const editando = editandoLojaId === l.id;

                return (
                  <View key={l.id} style={styles.card}>
                    <View style={styles.cardTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.storeName}>{l.nome}</Text>
                        <Text style={styles.storeMeta}>
                          {l.segmento}
                          {l.cidade ? ` • ${l.cidade}` : ''} • R${' '}
                          {Number(l.valor_mensalidade).toFixed(2).replace('.', ',')}/mês
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          ativa
                            ? styles.badgeOk
                            : l.assinatura_status === 'bloqueada'
                            ? styles.badgeErr
                            : styles.badgeWarn,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            ativa
                              ? { color: '#1F7A4C' }
                              : l.assinatura_status === 'bloqueada'
                              ? { color: '#B42318' }
                              : { color: '#92400E' },
                          ]}
                        >
                          {l.assinatura_status.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.ownerText}>
                      Resp.: <Text style={styles.bold}>{l.perfis?.nome ?? '---'}</Text> •{' '}
                      {l.perfis?.telefone ?? l.perfis?.email ?? ''}
                    </Text>
                    <Text style={styles.ownerText}>
                      Vencimento: <Text style={styles.bold}>{formatarDataCurta(l.vencimento_assinatura)}</Text>
                    </Text>

                    {/* Barra de cota mensal anti-fraude */}
                    <View style={styles.quotaBox}>
                      <View style={styles.quotaHeader}>
                        <Text style={styles.quotaLabel}>
                          Cota mensal usada: {emitidoMes.toLocaleString('pt-BR')} /{' '}
                          {l.cota_mensal_pontos.toLocaleString('pt-BR')} pts
                        </Text>
                        <Text style={styles.quotaLabel}>
                          Teto: {l.max_pontos_por_lancamento} pts/vez
                        </Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${percCota}%` },
                            percCota >= 85 && { backgroundColor: '#B42318' },
                          ]}
                        />
                      </View>
                    </View>

                    {/* Botões de ação */}
                    <View style={styles.actionRow}>
                      <Pressable
                        style={styles.btnApprove}
                        onPress={() => atualizarAssinatura(l, 'ativa')}
                        disabled={processandoId === l.id}
                      >
                        <CheckCircle2 size={14} color="#FFFFFF" />
                        <Text style={styles.btnTextWhite}>
                          {ativa ? 'Renovar +30d' : 'Ativar +30d'}
                        </Text>
                      </Pressable>

                      {l.assinatura_status !== 'bloqueada' ? (
                        <Pressable
                          style={styles.btnBlock}
                          onPress={() => atualizarAssinatura(l, 'bloqueada')}
                          disabled={processandoId === l.id}
                        >
                          <Ban size={14} color="#B42318" />
                          <Text style={styles.btnTextDanger}>Bloquear</Text>
                        </Pressable>
                      ) : null}

                      <Pressable
                        style={styles.btnNeutral}
                        onPress={() => abrirEdicaoLimites(l)}
                      >
                        <Sliders size={14} color="#141414" />
                        <Text style={styles.btnTextDark}>Limites</Text>
                      </Pressable>
                    </View>

                    {editando ? (
                      <View style={styles.editPanel}>
                        <Text style={styles.editTitle}>Travas anti-fraude desta loja</Text>
                        <View style={styles.editGrid}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.miniLabel}>Teto por lançamento</Text>
                            <TextInput
                              style={styles.miniInput}
                              keyboardType="numeric"
                              value={editTeto}
                              onChangeText={setEditTeto}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.miniLabel}>Cota mensal (pts)</Text>
                            <TextInput
                              style={styles.miniInput}
                              keyboardType="numeric"
                              value={editCota}
                              onChangeText={setEditCota}
                            />
                          </View>
                        </View>

                        <View style={styles.editGrid}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.miniLabel}>Máx. lanç./dia por cliente</Text>
                            <TextInput
                              style={styles.miniInput}
                              keyboardType="numeric"
                              value={editDia}
                              onChangeText={setEditDia}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.miniLabel}>Mensalidade (R$)</Text>
                            <TextInput
                              style={styles.miniInput}
                              keyboardType="numeric"
                              value={editMensalidade}
                              onChangeText={setEditMensalidade}
                            />
                          </View>
                        </View>

                        <Pressable
                          style={styles.saveLimitsBtn}
                          onPress={() => salvarLimites(l.id)}
                        >
                          <Text style={styles.btnTextWhite}>Salvar configurações</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })
            )
          ) : null}

          {/* ABA 2: AUDITORIA ANTI-FRAUDE */}
          {!carregando && aba === 'auditoria' ? (
            <>
              <View style={styles.subFilterRow}>
                <Pressable
                  style={[
                    styles.subFilterBtn,
                    filtroAuditoria === 'todos' && styles.subFilterBtnActive,
                  ]}
                  onPress={() => setFiltroAuditoria('todos')}
                >
                  <Text
                    style={[
                      styles.subFilterText,
                      filtroAuditoria === 'todos' && styles.subFilterTextActive,
                    ]}
                  >
                    Todos lançamentos ({movimentacoes.length})
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.subFilterBtn,
                    filtroAuditoria === 'alertas' && styles.subFilterBtnActive,
                  ]}
                  onPress={() => setFiltroAuditoria('alertas')}
                >
                  <Text
                    style={[
                      styles.subFilterText,
                      filtroAuditoria === 'alertas' && styles.subFilterTextActive,
                    ]}
                  >
                    Só alertas ({movimentacoes.filter((m) => m.alerta_fraude).length})
                  </Text>
                </Pressable>
              </View>

              {movsExibidas.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Nenhum lançamento encontrado</Text>
                  <Text style={styles.emptyDesc}>
                    Os lançamentos de pontos feitos pelas lojas parceiras aparecerão aqui para auditoria e eventual estorno.
                  </Text>
                </View>
              ) : (
                movsExibidas.map((m) => {
                  const confirmando = confirmEstornoId === m.id;
                  return (
                    <View
                      key={m.id}
                      style={[
                        styles.auditCard,
                        m.alerta_fraude && !m.estornada && styles.auditCardAlert,
                        m.estornada && { opacity: 0.65 },
                      ]}
                    >
                      <View style={styles.cardTopRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.auditStore}>
                            {m.lojas?.nome ?? 'Loja'} → {m.perfis?.nome ?? 'Cliente'} (
                            {m.perfis?.codigo_cliente ?? '---'})
                          </Text>
                          <Text style={styles.auditDesc}>
                            {m.descricao} • {formatarData(m.criado_em)}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.auditPts,
                            m.estornada && {
                              textDecorationLine: 'line-through',
                              color: '#7A776F',
                            },
                          ]}
                        >
                          +{m.pontos} pts
                        </Text>
                      </View>

                      <View style={styles.auditFooter}>
                        {m.estornada ? (
                          <View style={[styles.statusBadge, styles.badgeErr]}>
                            <Text style={[styles.statusBadgeText, { color: '#B42318' }]}>
                              ESTORNADO
                            </Text>
                          </View>
                        ) : m.alerta_fraude ? (
                          <View style={[styles.statusBadge, styles.badgeWarn]}>
                            <Text style={[styles.statusBadgeText, { color: '#92400E' }]}>
                              VALOR ALTO — VERIFICAR
                            </Text>
                          </View>
                        ) : (
                          <View style={[styles.statusBadge, styles.badgeOk]}>
                            <Text style={[styles.statusBadgeText, { color: '#1F7A4C' }]}>
                              NORMAL
                            </Text>
                          </View>
                        )}

                        {!m.estornada ? (
                          confirmando ? (
                            <View style={{ flexDirection: 'row', gap: 6 }}>
                              <Pressable
                                style={styles.btnNeutral}
                                onPress={() => setConfirmEstornoId(null)}
                              >
                                <Text style={styles.btnTextDark}>Cancelar</Text>
                              </Pressable>
                              <Pressable
                                style={styles.btnDangerSolid}
                                onPress={() => handleEstornar(m.id)}
                                disabled={processandoId === m.id}
                              >
                                <Text style={styles.btnTextWhite}>Confirmar estorno</Text>
                              </Pressable>
                            </View>
                          ) : (
                            <Pressable
                              style={styles.btnBlock}
                              onPress={() => setConfirmEstornoId(m.id)}
                            >
                              <RotateCcw size={13} color="#B42318" />
                              <Text style={styles.btnTextDanger}>Estornar</Text>
                            </Pressable>
                          )
                        ) : null}
                      </View>
                    </View>
                  );
                })
              )}
            </>
          ) : null}

          {/* ABA 3: VOUCHERS DA REDE */}
          {!carregando && aba === 'vouchers' ? (
            resgates.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Nenhum voucher emitido ainda</Text>
                <Text style={styles.emptyDesc}>
                  Todos os resgates feitos pelos clientes nas lojas parceiras aparecem aqui.
                </Text>
              </View>
            ) : (
              resgates.map((r) => (
                <View key={r.id} style={styles.auditCard}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.storeName}>{r.codigo_voucher}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        r.status === 'validado' ? styles.badgeOk : styles.badgeWarn,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          r.status === 'validado'
                            ? { color: '#1F7A4C' }
                            : { color: '#92400E' },
                        ]}
                      >
                        {r.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.auditStore}>
                    {r.produtos?.titulo ?? 'Resgate'} • {r.lojas?.nome ?? 'Loja'}
                  </Text>
                  <Text style={styles.auditDesc}>
                    Cliente: {r.perfis?.nome ?? '---'} ({r.perfis?.codigo_cliente ?? '---'}) •{' '}
                    {r.pontos_usados} pts • {formatarData(r.criado_em)}
                  </Text>
                </View>
              ))
            )
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F4F0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F4F0' },
  scroll: { padding: 20, paddingBottom: 40 },
  container: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  adminBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#C94A29',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  adminBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  title: { fontSize: 26, fontWeight: '800', color: '#141414' },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E2DC',
    padding: 9,
    borderRadius: 10,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E2DC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  logoutText: { fontSize: 13, fontWeight: '600', color: '#141414' },
  kpiGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  kpiCardDark: {
    flex: 1,
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E2DC',
  },
  kpiTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  kpiLabelDark: { color: '#A3A199', fontSize: 12, fontWeight: '600' },
  kpiValueDark: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  kpiSubDark: { color: '#A3A199', fontSize: 11, marginTop: 4 },
  kpiLabel: { color: '#6B6860', fontSize: 12, fontWeight: '600' },
  kpiValue: { color: '#141414', fontSize: 22, fontWeight: '800' },
  kpiSub: { color: '#6B6860', fontSize: 11, marginTop: 4 },
  tabBar: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E2DC',
  },
  tabBtnActive: { backgroundColor: '#141414', borderColor: '#141414' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#141414' },
  tabTextActive: { color: '#FFFFFF' },
  msgBox: { padding: 12, borderRadius: 10, marginBottom: 14 },
  msgOk: { backgroundColor: '#E8F5EE' },
  msgErro: { backgroundColor: '#FDECEB' },
  msgText: { fontSize: 13, fontWeight: '600' },
  msgTextOk: { color: '#1F7A4C' },
  msgTextErro: { color: '#B42318' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E2DC',
    marginBottom: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  storeName: { fontSize: 17, fontWeight: '800', color: '#141414' },
  storeMeta: { fontSize: 12, color: '#6B6860', marginTop: 2 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99 },
  badgeOk: { backgroundColor: '#E8F5EE' },
  badgeWarn: { backgroundColor: '#FEF3C7' },
  badgeErr: { backgroundColor: '#FDECEB' },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  ownerText: { fontSize: 12, color: '#57554E', marginBottom: 3 },
  bold: { fontWeight: '700', color: '#141414' },
  quotaBox: {
    backgroundColor: '#FAF9F6',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EFECE6',
  },
  quotaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  quotaLabel: { fontSize: 11, fontWeight: '600', color: '#57554E' },
  progressTrack: {
    height: 6,
    backgroundColor: '#E4E2DC',
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#1F7A4C', borderRadius: 99 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btnApprove: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1F7A4C',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 9,
  },
  btnBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FDECEB',
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 9,
  },
  btnDangerSolid: {
    backgroundColor: '#B42318',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 9,
  },
  btnNeutral: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFECE6',
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 9,
  },
  btnTextWhite: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  btnTextDanger: { color: '#B42318', fontSize: 12, fontWeight: '700' },
  btnTextDark: { color: '#141414', fontSize: 12, fontWeight: '700' },
  editPanel: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#EFECE6',
  },
  editTitle: { fontSize: 13, fontWeight: '800', color: '#141414', marginBottom: 10 },
  editGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  miniLabel: { fontSize: 11, fontWeight: '600', color: '#57554E', marginBottom: 4 },
  miniInput: {
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#D8D5CD',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#141414',
  },
  saveLimitsBtn: {
    backgroundColor: '#141414',
    paddingVertical: 11,
    borderRadius: 9,
    alignItems: 'center',
    marginTop: 4,
  },
  subFilterRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  subFilterBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8D5CD',
    alignItems: 'center',
  },
  subFilterBtnActive: { backgroundColor: '#141414', borderColor: '#141414' },
  subFilterText: { fontSize: 12, fontWeight: '700', color: '#141414' },
  subFilterTextActive: { color: '#FFFFFF' },
  auditCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E4E2DC',
    marginBottom: 10,
  },
  auditCardAlert: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFDF7',
  },
  auditStore: { fontSize: 14, fontWeight: '700', color: '#141414' },
  auditDesc: { fontSize: 12, color: '#6B6860', marginTop: 2 },
  auditPts: { fontSize: 16, fontWeight: '800', color: '#1F7A4C' },
  auditFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0EDE7',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E4E2DC',
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#141414', marginBottom: 6 },
  emptyDesc: { fontSize: 13, lineHeight: 19, color: '#6B6860' },
});