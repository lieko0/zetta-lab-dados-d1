import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, ScatterChart, Scatter, ZAxis, Cell
} from 'recharts';
import _ from 'lodash';
import Papa from 'papaparse';
// Importando diretamente os dados CSV, se o seu bundler suportar (Webpack, Vite, etc.)
// Se isso não funcionar, remova estas linhas e use a abordagem de fetch abaixo
import desmatamentoCSV from './desmatamento_prodes_para_municipios_2008_2024.csv?raw';
import pibCSV from './pib_para_estudo.csv?raw';
// Dados de exemplo para garantir que o dashboard seja renderizado mesmo se houver falhas na leitura dos arquivos


export default function Dashboard() {
  const [desmatamentoData, setDesmatamentoData] = useState([]);
  const [pibData, setPibData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMunicipios, setSelectedMunicipios] = useState([]);
  const [municipiosList, setMunicipiosList] = useState([]);
  const [visualizacaoAtual, setVisualizacaoAtual] = useState('desmatamento');
  const [anoInicio, setAnoInicio] = useState(2010);
  const [anoFim, setAnoFim] = useState(2021);
  const [comparativoData, setComparativoData] = useState([]);

  // Função para carregar e processar os dados
  useEffect(() => {
    const carregarDados = async () => {
      try {
        let desmatamentoContent, pibContent;
        
        desmatamentoContent = desmatamentoCSV;
        pibContent = pibCSV;
        
        // Processando os dados com PapaParse
        const desmatamentoResult = Papa.parse(desmatamentoContent, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
          transform: (value) => value?.trim() || value,
        });
        
        const pibResult = Papa.parse(pibContent, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
          transform: (value) => value?.trim() || value,
        });

        console.log("Dados carregados:", { 
          desmatamento: desmatamentoResult.data.slice(0, 2), 
          pib: pibResult.data.slice(0, 2) 
        });

        // Limpando e formatando os dados
        const desmatamentoClean = desmatamentoResult.data
          .filter(item => item.NM_MUN && item.year && item.area_km !== undefined)
          .map(item => ({
            municipio: item.NM_MUN,
            ano: item.year,
            area_desmatada: parseFloat(item.area_km) || 0
          }));

        const pibClean = pibResult.data
          .filter(item => (item.municipio || item.NM_MUN) && (item.ANO || item.ano) && (item.pib || item.PIB) !== undefined)
          .map(item => ({
            municipio: item.municipio || item.NM_MUN,
            ano: item.ANO || item.ano,
            pib: parseFloat(item.pib || item.PIB) || 0,
            pib_per_capita: parseFloat(item.pib_per_capita || item.PIB_PER_CAPITA) || 0,
            valor_agropecuaria: parseFloat(item["Valor adicionado bruto da Agropecuária, a preços correntes (R$ 1.000)"] || item.valor_agropecuaria) || 0,
            valor_industria: parseFloat(item.valor_industria) || 0,
            valor_servicos: parseFloat(item.valor_servicos) || 0
          }));

        if (desmatamentoClean.length === 0 || pibClean.length === 0) {
          console.warn("Dados processados vazios, usando dados de exemplo");
          processarDadosExemplo();
          return;
        }

        // Atualizando os estados com os dados processados
        setDesmatamentoData(desmatamentoClean);
        setPibData(pibClean);
        
        // Criando lista de municípios únicos
        const municipios = _.uniq([
          ...desmatamentoClean.map(d => d.municipio),
          ...pibClean.map(p => p.municipio)
        ]).sort();
        
        setMunicipiosList(municipios);
        
        // Selecionando os 5 primeiros municípios por padrão
        setSelectedMunicipios(municipios.slice(0, 5));
        
        // Processando dados comparativos entre desmatamento e PIB
        processarDadosComparativos(desmatamentoClean, pibClean);
        
        setLoading(false);
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
        console.warn("Usando dados de exemplo devido ao erro:", err);
        processarDadosExemplo();
      }
    };
   carregarDados();
  }, []);

  // Função para processar dados comparativos entre desmatamento e PIB
  const processarDadosComparativos = (desmatamentoData, pibData) => {
    // Encontrando anos que existem em ambos os conjuntos de dados
    const anosDesmatamento = _.uniq(desmatamentoData.map(d => d.ano));
    const anosPib = _.uniq(pibData.map(p => p.ano));
    const anosComuns = _.intersection(anosDesmatamento, anosPib);
    
    // Criando objeto para facilitar a busca
    const desmatamentoPorMunicipioAno = {};
    desmatamentoData.forEach(d => {
      if (!desmatamentoPorMunicipioAno[d.municipio]) {
        desmatamentoPorMunicipioAno[d.municipio] = {};
      }
      desmatamentoPorMunicipioAno[d.municipio][d.ano] = d.area_desmatada;
    });
    
    const pibPorMunicipioAno = {};
    pibData.forEach(p => {
      if (!pibPorMunicipioAno[p.municipio]) {
        pibPorMunicipioAno[p.municipio] = {};
      }
      pibPorMunicipioAno[p.municipio][p.ano] = {
        pib: p.pib,
        pib_per_capita: p.pib_per_capita,
        agropecuaria: p.valor_agropecuaria,
        industria: p.valor_industria,
        servicos: p.valor_servicos
      };
    });
    
    // Combinando os dados
    const dadosComparativos = [];
    
    const municipiosComuns = _.intersection(
      Object.keys(desmatamentoPorMunicipioAno),
      Object.keys(pibPorMunicipioAno)
    );
    
    municipiosComuns.forEach(municipio => {
      anosComuns.forEach(ano => {
        const desmatamento = desmatamentoPorMunicipioAno[municipio][ano];
        const dadosPib = pibPorMunicipioAno[municipio][ano];
        
        if (desmatamento !== undefined && dadosPib !== undefined) {
          dadosComparativos.push({
            municipio,
            ano,
            area_desmatada: desmatamento,
            pib: dadosPib.pib,
            pib_per_capita: dadosPib.pib_per_capita,
            agropecuaria: dadosPib.agropecuaria,
            industria: dadosPib.industria,
            servicos: dadosPib.servicos
          });
        }
      });
    });
    
    setComparativoData(dadosComparativos);
  };

  // Filtrando dados com base nas seleções
  // Função para garantir que os valores sejam númericos
  const garantirNumero = (valor) => {
    if (typeof valor === 'number' && !isNaN(valor)) {
      return valor;
    }
    return 0;
  };

  const dadosFiltrados = React.useMemo(() => {
    // Filtrando por municípios selecionados e intervalo de anos
    if (!desmatamentoData.length || !pibData.length) return { desmatamento: [], pib: [], comparativo: [] };
    
    const desmatamentoFiltrado = desmatamentoData.filter(d => 
      selectedMunicipios.includes(d.municipio) && 
      d.ano >= anoInicio && 
      d.ano <= anoFim
    ).map(d => ({
      ...d,
      area_desmatada: garantirNumero(d.area_desmatada)
    }));
    
    const pibFiltrado = pibData.filter(p => 
      selectedMunicipios.includes(p.municipio) && 
      p.ano >= anoInicio && 
      p.ano <= anoFim
    ).map(p => ({
      ...p,
      pib: garantirNumero(p.pib),
      pib_per_capita: garantirNumero(p.pib_per_capita),
      valor_agropecuaria: garantirNumero(p.valor_agropecuaria),
      valor_industria: garantirNumero(p.valor_industria),
      valor_servicos: garantirNumero(p.valor_servicos)
    }));
    
    const comparativoFiltrado = comparativoData.filter(c => 
      selectedMunicipios.includes(c.municipio) && 
      c.ano >= anoInicio && 
      c.ano <= anoFim
    ).map(c => ({
      ...c,
      area_desmatada: garantirNumero(c.area_desmatada),
      pib: garantirNumero(c.pib),
      pib_per_capita: garantirNumero(c.pib_per_capita),
      agropecuaria: garantirNumero(c.agropecuaria),
      industria: garantirNumero(c.industria),
      servicos: garantirNumero(c.servicos)
    }));
    
    return {
      desmatamento: desmatamentoFiltrado,
      pib: pibFiltrado,
      comparativo: comparativoFiltrado
    };
  }, [desmatamentoData, pibData, comparativoData, selectedMunicipios, anoInicio, anoFim]);

  // Dados para o gráfico de dispersão (relação desmatamento vs PIB)
  const dadosDispersao = React.useMemo(() => {
    try {
      return dadosFiltrados.comparativo.map(d => ({
        municipio: d.municipio,
        ano: d.ano,
        area_desmatada: garantirNumero(d.area_desmatada),
        pib: garantirNumero(d.pib) / 1000000, // convertendo para milhões
        pib_per_capita: garantirNumero(d.pib_per_capita)
      }));
    } catch (err) {
      console.error("Erro ao processar dados de dispersão:", err);
      return [];
    }
  }, [dadosFiltrados.comparativo]);

  // Agregação de dados por ano para todos os municípios selecionados
  const dadosAgregadosPorAno = React.useMemo(() => {
    try {
      // Garantindo que todos os objetos têm valores numéricos
      const desmatamentoSeguro = dadosFiltrados.desmatamento.map(d => ({
        ...d,
        area_desmatada: garantirNumero(d.area_desmatada),
        ano: garantirNumero(d.ano)
      }));
      
      const pibSeguro = dadosFiltrados.pib.map(p => ({
        ...p,
        pib: garantirNumero(p.pib),
        valor_agropecuaria: garantirNumero(p.valor_agropecuaria),
        valor_industria: garantirNumero(p.valor_industria),
        valor_servicos: garantirNumero(p.valor_servicos),
        ano: garantirNumero(p.ano)
      }));
      
      const desmatamentoPorAno = _.groupBy(desmatamentoSeguro, 'ano');
      const pibPorAno = _.groupBy(pibSeguro, 'ano');
      
      const anos = _.uniq([
        ...Object.keys(desmatamentoPorAno),
        ...Object.keys(pibPorAno)
      ]).map(ano => Number(ano)).filter(ano => !isNaN(ano)).sort((a, b) => a - b);
      
      return anos.map(ano => {
        const desmatamentoItens = desmatamentoPorAno[ano] || [];
        const pibItens = pibPorAno[ano] || [];
        
        const totalDesmatamento = _.sumBy(desmatamentoItens, item => garantirNumero(item.area_desmatada));
        const totalPib = _.sumBy(pibItens, item => garantirNumero(item.pib));
        const totalAgropecuaria = _.sumBy(pibItens, item => garantirNumero(item.valor_agropecuaria));
        const totalIndustria = _.sumBy(pibItens, item => garantirNumero(item.valor_industria));
        const totalServicos = _.sumBy(pibItens, item => garantirNumero(item.valor_servicos));
        
        return {
          ano,
          desmatamento: totalDesmatamento,
          pib: totalPib / 1000000, // convertendo para milhões
          agropecuaria: totalAgropecuaria / 1000000,
          industria: totalIndustria / 1000000,
          servicos: totalServicos / 1000000
        };
      });
    } catch (err) {
      console.error("Erro ao calcular dados agregados por ano:", err);
      return [];
    }
  }, [dadosFiltrados]);

  // Função para alternar seleção de município
  const toggleMunicipio = (municipio) => {
    if (selectedMunicipios.includes(municipio)) {
      if (selectedMunicipios.length > 1) {
        setSelectedMunicipios(selectedMunicipios.filter(m => m !== municipio));
      }
    } else {
      setSelectedMunicipios([...selectedMunicipios, municipio]);
    }
  };

  // Cores para os gráficos
  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="text-2xl font-bold text-blue-600">Carregando dados...</div>
        <p className="mt-2 text-gray-600">Por favor, aguarde enquanto processamos os dados.</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="text-2xl font-bold text-red-600">Erro!</div>
        <p className="mt-2 text-gray-600">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-blue-800">Dashboard de Análise: Desmatamento vs PIB na Amazônia Legal</h1>
          <p className="text-gray-600 mt-2">Análise comparativa entre desmatamento e atividade econômica nos municípios</p>
        </header>

        {/* Controles */}
        <div className="mb-8 bg-white p-4 rounded-lg shadow">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Filtros e Controles</h2>
            </div>
            <div className="flex flex-wrap gap-2 mt-2 md:mt-0">
              <button 
                className={`px-4 py-2 rounded ${visualizacaoAtual === 'desmatamento' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                onClick={() => setVisualizacaoAtual('desmatamento')}
              >
                Desmatamento
              </button>
              <button 
                className={`px-4 py-2 rounded ${visualizacaoAtual === 'pib' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                onClick={() => setVisualizacaoAtual('pib')}
              >
                PIB
              </button>
              <button 
                className={`px-4 py-2 rounded ${visualizacaoAtual === 'comparativo' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                onClick={() => setVisualizacaoAtual('comparativo')}
              >
                Comparativo
              </button>
              <button 
                className={`px-4 py-2 rounded ${visualizacaoAtual === 'setores' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                onClick={() => setVisualizacaoAtual('setores')}
              >
                Setores Econômicos
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Seleção de período */}
            <div>
              <h3 className="text-md font-medium mb-2">Período de Análise</h3>
              <div className="flex space-x-4">
                <div>
                  <label className="block text-sm text-gray-600">Ano Inicial</label>
                  <select 
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                    value={anoInicio}
                    onChange={(e) => setAnoInicio(Number(e.target.value))}
                  >
                    {Array.from({length: 16}, (_, i) => 2008 + i).map(ano => (
                      <option key={`inicio-${ano}`} value={ano}>{ano}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600">Ano Final</label>
                  <select 
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                    value={anoFim}
                    onChange={(e) => setAnoFim(Number(e.target.value))}
                  >
                    {Array.from({length: 16}, (_, i) => 2008 + i).map(ano => (
                      <option key={`fim-${ano}`} value={ano} disabled={ano < anoInicio}>{ano}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Seleção de municípios (com pesquisa) */}
            <div>
              <h3 className="text-md font-medium mb-2">Municípios Selecionados ({selectedMunicipios.length})</h3>
              <div className="flex flex-wrap gap-1 mb-2">
                {selectedMunicipios.map((municipio, index) => (
                  <span 
                    key={municipio} 
                    className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs flex items-center"
                  >
                    {municipio}
                    <button 
                      className="ml-1 text-blue-600 hover:text-blue-800"
                      onClick={() => toggleMunicipio(municipio)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="relative">
                <select 
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) toggleMunicipio(e.target.value);
                  }}
                >
                  <option value="">Adicionar município...</option>
                  {municipiosList
                    .filter(m => !selectedMunicipios.includes(m))
                    .map(municipio => (
                      <option key={municipio} value={municipio}>{municipio}</option>
                    ))
                  }
                </select>
              </div>
            </div>
          </div>
        </div>

       

        {/* Insights e Análises */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Insights Principais</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1 */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium text-blue-700 mb-2">Tendência de Desmatamento</h3>
              <p className="text-gray-700">
                {dadosAgregadosPorAno.length > 1 ? 
                  `Variação de ${(((dadosAgregadosPorAno[dadosAgregadosPorAno.length-1].desmatamento / 
                  dadosAgregadosPorAno[0].desmatamento) - 1) * 100).toFixed(1)}% no desmatamento entre ${
                    dadosAgregadosPorAno[0].ano} e ${dadosAgregadosPorAno[dadosAgregadosPorAno.length-1].ano}.` :
                  "Selecione um período maior para ver tendências de desmatamento."
                }
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-medium text-green-700 mb-2">Crescimento Econômico</h3>
              <p className="text-gray-700">
                {dadosAgregadosPorAno.length > 1 ? 
                  `Crescimento de ${(((dadosAgregadosPorAno[dadosAgregadosPorAno.length-1].pib / 
                  dadosAgregadosPorAno[0].pib) - 1) * 100).toFixed(1)}% no PIB entre ${
                    dadosAgregadosPorAno[0].ano} e ${dadosAgregadosPorAno[dadosAgregadosPorAno.length-1].ano}.` :
                  "Selecione um período maior para ver tendências econômicas."
                }
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-amber-50 p-4 rounded-lg">
              <h3 className="font-medium text-amber-700 mb-2">Setores Econômicos</h3>
              <p className="text-gray-700">
                {dadosAgregadosPorAno.length ? 
                  `Setor predominante: ${
                    dadosAgregadosPorAno[dadosAgregadosPorAno.length-1].servicos > 
                    dadosAgregadosPorAno[dadosAgregadosPorAno.length-1].agropecuaria &&
                    dadosAgregadosPorAno[dadosAgregadosPorAno.length-1].servicos > 
                    dadosAgregadosPorAno[dadosAgregadosPorAno.length-1].industria ? 'Serviços' :
                    dadosAgregadosPorAno[dadosAgregadosPorAno.length-1].industria > 
                    dadosAgregadosPorAno[dadosAgregadosPorAno.length-1].agropecuaria ? 'Indústria' : 'Agropecuária'
                  } nos municípios selecionados.` :
                  "Selecione municípios para ver a composição econômica."
                }
              </p>
            </div>
          </div>
        </div>

        {/* Tabela de dados */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Dados Detalhados</h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Município</th>
                  <th className="px-4 py-2 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ano</th>
                  <th className="px-4 py-2 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Desmatamento (km²)</th>
                  <th className="px-4 py-2 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PIB (R$ milhões)</th>
                  <th className="px-4 py-2 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PIB per capita (R$)</th>
                </tr>
              </thead>
              <tbody>
                {dadosFiltrados.comparativo.slice(0, 20).map((item, index) => (
                  <tr key={`${item.municipio}-${item.ano}-${index}`} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="px-4 py-2 border-b border-gray-200 text-sm">{item.municipio}</td>
                    <td className="px-4 py-2 border-b border-gray-200 text-sm">{item.ano}</td>
                    <td className="px-4 py-2 border-b border-gray-200 text-sm">{item.area_desmatada.toFixed(2)}</td>
                    <td className="px-4 py-2 border-b border-gray-200 text-sm">{(item.pib / 1000000).toFixed(2)}</td>
                    <td className="px-4 py-2 border-b border-gray-200 text-sm">{item.pib_per_capita.toFixed(2)}</td>
                  </tr>
                ))}
                {dadosFiltrados.comparativo.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-gray-500 italic">
                      Nenhum dado disponível para os filtros selecionados. Tente selecionar outros municípios ou período.
                    </td>
                  </tr>
                )}
                {dadosFiltrados.comparativo.length > 20 && (
                  <tr>
                    <td colSpan="5" className="px-4 py-2 text-center text-blue-600 italic">
                      Mostrando 20 de {dadosFiltrados.comparativo.length} registros. Refine seus filtros para ver mais detalhes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rodapé com metadados */}
        <footer className="mt-8 text-center text-gray-500 text-sm">
          <p>Dashboard criado com base nos dados de desmatamento da Amazônia Legal (2008-2023) e PIB municipal (2010-2021)</p>
          <p className="mt-1">Última atualização: 11/05/2025</p>
        </footer>
      </div>
    </div>
  );
}