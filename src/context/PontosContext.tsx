import React, { createContext, useContext, useState } from 'react';

export interface Movimentacao {
  id: string;
  estabelecimento: string;
  descricao: string;
  pontos: number;
  data: string;
}

interface PontosContextData {
  clienteNome: string;
  clienteCodigo: string;
  saldoPontos: number;
  valorEmReais: number;
  movimentacoes: Movimentacao[];
  lancarPontos: (estabelecimento: string, descricao: string, pontos: number) => void;
}

const PONTOS_POR_REAL = 10; // 250 pts = R$ 25,00 | 5.000 pts = R$ 500,00

const PontosContext = createContext<PontosContextData>({} as PontosContextData);

export function PontosProvider({ children }: { children: React.ReactNode }) {
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([
    {
      id: '1',
      estabelecimento: 'Moda Urbana',
      descricao: 'Compra de camiseta',
      pontos: 30,
      data: 'Hoje, 14:20',
    },
    {
      id: '2',
      estabelecimento: 'Burguer da Praça',
      descricao: 'Lanche artesanal',
      pontos: 5,
      data: 'Ontem, 20:15',
    },
    {
      id: '3',
      estabelecimento: 'Moda Urbana',
      descricao: 'Compra acumulada',
      pontos: 215,
      data: '12/11, 16:40',
    },
  ]);

  const saldoPontos = movimentacoes.reduce((acc, item) => acc + item.pontos, 0);
  const valorEmReais = saldoPontos / PONTOS_POR_REAL;

  function lancarPontos(estabelecimento: string, descricao: string, pontos: number) {
    const agora = new Date();
    const hora = agora.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const nova: Movimentacao = {
      id: String(Date.now()),
      estabelecimento,
      descricao: descricao.trim() || 'Compra no estabelecimento',
      pontos,
      data: `Hoje, ${hora}`,
    };

    setMovimentacoes((prev) => [nova, ...prev]);
  }

  return (
    <PontosContext.Provider
      value={{
        clienteNome: 'João',
        clienteCodigo: 'LP-1024',
        saldoPontos,
        valorEmReais,
        movimentacoes,
        lancarPontos,
      }}
    >
      {children}
    </PontosContext.Provider>
  );
}

export function usePontos() {
  return useContext(PontosContext);
}