const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Bellekte tutulacak güncel fon verileri
let fundsData = {
  "TLY": [],
  "TMV": [],
  "DFI": []
};

// TEFAS Üzerinden Canlı Hisse Ağırlıklarını Çeken Bot
async function fetchTefasData() {
  console.log("TEFAS üzerinden TLY, TMV ve DFI içerikleri çekiliyor...");
  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const targetFunds = ['TLY', 'TMV', 'DFI'];

    for (const fundCode of targetFunds) {
      try {
        // TEFAS Detay Sayfasına Git
        await page.goto(`https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod=${fundCode}`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Hisse senedi oranını ve içerikteki hisseleri çek
        const stockData = await page.evaluate(() => {
          const items = [];
          // TEFAS portföy dağılım tablosundaki hisse verilerini tara
          const rows = document.querySelectorAll('#MainContent_PanelPortfoyDagilim tr');
          rows.forEach(row => {
            const cols = row.querySelectorAll('td');
            if (cols.length >= 2) {
              const symbol = cols[0].innerText.trim();
              const weight = parseFloat(cols[1].innerText.replace(',', '.').trim());
              if (symbol && !isNaN(weight)) {
                items.push([symbol, weight]);
              }
            }
          });
          return items;
        });

        if (stockData.length > 0) {
          fundsData[fundCode] = stockData;
          console.log(`${fundCode} içeriği başarıyla çekildi: ${stockData.length} hisse bulundu.`);
        }
      } catch (err) {
        console.error(`${fundCode} çekilirken hata oluştu:`, err.message);
      }
    }
  } catch (error) {
    console.error("Puppeteer başlatılamadı:", error.message);
  } finally {
    if (browser) await browser.close();
  }
}

// Sunucu başladığında ilk çekimi yap ve her 6 saatte bir yenile
fetchTefasData();
setInterval(fetchTefasData, 6 * 60 * 60 * 1000);

// Ön yüze veriyi sunan API
app.get('/api/fund-weights', (req, res) => {
  res.json({ success: true, data: fundsData });
});

app.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} portunda çalışıyor.`);
});
