import express from 'express';
import compression from 'compression';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import Papa from 'papaparse';
import 'dotenv/config';

// In-memory cache to handle high-speed requests
let sheetDataCache: any[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 0; // Disable server cache to fetch fresh data every time (Google Sheets still has a 5-min delay)

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
    
    // Add cache buster to bypass browser/intermediate network caches
    const fetchUrl = csvUrl.includes('?') ? `${csvUrl}&_t=${now}` : `${csvUrl}?_t=${now}`;
    sheetDataCache = await fetchAndParseCSV(fetchUrl);
    lastFetchTime = now;
  }
  return sheetDataCache;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add response compression
  app.use(compression());

  app.use(express.json());

  // API endpoints FIRST
  // In-memory messages fallback
  let messages: any[] = [];

  app.post('/api/message', async (req, res) => {
    try {
      const { nomor, nama, pesan } = req.body;
      if (!pesan) {
        return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
      }
      
      const newMessage = { nomor, nama, pesan, timestamp: new Date() };
      
      // Allow overriding existing local message
      const existingMemIndex = messages.findIndex(m => m.nomor === nomor);
      if (existingMemIndex >= 0) {
        messages[existingMemIndex] = newMessage;
      } else {
        messages.push(newMessage);
      }

      // Send to Google Apps Script Webhook
      const webhookUrl = process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL;
      if (webhookUrl) {
        try {
          const response = await fetch(webhookUrl, {
            method: 'POST',
            redirect: 'follow', // Make sure fetch follows Google's 302 redirect
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(newMessage)
          });
          if (!response.ok) {
            console.warn(`[Google Sheets Webhook] Gagal (Status: ${response.status}). Pastikan "Who has access" Web App disetel menjadi 'Anyone'.`);
          } else {
            console.log("[Google Sheets Webhook] Pesan berhasil dikirim ke spreadsheet.");
          }
        } catch (err) {
          console.error("[Google Sheets Webhook] Network error:", err);
        }
      }

      res.json({ success: true, message: 'Pesan berhasil dikirim' });
    } catch (error) {
      console.error('Error handling message submission:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/messages', async (req, res) => {
    try {
      // Read from the main sheet
      const data = await getSheetData();
      
      const sheetMessages = data
        .filter(row => (row['Pesan'] || row['pesan']) && String(row['Pesan'] || row['pesan']).trim() !== '')
        .map(row => ({
          nomor: row['Nomor Formulir'] || row['nomor'] || (Object.values(row)[0] as string) || '',
          nama: row['Nama'] || row['nama'] || '',
          pesan: row['Pesan'] || row['pesan'] || ''
        }));

      // Local in-memory messages (those just submitted and not yet in the sheet)
      // Keep only messages from the last 5 minutes to avoid showing deleted messages forever
      const now = new Date().getTime();
      messages = messages.filter(m => now - m.timestamp.getTime() < 5 * 60 * 1000);

      const activeMessages = [...sheetMessages];

      for (const msg of messages) {
         const inSheet = sheetMessages.find(sm => sm.nomor === msg.nomor);
         if (!inSheet) {
            activeMessages.push(msg);
         }
      }
      
      // Return latest messages
      res.json({ success: true, data: activeMessages.slice(-20).reverse() });
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
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
        // Find if we have a MORE RECENT message in local memory for this participant
        const localMsg = messages.find(m => m.nomor === participantCode);
        if (localMsg) {
          // Find the precise column name for "Pesan" to update it
          const keys = Object.keys(result);
          const pesanKey = keys.find(k => k.toLowerCase() === 'pesan') || 'Pesan';
          result[pesanKey] = localMsg.pesan;
        }

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
