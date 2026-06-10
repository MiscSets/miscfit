/**
 * MiscFit - Core Engine (Frontend)
 * Gerencia a navegação, chamadas de API e interações da interface.
 * Powered by MiscSets.
 */

// CONFIGURAÇÃO: URL fornecida pelo seu Google Apps Script (Mude para /exec ao subir para produção)
const API_URL = 'https://script.google.com/macros/s/AKfycby-J5nLEW5bN2zZLcOZVSTeJJsiZHhNU4-I2OlX8dClAvCPWSC8MOTNsGwCVErizsoe/exec';

// Estado global do aplicativo para evitar requisições repetidas
let dadosUsuario = null;
let listaAlimentos = [];
let listaTreinosNativos = []; // Guarda o catálogo de exercícios vindo do Sheets
let totalAguaConsumidaHoje = 0;

// Executa automaticamente assim que a página carrega no navegador
document.addEventListener("DOMContentLoaded", () => {
  inicializarApp();
});

/**
 * Faz a carga inicial de todos os módulos conectados ao Sheets.
 */
async function inicializarApp() {
  console.log("Inicializando MiscFit Engine em modo paralelo...");
  
  try {
    // Dispara as 4 requisições ao mesmo tempo. O app só vai demorar o tempo da requisição mais lenta!
    await Promise.all([
      carregarPerfil(),
      carregarAlimentos(),
      carregarTreinosNativos(),
      sincronizarConsumoDiario() // Agora a água roda no milissegundo zero junto com o resto!
    ]);
    
    console.log("Todos os módulos do MiscFit foram carregados com sucesso!");
  } catch (erro) {
    console.error("Erro durante o carregamento paralelo do app:", erro);
  }
}

/**
 * SISTEMA DE NAVEGAÇÃO ENTRE TELAS
 * Alterna as seções ativas e muda o estado visual dos botões da nav bar.
 */
function navegarPara(idTela, botaoClicado) {
  document.querySelectorAll('.app-section').forEach(section => {
    section.classList.remove('active');
  });
  
  const telaAlvo = document.getElementById(idTela);
  if (telaAlvo) telaAlvo.classList.add('active');
  
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.remove('active');
  });
  
  if (botaoClicado) botaoClicado.classList.add('active');
}

/**
 * BUSCA DE DADOS: carregarPerfil
 * Consome o endpoint 'buscarPerfil' do backend e renderiza as metas na tela.
 */
async function carregarPerfil() {
  try {
    const resposta = await fetch(`${API_URL}?action=buscarPerfil`);
    const resultado = await resposta.json();
    
    if (resultado.status === "sucesso") {
      dadosUsuario = resultado.dados;
      
      // Atualiza os elementos do HTML com os dados dinâmicos do Sheets
      document.getElementById("lbl-peso").innerText = dadosUsuario.pesoAtual;
      document.getElementById("macro-cal-meta").innerText = dadosUsuario.caloriasMeta;
      document.getElementById("macro-prot-meta").innerText = dadosUsuario.proteinaMeta;
      document.getElementById("agua-meta").innerText = dadosUsuario.metaAgua;
      // Em vez de zerar (0), passa a variável global que guarda a água do dia!
      atualizarProgressoAguaVisual(totalAguaConsumidaHoje);
    } else {
      alert("Erro ao ler perfil: " + resultado.mensagem);
    }
  } catch (erro) {
    console.error("Erro na requisição de perfil:", erro);
  }
}

/**
 * INTERFACE: atualizarSugestoesAlimentos
 * Preenche o datalist com os alimentos cadastrados na planilha
 */
function atualizarSugestoesAlimentos(alimentos) {
  const datalist = document.getElementById("lista-alimentos");
  
  // Limpa sugestões antigas para não duplicar
  datalist.innerHTML = "";
  
  // Roda cada alimento da planilha e cria uma opção para o buscador
  alimentos.forEach(alimento => {
    const option = document.createElement("option");
    option.value = alimento.nome; // O que vai ser escrito no campo (ex: "Magic Toast Original")
    datalist.appendChild(option);
  });
}

/**
 * BUSCA DE DADOS: carregarAlimentos (ATUALIZADO COM AUTOCOMPLETE)
 * Baixa a lista de alimentos cadastrados da planilha para uso interno do app.
 */
async function carregarAlimentos() {
  try {
    const resposta = await fetch(`${API_URL}?action=listarAlimentos`);
    const resultado = await resposta.json();
    if (resultado.status === "sucesso") {
      listaAlimentos = resultado.dados;
      console.log(`${listaAlimentos.length} alimentos carregados localmente.`);
      
      // TOQUE FINAL: Alimenta o datalist do HTML com os alimentos que acabaram de vir do Sheets
      atualizarSugestoesAlimentos(listaAlimentos);
      
    }
  } catch (erro) {
    console.error("Erro ao carregar lista de alimentos:", erro);
  }
}

