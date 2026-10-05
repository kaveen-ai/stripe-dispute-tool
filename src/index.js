// Environment variables load කරන්න
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const disputeRoutes = require('./routes/dispute');

const app = express();

// PORT — Render/Railway තමන්ගේ port එක inject කරනවා
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// ---------- Frontend static files serve කරන්න (public folder) ----------
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- API routes ----------
app.use('/api/dispute', disputeRoutes);

// ---------- Fallback: API නොවන හැම route එකකටම dashboard එක දෙන්න ----------
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Server start
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});