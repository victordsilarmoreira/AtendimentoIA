const express = require('express');
const app = express();
app.use(express.json());

const logs = [];

app.post('/webhook', (req, res) => {
  const payload = req.body;
  const text = payload?.data?.message?.text;
  const contactId = payload?.data?.contactId;

  const resposta = `Resposta automática para: ${text}`;
  logs.push({ texto: text, resposta });

  console.log('Webhook recebido:', { texto: text, contactId });
  res.json({ status: 'ok', entrada: text, resposta, logs: logs.slice(-10) });
});

app.get('/painel', (req, res) => {
  res.sendFile(__dirname + '/painel.html');
});

app.get('/monitor', (req, res) => {
  res.json(logs.slice(-10));
});

app.use('/static', express.static('static'));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor ativo na porta ${port}`);
});
