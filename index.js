import express from 'express';
import fetch from 'node-fetch';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
const cols = db.prepare(`PRAGMA table_info(instrucoes)`).all();
const temCategoria = cols.some(col => col.name === 'categoria');
if (!temCategoria) {
  db.prepare(`ALTER TABLE instrucoes ADD COLUMN categoria TEXT`).run();
}

app.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;
    const text = payload?.data?.message?.text;
    const contactId = payload?.data?.contactId;

    if (!text || !contactId) {
      return res.status(400).json({ error: "text ou contactId ausente" });
    }

    const instrucoes = db.prepare(`SELECT texto FROM instrucoes ORDER BY created_at ASC`).all();
    const historicoBruto = db.prepare(`
      SELECT texto FROM logs
      WHERE contact_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(contactId);

    const messages = [];

    instrucoes.forEach(instrucao => {
      messages.push({
        role: "system",
        content: instrucao.texto
      });
    });

    historicoBruto.reverse().forEach(row => {
      messages.push({
        role: "user",
        content: row.texto
      });
    });

    messages.push({
      role: "user",
      content: text
    });

    const respostaGPT = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: messages,
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

app.get('/instrucoes', (req, res) => {
  const rows = db.prepare(`SELECT id, texto, created_at FROM instrucoes ORDER BY created_at ASC`).all();
  res.json(rows);
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
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
// Atualizar uma instrução
app.put('/instrucoes/:id', (req, res) => {
  const { id } = req.params;
  const { texto } = req.body;
  if (!texto) return res.status(400).json({ error: "Texto obrigatório" });

  const stmt = db.prepare(`UPDATE instrucoes SET texto = ? WHERE id = ?`);
  const info = stmt.run(texto, id);
  res.json({ status: "Instrução atualizada", changes: info.changes });
});

// Excluir uma instrução
app.delete('/instrucoes/:id', (req, res) => {
  const { id } = req.params;
  const stmt = db.prepare(`DELETE FROM instrucoes WHERE id = ?`);
  const info = stmt.run(id);
  res.json({ status: "Instrução excluída", changes: info.changes });
});
