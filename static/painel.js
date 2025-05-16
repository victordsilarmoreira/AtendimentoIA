async function carregarLogs() {
  const res = await fetch('/monitor');
  const dados = await res.json();
  document.getElementById('log').innerHTML = dados.map(item =>
    `<pre><b>Texto:</b> ${item.texto}\n<b>Resposta:</b> ${item.resposta}</pre>`
  ).join('');
}

setInterval(carregarLogs, 3000);
carregarLogs();
