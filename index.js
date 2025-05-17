const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const Database = require('better-sqlite3');
const app = express();
app.use(express.json());

const OPENAI_TOKEN = process.env.OPENAI_TOKEN;
const DIGISAC_TOKEN = process.env.DIGISAC_TOKEN;

const db = new Database('./logs.db');

db.prepare(`CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id TEXT,
  texto TEXT,
  resposta TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS instrucoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  texto TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`).run();

app.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;
    const text = payload?.data?.message?.text;
    const contactId = payload?.data?.contactId;

    if (!text || !contactId) {
      return res.status(400).json({ error: "text ou contactId ausente" });
    }

    const historico = db.prepare(`
      SELECT texto FROM logs
      WHERE contact_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(contactId).reverse().map(row => ({
      role: "user",
      content: row.texto
    }));

    historico.push({ role: "user", content: text });

    const respostaGPT = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": \`Bearer \${OPENAI_TOKEN}\`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: historico,
        temperature: 0.7
      })
    });

    const respostaJson = await respostaGPT.json();
    const resposta = respostaJson.choices[0].message.content;

    db.prepare(`INSERT INTO logs (contact_id, texto, resposta) VALUES (?, ?, ?)`)
      .run(contactId, text, resposta);

    await fetch("https://bsantos.digisac.biz/api/v1/messages", {
      method: "POST",
      headers: {
        "Authorization": \`Bearer \${DIGISAC_TOKEN}\`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: resposta,
        type: "chat",
        contactId: contactId,
        origin: "bot"
      })
    });

    res.json({ status: "ok", entrada: text, resposta });
  } catch (err) {
    console.error("❌ Erro:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/instrucoes', (req, res) => {
  const { texto } = req.body;
  if (!texto) return res.status(400).json({ error: "Texto da instrução é obrigatório." });

  const stmt = db.prepare(`INSERT INTO instrucoes (texto) VALUES (?)`);
  const info = stmt.run(texto);
  res.json({ status: "Instrução salva", id: info.lastInsertRowid });
});

app.get('/monitor', (req, res) => {
  const rows = db.prepare(`SELECT texto, resposta, contact_id, created_at FROM logs ORDER BY created_at DESC LIMIT 10`).all();
  res.json(rows);
});

app.get('/painel', (req, res) => {
  res.sendFile(__dirname + '/painel.html');
});

app.use('/static', express.static('static'));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(\`Servidor rodando na porta \${port}\`);
});
