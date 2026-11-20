import { useRouter } from 'expo-router';
import { ArrowLeft, Gift, Store, User } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
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
import { supabase } from '../../lib/supabase';

const SEGMENTOS = [
  'Tatuagem',
  'Alimentação',
  'Moda',
  'Barbearia',
  'Estética',
  'Serviços',
  'Outros',
];

export default function CadastroScreen() {
  const router = useRouter();
  const [tipo, setTipo] = useState<'cliente' | 'parceiro'>('cliente');

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [codigoIndicacao, setCodigoIndicacao] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  // Campos extras para Loja Parceira
  const [lojaNome, setLojaNome] = useState('');
  const [lojaSegmento, setLojaSegmento] = useState('Alimentação');
  const [lojaCidade, setLojaCidade] = useState('');
  const [lojaWhatsapp, setLojaWhatsapp] = useState('');
  const [lojaEndereco, setLojaEndereco] = useState('');

  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function handleCadastrar() {
    setErro('');
    const telefoneLimpo = telefone.replace(/\D/g, '');
    const cpfLimpo = cpf.replace(/\D/g, '');
    const whatsLojaLimpo = lojaWhatsapp.replace(/\D/g, '') || telefoneLimpo;

    if (!nome.trim() || !email.trim() || senha.length < 6) {
      setErro('Preencha nome, e-mail válido e senha com pelo menos 6 caracteres.');
      return;
    }

    if (telefoneLimpo.length < 10) {
      setErro('Informe um número de celular válido com DDD.');
      return;
    }

    if (cpfLimpo.length !== 11) {
      setErro('Informe um CPF válido (11 dígitos) para segurança da conta.');
      return;
    }

    if (tipo === 'parceiro' && !lojaNome.trim()) {
      setErro('Informe o nome do seu estabelecimento.');
      return;
    }

    setEnviando(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: senha,
      options: {
        data: {
          nome: nome.trim(),
          telefone: telefoneLimpo,
          cpf: cpfLimpo,
          tipo,
          codigo_indicacao: tipo === 'cliente' ? codigoIndicacao.trim().toUpperCase() : undefined,
          loja_nome: tipo === 'parceiro' ? lojaNome.trim() : undefined,
          loja_segmento: tipo === 'parceiro' ? lojaSegmento : undefined,
          loja_cidade: tipo === 'parceiro' ? lojaCidade.trim() : undefined,
          loja_whatsapp: tipo === 'parceiro' ? whatsLojaLimpo : undefined,
          loja_endereco: tipo === 'parceiro' ? lojaEndereco.trim() : undefined,
        },
      },
    });
    setEnviando(false);

    if (error) {
      setErro(error.message);
      return;
    }

    if (data.session) {
      if (tipo === 'parceiro') router.replace('/parceiro');
      else router.replace('/cliente');
      return;
    }

    router.replace({
      pathname: '/auth/verificar',
      params: { email: email.trim().toLowerCase() },
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.container}>
            <Pressable style={styles.backBtn} onPress={() => router.back()}>
              <ArrowLeft size={18} color="#141414" />
              <Text style={styles.backText}>Voltar</Text>
            </Pressable>

            <Text style={styles.title}>Criar conta</Text>
            <Text style={styles.subtitle}>
              Preencha seus dados para começar a usar o Lara Pont.
            </Text>

            <View style={styles.card}>
              <Text style={styles.label}>Tipo de conta</Text>
              <View style={styles.selectorRow}>
                <Pressable
                  onPress={() => setTipo('cliente')}
                  style={[styles.selectorBtn, tipo === 'cliente' && styles.selectorBtnActive]}
                >
                  <User size={18} color={tipo === 'cliente' ? '#FFFFFF' : '#141414'} />
                  <Text
                    style={[
                      styles.selectorText,
                      tipo === 'cliente' && styles.selectorTextActive,
                    ]}
                  >
                    Cliente
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setTipo('parceiro')}
                  style={[styles.selectorBtn, tipo === 'parceiro' && styles.selectorBtnActive]}
                >
                  <Store size={18} color={tipo === 'parceiro' ? '#FFFFFF' : '#141414'} />
                  <Text
                    style={[
                      styles.selectorText,
                      tipo === 'parceiro' && styles.selectorTextActive,
                    ]}
                  >
                    Loja Parceira
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.label}>Nome completo</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: João Silva"
                placeholderTextColor="#8C8A82"
                value={nome}
                onChangeText={setNome}
              />

              <Text style={styles.label}>Celular (WhatsApp com DDD)</Text>
              <TextInput
                style={styles.input}
                placeholder="15999998888"
                placeholderTextColor="#8C8A82"
                keyboardType="phone-pad"
                value={telefone}
                onChangeText={setTelefone}
              />

              <Text style={styles.label}>CPF (somente números)</Text>
              <TextInput
                style={styles.input}
                placeholder="00000000000"
                placeholderTextColor="#8C8A82"
                keyboardType="numeric"
                maxLength={14}
                value={cpf}
                onChangeText={setCpf}
              />

              {tipo === 'cliente' ? (
                <View style={styles.referralBox}>
                  <View style={styles.referralHeader}>
                    <Gift size={15} color="#C94A29" />
                    <Text style={styles.referralTitle}>Código de indicação (opcional)</Text>
                  </View>
                  <TextInput
                    style={[styles.input, { marginBottom: 6, backgroundColor: '#FFFFFF' }]}
                    placeholder="Ex: LP-4821"
                    placeholderTextColor="#8C8A82"
                    autoCapitalize="characters"
                    value={codigoIndicacao}
                    onChangeText={setCodigoIndicacao}
                  />
                  <Text style={styles.referralHint}>
                    Você e quem te indicou ganham +25 pontos bônus assim que você pontuar pela 1ª vez!
                  </Text>
                </View>
              ) : (
                <View style={styles.partnerBox}>
                  <Text style={styles.partnerTitle}>Dados do estabelecimento</Text>

                  <Text style={styles.label}>Nome da loja / estúdio</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: Studio Ink / Burguer da Praça"
                    placeholderTextColor="#8C8A82"
                    value={lojaNome}
                    onChangeText={setLojaNome}
                  />

                  <Text style={styles.label}>Segmento</Text>
                  <View style={styles.chipRow}>
                    {SEGMENTOS.map((seg) => {
                      const ativo = lojaSegmento === seg;
                      return (
                        <Pressable
                          key={seg}
                          onPress={() => setLojaSegmento(seg)}
                          style={[styles.chip, ativo && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, ativo && styles.chipTextActive]}>
                            {seg}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={styles.label}>WhatsApp da loja (para agendamentos)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="15999998888 (se diferente do seu)"
                    placeholderTextColor="#8C8A82"
                    keyboardType="phone-pad"
                    value={lojaWhatsapp}
                    onChangeText={setLojaWhatsapp}
                  />

                  <Text style={styles.label}>Endereço</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: Rua Central, 120 - Centro"
                    placeholderTextColor="#8C8A82"
                    value={lojaEndereco}
                    onChangeText={setLojaEndereco}
                  />

                  <Text style={styles.label}>Cidade</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: Laranjal Paulista"
                    placeholderTextColor="#8C8A82"
                    value={lojaCidade}
                    onChangeText={setLojaCidade}
                  />
                </View>
              )}

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

              <Text style={styles.label}>Senha (mín. 6 caracteres)</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#8C8A82"
                secureTextEntry
                value={senha}
                onChangeText={setSenha}
              />

              {erro ? <Text style={styles.errorText}>{erro}</Text> : null}

              <Pressable
                style={[styles.primaryBtn, enviando && { opacity: 0.7 }]}
                onPress={handleCadastrar}
                disabled={enviando}
              >
                {enviando ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Criar conta</Text>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F4F0' },
  scroll: { padding: 20, paddingBottom: 40 },
  container: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backText: { fontSize: 14, fontWeight: '600', color: '#141414' },
  title: { fontSize: 28, fontWeight: '800', color: '#141414' },
  subtitle: { fontSize: 14, color: '#57554E', marginTop: 4, marginBottom: 20 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E4E2DC',
  },
  selectorRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  selectorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D8D5CD',
    backgroundColor: '#FAF9F6',
  },
  selectorBtnActive: { backgroundColor: '#141414', borderColor: '#141414' },
  selectorText: { fontSize: 14, fontWeight: '600', color: '#141414' },
  selectorTextActive: { color: '#FFFFFF' },
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
  referralBox: {
    backgroundColor: '#FDF6F3',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3D6CC',
  },
  referralHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  referralTitle: { fontSize: 13, fontWeight: '700', color: '#141414' },
  referralHint: { fontSize: 12, color: '#6B6860', lineHeight: 17 },
  partnerBox: {
    backgroundColor: '#F7F5EF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E1D6',
  },
  partnerTitle: { fontSize: 14, fontWeight: '800', color: '#141414', marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D8D5CD',
    backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: '#141414', borderColor: '#141414' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#141414' },
  chipTextActive: { color: '#FFFFFF' },
  errorText: { color: '#B42318', fontSize: 13, fontWeight: '600', marginBottom: 12 },
  primaryBtn: {
    backgroundColor: '#C94A29',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});