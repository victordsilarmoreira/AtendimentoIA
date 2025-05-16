const express = require('express');
const app = express();
app.use(express.json());

const logs = [];

const OPENAI_TOKEN = process.env.OPENAI_TOKEN;
const DIGISAC_TOKEN = "fdb36d7ef9c813c6516ff7fae664a529199b4311";

app.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;
    const text = payload?.data?.message?.text;
    const contactId = payload?.data?.contactId;

    if (!text || !contactId) {
      return res.status(400).json({ error: "text ou contactId ausente" });
    }

    // Etapa 1: Enviar para ChatGPT
   const respostaGPT = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${OPENAI_TOKEN}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "Você é um atendente simpático do outlet Só Marcas." },
      { role: "user", content: text }
    ],
    temperature: 0.7
  })
});
const respostaJson = await respostaGPT.json();
const resposta = respostaJson.choices[0].message.content;


    // Etapa 2: Enviar resposta para o Digisac
  await fetch("https://bsantos.digisac.biz/api/v1/messages", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${DIGISAC_TOKEN}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    text: resposta,
    type: "chat",
    contactId: contactId,
    origin: "bot"
  })
});

    // Log interno
    logs.push({ texto: text, resposta });
    if (logs.length > 20) logs.shift();

    console.log("✅ Webhook processado com sucesso:", { text, resposta });
    res.json({ status: "ok", entrada: text, resposta });

  } catch (err) {
    console.error("❌ Erro no webhook:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/monitor', (req, res) => {
  res.json(logs.slice(-10));
});

app.get('/painel', (req, res) => {
  res.sendFile(__dirname + '/painel.html');
});

app.use('/static', express.static('static'));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor ativo na porta ${port}`);
});
