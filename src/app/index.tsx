import { Redirect, useRouter } from 'expo-router';
import { Flame, MapPin, Store } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface LojaPublica {
  id: string;
  nome: string;
  segmento: string;
  cidade: string | null;
  pontos_por_real: number;
  pontos_em_dobro: boolean;
  logo_url: string | null;
}

export default function LoginScreen() {
  const router = useRouter();
  const { session, perfil, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const [lojasParceiras, setLojasParceiras] = useState<LojaPublica[]>([]);
  const [segmentoFiltro, setSegmentoFiltro] = useState('Todos');

  useEffect(() => {
    supabase
      .from('lojas')
      .select('id, nome, segmento, cidade, pontos_por_real, pontos_em_dobro, logo_url')
      .eq('assinatura_status', 'ativa')
      .order('pontos_em_dobro', { ascending: false })
      .order('nome', { ascending: true })
      .then(({ data }) => {
        if (data) setLojasParceiras(data as LojaPublica[]);
      });
  }, []);

  async function handleLogin() {
    setErro('');
    if (!email.trim() || !senha) {
      setErro('Informe seu e-mail e sua senha.');
      return;
    }

    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    });
    setEnviando(false);

    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        router.push({
          pathname: '/auth/verificar',
          params: { email: email.trim().toLowerCase() },
        });
        return;
      }
      setErro('E-mail ou senha inválidos. Verifique e tente novamente.');
    }
  }

  if (loading || (session && !perfil)) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#C94A29" />
      </SafeAreaView>
    );
  }

  if (session && perfil) {
    if (perfil.tipo === 'parceiro' || perfil.tipo === 'atendente') {
      return <Redirect href="/parceiro" />;
    }
    if (perfil.tipo === 'admin') return <Redirect href="/admin" />;
    return <Redirect href="/cliente" />;
  }

  const segmentosDisponiveis = [
    'Todos',
    ...Array.from(new Set(lojasParceiras.map((l) => l.segmento))),
  ];

  const lojasFiltradas =
    segmentoFiltro === 'Todos'
      ? lojasParceiras
      : lojasParceiras.filter((l) => l.segmento === segmentoFiltro);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.container}>
            <View style={styles.brandBlock}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>CLUBE DE PONTOS DA CIDADE</Text>
              </View>
              <Text style={styles.title}>Lara Pont</Text>
              <Text style={styles.subtitle}>
                Compre nas lojas parceiras, acumule pontos sem limite e troque por tatuagens, produtos e descontos.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>E-mail</Text>
              <TextInput
                style={styles.input}
                placeholder="seu@email.com"
                placeholderTextColor="#8C8A82"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />

              <Text style={styles.label}>Senha</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#8C8A82"
                secureTextEntry
                value={senha}
                onChangeText={setSenha}
                onSubmitEditing={handleLogin}
              />

              <Pressable
                style={styles.forgotBtn}
                onPress={() => router.push('/auth/recuperar')}
              >
                <Text style={styles.forgotText}>Esqueci minha senha</Text>
              </Pressable>

              {erro ? <Text style={styles.errorText}>{erro}</Text> : null}

              <Pressable
                style={[styles.primaryBtn, enviando && { opacity: 0.7 }]}
                onPress={handleLogin}
                disabled={enviando}
              >
                {enviando ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Entrar</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.secondaryBtn}
                onPress={() => router.push('/auth/cadastro')}
              >
                <Text style={styles.secondaryBtnText}>
                  Não tem conta? <Text style={styles.bold}>Criar cadastro grátis</Text>
                </Text>
              </Pressable>
            </View>

            {/* Vitrine pública de empresas parceiras */}
            <View style={styles.showcaseSection}>
              <View style={styles.showcaseHeader}>
                <Store size={18} color="#141414" />
                <Text style={styles.showcaseTitle}>
                  Empresas parceiras ({lojasParceiras.length})
                </Text>
              </View>

              {lojasParceiras.length > 0 ? (
                <>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                  >
                    {segmentosDisponiveis.map((seg) => {
                      const ativo = segmentoFiltro === seg;
                      return (
                        <Pressable
                          key={seg}
                          onPress={() => setSegmentoFiltro(seg)}
                          style={[styles.chip, ativo && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, ativo && styles.chipTextActive]}>
                            {seg}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  {lojasFiltradas.map((loja) => (
                    <View key={loja.id} style={styles.partnerCard}>
                      <View style={styles.partnerRow}>
                        {loja.logo_url ? (
                          <Image
                            source={{ uri: loja.logo_url }}
                            style={styles.partnerLogo}
                          />
                        ) : (
                          <View style={styles.partnerLogoFallback}>
                            <Store size={20} color="#6B6860" />
                          </View>
                        )}

                        <View style={{ flex: 1 }}>
                          <View style={styles.partnerTop}>
                            <View style={styles.segPill}>
                              <Text style={styles.segPillText}>{loja.segmento}</Text>
                            </View>
                            {loja.pontos_em_dobro ? (
                              <View style={styles.doublePill}>
                                <Flame size={12} color="#FFFFFF" />
                                <Text style={styles.doublePillText}>2x PONTOS HOJE</Text>
                              </View>
                            ) : null}
                          </View>

                          <Text style={styles.partnerName}>{loja.nome}</Text>

                          <View style={styles.partnerBottom}>
                            <Text style={styles.partnerRule}>
                              {loja.pontos_em_dobro
                                ? `${Number(loja.pontos_por_real) * 2} pts por R$ 1,00`
                                : `${loja.pontos_por_real} pt(s) por R$ 1,00`}
                            </Text>
                            {loja.cidade ? (
                              <View style={styles.cityRow}>
                                <MapPin size={12} color="#6B6860" />
                                <Text style={styles.cityText}>{loja.cidade}</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      </View>
                    </View>
                  ))}
                </>
              ) : (
                <View style={styles.emptyShowcase}>
                  <Text style={styles.emptyText}>
                    Novas lojas parceiras sendo ativadas na sua cidade. Cadastre-se para começar a acumular!
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F4F0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F4F0' },
  scroll: { flexGrow: 1, padding: 20, paddingVertical: 32 },
  container: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  brandBlock: { marginBottom: 24 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#141414',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginBottom: 12,
  },
  badgeText: { color: '#F5F4F0', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  title: { fontSize: 34, fontWeight: '800', color: '#141414', letterSpacing: -0.5 },
  subtitle: { marginTop: 6, fontSize: 15, lineHeight: 22, color: '#57554E' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E4E2DC',
  },
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
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 14,
    marginTop: -6,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#C94A29',
  },
  errorText: { color: '#B42318', fontSize: 13, fontWeight: '600', marginBottom: 12 },
  primaryBtn: {
    backgroundColor: '#C94A29',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 6 },
  secondaryBtnText: { fontSize: 14, color: '#57554E' },
  bold: { fontWeight: '700', color: '#141414' },
  showcaseSection: { marginTop: 28 },
  showcaseHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  showcaseTitle: { fontSize: 17, fontWeight: '800', color: '#141414' },
  chipRow: { gap: 8, paddingBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8D5CD',
  },
  chipActive: { backgroundColor: '#141414', borderColor: '#141414' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#141414' },
  chipTextActive: { color: '#FFFFFF' },
  partnerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E4E2DC',
    marginBottom: 10,
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  partnerLogo: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#F3EFE6',
  },
  partnerLogoFallback: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#F3EFE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  segPill: {
    backgroundColor: '#F3EFE6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  segPillText: { fontSize: 11, fontWeight: '700', color: '#57554E' },
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
  partnerName: { fontSize: 16, fontWeight: '800', color: '#141414', marginBottom: 4 },
  partnerBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  partnerRule: { fontSize: 12, fontWeight: '700', color: '#1F7A4C' },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cityText: { fontSize: 12, color: '#6B6860' },
  emptyShowcase: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E2DC',
  },
  emptyText: { fontSize: 13, color: '#6B6860', lineHeight: 19 },
});