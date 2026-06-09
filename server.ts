import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import Papa from 'papaparse';

// In-memory cache to handle high-speed requests
let sheetDataCache: any[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes cache

async function fetchAndParseCSV(url: string): Promise<any[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.statusText}`);
    }
    const csvText = await response.text();

    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as string[][];
          let headerRowIndex = -1;
          
          // Find the row that contains 'nomor', 'nama', etc.
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (row.some(cell => {
              const lower = cell.toLowerCase();
              return lower.includes('nomor') || lower.includes('nama') || lower.includes('peserta');
            })) {
              headerRowIndex = i;
              break;
            }
          }

          if (headerRowIndex === -1) {
            resolve([]);
            return;
          }

          const headers = rows[headerRowIndex];
          const dataRows = rows.slice(headerRowIndex + 1);
          
          const parsedData = dataRows.map(row => {
            const obj: any = {};
            headers.forEach((header, index) => {
              const cleanHeader = header.trim();
              if (cleanHeader) {
                obj[cleanHeader] = row[index] ? row[index].trim() : '';
              }
            });
            return obj;
          });
          
          resolve(parsedData);
        },
        error: (error) => reject(error),
      });
    });
  } catch (err) {
    console.error("Error fetching CSV:", err);
    return [];
  }
}

async function getSheetData(): Promise<any[]> {
  const now = Date.now();
  if (sheetDataCache.length === 0 || now - lastFetchTime > CACHE_TTL_MS) {
    const csvUrl = process.env.GOOGLE_SHEET_CSV_URL || "https://docs.google.com/spreadsheets/d/e/2PACX-1vQls-_eK2y98I26rfD6vFUrjo2IrSIUoQbGthp_AzkMzRa9ARseP-6_AAWtTbslNKoH15Yy-6GZatgd/pub?output=csv";
    if (!csvUrl) {
      console.warn("GOOGLE_SHEET_CSV_URL is not configured.");
      return [];
    }
    sheetDataCache = await fetchAndParseCSV(csvUrl);
    lastFetchTime = now;
  }
  return sheetDataCache;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API endpoints FIRST
  // In-memory messages fallback
  let messages: any[] = [];

  app.post('/api/message', async (req, res) => {
    const { nomor, nama, pesan } = req.body;
    if (!pesan) {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
    }
    
    // Validasi 1 Nomor = 1 Komentar
    const existing = messages.find(m => m.nomor === nomor);
    if (existing) {
      return res.status(400).json({ error: 'Nomor pendaftaran ini sudah mengirimkan pesan.' });
    }

    const newMessage = { nomor, nama, pesan, timestamp: new Date() };
    messages.push(newMessage);

    // Optional: Send to Google Apps Script Webhook to write to Sheet2
    const webhookUrl = process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newMessage)
        });
      } catch (err) {
        console.error("Failed to sync to Google Sheets:", err);
      }
    }

    res.json({ success: true, message: 'Pesan berhasil dikirim' });
  });

  let messagesCache: any[] = [];
  let lastMessagesFetchTime = 0;

  app.get('/api/messages', async (req, res) => {
    // If Admin configures Sheet2 CSV URL, we pull from there so if they delete a row, it syncs
    const sheetsCsvUrl = process.env.GOOGLE_SHEET_MESSAGES_CSV_URL;
    
    if (sheetsCsvUrl) {
      const now = Date.now();
      if (messagesCache.length === 0 || now - lastMessagesFetchTime > CACHE_TTL_MS) {
        messagesCache = await fetchAndParseCSV(sheetsCsvUrl);
        lastMessagesFetchTime = now;
      }
      // Re-populate inner state from sheet just in case
      messages = messagesCache.map(row => ({
        nomor: row['Nomor Formulir'] || row['nomor'] || row[Object.keys(row)[0]],
        nama: row['Nama'] || row['nama'] || '',
        pesan: row['Pesan'] || row['pesan'] || ''
      })).filter(m => m.pesan);
    }
    
    // Return latest 20 messages
    res.json({ success: true, data: messages.slice(-20).reverse() });
  });

  app.get('/api/check-status', async (req, res) => {
    const participantCode = req.query.nomor as string;

    if (!participantCode) {
      return res.status(400).json({ error: 'Nomor peserta diperlukan.' });
    }

    try {
      const data = await getSheetData();
      
      // Perform flexible column matching across common header namings
      const result = data.find(row => {
         const keys = Object.keys(row);
         for (const key of keys) {
           const normalizedKey = key.toLowerCase().trim();
           if (normalizedKey.includes('nomor') || normalizedKey.includes('no peserta') || normalizedKey.includes('id') || normalizedKey.includes('form')) {
             if (row[key] === participantCode) return true;
           }
         }
         
         // Fallback just in case first column is the participant code
         if (keys.length > 0 && row[keys[0]] === participantCode) return true;
         
         return false;
      });

      if (result) {
        return res.json({ found: true, data: result });
      }

      return res.json({ found: false });

    } catch (error) {
      console.error('Error handling check status:', error);
      res.status(500).json({ error: 'Terjadi kesalahan internal server' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use((req, res, next) => {
      vite.middlewares.handle(req, res, next);
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
