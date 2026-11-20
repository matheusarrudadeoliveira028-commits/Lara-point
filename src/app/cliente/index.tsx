import { Redirect } from 'expo-router';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  Flame,
  Gift,
  LogOut,
  MapPin,
  MessageCircle,
  QrCode,
  RefreshCw,
  Share2,
  ShoppingBag,
  Store,
  Ticket,
  Trophy,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

interface MovimentacaoDB {
  id: string;
  tipo: 'ganho' | 'resgate' | 'estorno' | 'bonus';
  pontos: number;
  descricao: string;
  estornada?: boolean;
  criado_em: string;
  lojas?: { nome: string; segmento?: string } | null;
}

interface LojaDB {
  id: string;
  nome: string;
  segmento: string;
  cidade: string | null;
  endereco: string | null;
  whatsapp: string | null;
  pontos_por_real: number;
  pontos_em_dobro: boolean;
}

interface ProdutoDB {
  id: string;
  loja_id: string;
  titulo: string;
  descricao: string | null;
  categoria: string;
  pontos_necessarios: number;
  valor_referencia: number | null;
  tipo_resgate: 'total' | 'desconto';
  compra_minima: number | null;
  estoque: number | null;
  lojas: {
    id: string;
    nome: string;
    segmento: string;
    cidade: string | null;
    assinatura_status: string;
  } | null;
}

interface ResgateDB {
  id: string;
  codigo_voucher: string;
  pontos_usados: number;
  status: 'pendente' | 'validado' | 'cancelado';
  criado_em: string;
  validado_em: string | null;
  produtos?: { titulo: string } | null;
  lojas?: { nome: string; whatsapp: string | null } | null;
}

const SEGMENTOS_FILTRO = [
  'Todos',
  'Tatuagem',
  'Alimentação',
  'Moda',
  'Barbearia',
  'Estética',
  'Serviços',
  'Outros',
];

