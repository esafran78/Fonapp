const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8765;

const symbols = [
  "DSTKF","OZATD","PEKGY","TEHOL","TERA","TRHOL","ANELE","SELEC","SVGYO",
  "ALKLC","HEDEF","MANAS","DAPGM","EUPWR","EFOR","GESAN","TMPOL","BIGEN",
  "KARCL","METEN","SARAE","YKBNK","TURSG","AKSEN","KORDS","IEYHO","ISKPL","LIDER"
];

const fundSymbols = ["HMV","T3B","ABG","TMM","KVR","PFS"];

async function getYahoo(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.IS?range=5d&interval=1d&includePrePost=false`;
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
    const meta = res.data.chart.result[0].meta;
    let current = meta.regularMarketPrice ?? meta.previousClose;
    let prev = meta.previousClose;

    if (!prev) {
      const closes = res.data.chart.result[0].indicators.quote[0].close.filter(c => c !== null);
      if (closes.length >= 2) prev = closes[closes.length - 2];
    }
    return { symbol, current, previousClose: prev };
  } catch (e) {
    return null;
  }
}

async function getOneTefasFund(symbol) {
  try {
    const detailUrl = `https://www.tefas.gov.tr/tr/fon-detayli-analiz/${symbol}`;
    const apiUrl = "https://www.tefas.gov.tr/api/funds/fonFiyatBilgiGetir";
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      'Origin': 'https://www.tefas.gov.tr',
      'Referer': detailUrl
    };

    const payload = { fonKodu: symbol, dil: "TR", periyod: 12 };
    const res = await axios.post(apiUrl, payload, { headers, timeout: 10000 });
    const rows = res.data.resultList || [];

    const priced = rows.map(r => ({
      price: parseFloat(String(r.fiyat || r.price || '').replace(',', '.')),
      date: r.tarih || r.date
    })).filter(r => !isNaN(r.price)).sort((a, b) => new Date(a.date) - new Date(b.date));

    if (priced.length === 0) return null;

    const latest = priced[priced.length - 1];
    const previous = priced.length >= 2 ? priced[priced.length - 2].price : null;

    return { symbol, current: latest.price, previousClose: previous, source: "TEFAS", date: latest.date };
  } catch (e) {
    return null;
  }
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/provider', (req, res) => {
  res.json({ provider: "Yahoo Finance & TEFAS (Node.js)", mode: "cloud", realtimeReady: false });
});

app.get('/api/prices', async (req, res) => {
  const out = [];
  const errors = [];

  const stockPromises = symbols.map(async (s) => {
    const data = await getYahoo(s);
    if (data && data.current !== null) out.push(data);
    else errors.push(s);
  });

  const fundPromises = fundSymbols.map(async (f) => {
    const data = await getOneTefasFund(f);
    if (data && data.current !== null) out.push(data);
    else errors.push(f);
  });

  await Promise.all([...stockPromises, ...fundPromises]);

  res.json({
    okCount: out.length,
    data: out,
    errors,
    updated: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda aktif.`);
});