/**
 * RECURSO: SINCRONIZAÇÃO HISTÓRICA DO DIA
 * Puxa do backend o somatório de água e macros já registrados na data de hoje.
 */
async function sincronizarConsumoDiario() {
  try {
    const resposta = await fetch(`${API_URL}?action=buscarConsumoHoje`);
    const resultado = await resposta.json();
    
    if (resultado.status === "sucesso") {
      // Atualiza os contadores globais com os dados reais salvos no Sheets
      totalAguaConsumidaHoje = resultado.dados.aguaTotal || 0;
      const caloriasHoje = resultado.dados.caloriasTotal || 0;
      const proteinasHoje = resultado.dados.proteinasTotal || 0;
      
      // Renderiza os valores recuperados direto na interface
      document.getElementById("macro-cal-consumidas").innerText = caloriasHoje.toFixed(0);
      document.getElementById("macro-prot-consumidas").innerText = proteinasHoje.toFixed(1);
      atualizarProgressoAguaVisual(totalAguaConsumidaHoje);
      
      console.log("Sincronização diária concluída com sucesso.");
    }
  } catch (erro) {
    console.error("Erro ao sincronizar consumo do dia:", erro);
  }
}

/**
 * RECURSO: CONTADOR DE ÁGUA
 * Soma a água consumida na tela e envia a requisição de gravação para o Sheets.
 */
async function adicionarAgua(quantidadeMl) {
  totalAguaConsumidaHoje += quantidadeMl;
  atualizarProgressoAguaVisual(totalAguaConsumidaHoje);
  
  try {
    const resposta = await fetch(`${API_URL}?action=salvarAgua&quantidade=${quantidadeMl}`);
    const resultado = await resposta.json();
    if (resultado.status !== "sucesso") {
      console.error("Erro ao salvar água na planilha:", resultado.mensagem);
    }
  } catch (erro) {
    console.error("Erro de rede ao salvar água:", erro);
  }
}

/**
 * ATUALIZAÇÃO VISUAL: Sistema Dinâmico de Dupla Barra (Azul / Laranja Excedente)
 */
function atualizarProgressoAguaVisual(valorAtual) {
  document.getElementById("agua-atual").innerText = valorAtual;
  const meta = dadosUsuario ? dadosUsuario.metaAgua : 2000;
  
  const barraAzul = document.getElementById("barra-agua");
  const barraLaranja = document.getElementById("barra-agua-excedente");
  
  if (valorAtual <= meta) {
    // Cenário Normal: Abaixo ou igual à meta (Apenas a barra azul enche)
    let porcentagemAzul = (valorAtual / meta) * 100;
    if (barraAzul) barraAzul.style.width = `${porcentagemAzul}%`;
    if (barraLaranja) barraLaranja.style.width = `0%`; // Oculta a laranja
  } else {
    // Cenário de Super-Hidratação: Passou da meta!
    if (barraAzul) barraAzul.style.width = `100%`; // Trava a azul em 100%
    
    // Calcula quanto passou da meta e joga na proporção da segunda barra (limite máximo de +100%)
    let excedente = valorAtual - meta;
    let porcentagemLaranja = (excedente / meta) * 100;
    if (porcentagemLaranja > 100) porcentagemLaranja = 100;
    
    if (barraLaranja) barraLaranja.style.width = `${porcentagemLaranja}%`;
  }
}

/**
 * RECURSO: SALVAR REFEIÇÃO
 */
async function enviarRefeicao() {
  const refeicao = document.getElementById("select-refeicao").value;
  const nomeAlimento = document.getElementById("input-alimento").value;
  const quantidade = parseFloat(document.getElementById("input-qtd").value);
  
  if (!nomeAlimento || isNaN(quantidade)) {
    alert("Por favor, preencha o nome do alimento e a quantidade em gramas.");
    return;
  }
  
  const alimentoEncontrado = listaAlimentos.find(a => a.nome.toLowerCase() === nomeAlimento.toLowerCase());
  
  let kcalCalculadas = 0;
  let protCalculadas = 0;
  
  if (alimentoEncontrado) {
    kcalCalculadas = (alimentoEncontrado.calorias * quantidade) / 100;
    protCalculadas = (alimentoEncontrado.proteinas * quantidade) / 100;
  }
  
  const urlEnvio = `${API_URL}?action=salvarRefeicao&refeicao=${encodeURIComponent(refeicao)}&alimento=${encodeURIComponent(nomeAlimento)}&quantidade=${quantidade}&calorias=${kcalCalculadas}&proteinas=${protCalculadas}`;
  
  try {
    const resposta = await fetch(urlEnvio);
    const resultado = await resposta.json();
    
    if (resultado.status === "sucesso") {
      alert(`Registrado! +${kcalCalculadas.toFixed(0)} kcal e +${protCalculadas.toFixed(1)}g Proteínas.`);
      
      const calAtuais = parseFloat(document.getElementById("macro-cal-consumidas").innerText);
      const protAtuais = parseFloat(document.getElementById("macro-prot-consumidas").innerText);
      
      document.getElementById("macro-cal-consumidas").innerText = (calAtuais + kcalCalculadas).toFixed(0);
      document.getElementById("macro-prot-consumidas").innerText = (protAtuais + protCalculadas).toFixed(1);
      
      document.getElementById("input-alimento").value = "";
      document.getElementById("input-qtd").value = "";
    } else {
      alert("Erro ao salvar refeição: " + resultado.mensagem);
    }
  } catch (erro) {
    console.error("Erro ao enviar refeição:", erro);
  }
}