export default function ClienteHomeScreen() {
  const { session, perfil, loading: authLoading, sair } = useAuth();

  const [aba, setAba] = useState<'carteira' | 'lojas' | 'explorar' | 'vouchers'>('carteira');
  const [segmento, setSegmento] = useState('Todos');
  const [lojaSelecionada, setLojaSelecionada] = useState<{ id: string; nome: string } | null>(null);
  const [filtroVoucher, setFiltroVoucher] = useState<'todos' | 'pendente' | 'validado'>('todos');
  const [mostrarQrCarteira, setMostrarQrCarteira] = useState(false);

  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoDB[]>([]);
  const [lojas, setLojas] = useState<LojaDB[]>([]);
  const [produtos, setProdutos] = useState<ProdutoDB[]>([]);
  const [resgates, setResgates] = useState<ResgateDB[]>([]);
  const [missaoResgatadaMes, setMissaoResgatadaMes] = useState(false);

  const [carregando, setCarregando] = useState(true);
  const [saindo, setSaindo] = useState(false);
  const [resgatandoId, setResgatandoId] = useState<string | null>(null);
  const [resgatandoMissao, setResgatandoMissao] = useState(false);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const mesAtual = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const carregarTudo = useCallback(async () => {
    if (!perfil?.id) return;
    setCarregando(true);

    const [movRes, lojasRes, prodRes, resgRes, missaoRes] = await Promise.all([
      supabase
        .from('movimentacoes_pontos')
        .select('id, tipo, pontos, descricao, estornada, criado_em, lojas(nome, segmento)')
        .eq('cliente_id', perfil.id)
        .order('criado_em', { ascending: false }),

      supabase
        .from('lojas')
        .select('id, nome, segmento, cidade, endereco, whatsapp, pontos_por_real, pontos_em_dobro')
        .eq('assinatura_status', 'ativa')
        .order('pontos_em_dobro', { ascending: false })
        .order('nome', { ascending: true }),

      supabase
        .from('produtos')
        .select(
          'id, loja_id, titulo, descricao, categoria, pontos_necessarios, valor_referencia, tipo_resgate, compra_minima, estoque, lojas(id, nome, segmento, cidade, assinatura_status)'
        )
        .eq('ativo', true)
        .order('pontos_necessarios', { ascending: true }),

      supabase
        .from('resgates')
        .select(
          'id, codigo_voucher, pontos_usados, status, criado_em, validado_em, produtos(titulo), lojas(nome, whatsapp)'
        )
        .eq('cliente_id', perfil.id)
        .order('criado_em', { ascending: false }),

      supabase
        .from('missoes_resgatadas')
        .select('id')
        .eq('cliente_id', perfil.id)
        .eq('missao_codigo', '3_segmentos')
        .eq('mes_referencia', mesAtual)
        .maybeSingle(),
    ]);

    if (movRes.data) setMovimentacoes(movRes.data as unknown as MovimentacaoDB[]);
    if (lojasRes.data) setLojas(lojasRes.data as LojaDB[]);
    if (prodRes.data) {
      const ativos = (prodRes.data as unknown as ProdutoDB[]).filter(
        (p) => p.lojas?.assinatura_status === 'ativa'
      );
      setProdutos(ativos);
    }
    if (resgRes.data) setResgates(resgRes.data as unknown as ResgateDB[]);
    setMissaoResgatadaMes(Boolean(missaoRes.data));

    setCarregando(false);
  }, [perfil?.id, mesAtual]);

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

  async function handleResgatar(produto: ProdutoDB) {
    setFeedback(null);
    setResgatandoId(produto.id);

    const { data, error } = await supabase.rpc('resgatar_produto', {
      p_produto_id: produto.id,
    });

    setResgatandoId(null);
    setConfirmandoId(null);

    if (error) {
      setFeedback({ tipo: 'erro', texto: error.message });
      return;
    }

    const codigo = (data as { codigo_voucher?: string })?.codigo_voucher ?? '';
    setFeedback({
      tipo: 'ok',
      texto: `Resgate feito! Código do voucher: ${codigo}. Mostre o QR Code na loja.`,
    });
    await carregarTudo();
    setFiltroVoucher('todos');
    setAba('vouchers');
  }

  async function handleResgatarMissao() {
    setFeedback(null);
    setResgatandoMissao(true);
    const { error } = await supabase.rpc('resgatar_missao_segmentos');
    setResgatandoMissao(false);

    if (error) {
      setFeedback({ tipo: 'erro', texto: error.message });
      return;
    }

    setFeedback({
      tipo: 'ok',
      texto: 'Parabéns! +40 pontos bônus da Missão da Cidade creditados na sua carteira!',
    });
    await carregarTudo();
  }

  async function handleCompartilharIndicacao() {
    const code = perfil?.codigo_cliente ?? '';
    const texto = `Use meu código ${code} ao se cadastrar no Lara Pont! Na sua 1ª compra em qualquer loja parceira, nós dois ganhamos +25 pontos bônus.`;

    if (Platform.OS === 'web') {
      try {
        const nav = (globalThis as { navigator?: { clipboard?: { writeText: (t: string) => Promise<void> } } }).navigator;
        if (nav?.clipboard) {
          await nav.clipboard.writeText(texto);
          setFeedback({ tipo: 'ok', texto: `Convite copiado! Envie seu código ${code} no WhatsApp.` });
          return;
        }
      } catch {
        // fallback WhatsApp
      }
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(texto)}`);
      return;
    }

    await Share.share({ message: texto });
  }

  function abrirWhatsApp(numero: string | null | undefined, mensagem: string) {
    if (!numero) return;
    const limpo = numero.replace(/\D/g, '');
    const comDdi = limpo.startsWith('55') ? limpo : `55${limpo}`;
    Linking.openURL(`https://wa.me/${comDdi}?text=${encodeURIComponent(mensagem)}`);
  }

  if (authLoading || saindo) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#C94A29" />
      </SafeAreaView>
    );
  }

  if (!session) return <Redirect href="/" />;

  const saldoPontos = movimentacoes.reduce((acc, item) => acc + item.pontos, 0);
  const valorEstimado = saldoPontos / 10;

  // Cálculo da Missão da Cidade (segmentos únicos pontuados neste mês)
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const segmentosMesSet = new Set<string>();
  movimentacoes.forEach((m) => {
    if (
      m.tipo === 'ganho' &&
      !m.estornada &&
      m.lojas?.segmento &&
      new Date(m.criado_em) >= inicioMes
    ) {
      segmentosMesSet.add(m.lojas.segmento);
    }
  });
  const segmentosMes = Array.from(segmentosMesSet);
  const progressoMissao = Math.min((segmentosMes.length / 3) * 100, 100);

  const lojasFiltradas =
    segmento === 'Todos' ? lojas : lojas.filter((l) => l.segmento === segmento);

  const produtosFiltrados = produtos.filter((p) => {
    if (lojaSelecionada && p.loja_id !== lojaSelecionada.id) return false;
    if (segmento !== 'Todos' && p.lojas?.segmento !== segmento) return false;
    return true;
  });

  const totalPendentes = resgates.filter((r) => r.status === 'pendente').length;
  const totalValidados = resgates.filter((r) => r.status === 'validado').length;
  const resgatesFiltrados =
    filtroVoucher === 'todos' ? resgates : resgates.filter((r) => r.status === filtroVoucher);

  function formatarData(iso: string | null) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.container}>
          {/* Topo */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>
                Olá, {perfil?.nome?.split(' ')[0] ?? 'Cliente'}
              </Text>
              <Text style={styles.subGreeting}>
                Seu código: <Text style={styles.bold}>{perfil?.codigo_cliente ?? '...'}</Text>
              </Text>
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

          {/* Navegação 4 abas */}
          <View style={styles.tabBar}>
            <Pressable
              style={[styles.tabBtn, aba === 'carteira' && styles.tabBtnActive]}
              onPress={() => setAba('carteira')}
            >
              <CreditCard size={14} color={aba === 'carteira' ? '#FFFFFF' : '#141414'} />
              <Text style={[styles.tabText, aba === 'carteira' && styles.tabTextActive]}>
                Carteira
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tabBtn, aba === 'lojas' && styles.tabBtnActive]}
              onPress={() => setAba('lojas')}
            >
              <Store size={14} color={aba === 'lojas' ? '#FFFFFF' : '#141414'} />
              <Text style={[styles.tabText, aba === 'lojas' && styles.tabTextActive]}>
                Lojas
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tabBtn, aba === 'explorar' && styles.tabBtnActive]}
              onPress={() => setAba('explorar')}
            >
              <ShoppingBag size={14} color={aba === 'explorar' ? '#FFFFFF' : '#141414'} />
              <Text style={[styles.tabText, aba === 'explorar' && styles.tabTextActive]}>
                Trocar
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tabBtn, aba === 'vouchers' && styles.tabBtnActive]}
              onPress={() => setAba('vouchers')}
            >
              <Ticket size={14} color={aba === 'vouchers' ? '#FFFFFF' : '#141414'} />
              <Text style={[styles.tabText, aba === 'vouchers' && styles.tabTextActive]}>
                Vouchers{totalPendentes > 0 ? ` (${totalPendentes})` : ''}
              </Text>
            </Pressable>
          </View>

          {feedback ? (
            <View
              style={[
                styles.feedbackBox,
                feedback.tipo === 'erro' ? styles.feedbackErro : styles.feedbackOk,
              ]}
            >
              <Text
                style={[
                  styles.feedbackText,
                  feedback.tipo === 'erro' ? styles.feedbackTextErro : styles.feedbackTextOk,
                ]}
              >
                {feedback.texto}
              </Text>
            </View>
          ) : null}

          {carregando ? (
            <ActivityIndicator size="large" color="#C94A29" style={{ marginTop: 40 }} />
          ) : null}

          {/* ABA 1: CARTEIRA + QR CODE + MISSÃO + INDIQUE E GANHE */}
          {!carregando && aba === 'carteira' ? (
            <>
              <View style={styles.walletCard}>
                <View style={styles.walletTopRow}>
                  <View style={styles.cardTag}>
                    <Text style={styles.cardTagText}>ID: {perfil?.codigo_cliente}</Text>
                  </View>
                  <Pressable
                    style={styles.qrToggleBtn}
                    onPress={() => setMostrarQrCarteira((v) => !v)}
                  >
                    <QrCode size={14} color="#FFFFFF" />
                    <Text style={styles.qrToggleText}>
                      {mostrarQrCarteira ? 'Ocultar QR' : 'Meu QR Code'}
                    </Text>
                  </Pressable>
                </View>

                {mostrarQrCarteira && perfil?.codigo_cliente ? (
                  <View style={styles.qrWalletBox}>
                    <QRCode value={perfil.codigo_cliente} size={150} />
                    <Text style={styles.qrWalletCode}>{perfil.codigo_cliente}</Text>
                    <Text style={styles.qrWalletHint}>
                      Mostre este QR Code no caixa da loja parceira para receber seus pontos.
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.pointsLabel}>Saldo disponível</Text>
                <Text style={styles.pointsValue}>
                  {saldoPontos.toLocaleString('pt-BR')}{' '}
                  <Text style={styles.pointsUnit}>pts</Text>
                </Text>

                <View style={styles.divider} />

                <View style={styles.cashRow}>
                  <View>
                    <Text style={styles.cashLabel}>Referência em desconto</Text>
                    <Text style={styles.cashValue}>
                      R$ {valorEstimado.toFixed(2).replace('.', ',')}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.exploreCta}
                    onPress={() => {
                      setLojaSelecionada(null);
                      setAba('explorar');
                    }}
                  >
                    <Gift size={14} color="#FFFFFF" />
                    <Text style={styles.exploreCtaText}>Trocar pontos</Text>
                  </Pressable>
                </View>
              </View>

              {/* Card Missão da Cidade */}
              <View style={styles.missionCard}>
                <View style={styles.missionTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Trophy size={18} color="#C94A29" />
                    <Text style={styles.missionTitle}>Missão da Cidade (+40 pts)</Text>
                  </View>
                  <Text style={styles.missionCounter}>{segmentosMes.length}/3</Text>
                </View>
                <Text style={styles.missionDesc}>
                  Pontue em 3 segmentos diferentes neste mês para ganhar +40 pontos bônus.
                </Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressoMissao}%` }]} />
                </View>
                {segmentosMes.length > 0 ? (
                  <Text style={styles.missionDoneList}>
                    Concluídos: {segmentosMes.join(', ')}
                  </Text>
                ) : null}

                {missaoResgatadaMes ? (
                  <View style={styles.missionClaimedBadge}>
                    <CheckCircle2 size={14} color="#1F7A4C" />
                    <Text style={styles.missionClaimedText}>Bônus deste mês já resgatado!</Text>
                  </View>
                ) : segmentosMes.length >= 3 ? (
                  <Pressable
                    style={styles.missionBtn}
                    onPress={handleResgatarMissao}
                    disabled={resgatandoMissao}
                  >
                    <Text style={styles.missionBtnText}>
                      {resgatandoMissao ? 'Resgatando...' : 'Resgatar +40 pontos agora'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Card Indique e Ganhe */}
              <View style={styles.refCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.refTitle}>Indique amigos e ganhe +25 pts</Text>
                  <Text style={styles.refDesc}>
                    Compartilhe seu código <Text style={styles.bold}>{perfil?.codigo_cliente}</Text>. Na 1ª compra do seu amigo, os dois ganham +25 pontos.
                  </Text>
                </View>
                <Pressable style={styles.shareBtn} onPress={handleCompartilharIndicacao}>
                  <Share2 size={16} color="#FFFFFF" />
                  <Text style={styles.shareBtnText}>Convidar</Text>
                </Pressable>
              </View>

              <Text style={styles.sectionTitle}>Extrato de pontos</Text>

              {movimentacoes.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Nenhum ponto ainda</Text>
                  <Text style={styles.emptyDesc}>
                    Mostre seu QR Code ou informe o código{' '}
                    <Text style={styles.bold}>{perfil?.codigo_cliente}</Text> nas lojas parceiras.
                  </Text>
                </View>
              ) : (
                <View style={styles.listCard}>
                  {movimentacoes.map((item, idx) => {
                    const positivo = item.pontos >= 0;
                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.txRow,
                          idx < movimentacoes.length - 1 && styles.txRowBorder,
                        ]}
                      >
                        <View
                          style={[
                            styles.txIcon,
                            !positivo && { backgroundColor: '#FBEAE5' },
                          ]}
                        >
                          {positivo ? (
                            <ArrowDownLeft size={18} color="#1F7A4C" />
                          ) : (
                            <ArrowUpRight size={18} color="#C94A29" />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.txStore}>
                            {item.lojas?.nome ?? 'Bônus Lara Pont'}
                          </Text>
                          <Text style={styles.txDesc}>
                            {item.descricao} • {formatarData(item.criado_em)}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.txPoints,
                            !positivo && { color: '#C94A29' },
                          ]}
                        >
                          {positivo ? `+${item.pontos}` : item.pontos} pts
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          ) : null}

          {/* ABA 2: LOJAS PARCEIRAS */}
          {!carregando && aba === 'lojas' ? (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                {SEGMENTOS_FILTRO.map((seg) => {
                  const ativo = segmento === seg;
                  return (
                    <Pressable
                      key={seg}
                      style={[styles.chip, ativo && styles.chipActive]}
                      onPress={() => setSegmento(seg)}
                    >
                      <Text style={[styles.chipText, ativo && styles.chipTextActive]}>
                        {seg}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {lojasFiltradas.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Nenhuma loja neste segmento</Text>
                  <Text style={styles.emptyDesc}>
                    Em breve novos estabelecimentos parceiros entrarão nesta categoria.
                  </Text>
                </View>
              ) : (
                lojasFiltradas.map((loja) => (
                  <View key={loja.id} style={styles.storeCard}>
                    <View style={styles.productTop}>
                      <View style={styles.segBadge}>
                        <Text style={styles.segBadgeText}>{loja.segmento}</Text>
                      </View>
                      {loja.pontos_em_dobro ? (
                        <View style={styles.doublePill}>
                          <Flame size={12} color="#FFFFFF" />
                          <Text style={styles.doublePillText}>2x PONTOS HOJE</Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={styles.productTitle}>{loja.nome}</Text>

                    <Text style={styles.storeRule}>
                      Ganhe{' '}
                      <Text style={styles.bold}>
                        {loja.pontos_em_dobro
                          ? Number(loja.pontos_por_real) * 2
                          : loja.pontos_por_real}{' '}
                        pt(s)
                      </Text>{' '}
                      a cada R$ 1,00 gasto
                    </Text>

                    {loja.endereco || loja.cidade ? (
                      <View style={styles.addrRow}>
                        <MapPin size={13} color="#6B6860" />
                        <Text style={styles.addrText}>
                          {[loja.endereco, loja.cidade].filter(Boolean).join(' • ')}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.storeActions}>
                      <Pressable
                        style={styles.storeProductsBtn}
                        onPress={() => {
                          setLojaSelecionada({ id: loja.id, nome: loja.nome });
                          setSegmento('Todos');
                          setAba('explorar');
                        }}
                      >
                        <ShoppingBag size={14} color="#FFFFFF" />
                        <Text style={styles.redeemBtnText}>Ver produtos</Text>
                      </Pressable>

                      {loja.whatsapp ? (
                        <Pressable
                          style={styles.whatsBtn}
                          onPress={() =>
                            abrirWhatsApp(
                              loja.whatsapp,
                              `Olá ${loja.nome}! Vi vocês no aplicativo Lara Pont.`
                            )
                          }
                        >
                          <MessageCircle size={14} color="#1F7A4C" />
                          <Text style={styles.whatsBtnText}>WhatsApp</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </>
          ) : null}

          {/* ABA 3: EXPLORAR / TROCAR PONTOS */}
          {!carregando && aba === 'explorar' ? (
            <>
              {lojaSelecionada ? (
                <View style={styles.activeStoreFilter}>
                  <Text style={styles.activeStoreText}>
                    Filtrando loja: <Text style={styles.bold}>{lojaSelecionada.nome}</Text>
                  </Text>
                  <Pressable onPress={() => setLojaSelecionada(null)}>
                    <X size={16} color="#141414" />
                  </Pressable>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterRow}
                >
                  {SEGMENTOS_FILTRO.map((seg) => {
                    const ativo = segmento === seg;
                    return (
                      <Pressable
                        key={seg}
                        style={[styles.chip, ativo && styles.chipActive]}
                        onPress={() => setSegmento(seg)}
                      >
                        <Text style={[styles.chipText, ativo && styles.chipTextActive]}>
                          {seg}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              {produtosFiltrados.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Nenhum produto encontrado</Text>
                  <Text style={styles.emptyDesc}>
                    Assim que as lojas parceiras ativas cadastrarem produtos, tatuagens ou descontos, eles aparecerão aqui.
                  </Text>
                </View>
              ) : (
                produtosFiltrados.map((prod) => {
                  const podeResgatar = saldoPontos >= prod.pontos_necessarios;
                  const confirmando = confirmandoId === prod.id;
                  const processando = resgatandoId === prod.id;

                  return (
                    <View key={prod.id} style={styles.productCard}>
                      <View style={styles.productTop}>
                        <View style={styles.segBadge}>
                          <Text style={styles.segBadgeText}>
                            {prod.lojas?.segmento ?? prod.categoria}
                          </Text>
                        </View>
                        <Text style={styles.storeNameText}>
                          {prod.lojas?.nome}
                          {prod.lojas?.cidade ? ` • ${prod.lojas.cidade}` : ''}
                        </Text>
                      </View>

                      <Text style={styles.productTitle}>{prod.titulo}</Text>
                      {prod.descricao ? (
                        <Text style={styles.productDesc}>{prod.descricao}</Text>
                      ) : null}

                      {prod.compra_minima ? (
                        <Text style={styles.minPurchaseNote}>
                          Regra: válido em compras/serviços a partir de R${' '}
                          {Number(prod.compra_minima).toFixed(2).replace('.', ',')}
                        </Text>
                      ) : null}

                      <View style={styles.productFooter}>
                        <View>
                          <Text style={styles.productPoints}>
                            {prod.pontos_necessarios.toLocaleString('pt-BR')} pts
                          </Text>
                          {prod.valor_referencia ? (
                            <Text style={styles.productRef}>
                              {prod.tipo_resgate === 'desconto' ? 'Desconto de' : 'Equivalente a'} R${' '}
                              {Number(prod.valor_referencia).toFixed(2).replace('.', ',')}
                            </Text>
                          ) : null}
                        </View>

                        {confirmando ? (
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Pressable
                              style={styles.cancelSmallBtn}
                              onPress={() => setConfirmandoId(null)}
                            >
                              <Text style={styles.cancelSmallText}>Cancelar</Text>
                            </Pressable>
                            <Pressable
                              style={styles.confirmSmallBtn}
                              onPress={() => handleResgatar(prod)}
                              disabled={processando}
                            >
                              {processando ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <Text style={styles.redeemBtnText}>Confirmar</Text>
                              )}
                            </Pressable>
                          </View>
                        ) : (
                          <Pressable
                            style={[
                              styles.redeemBtn,
                              !podeResgatar && styles.redeemBtnDisabled,
                            ]}
                            onPress={() => podeResgatar && setConfirmandoId(prod.id)}
                            disabled={!podeResgatar}
                          >
                            <Text style={styles.redeemBtnText}>
                              {podeResgatar ? 'Resgatar' : 'Pontos insuficientes'}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </>
          ) : null}

          {/* ABA 4: MEUS VOUCHERS + QR CODE + WHATSAPP */}
          {!carregando && aba === 'vouchers' ? (
            <>
              <View style={styles.subFilterRow}>
                <Pressable
                  style={[styles.subFilterBtn, filtroVoucher === 'todos' && styles.subFilterBtnActive]}
                  onPress={() => setFiltroVoucher('todos')}
                >
                  <Text
                    style={[
                      styles.subFilterText,
                      filtroVoucher === 'todos' && styles.subFilterTextActive,
                    ]}
                  >
                    Todos ({resgates.length})
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.subFilterBtn,
                    filtroVoucher === 'pendente' && styles.subFilterBtnActive,
                  ]}
                  onPress={() => setFiltroVoucher('pendente')}
                >
                  <Text
                    style={[
                      styles.subFilterText,
                      filtroVoucher === 'pendente' && styles.subFilterTextActive,
                    ]}
                  >
                    Ativos ({totalPendentes})
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.subFilterBtn,
                    filtroVoucher === 'validado' && styles.subFilterBtnActive,
                  ]}
                  onPress={() => setFiltroVoucher('validado')}
                >
                  <Text
                    style={[
                      styles.subFilterText,
                      filtroVoucher === 'validado' && styles.subFilterTextActive,
                    ]}
                  >
                    Validados ({totalValidados})
                  </Text>
                </Pressable>
              </View>

              {resgatesFiltrados.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Nenhum voucher encontrado</Text>
                  <Text style={styles.emptyDesc}>
                    Troque seus pontos na aba Trocar para gerar seu voucher com QR Code.
                  </Text>
                </View>
              ) : (
                resgatesFiltrados.map((r) => {
                  const validado = r.status === 'validado';
                  return (
                    <View
                      key={r.id}
                      style={[styles.voucherCard, validado && styles.voucherCardValidated]}
                    >
                      <View style={styles.voucherTop}>
                        <Text style={styles.voucherStore}>{r.lojas?.nome ?? 'Parceiro'}</Text>
                        <View
                          style={[
                            styles.statusBadge,
                            validado
                              ? styles.statusOk
                              : r.status === 'cancelado'
                              ? styles.statusCancel
                              : styles.statusPending,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              validado && { color: '#1F7A4C' },
                            ]}
                          >
                            {validado
                              ? 'Validado'
                              : r.status === 'cancelado'
                              ? 'Cancelado'
                              : 'Pronto para uso'}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.voucherTitle}>
                        {r.produtos?.titulo ?? 'Resgate de pontos'}
                      </Text>

                      <View
                        style={[
                          styles.voucherCodeBox,
                          validado && styles.voucherCodeBoxValidated,
                        ]}
                      >
                        {!validado ? (
                          <View style={{ marginBottom: 10 }}>
                            <QRCode value={r.codigo_voucher} size={135} />
                          </View>
                        ) : null}
                        <Text style={styles.voucherCodeLabel}>
                          {validado
                            ? 'Comprovante de voucher utilizado:'
                            : 'Mostre este QR Code ou código na loja:'}
                        </Text>
                        <Text
                          style={[
                            styles.voucherCode,
                            validado && styles.voucherCodeValidated,
                          ]}
                        >
                          {r.codigo_voucher}
                        </Text>
                      </View>

                      <Text style={styles.voucherMeta}>
                        {r.pontos_usados} pts • Emitido em {formatarData(r.criado_em)}
                      </Text>

                      {!validado && r.lojas?.whatsapp ? (
                        <Pressable
                          style={styles.whatsVoucherBtn}
                          onPress={() =>
                            abrirWhatsApp(
                              r.lojas?.whatsapp,
                              `Olá ${r.lojas?.nome}! Resgatei "${r.produtos?.titulo ?? 'um item'}" no Lara Pont. Meu voucher é ${r.codigo_voucher}. Podemos combinar a retirada/agendamento?`
                            )
                          }
                        >
                          <MessageCircle size={15} color="#FFFFFF" />
                          <Text style={styles.whatsVoucherText}>
                            Agendar / Enviar voucher no WhatsApp
                          </Text>
                        </Pressable>
                      ) : null}

                      {validado && r.validado_em ? (
                        <View style={styles.validatedStamp}>
                          <CheckCircle2 size={14} color="#1F7A4C" />
                          <Text style={styles.validatedStampText}>
                            Validado pela loja em {formatarData(r.validado_em)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )}
            </>
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
  container: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greeting: { fontSize: 24, fontWeight: '800', color: '#141414' },
  subGreeting: { fontSize: 13, color: '#6B6860', marginTop: 2 },
  bold: { fontWeight: '700', color: '#141414' },
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
  tabBar: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E2DC',
  },
  tabBtnActive: { backgroundColor: '#141414', borderColor: '#141414' },
  tabText: { fontSize: 11, fontWeight: '700', color: '#141414' },
  tabTextActive: { color: '#FFFFFF' },
  feedbackBox: { padding: 12, borderRadius: 10, marginBottom: 14 },
  feedbackOk: { backgroundColor: '#E8F5EE' },
  feedbackErro: { backgroundColor: '#FDECEB' },
  feedbackText: { fontSize: 13, fontWeight: '600' },
  feedbackTextOk: { color: '#1F7A4C' },
  feedbackTextErro: { color: '#B42318' },
  walletCard: {
    backgroundColor: '#141414',
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
  },
  walletTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTag: {
    backgroundColor: '#262626',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  cardTagText: { color: '#F5F4F0', fontSize: 12, fontWeight: '700' },
  qrToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#C94A29',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
  },
  qrToggleText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  qrWalletBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  qrWalletCode: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#141414',
  },
  qrWalletHint: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B6860',
    textAlign: 'center',
  },
  pointsLabel: { color: '#A3A199', fontSize: 13 },
  pointsValue: { color: '#FFFFFF', fontSize: 40, fontWeight: '800', marginTop: 2 },
  pointsUnit: { fontSize: 20, fontWeight: '600', color: '#C94A29' },
  divider: { height: 1, backgroundColor: '#2A2A2A', marginVertical: 16 },
  cashRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cashLabel: { color: '#A3A199', fontSize: 12, marginBottom: 4 },
  cashValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  exploreCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#C94A29',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  exploreCtaText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  missionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E2DC',
    marginBottom: 12,
  },
  missionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  missionTitle: { fontSize: 15, fontWeight: '800', color: '#141414' },
  missionCounter: { fontSize: 14, fontWeight: '800', color: '#C94A29' },
  missionDesc: { fontSize: 12, color: '#57554E', lineHeight: 18, marginBottom: 10 },
  progressTrack: {
    height: 8,
    backgroundColor: '#ECEAE4',
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#C94A29', borderRadius: 99 },
  missionDoneList: { fontSize: 11, color: '#6B6860', marginTop: 8 },
  missionBtn: {
    marginTop: 12,
    backgroundColor: '#1F7A4C',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  missionBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  missionClaimedBadge: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  missionClaimedText: { fontSize: 12, fontWeight: '700', color: '#1F7A4C' },
  refCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FDF6F3',
    borderRadius: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: '#F3D6CC',
    marginBottom: 22,
  },
  refTitle: { fontSize: 14, fontWeight: '800', color: '#141414', marginBottom: 3 },
  refDesc: { fontSize: 12, color: '#57554E', lineHeight: 17 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#141414',
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 10,
  },
  shareBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#141414', marginBottom: 10 },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E4E2DC',
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#141414', marginBottom: 6 },
  emptyDesc: { fontSize: 13, lineHeight: 19, color: '#6B6860' },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4E2DC',
    paddingHorizontal: 16,
  },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  txRowBorder: { borderBottomWidth: 1, borderBottomColor: '#EFECE6' },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txStore: { fontSize: 15, fontWeight: '700', color: '#141414' },
  txDesc: { fontSize: 12, color: '#6B6860', marginTop: 2 },
  txPoints: { fontSize: 15, fontWeight: '800', color: '#1F7A4C' },
  filterRow: { gap: 8, paddingBottom: 14 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8D5CD',
  },
  chipActive: { backgroundColor: '#141414', borderColor: '#141414' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#141414' },
  chipTextActive: { color: '#FFFFFF' },
  storeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E2DC',
    marginBottom: 12,
  },
  doublePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#C94A29',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  doublePillText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  storeRule: { fontSize: 13, color: '#1F7A4C', marginTop: 4 },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  addrText: { fontSize: 12, color: '#6B6860' },
  storeActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  storeProductsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#141414',
    paddingVertical: 10,
    borderRadius: 10,
  },
  whatsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  whatsBtnText: { fontSize: 13, fontWeight: '700', color: '#1F7A4C' },
  activeStoreFilter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EAE7DF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  activeStoreText: { fontSize: 13, color: '#2E2D2A' },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E2DC',
    marginBottom: 12,
  },
  productTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  segBadge: {
    backgroundColor: '#F3EFE6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  segBadgeText: { fontSize: 11, fontWeight: '700', color: '#57554E' },
  storeNameText: { fontSize: 12, color: '#6B6860', fontWeight: '600' },
  productTitle: { fontSize: 17, fontWeight: '800', color: '#141414' },
  productDesc: { fontSize: 13, color: '#57554E', marginTop: 4, lineHeight: 19 },
  minPurchaseNote: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0EDE7',
  },
  productPoints: { fontSize: 18, fontWeight: '800', color: '#C94A29' },
  productRef: { fontSize: 11, color: '#7A776F' },
  redeemBtn: {
    backgroundColor: '#141414',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  redeemBtnDisabled: { backgroundColor: '#C5C2B8' },
  redeemBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  cancelSmallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#ECEAE4',
  },
  cancelSmallText: { fontSize: 12, fontWeight: '700', color: '#141414' },
  confirmSmallBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1F7A4C',
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
  voucherCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E2DC',
    marginBottom: 12,
  },
  voucherCardValidated: { borderColor: '#CBE8D7', backgroundColor: '#FCFDFC' },
  voucherTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  voucherStore: { fontSize: 13, fontWeight: '700', color: '#6B6860' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusOk: { backgroundColor: '#E8F5EE' },
  statusCancel: { backgroundColor: '#FDECEB' },
  statusBadgeText: { fontSize: 11, fontWeight: '700', color: '#141414' },
  voucherTitle: { fontSize: 17, fontWeight: '800', color: '#141414', marginTop: 6 },
  voucherCodeBox: {
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#C94A29',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginVertical: 12,
  },
  voucherCodeBoxValidated: { borderColor: '#A7D7BC', backgroundColor: '#F3FAF6' },
  voucherCodeLabel: { fontSize: 11, color: '#6B6860', marginBottom: 4 },
  voucherCode: { fontSize: 22, fontWeight: '800', letterSpacing: 3, color: '#C94A29' },
  voucherCodeValidated: { color: '#1F7A4C' },
  voucherMeta: { fontSize: 12, color: '#7A776F' },
  whatsVoucherBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1F7A4C',
    paddingVertical: 11,
    borderRadius: 10,
  },
  whatsVoucherText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  validatedStamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E6F2EB',
  },
  validatedStampText: { fontSize: 12, fontWeight: '700', color: '#1F7A4C' },
});