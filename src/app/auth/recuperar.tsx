import { useRouter } from 'expo-router';
import { ArrowLeft, KeyRound } from 'lucide-react-native';
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

export default function RecuperarSenhaScreen() {
  const router = useRouter();

  const [etapa, setEtapa] = useState<'email' | 'codigo'>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  async function handleEnviarCodigo() {
    setErro('');
    setSucesso('');

    const emailLimpo = email.trim().toLowerCase();
    if (!emailLimpo || !emailLimpo.includes('@')) {
      setErro('Informe o e-mail cadastrado na sua conta.');
      return;
    }

    setEnviando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(emailLimpo);
    setEnviando(false);

    if (error) {
      setErro(error.message);
      return;
    }

    setSucesso('Código enviado! Confira sua caixa de entrada e spam.');
    setEtapa('codigo');
  }

  async function handleRedefinirSenha() {
    setErro('');
    setSucesso('');

    const tokenLimpo = codigo.replace(/\D/g, '');
    if (tokenLimpo.length < 6) {
      setErro('Digite o código completo recebido no e-mail.');
      return;
    }

    if (novaSenha.length < 6) {
      setErro('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não conferem.');
      return;
    }

    setEnviando(true);
    const { error: otpError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: tokenLimpo,
      type: 'recovery',
    });

    if (otpError) {
      setEnviando(false);
      setErro('Código inválido ou expirado. Tente reenviar.');
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: novaSenha,
    });
    setEnviando(false);

    if (updateError) {
      setErro(updateError.message);
      return;
    }

    setSucesso('Senha alterada com sucesso! Redirecionando...');
    setTimeout(() => {
      router.replace('/');
    }, 1200);
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
              <Text style={styles.backText}>Voltar ao login</Text>
            </Pressable>

            <View style={styles.iconCircle}>
              <KeyRound size={26} color="#C94A29" />
            </View>

            <Text style={styles.title}>Recuperar senha</Text>
            <Text style={styles.subtitle}>
              {etapa === 'email'
                ? 'Informe seu e-mail para receber o código de redefinição.'
                : `Digite o código enviado para ${email.trim().toLowerCase()} e escolha sua nova senha.`}
            </Text>

            <View style={styles.card}>
              {etapa === 'email' ? (
                <>
                  <Text style={styles.label}>E-mail da conta</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="seu@email.com"
                    placeholderTextColor="#8C8A82"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                    onSubmitEditing={handleEnviarCodigo}
                  />

                  {erro ? <Text style={styles.errorText}>{erro}</Text> : null}

                  <Pressable
                    style={[styles.primaryBtn, enviando && { opacity: 0.7 }]}
                    onPress={handleEnviarCodigo}
                    disabled={enviando}
                  >
                    {enviando ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Enviar código</Text>
                    )}
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Código recebido no e-mail</Text>
                  <TextInput
                    style={styles.codeInput}
                    placeholder="00000000"
                    placeholderTextColor="#B5B2A8"
                    keyboardType="numeric"
                    maxLength={8}
                    value={codigo}
                    onChangeText={(t) => setCodigo(t.replace(/\D/g, ''))}
                  />

                  <Text style={styles.label}>Nova senha (mín. 6 caracteres)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="#8C8A82"
                    secureTextEntry
                    value={novaSenha}
                    onChangeText={setNovaSenha}
                  />

                  <Text style={styles.label}>Confirmar nova senha</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="#8C8A82"
                    secureTextEntry
                    value={confirmarSenha}
                    onChangeText={setConfirmarSenha}
                  />

                  {erro ? <Text style={styles.errorText}>{erro}</Text> : null}
                  {sucesso ? <Text style={styles.successText}>{sucesso}</Text> : null}

                  <Pressable
                    style={[styles.primaryBtn, enviando && { opacity: 0.7 }]}
                    onPress={handleRedefinirSenha}
                    disabled={enviando}
                  >
                    {enviando ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Salvar nova senha</Text>
                    )}
                  </Pressable>

                  <Pressable
                    style={styles.resendBtn}
                    onPress={handleEnviarCodigo}
                    disabled={enviando}
                  >
                    <Text style={styles.resendText}>Reenviar código</Text>
                  </Pressable>
                </>
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
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  container: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  backText: { fontSize: 14, fontWeight: '600', color: '#141414' },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#FBEAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#141414' },
  subtitle: { fontSize: 14, lineHeight: 20, color: '#57554E', marginTop: 6, marginBottom: 20 },
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
  codeInput: {
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#D8D5CD',
    borderRadius: 10,
    paddingVertical: 12,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
    color: '#141414',
    marginBottom: 14,
  },
  errorText: { color: '#B42318', fontSize: 13, fontWeight: '600', marginBottom: 12 },
  successText: { color: '#1F7A4C', fontSize: 13, fontWeight: '600', marginBottom: 12 },
  primaryBtn: {
    backgroundColor: '#C94A29',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  resendBtn: { marginTop: 14, alignItems: 'center', paddingVertical: 6 },
  resendText: { fontSize: 13, fontWeight: '600', color: '#57554E' },
});