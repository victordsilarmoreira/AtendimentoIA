// index.js
const express = require('express');
const Database = require('better-sqlite3');
const app = express();
app.use(express.json());

const OPENAI_TOKEN = process.env.OPENAI_TOKEN;
const DIGISAC_TOKEN = process.env.DIGISAC_TOKEN;

const db = new Database('./logs.db');

// Criação das tabelas persistentes

db.run(`CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id TEXT,
  texto TEXT,
  resposta TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);


db.run(`CREATE TABLE IF NOT EXISTS instrucoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  texto TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);

// Rota principal de Webhook
app.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;
    const text = payload?.data?.message?.text;
    const contactId = payload?.data?.contactId;

    if (!text || !contactId) {
      return res.status(400).json({ error: "text ou contactId ausente" });
    }

    // Buscar as últimas 10 mensagens desse contato
    db.all(
      `SELECT texto FROM logs WHERE contact_id = ? ORDER BY created_at DESC LIMIT 10`,
      [contactId],
      async (err, rows) => {
        if (err) {
          console.error("Erro ao buscar histórico:", err);
          return res.status(500).json({ error: "Erro ao buscar histórico" });
        }

        const historico = rows.reverse().map(row => ({ role: "user", content: row.texto }));
        historico.push({ role: "user", content: text });

        // Enviar para ChatGPT
        const respostaGPT = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_TOKEN}`,
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

        // Salvar nova mensagem no banco
        db.run(`INSERT INTO logs (contact_id, texto, resposta) VALUES (?, ?, ?)`, [contactId, text, resposta]);

        // Enviar resposta para Digisac
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

        res.json({ status: "ok", entrada: text, resposta });
      }
    );

  } catch (err) {
    console.error("❌ Erro no webhook:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Monitoramento dos logs recentes
app.get('/monitor', (req, res) => {
  db.all(`SELECT texto, resposta, contact_id, created_at FROM logs ORDER BY created_at DESC LIMIT 10`, [], (err, rows) => {
    if (err) {
      console.error("Erro ao buscar logs:", err);
      return res.status(500).json({ error: "Erro ao buscar logs" });
    }
    res.json(rows);
  });
});

// Painel HTML
app.get('/painel', (req, res) => {
  res.sendFile(__dirname + '/painel.html');
});

// Registro de novas instruções
app.post('/instrucoes', (req, res) => {
  const { texto } = req.body;
  if (!texto) return res.status(400).json({ error: "Texto da instrução é obrigatório." });

  db.run(`INSERT INTO instrucoes (texto) VALUES (?)`, [texto], function (err) {
    if (err) {
      console.error("Erro ao salvar instrução:", err);
      return res.status(500).json({ error: "Erro ao salvar instrução." });
    }
    res.json({ status: "Instrução salva", id: this.lastID });
  });
});

// Servir arquivos estáticos (JS, CSS, etc)
app.use('/static', express.static('static'));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor ativo na porta ${port}`);
});
