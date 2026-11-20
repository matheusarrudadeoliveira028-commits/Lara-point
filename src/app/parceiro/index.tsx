import { Redirect } from 'expo-router';
import {
  CheckCircle2,
  Clock,
  Flame,
  Lock,
  LogOut,
  Package,
  Plus,
  Printer,
  RefreshCw,
  ScanLine,
  Search,
  Settings,
  TicketCheck,
  Trash2,
  UserPlus,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QrScannerModal } from '../../components/QrScannerModal';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

interface ClienteEncontrado {
  id: string;
  nome: string;
  codigo_cliente: string;
  telefone: string | null;
}

interface ProdutoLoja {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: string;
  pontos_necessarios: number;
  valor_referencia: number | null;
  tipo_resgate: 'total' | 'desconto';
  compra_minima: number | null;
  ativo: boolean;
}

interface ResgateLoja {
  id: string;
  codigo_voucher: string;
  pontos_usados: number;
  status: 'pendente' | 'validado' | 'cancelado';
  criado_em: string;
  validado_em: string | null;
  produtos?: { titulo: string } | null;
  perfis?: { nome: string; codigo_cliente: string } | null;
}

interface Atendente {
  id: string;
  nome: string;
  email: string | null;
}

export default function ParceiroHomeScreen() {
  const { session, perfil, loja, loading: authLoading, recarregarPerfil, sair } = useAuth();

  const ehDono = perfil?.tipo === 'parceiro';
  const assinaturaAtiva = loja?.assinatura_status === 'ativa';

  const [aba, setAba] = useState<'pontos' | 'produtos' | 'voucher' | 'loja'>('pontos');
  const [filtroVoucher, setFiltroVoucher] = useState<'todos' | 'pendente' | 'validado'>('todos');
  const [scannerModo, setScannerModo] = useState<'cliente' | 'voucher' | null>(null);

  // Lançar pontos (Calculadora R$ -> pts)
  const [termoBusca, setTermoBusca] = useState('');
  const [cliente, setCliente] = useState<ClienteEncontrado | null>(null);
  const [valorCompra, setValorCompra] = useState('');
  const [descPontos, setDescPontos] = useState('');

  // Produtos
  const [produtos, setProdutos] = useState<ProdutoLoja[]>([]);
  const [prodTitulo, setProdTitulo] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPontos, setProdPontos] = useState('');
  const [prodValorRef, setProdValorRef] = useState('');
  const [prodTipo, setProdTipo] = useState<'total' | 'desconto'>('total');
  const [prodCompraMin, setProdCompraMin] = useState('');

  // Vouchers
  const [resgates, setResgates] = useState<ResgateLoja[]>([]);
  const [codigoVoucher, setCodigoVoucher] = useState('');

  // Configurações da loja & Atendentes
  const [cfgTaxa, setCfgTaxa] = useState('1');
  const [cfgWhats, setCfgWhats] = useState('');
  const [cfgEndereco, setCfgEndereco] = useState('');
  const [cfgCidade, setCfgCidade] = useState('');
  const [atendentes, setAtendentes] = useState<Atendente[]>([]);
  const [emailAtendente, setEmailAtendente] = useState('');

  const [saindo, setSaindo] = useState(false);
  const [loadingAcao, setLoadingAcao] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  useEffect(() => {
    if (loja) {
      setCfgTaxa(String(loja.pontos_por_real ?? 1));
      setCfgWhats(loja.whatsapp ?? '');
      setCfgEndereco(loja.endereco ?? '');
      setCfgCidade(loja.cidade ?? '');
    }
  }, [loja]);

  const carregarProdutos = useCallback(async () => {
    if (!loja?.id) return;
    const { data } = await supabase
      .from('produtos')
      .select(
        'id, titulo, descricao, categoria, pontos_necessarios, valor_referencia, tipo_resgate, compra_minima, ativo'
      )
      .eq('loja_id', loja.id)
      .order('criado_em', { ascending: false });

    if (data) setProdutos(data as ProdutoLoja[]);
  }, [loja?.id]);

  const carregarResgates = useCallback(async () => {
    if (!loja?.id) return;
    const { data } = await supabase
      .from('resgates')
      .select(
        'id, codigo_voucher, pontos_usados, status, criado_em, validado_em, produtos(titulo), perfis(nome, codigo_cliente)'
      )
      .eq('loja_id', loja.id)
      .order('criado_em', { ascending: false });

    if (data) setResgates(data as unknown as ResgateLoja[]);
  }, [loja?.id]);

  const carregarAtendentes = useCallback(async () => {
    if (!loja?.id || !ehDono) return;
    const { data } = await supabase
      .from('perfis')
      .select('id, nome, email')
      .eq('loja_atendente_id', loja.id);

    if (data) setAtendentes(data as Atendente[]);
  }, [loja?.id, ehDono]);

  useEffect(() => {
    carregarProdutos();
    carregarResgates();
    carregarAtendentes();
  }, [carregarProdutos, carregarResgates, carregarAtendentes]);

  async function handleSair() {
    if (saindo) return;
    setSaindo(true);
    try {
      await sair();
    } finally {
      setSaindo(false);
    }
  }

  async function buscarCliente(termoCustom?: string) {
    setMsg(null);
    setCliente(null);
    const limpo = (termoCustom ?? termoBusca).trim();
    if (!limpo) return;

    const numeros = limpo.replace(/\D/g, '');
    let query = supabase
      .from('perfis')
      .select('id, nome, codigo_cliente, telefone')
      .eq('tipo', 'cliente');

    if (limpo.toUpperCase().startsWith('LP-')) {
      query = query.eq('codigo_cliente', limpo.toUpperCase());
    } else if (numeros.length === 11) {
      query = query.or(`cpf.eq.${numeros},telefone.eq.${numeros}`);
    } else {
      query = query.or(
        `codigo_cliente.ilike.%${limpo}%,telefone.ilike.%${numeros || limpo}%`
      );
    }

    const { data, error } = await query.limit(1).maybeSingle();
    if (error || !data) {
      setMsg({
        tipo: 'erro',
        texto: 'Cliente não encontrado. Confira o QR Code, código LP-XXXX, celular ou CPF.',
      });
      return;
    }

    setCliente(data as ClienteEncontrado);
  }

  async function handleLancarPorValor() {
    setMsg(null);
    if (!assinaturaAtiva) {
      setMsg({ tipo: 'erro', texto: 'Assinatura pendente. Ative a mensalidade para lançar pontos.' });
      return;
    }
    if (!cliente) {
      setMsg({ tipo: 'erro', texto: 'Escaneie ou busque o cliente primeiro.' });
      return;
    }
    const valorNum = Number(valorCompra.replace(',', '.'));
    if (!valorNum || valorNum <= 0) {
      setMsg({ tipo: 'erro', texto: 'Informe o valor da compra em reais (ex: 45,00).' });
      return;
    }

    setLoadingAcao(true);
    const { data, error } = await supabase.rpc('lancar_pontos_por_valor', {
      p_cliente_id: cliente.id,
      p_valor_compra: valorNum,
      p_descricao: descPontos.trim() || null,
    });
    setLoadingAcao(false);

    if (error) {
      setMsg({ tipo: 'erro', texto: error.message });
      return;
    }

    const res = data as { pontos_creditados?: number; em_dobro?: boolean };
    setMsg({
      tipo: 'ok',
      texto: `+${res?.pontos_creditados ?? 0} pontos creditados para ${cliente.nome}${res?.em_dobro ? ' (Modo 2x ativo!)' : ''}!`,
    });
    setValorCompra('');
    setDescPontos('');
  }

  async function togglePontosEmDobro() {
    if (!loja || !ehDono) return;
    setMsg(null);
    const novoValor = !loja.pontos_em_dobro;
    const { error } = await supabase
      .from('lojas')
      .update({ pontos_em_dobro: novoValor })
      .eq('id', loja.id);

    if (error) {
      setMsg({ tipo: 'erro', texto: error.message });
      return;
    }

    await recarregarPerfil();
    setMsg({
      tipo: 'ok',
      texto: novoValor
        ? 'Modo 2x Pontos ATIVADO! Sua loja ganhou selo de destaque na vitrine.'
        : 'Modo 2x Pontos desativado.',
    });
  }

  async function handleSalvarConfigLoja() {
    if (!loja || !ehDono) return;
    setMsg(null);
    const taxaNum = Number(cfgTaxa.replace(',', '.'));
    if (!taxaNum || taxaNum <= 0) {
      setMsg({ tipo: 'erro', texto: 'Informe uma taxa válida de pontos por real (ex: 1 ou 0,5).' });
      return;
    }

    setLoadingAcao(true);
    const { error } = await supabase
      .from('lojas')
      .update({
        pontos_por_real: taxaNum,
        whatsapp: cfgWhats.replace(/\D/g, '') || null,
        endereco: cfgEndereco.trim() || null,
        cidade: cfgCidade.trim() || null,
      })
      .eq('id', loja.id);
    setLoadingAcao(false);

    if (error) {
      setMsg({ tipo: 'erro', texto: error.message });
      return;
    }

    await recarregarPerfil();
    setMsg({ tipo: 'ok', texto: 'Dados da loja atualizados!' });
  }

  async function handleGerenciarAtendente(email: string, acao: 'adicionar' | 'remover') {
    setMsg(null);
    if (!email.trim()) return;
    setLoadingAcao(true);
    const { data, error } = await supabase.rpc('gerenciar_atendente', {
      p_email: email.trim(),
      p_acao: acao,
    });
    setLoadingAcao(false);

    if (error) {
      setMsg({ tipo: 'erro', texto: error.message });
      return;
    }

    const res = data as { mensagem?: string };
    setMsg({ tipo: 'ok', texto: res?.mensagem ?? 'Equipe atualizada!' });
    setEmailAtendente('');
    carregarAtendentes();
  }

  async function handleImprimirPlaca() {
    if (!loja) return;
    const textoTaxa = `${loja.pontos_por_real} ponto(s) a cada R$ 1,00`;

    if (Platform.OS === 'web') {
      const w = (globalThis as { window?: Window }).window;
      if (w) {
        const html = `
          <!doctype html>
          <html lang="pt-BR">
          <head>
            <meta charset="utf-8" />
            <title>Placa de Balcão - ${loja.nome}</title>
            <style>
              body { font-family: system-ui, sans-serif; display: flex; justify-content: center; padding: 32px; background: #fff; }
              .placa { width: 420px; border: 4px solid #141414; border-radius: 24px; padding: 36px 28px; text-align: center; }
              .tag { display: inline-block; background: #C94A29; color: #fff; font-weight: 800; font-size: 12px; letter-spacing: 1.5px; padding: 6px 14px; border-radius: 99px; }
              h1 { font-size: 32px; margin: 16px 0 6px; color: #141414; }
              h2 { font-size: 18px; margin: 0 0 22px; color: #57554E; font-weight: 600; }
              .box { background: #FAF9F6; border: 2px dashed #C94A29; border-radius: 16px; padding: 20px; margin: 20px 0; }
              .box p { margin: 0; font-size: 18px; font-weight: 800; color: #141414; }
              .rule { font-size: 15px; color: #1F7A4C; font-weight: 700; margin-top: 8px; }
              .foot { font-size: 13px; color: #6B6860; margin-top: 24px; line-height: 1.5; }
            </style>
          </head>
          <body>
            <div class="placa">
              <div class="tag">CLUBE DE PONTOS LARA PONT</div>
              <h1>${loja.nome}</h1>
              <h2>${loja.segmento}${loja.cidade ? ' • ' + loja.cidade : ''}</h2>
              <div class="box">
                <p>PEÇA SEUS PONTOS AQUI!</p>
                <div class="rule">Ganhe ${textoTaxa}</div>
              </div>
              <div class="foot">
                Mostre seu QR Code ou informe seu código <strong>LP-XXXX</strong> no caixa.<br/>
                Acumule sem limite e troque por tatuagens, produtos e descontos na cidade!
              </div>
            </div>
            <script>window.onload = function(){ window.print(); }</script>
          </body>
          </html>
        `;
        const popup = w.open('', '_blank', 'width=540,height=720');
        if (popup) {
          popup.document.write(html);
          popup.document.close();
        }
      }
      return;
    }

    await Share.share({
      message: `PLACA DE BALCÃO — ${loja.nome} (Lara Pont)\nPeça seus pontos aqui! Ganhe ${textoTaxa} e troque por produtos, tatuagens e descontos na cidade.`,
    });
  }

  async function handleCriarProduto() {
    setMsg(null);
    if (!loja) return;
    const pts = parseInt(prodPontos, 10);
    if (!prodTitulo.trim() || !pts || pts <= 0) {
      setMsg({
        tipo: 'erro',
        texto: 'Preencha o nome do produto/serviço e quantos pontos custa.',
      });
      return;
    }

    setLoadingAcao(true);
    const { error } = await supabase.from('produtos').insert({
      loja_id: loja.id,
      titulo: prodTitulo.trim(),
      descricao: prodDesc.trim() || null,
      categoria: loja.segmento,
      pontos_necessarios: pts,
      valor_referencia: prodValorRef ? Number(prodValorRef.replace(',', '.')) : null,
      tipo_resgate: prodTipo,
      compra_minima: prodCompraMin ? Number(prodCompraMin.replace(',', '.')) : null,
      ativo: true,
    });
    setLoadingAcao(false);

    if (error) {
      setMsg({ tipo: 'erro', texto: error.message });
      return;
    }

    setProdTitulo('');
    setProdDesc('');
    setProdPontos('');
    setProdValorRef('');
    setProdCompraMin('');
    setMsg({ tipo: 'ok', texto: 'Produto cadastrado na vitrine!' });
    carregarProdutos();
  }

  async function handleValidarVoucher(codigoCustom?: string) {
    setMsg(null);
    const code = (codigoCustom ?? codigoVoucher).trim().toUpperCase();
    if (!loja || !code) return;

    setLoadingAcao(true);
    const { data: resgate } = await supabase
      .from('resgates')
      .select('id, status, pontos_usados, produtos(titulo)')
      .eq('codigo_voucher', code)
      .eq('loja_id', loja.id)
      .maybeSingle();

    if (!resgate) {
      setLoadingAcao(false);
      setMsg({ tipo: 'erro', texto: `Voucher ${code} não encontrado para esta loja.` });
      return;
    }

    if (resgate.status !== 'pendente') {
      setLoadingAcao(false);
      setMsg({ tipo: 'erro', texto: `Este voucher já está com status: ${resgate.status}.` });
      return;
    }

    const { error } = await supabase
      .from('resgates')
      .update({ status: 'validado', validado_em: new Date().toISOString() })
      .eq('id', resgate.id);

    setLoadingAcao(false);

    if (error) {
      setMsg({ tipo: 'erro', texto: error.message });
      return;
    }

    setCodigoVoucher('');
    setMsg({
      tipo: 'ok',
      texto: `Voucher ${code} validado com sucesso! Registrado no histórico.`,
    });
    await carregarResgates();
  }

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

  if (authLoading || saindo) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#C94A29" />
      </SafeAreaView>
    );
  }

  if (!session) return <Redirect href="/" />;

  // Renderiza o scanner sozinho em tela cheia (evita bug de tela preta no iOS sobre ScrollView)
  if (scannerModo !== null) {
    return (
      <QrScannerModal
        visible={true}
        titulo={
          scannerModo === 'cliente' ? 'Escanear QR do Cliente' : 'Escanear QR do Voucher'
        }
        subtitulo={
          scannerModo === 'cliente'
            ? 'Aponte para o QR Code na carteira do cliente'
            : 'Aponte para o QR Code na aba Vouchers do cliente'
        }
        onClose={() => setScannerModo(null)}
        onScan={(valor) => {
          if (scannerModo === 'cliente') {
            setTermoBusca(valor);
            buscarCliente(valor);
          } else if (scannerModo === 'voucher') {
            setCodigoVoucher(valor.toUpperCase());
          }
        }}
      />
    );
  }

  const valorNumPreview = Number(valorCompra.replace(',', '.')) || 0;
  const mult = loja?.pontos_em_dobro ? 2 : 1;
  const pontosPrevistos =
    valorNumPreview > 0
      ? Math.max(1, Math.floor(valorNumPreview * Number(loja?.pontos_por_real ?? 1) * mult))
      : 0;

  const totalPendentes = resgates.filter((r) => r.status === 'pendente').length;
  const totalValidados = resgates.filter((r) => r.status === 'validado').length;
  const resgatesFiltrados =
    filtroVoucher === 'todos' ? resgates : resgates.filter((r) => r.status === filtroVoucher);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          {/* Topo */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View
                style={[
                  styles.statusPill,
                  !assinaturaAtiva && { backgroundColor: '#FEF3C7' },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    !assinaturaAtiva && { backgroundColor: '#B45309' },
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    !assinaturaAtiva && { color: '#B45309' },
                  ]}
                >
                  {assinaturaAtiva
                    ? `${ehDono ? loja?.segmento : 'Atendente de Caixa'}`
                    : `Mensalidade ${loja?.assinatura_status ?? 'pendente'}`}
                </Text>
              </View>
              <Text style={styles.title}>{loja?.nome ?? 'Minha Loja'}</Text>
            </View>

            <View style={styles.headerActions}>
              <Pressable
                style={styles.iconBtn}
                onPress={() => {
                  carregarProdutos();
                  carregarResgates();
                  recarregarPerfil();
                }}
              >
                <RefreshCw size={16} color="#141414" />
              </Pressable>
              <Pressable style={styles.logoutBtn} onPress={handleSair}>
                <LogOut size={16} color="#141414" />
                <Text style={styles.logoutText}>Sair</Text>
              </Pressable>
            </View>
          </View>

          {!assinaturaAtiva ? (
            <View style={styles.lockCard}>
              <Lock size={20} color="#B45309" />
              <View style={{ flex: 1 }}>
                <Text style={styles.lockTitle}>Assinatura mensal pendente</Text>
                <Text style={styles.lockDesc}>
                  Sua loja ainda não aparece na vitrine nem pode lançar pontos. Regularize a mensalidade para liberar o painel.
                </Text>
                <Pressable style={styles.refreshPlanBtn} onPress={recarregarPerfil}>
                  <Text style={styles.refreshPlanText}>Já paguei — atualizar status</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* Banner rápido Modo 2x */}
          {assinaturaAtiva && ehDono ? (
            <Pressable
              style={[styles.doubleBanner, loja?.pontos_em_dobro && styles.doubleBannerActive]}
              onPress={togglePontosEmDobro}
            >
              <Flame size={18} color={loja?.pontos_em_dobro ? '#FFFFFF' : '#C94A29'} />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.doubleTitle,
                    loja?.pontos_em_dobro && { color: '#FFFFFF' },
                  ]}
                >
                  {loja?.pontos_em_dobro
                    ? 'Modo 2x Pontos ATIVO hoje!'
                    : 'Dia fraco? Ligue o Modo 2x Pontos'}
                </Text>
                <Text
                  style={[
                    styles.doubleSub,
                    loja?.pontos_em_dobro && { color: '#FDE8E1' },
                  ]}
                >
                  {loja?.pontos_em_dobro
                    ? 'Toque aqui para voltar à pontuação normal.'
                    : 'Dobra os pontos das compras e coloca sua loja em destaque no app.'}
                </Text>
              </View>
            </Pressable>
          ) : null}

          {/* Abas */}
          <View style={styles.tabBar}>
            <Pressable
              style={[styles.tabBtn, aba === 'pontos' && styles.tabBtnActive]}
              onPress={() => {
                setMsg(null);
                setAba('pontos');
              }}
            >
              <Plus size={14} color={aba === 'pontos' ? '#FFFFFF' : '#141414'} />
              <Text style={[styles.tabText, aba === 'pontos' && styles.tabTextActive]}>
                Pontos
              </Text>
            </Pressable>

            {ehDono ? (
              <Pressable
                style={[styles.tabBtn, aba === 'produtos' && styles.tabBtnActive]}
                onPress={() => {
                  setMsg(null);
                  setAba('produtos');
                }}
              >
                <Package size={14} color={aba === 'produtos' ? '#FFFFFF' : '#141414'} />
                <Text style={[styles.tabText, aba === 'produtos' && styles.tabTextActive]}>
                  Produtos
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              style={[styles.tabBtn, aba === 'voucher' && styles.tabBtnActive]}
              onPress={() => {
                setMsg(null);
                setAba('voucher');
                carregarResgates();
              }}
            >
              <TicketCheck size={14} color={aba === 'voucher' ? '#FFFFFF' : '#141414'} />
              <Text style={[styles.tabText, aba === 'voucher' && styles.tabTextActive]}>
                Vouchers
              </Text>
            </Pressable>

            {ehDono ? (
              <Pressable
                style={[styles.tabBtn, aba === 'loja' && styles.tabBtnActive]}
                onPress={() => {
                  setMsg(null);
                  setAba('loja');
                  carregarAtendentes();
                }}
              >
                <Settings size={14} color={aba === 'loja' ? '#FFFFFF' : '#141414'} />
                <Text style={[styles.tabText, aba === 'loja' && styles.tabTextActive]}>
                  Loja
                </Text>
              </Pressable>
            ) : null}
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

          {/* ABA 1: SCANNER + CALCULADORA R$ -> PONTOS */}
          {aba === 'pontos' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Lançar pontos pela compra</Text>

              <Pressable
                style={styles.scanBtn}
                onPress={() => setScannerModo('cliente')}
              >
                <ScanLine size={18} color="#FFFFFF" />
                <Text style={styles.scanBtnText}>Escanear QR Code do Cliente</Text>
              </Pressable>

              <Text style={styles.label}>Ou busque por código LP-XXXX, celular ou CPF</Text>
              <View style={styles.searchRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Ex: LP-4821 ou 15999998888"
                  placeholderTextColor="#8C8A82"
                  value={termoBusca}
                  onChangeText={setTermoBusca}
                />
                <Pressable style={styles.searchBtn} onPress={() => buscarCliente()}>
                  <Search size={18} color="#FFFFFF" />
                </Pressable>
              </View>

              {cliente ? (
                <View style={styles.clientFound}>
                  <CheckCircle2 size={18} color="#1F7A4C" />
                  <View>
                    <Text style={styles.clientName}>{cliente.nome}</Text>
                    <Text style={styles.clientMeta}>
                      {cliente.codigo_cliente} • {cliente.telefone}
                    </Text>
                  </View>
                </View>
              ) : null}

              <Text style={[styles.label, { marginTop: 16 }]}>
                Valor da compra (R$) — cálculo automático
              </Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={valorCompra}
                onChangeText={setValorCompra}
                placeholder="Ex: 45,00"
                placeholderTextColor="#8C8A82"
              />

              <View style={styles.calcPreview}>
                <Text style={styles.calcLabel}>
                  Regra: {loja?.pontos_por_real ?? 1} pt/R$
                  {loja?.pontos_em_dobro ? ' × 2 (Dobro)' : ''}
                </Text>
                <Text style={styles.calcResult}>+{pontosPrevistos} pts</Text>
              </View>

              <Text style={styles.label}>Descrição (opcional)</Text>
              <TextInput
                style={styles.input}
                value={descPontos}
                onChangeText={setDescPontos}
                placeholder="Ex: Camiseta, combo lanche, sessão..."
                placeholderTextColor="#8C8A82"
              />

              <Pressable
                style={[
                  styles.primaryBtn,
                  (!assinaturaAtiva || loadingAcao) && { opacity: 0.5 },
                ]}
                onPress={handleLancarPorValor}
                disabled={!assinaturaAtiva || loadingAcao}
              >
                {loadingAcao ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    Creditar +{pontosPrevistos} pontos
                  </Text>
                )}
              </Pressable>
            </View>
          ) : null}

          {/* ABA 2: PRODUTOS COM REGRA DE COMPRA MÍNIMA */}
          {aba === 'produtos' && ehDono ? (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Cadastrar produto ou cupom</Text>

                <Text style={styles.label}>Tipo de recompensa</Text>
                <View style={styles.subFilterRow}>
                  <Pressable
                    style={[
                      styles.subFilterBtn,
                      prodTipo === 'total' && styles.subFilterBtnActive,
                    ]}
                    onPress={() => setProdTipo('total')}
                  >
                    <Text
                      style={[
                        styles.subFilterText,
                        prodTipo === 'total' && styles.subFilterTextActive,
                      ]}
                    >
                      100% em pontos
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.subFilterBtn,
                      prodTipo === 'desconto' && styles.subFilterBtnActive,
                    ]}
                    onPress={() => setProdTipo('desconto')}
                  >
                    <Text
                      style={[
                        styles.subFilterText,
                        prodTipo === 'desconto' && styles.subFilterTextActive,
                      ]}
                    >
                      Desconto parcial
                    </Text>
                  </Pressable>
                </View>

                <Text style={styles.label}>Nome do item / recompensa</Text>
                <TextInput
                  style={styles.input}
                  value={prodTitulo}
                  onChangeText={setProdTitulo}
                  placeholder="Ex: R$ 25 de desconto na tatuagem / X-Burguer"
                  placeholderTextColor="#8C8A82"
                />

                <Text style={styles.label}>Descrição (opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={prodDesc}
                  onChangeText={setProdDesc}
                  placeholder="Detalhes, validade ou regras..."
                  placeholderTextColor="#8C8A82"
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Pontos necessários</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={prodPontos}
                      onChangeText={setProdPontos}
                      placeholder="Ex: 250"
                      placeholderTextColor="#8C8A82"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Valor ref. (R$)</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={prodValorRef}
                      onChangeText={setProdValorRef}
                      placeholder="Ex: 25,00"
                      placeholderTextColor="#8C8A82"
                    />
                  </View>
                </View>

                <Text style={styles.label}>Compra mínima exigida (R$ — opcional)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={prodCompraMin}
                  onChangeText={setProdCompraMin}
                  placeholder="Ex: 150,00 (deixe vazio se não exigir)"
                  placeholderTextColor="#8C8A82"
                />

                <Pressable
                  style={styles.primaryBtn}
                  onPress={handleCriarProduto}
                  disabled={loadingAcao}
                >
                  <Text style={styles.primaryBtnText}>Salvar na vitrine</Text>
                </Pressable>
              </View>

              {produtos.map((p) => (
                <View key={p.id} style={styles.prodRowCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prodTitle}>{p.titulo}</Text>
                    {p.descricao ? <Text style={styles.prodDesc}>{p.descricao}</Text> : null}
                    {p.compra_minima ? (
                      <Text style={styles.prodMin}>
                        Compra mín.: R$ {Number(p.compra_minima).toFixed(2).replace('.', ',')}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.prodPts}>{p.pontos_necessarios} pts</Text>
                </View>
              ))}
            </>
          ) : null}

          {/* ABA 3: SCANNER DE VOUCHER + HISTÓRICO */}
          {aba === 'voucher' ? (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Validar voucher do cliente</Text>

                <Pressable
                  style={styles.scanBtn}
                  onPress={() => setScannerModo('voucher')}
                >
                  <ScanLine size={18} color="#FFFFFF" />
                  <Text style={styles.scanBtnText}>Escanear QR Code do Voucher</Text>
                </Pressable>

                <Text style={styles.label}>Ou digite o código do voucher</Text>
                <TextInput
                  style={styles.input}
                  autoCapitalize="characters"
                  placeholder="RES-XXXXXX"
                  placeholderTextColor="#8C8A82"
                  value={codigoVoucher}
                  onChangeText={setCodigoVoucher}
                />

                <Pressable
                  style={styles.primaryBtn}
                  onPress={() => handleValidarVoucher()}
                  disabled={loadingAcao}
                >
                  {loadingAcao ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Confirmar e dar baixa</Text>
                  )}
                </Pressable>
              </View>

              <Text style={styles.sectionTitle}>Histórico de vouchers da loja</Text>

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
                    Pendentes ({totalPendentes})
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
                  <Text style={styles.emptyTitle}>Nenhum voucher registrado</Text>
                  <Text style={styles.emptyDesc}>
                    O histórico de vouchers pendentes e validados aparecerá aqui.
                  </Text>
                </View>
              ) : (
                resgatesFiltrados.map((r) => {
                  const validado = r.status === 'validado';
                  return (
                    <View
                      key={r.id}
                      style={[styles.historyCard, validado && styles.historyCardValidated]}
                    >
                      <View style={styles.historyTop}>
                        <Text style={styles.historyCode}>{r.codigo_voucher}</Text>
                        <View
                          style={[
                            styles.statusBadge,
                            validado ? styles.statusOk : styles.statusPending,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              validado && { color: '#1F7A4C' },
                            ]}
                          >
                            {validado ? 'Validado' : 'Pendente'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.historyProduct}>
                        {r.produtos?.titulo ?? 'Produto resgatado'}
                      </Text>
                      <Text style={styles.historyClient}>
                        Cliente: <Text style={styles.bold}>{r.perfis?.nome ?? 'Cliente'}</Text> (
                        {r.perfis?.codigo_cliente ?? '---'}) • {r.pontos_usados} pts
                      </Text>
                      <View style={styles.historyFooter}>
                        {validado && r.validado_em ? (
                          <View style={styles.dateRow}>
                            <CheckCircle2 size={14} color="#1F7A4C" />
                            <Text style={styles.dateTextOk}>
                              Validado em {formatarData(r.validado_em)}
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.dateRow}>
                            <Clock size={14} color="#92400E" />
                            <Text style={styles.dateTextPending}>
                              Emitido em {formatarData(r.criado_em)}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </>
          ) : null}

          {/* ABA 4: CONFIGURAÇÕES + PLACA DE BALCÃO + ATENDENTES */}
          {aba === 'loja' && ehDono ? (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Placa de balcão</Text>
                <Text style={styles.helperText}>
                  Gere uma placa pronta para imprimir e colocar ao lado da maquininha avisando que sua loja participa do Lara Pont.
                </Text>
                <Pressable style={styles.scanBtn} onPress={handleImprimirPlaca}>
                  <Printer size={18} color="#FFFFFF" />
                  <Text style={styles.scanBtnText}>Imprimir / Gerar placa da loja</Text>
                </Pressable>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Regras e dados da loja</Text>

                <Text style={styles.label}>Pontos dados a cada R$ 1,00 gasto</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={cfgTaxa}
                  onChangeText={setCfgTaxa}
                  placeholder="Ex: 1"
                />

                <Text style={styles.label}>WhatsApp da loja (com DDD)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="phone-pad"
                  value={cfgWhats}
                  onChangeText={setCfgWhats}
                  placeholder="15999998888"
                />

                <Text style={styles.label}>Endereço</Text>
                <TextInput
                  style={styles.input}
                  value={cfgEndereco}
                  onChangeText={setCfgEndereco}
                  placeholder="Rua, número e bairro"
                />

                <Text style={styles.label}>Cidade</Text>
                <TextInput
                  style={styles.input}
                  value={cfgCidade}
                  onChangeText={setCfgCidade}
                  placeholder="Ex: Laranjal Paulista"
                />

                <Pressable
                  style={styles.primaryBtn}
                  onPress={handleSalvarConfigLoja}
                  disabled={loadingAcao}
                >
                  <Text style={styles.primaryBtnText}>Salvar dados da loja</Text>
                </Pressable>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Equipe / Atendentes de caixa</Text>
                <Text style={styles.helperText}>
                  Peça ao funcionário para criar uma conta de Cliente e informe o e-mail dele abaixo. Ele terá acesso apenas para lançar pontos e validar vouchers.
                </Text>

                <View style={styles.searchRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="email@funcionario.com"
                    placeholderTextColor="#8C8A82"
                    value={emailAtendente}
                    onChangeText={setEmailAtendente}
                  />
                  <Pressable
                    style={styles.searchBtn}
                    onPress={() => handleGerenciarAtendente(emailAtendente, 'adicionar')}
                  >
                    <UserPlus size={18} color="#FFFFFF" />
                  </Pressable>
                </View>

                {atendentes.length > 0 ? (
                  <View style={{ marginTop: 14 }}>
                    {atendentes.map((at) => (
                      <View key={at.id} style={styles.atendenteRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.prodTitle}>{at.nome}</Text>
                          <Text style={styles.prodDesc}>{at.email}</Text>
                        </View>
                        <Pressable
                          style={styles.removeBtn}
                          onPress={() =>
                            at.email && handleGerenciarAtendente(at.email, 'remover')
                          }
                        >
                          <Trash2 size={15} color="#B42318" />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
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
    marginBottom: 14,
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E2DC',
    padding: 9,
    borderRadius: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    marginBottom: 6,
  },
  statusDot: { width: 7, height: 7, borderRadius: 99, backgroundColor: '#1F7A4C' },
  statusText: { fontSize: 12, fontWeight: '700', color: '#1F7A4C' },
  title: { fontSize: 24, fontWeight: '800', color: '#141414' },
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
  lockCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  lockTitle: { fontSize: 14, fontWeight: '800', color: '#92400E', marginBottom: 4 },
  lockDesc: { fontSize: 13, lineHeight: 19, color: '#78350F' },
  refreshPlanBtn: { marginTop: 10, alignSelf: 'flex-start' },
  refreshPlanText: { fontSize: 12, fontWeight: '700', color: '#92400E', textDecorationLine: 'underline' },
  doubleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FDF6F3',
    borderWidth: 1,
    borderColor: '#F3D6CC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  doubleBannerActive: {
    backgroundColor: '#C94A29',
    borderColor: '#C94A29',
  },
  doubleTitle: { fontSize: 14, fontWeight: '800', color: '#141414' },
  doubleSub: { fontSize: 12, color: '#57554E', marginTop: 2 },
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
  msgBox: { padding: 12, borderRadius: 10, marginBottom: 14 },
  msgOk: { backgroundColor: '#E8F5EE' },
  msgErro: { backgroundColor: '#FDECEB' },
  msgText: { fontSize: 13, fontWeight: '600' },
  msgTextOk: { color: '#1F7A4C' },
  msgTextErro: { color: '#B42318' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E4E2DC',
    marginBottom: 16,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#141414', marginBottom: 12 },
  helperText: { fontSize: 13, color: '#6B6860', lineHeight: 19, marginBottom: 14 },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#141414',
    paddingVertical: 13,
    borderRadius: 10,
    marginBottom: 16,
  },
  scanBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: '#2E2D2A', marginBottom: 6 },
  input: {
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#D8D5CD',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#141414',
    marginBottom: 14,
  },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchBtn: {
    backgroundColor: '#141414',
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientFound: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#E8F5EE',
    padding: 12,
    borderRadius: 10,
  },
  clientName: { fontSize: 14, fontWeight: '700', color: '#141414' },
  clientMeta: { fontSize: 12, color: '#1F7A4C' },
  calcPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#E4E2DC',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  calcLabel: { fontSize: 12, color: '#57554E', fontWeight: '600' },
  calcResult: { fontSize: 18, fontWeight: '800', color: '#1F7A4C' },
  primaryBtn: {
    backgroundColor: '#C94A29',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  prodRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E4E2DC',
    marginBottom: 10,
  },
  prodTitle: { fontSize: 15, fontWeight: '700', color: '#141414' },
  prodDesc: { fontSize: 12, color: '#6B6860', marginTop: 2 },
  prodMin: { fontSize: 11, color: '#92400E', marginTop: 3, fontWeight: '600' },
  prodPts: { fontSize: 15, fontWeight: '800', color: '#C94A29' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#141414', marginBottom: 10 },
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
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E4E2DC',
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#141414', marginBottom: 6 },
  emptyDesc: { fontSize: 13, lineHeight: 19, color: '#6B6860' },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E2DC',
    marginBottom: 12,
  },
  historyCardValidated: { borderColor: '#CBE8D7', backgroundColor: '#FCFDFC' },
  historyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  historyCode: { fontSize: 16, fontWeight: '800', letterSpacing: 1, color: '#141414' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusOk: { backgroundColor: '#E8F5EE' },
  statusBadgeText: { fontSize: 11, fontWeight: '700', color: '#92400E' },
  historyProduct: { fontSize: 15, fontWeight: '700', color: '#141414' },
  historyClient: { fontSize: 13, color: '#57554E', marginTop: 4 },
  bold: { fontWeight: '700', color: '#141414' },
  historyFooter: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EFECE6',
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateTextOk: { fontSize: 12, fontWeight: '700', color: '#1F7A4C' },
  dateTextPending: { fontSize: 12, color: '#92400E' },
  atendenteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#EFECE6',
  },
  removeBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FDECEB',
  },
});