/**
 * BUSCA DE DADOS: carregarTreinosNativos
 */
async function carregarTreinosNativos() {
  try {
    const resposta = await fetch(`${API_URL}?action=listarTreinos`);
    const resultado = await resposta.json();
    if (resultado.status === "sucesso") {
      listaTreinosNativos = resultado.dados;
      console.log(`${listaTreinosNativos.length} exercícios de calistenia carregados.`);
    }
  } catch (erro) {
    console.error("Erro ao carregar treinos nativos:", erro);
  }
}

/**
 * RECURSO: MONTAGEM DINÂMICA DA ROTINA
 */
function carregarBlocoTreino(bloco) {
  document.querySelectorAll('.btn-bloco').forEach(btn => {
    btn.classList.remove('selected');
    if (btn.innerText === bloco) btn.classList.add('selected');
  });

  const container = document.getElementById("container-exercicios");
  container.innerHTML = ""; 

  const exerciciosDoBloco = listaTreinosNativos.filter(t => t.bloco.toLowerCase() === bloco.toLowerCase());

  if (exerciciosDoBloco.length === 0) {
    container.innerHTML = `<p style="text-align:center; color:var(--texto-mutado); padding:20px;">Nenhum exercício cadastrado para o ${bloco} na planilha.</p>`;
    return;
  }

  exerciciosDoBloco.forEach((ex, index) => {
    const cardExercicios = document.createElement("div");
    cardExercicios.className = "card card-exercicio-item";
    
    const urlImagem = ex.urlImagem || "https://via.placeholder.com/150?text=Calistenia";

    cardExercicios.innerHTML = `
      <div class="exercicio-layout">
        <img src="${urlImagem}" alt="${ex.exercicio}" class="img-boneco-calistenia">
        <div class="exercicio-info">
          <h4>${ex.exercicio}</h4>
          <p class="meta-info"><i class="fa-solid fa-bullseye"></i> Meta: ${ex.metaSeries}x ${ex.metaRepeticoes}</p>
          
          <div class="inputs-log-treino">
            <input type="text" id="log-series-${index}" placeholder="Feito (Ex: 4x12)" value="${ex.metaSeries}x${ex.metaRepeticoes}">
            <input type="text" id="log-carga-${index}" placeholder="Carga/Tempo" value="-">
          </div>
          
          <button class="btn-check" id="btn-check-${index}" onclick="concluirExercicioNoSheets('${bloco}', '${ex.exercicio}', ${index})">
            <i class="fa-solid fa-circle-check"></i> Concluir Exercício
          </button>
        </div>
      </div>
    `;
    container.appendChild(cardExercicios);
  });
}

/**
 * RECURSO: CONCLUIR EXERCÍCIO
 */
async function concluirExercicioNoSheets(bloco, nomeExercicio, index) {
  const seriesFeitas = document.getElementById(`log-series-${index}`).value;
  const cargaAdicional = document.getElementById(`log-carga-${index}`).value;
  const botao = document.getElementById(`btn-check-${index}`);

  if (!seriesFeitas) {
    alert("Por favor, informe as séries e repetições concluídas.");
    return;
  }

  botao.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Gravando...`;
  botao.style.pointerEvents = "none";

  const urlEnvio = `${API_URL}?action=salvarTreino&bloco=${encodeURIComponent(bloco)}&exercicio=${encodeURIComponent(nomeExercicio)}&seriesRepeticoes=${encodeURIComponent(seriesFeitas)}&tempoCarga=${encodeURIComponent(cargaAdicional)}`;

  try {
    const resposta = await fetch(urlEnvio);
    const resultado = await resposta.json();

    if (resultado.status === "sucesso") {
      botao.innerHTML = `<i class="fa-solid fa-check-double"></i> Concluído!`;
      botao.style.background = "rgba(57, 255, 20, 0.2)";
      botao.style.color = "var(--verde-neon)";
      botao.style.border = "1px solid var(--verde-neon)";
    } else {
      alert("Erro ao salvar exercício: " + resultado.mensagem);
      botao.innerHTML = `<i class="fa-solid fa-circle-check"></i> Concluir Exercício`;
      botao.style.pointerEvents = "auto";
    }
  } catch (erro) {
    console.error("Erro de rede ao salvar treino:", erro);
    botao.innerHTML = `<i class="fa-solid fa-circle-check"></i> Concluir Exercício`;
    botao.style.pointerEvents = "auto";
  }
}
