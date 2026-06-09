/**
 * MiscFit - Core Engine (Frontend)
 * Gerencia a navegação, chamadas de API e interações da interface.
 */

// CONFIGURAÇÃO: URL fornecida pelo seu Google Apps Script (Corrigida com aspas)
const API_URL = 'https://script.google.com/macros/s/AKfycby-J5nLEW5bN2zZLcOZVSTeJJsiZHhNU4-I2OlX8dClAvCPWSC8MOTNsGwCVErizsoe/exec';

// Estado global do aplicativo para evitar requisições repetidas
let dadosUsuario = null;
let listaAlimentos = [];
let listaTreinosNativos = []; // Guarda o catálogo de exercícios vindo do Sheets

// Executa automaticamente assim que a página carrega no navegador
document.addEventListener("DOMContentLoaded", () => {
  inicializarApp();
});

/**
 * Faz a carga inicial de todos os módulos conectados ao Sheets.
 */
async function inicializarApp() {
  console.log("Inicializando MiscFit Engine...");
  await carregarPerfil();
  await carregarAlimentos();
  await carregarTreinosNativos(); // Inicializa o catálogo de calistenia
}

/**
 * SISTEMA DE NAVEGAÇÃO ENTRE TELAS
 * Alterna as seções ativas e muda o estado visual dos botões da nav bar.
 */
function navegarPara(idTela, botaoClicado) {
  // Esconde todas as seções
  document.querySelectorAll('.app-section').forEach(section => {
    section.classList.remove('active');
  });
  
  // Exibe a seção selecionada
  const telaAlvo = document.getElementById(idTela);
  if (telaAlvo) telaAlvo.classList.add('active');
  
  // Remove o estado ativo de todos os botões da barra de navegação
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Adiciona o estado ativo no botão que foi clicado
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
      
      atualizarProgressoAguaVisual(0); // Inicia o contador de água zerado
    } else {
      alert("Erro ao ler perfil: " + resultado.mensagem);
    }
  } catch (erro) {
    console.error("Erro na requisição de perfil:", erro);
  }
}

/**
 * BUSCA DE DADOS: carregarAlimentos
 * Baixa a lista de alimentos cadastrados da planilha para uso interno do app.
 */
async function carregarAlimentos() {
  try {
    const resposta = await fetch(`${API_URL}?action=listarAlimentos`);
    const resultado = await resposta.json();
    if (resultado.status === "sucesso") {
      listaAlimentos = resultado.dados;
      console.log(`${listaAlimentos.length} alimentos carregados localmente.`);
    }
  } catch (erro) {
    console.error("Erro ao carregar lista de alimentos:", erro);
  }
}

/**
 * RECURSO: CONTADOR DE ÁGUA
 * Soma a água consumida na tela e envia a requisição de gravação para o Sheets.
 */
let totalAguaConsumidaHoje = 0;

async function adicionarAgua(quantidadeMl) {
  totalAguaConsumidaHoje += quantidadeMl;
  atualizarProgressoAguaVisual(totalAguaConsumidaHoje);
  
  // Dispara o salvamento em background no Google Sheets
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

function atualizarProgressoAguaVisual(valorAtual) {
  document.getElementById("agua-atual").innerText = valorAtual;
  const meta = dadosUsuario ? dadosUsuario.metaAgua : 2000;
  
  // Calcula a porcentagem e limita em no máximo 100% da barra
  let porcentagem = (valorAtual / meta) * 100;
  if (porcentagem > 100) porcentagem = 100;
  
  // Altera dinamicamente a largura da barra CSS com efeito animado
  document.getElementById("barra-agua").style.width = `${porcentagem}%`;
}

/**
 * RECURSO: SALVAR REFEIÇÃO
 * Captura os dados do formulário e realiza o envio para o diário do Sheets.
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
 * Baixa o catálogo de exercícios da aba CADASTRO_TREINOS da planilha.
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
 * RECURSO: MONTAGEM DINÂMICA DA ROTINA (Sua Ideia Chave!)
 * Filtra os exercícios pelo bloco clicado (Treino A ou B) e monta os cards com fotos na tela.
 */
function carregarBlocoTreino(bloco) {
  document.querySelectorAll('.btn-bloco').forEach(btn => {
    btn.classList.remove('selected');
    if (btn.innerText === bloco) btn.classList.add('selected');
  });

  const container = document.getElementById("container-exercicios");
  container.innerHTML = ""; 

  // Filtra apenas os exercícios do bloco clicado
  const exerciciosDoBloco = listaTreinosNativos.filter(t => t.bloco.toLowerCase() === bloco.toLowerCase());

  if (exerciciosDoBloco.length === 0) {
    container.innerHTML = `<p style="text-align:center; color:var(--texto-mutado); padding:20px;">Nenhum exercício cadastrado para o ${bloco} na planilha.</p>`;
    return;
  }

  // Percorre cada exercício da planilha e constrói o card na tela
  exerciciosDoBloco.forEach((ex, index) => {
    const cardExercicios = document.createElement("div");
    cardExercicios.className = "card card-exercicio-item";
    
    // Imagem padrão caso o campo esteja em branco no Sheets
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
 * Dispara os dados digitados direto para a aba LOG_TREINOS do Sheets.
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
