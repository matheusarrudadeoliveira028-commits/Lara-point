import { Session } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface Perfil {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cpf: string | null;
  tipo: 'cliente' | 'parceiro' | 'atendente' | 'admin';
  codigo_cliente: string;
  verificado: boolean;
  loja_atendente_id: string | null;
  indicado_por: string | null;
  avatar_url: string | null;
}

export interface Loja {
  id: string;
  dono_id: string;
  nome: string;
  segmento: string;
  cidade: string | null;
  whatsapp: string | null;
  endereco: string | null;
  regra_pontos: string | null;
  pontos_por_real: number;
  pontos_em_dobro: boolean;
  assinatura_status: 'ativa' | 'pendente' | 'bloqueada';
  valor_mensalidade: number;
  vencimento_assinatura: string | null;
  cota_mensal_pontos: number;
  max_pontos_por_lancamento: number;
  logo_url: string | null;
}

interface AuthContextData {
  session: Session | null;
  perfil: Perfil | null;
  loja: Loja | null;
  loading: boolean;
  recarregarPerfil: () => Promise<Perfil | null>;
  sair: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loja, setLoja] = useState<Loja | null>(null);
  const [loading, setLoading] = useState(true);

  async function carregarDadosUsuario(userId: string): Promise<Perfil | null> {
    const { data: perfilData } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', userId)
      .single();

    if (perfilData) {
      const p = perfilData as Perfil;
      setPerfil(p);

      if (p.tipo === 'parceiro') {
        const { data: lojaData } = await supabase
          .from('lojas')
          .select('*')
          .eq('dono_id', userId)
          .single();
        setLoja((lojaData as Loja) ?? null);
      } else if (p.tipo === 'atendente' && p.loja_atendente_id) {
        const { data: lojaData } = await supabase
          .from('lojas')
          .select('*')
          .eq('id', p.loja_atendente_id)
          .single();
        setLoja((lojaData as Loja) ?? null);
      } else {
        setLoja(null);
      }

      return p;
    }

    return null;
  }

  async function recarregarPerfil() {
    if (!session?.user?.id) return null;
    return carregarDadosUsuario(session.user.id);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user?.id) {
        await carregarDadosUsuario(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, novaSessao) => {
        setSession(novaSessao);
        if (novaSessao?.user?.id) {
          await carregarDadosUsuario(novaSessao.user.id);
        } else {
          setPerfil(null);
          setLoja(null);
        }
        setLoading(false);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  async function sair() {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Limpa estado local mesmo sem rede
    } finally {
      setSession(null);
      setPerfil(null);
      setLoja(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{ session, perfil, loja, loading, recarregarPerfil, sair }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}