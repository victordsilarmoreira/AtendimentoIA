async function carregarLogs() {
  const res = await fetch('/monitor');
  const dados = await res.json();
  document.getElementById('log').innerHTML = dados.map(item =>
    `<pre><b>Texto:</b> ${item.texto}\n<b>Resposta:</b> ${item.resposta}\n<b>Contato:</b> ${item.contact_id}</pre>`
  ).join('');
}

setInterval(carregarLogs, 3000);
carregarLogs();

document.getElementById("formInstrucoes").addEventListener("submit", async function (e) {
  e.preventDefault();
  const texto = document.getElementById("instrucaoTexto").value;

  const res = await fetch("/instrucoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texto })
  });

  const data = await res.json();
  document.getElementById("statusInstrucao").innerText = data.status || data.error;
  document.getElementById("instrucaoTexto").value = "";
  carregarInstrucoes();
});

async function carregarInstrucoes() {
  const res = await fetch("/instrucoes");
  const instrucoes = await res.json();

  const lista = instrucoes.map(instrucao => `
    <div class="instrucao" data-id="${instrucao.id}">
      <textarea rows="3">${instrucao.texto}</textarea><br>
      <select class="categoria">
        <option value="geral"${instrucao.categoria === 'geral' ? ' selected' : ''}>Geral</option>
        <option value="promoção"${instrucao.categoria === 'promoção' ? ' selected' : ''}>Promoção</option>
        <option value="produto"${instrucao.categoria === 'produto' ? ' selected' : ''}>Produto</option>
        <option value="comportamento"${instrucao.categoria === 'comportamento' ? ' selected' : ''}>Comportamento</option>
      </select><br>
      <button onclick="editarInstrucao(${instrucao.id}, this)">Salvar</button>
      <button onclick="excluirInstrucao(${instrucao.id})">Excluir</button>
    </div>
  `).join('');

  document.getElementById("listaInstrucoes").innerHTML = lista;
}


const textarea = btn.parentElement.querySelector("textarea");
const select = btn.parentElement.querySelector("select");
const texto = textarea.value;
const categoria = select.value;

const res = await fetch(`/instrucoes/${id}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ texto, categoria })
});


async function excluirInstrucao(id) {
  if (!confirm("Deseja realmente excluir esta instrução?")) return;
  const res = await fetch(`/instrucoes/${id}`, {
    method: "DELETE"
  });
  const data = await res.json();
  alert(data.status || data.error);
  carregarInstrucoes();
}

carregarInstrucoes();

