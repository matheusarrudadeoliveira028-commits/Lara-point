import { useLocalSearchParams, useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export default function VerificarCodigoScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { recarregarPerfil } = useAuth();

  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [validando, setValidando] = useState(false);

  async function handleVerificar() {
    setErro('');
    setAviso('');

    const tokenLimpo = codigo.replace(/\D/g, '');
    if (tokenLimpo.length < 6) {
      setErro('Digite o código completo enviado para o seu e-mail.');
      return;
    }

    setValidando(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email: String(email),
      token: tokenLimpo,
      type: 'signup',
    });

    if (error) {
      setValidando(false);
      setErro('Código inválido ou expirado. Confira seu e-mail ou peça um novo.');
      return;
    }

    if (data.user?.id) {
      await supabase
        .from('perfis')
        .update({ verificado: true })
        .eq('id', data.user.id);
    }

    const perfilAtualizado = await recarregarPerfil();
    setValidando(false);

    if (perfilAtualizado?.tipo === 'parceiro' || perfilAtualizado?.tipo === 'atendente') {
      router.replace('/parceiro');
    } else if (perfilAtualizado?.tipo === 'admin') {
      router.replace('/admin');
    } else {
      router.replace('/cliente');
    }
  }

  async function handleReenviar() {
    setErro('');
    setAviso('');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: String(email),
    });

    if (error) {
      setErro('Aguarde alguns segundos antes de reenviar.');
    } else {
      setAviso('Novo código enviado! Confira sua caixa de entrada e spam.');
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <ShieldCheck size={28} color="#C94A29" />
        </View>

        <Text style={styles.title}>Verifique sua conta</Text>
        <Text style={styles.subtitle}>
          Enviamos um código de verificação para{' '}
          <Text style={styles.bold}>{email}</Text>.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Código recebido no e-mail</Text>
          <TextInput
            style={styles.codeInput}
            placeholder="00000000"
            placeholderTextColor="#B5B2A8"
            keyboardType="numeric"
            maxLength={8}
            value={codigo}
            onChangeText={(texto) => setCodigo(texto.replace(/\D/g, ''))}
            onSubmitEditing={handleVerificar}
          />

          {erro ? <Text style={styles.errorText}>{erro}</Text> : null}
          {aviso ? <Text style={styles.successText}>{aviso}</Text> : null}

          <Pressable
            style={[styles.primaryBtn, validando && { opacity: 0.7 }]}
            onPress={handleVerificar}
            disabled={validando}
          >
            {validando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>Confirmar código</Text>
            )}
          </Pressable>

          <Pressable style={styles.resendBtn} onPress={handleReenviar}>
            <Text style={styles.resendText}>Não recebeu? Reenviar código</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F4F0', justifyContent: 'center', padding: 20 },
  container: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FBEAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#141414' },
  subtitle: { fontSize: 14, lineHeight: 20, color: '#57554E', marginTop: 6, marginBottom: 20 },
  bold: { fontWeight: '700', color: '#141414' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E4E2DC',
  },
  label: { fontSize: 13, fontWeight: '600', color: '#2E2D2A', marginBottom: 8 },
  codeInput: {
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#D8D5CD',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 24,
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
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  resendBtn: { marginTop: 14, alignItems: 'center', paddingVertical: 6 },
  resendText: { fontSize: 13, fontWeight: '600', color: '#57554E' },
});