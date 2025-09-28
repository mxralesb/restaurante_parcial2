import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import pkg from 'pg';

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined
});

// Health
app.get('/health', (_, res) => res.json({ ok: true }));

// Helpers
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// 1) POST /clientes/registrar
app.post('/clientes/registrar', async (req, res) => {
  try {
    const { nombre, email, telefono } = req.body || {};
    if (!nombre || !email || !telefono) return res.status(400).json({ error: 'nombre, email, telefono requeridos' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'email inválido' });

    const q = `INSERT INTO public.clientes (nombre, email, telefono)
               VALUES ($1, $2, $3) RETURNING id, nombre, email, telefono`;
    const { rows } = await pool.query(q, [nombre, email, telefono]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'nombre o email ya existe' });
    }
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// 2) POST /clientes/login  (email + telefono)
app.post('/clientes/login', async (req, res) => {
  try {
    const { email, telefono } = req.body || {};
    if (!email || !telefono) return res.status(400).json({ error: 'email y telefono requeridos' });
    const q = `SELECT id, nombre, email, telefono FROM public.clientes WHERE email=$1 AND telefono=$2`;
    const { rows } = await pool.query(q, [email, telefono]);
    if (rows.length === 0) return res.status(401).json({ error: 'credenciales inválidas' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// 3) POST /ordenes
app.post('/ordenes', async (req, res) => {
  try {
    const { cliente_id, platillo_nombre, notas } = req.body || {};
    if (!cliente_id || !platillo_nombre) return res.status(400).json({ error: 'cliente_id y platillo_nombre requeridos' });
    const q = `INSERT INTO public.ordenes (cliente_id, platillo_nombre, notas)
               VALUES ($1, $2, $3)
               RETURNING id, cliente_id, platillo_nombre, notas, estado, creado`;
    const { rows } = await pool.query(q, [cliente_id, platillo_nombre, notas || null]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// 4) GET /ordenes/:clienteId
app.get('/ordenes/:clienteId', async (req, res) => {
  try {
    const { clienteId } = req.params;
    const q = `SELECT id, cliente_id, platillo_nombre, notas, estado, creado
               FROM public.ordenes
               WHERE cliente_id=$1
               ORDER BY creado DESC`;
    const { rows } = await pool.query(q, [clienteId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// 5) PUT /ordenes/:id/estado  (pending -> preparing -> delivered)
app.put('/ordenes/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body || {};
    const allowed = ['pending', 'preparing', 'delivered'];
    if (!allowed.includes(estado)) return res.status(400).json({ error: 'estado inválido' });
    const q = `UPDATE public.ordenes SET estado=$1 WHERE id=$2 RETURNING id, cliente_id, platillo_nombre, notas, estado, creado`;
    const { rows } = await pool.query(q, [estado, id]);
    if (rows.length === 0) return res.status(404).json({ error: 'orden no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Static for local dev (serve client build if desired)
app.get('/', (_, res) => res.send('Ordenes API running'));

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
