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
});
