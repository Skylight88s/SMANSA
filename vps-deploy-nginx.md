# Panduan Deployment di VPS dengan NGINX

Website SPMB SMAN 1 Wamena ini menggunakan arsitektur **Express + React (Vite)**. Untuk men-deploy ini ke VPS dengan NGINX, Anda harus menjalankan server Node.js di background (contoh: pakai `pm2`) dan mengatur NGINX sebagai **Reverse Proxy**.

## Langkah 1: Persiapan di VPS
Pastikan VPS Anda sudah terinstal:
- **Node.js** (versi 18+)
- **NPM** (terbawa oleh Node.js)
- **NGINX**
- **PM2** (opsional tapi sangat disarankan: `npm install -g pm2`)

## Langkah 2: Build Aplikasi (Jika build di lokal)
Jalankan perintah ini di komputer lokal Anda atau di VPS:

```bash
npm install
npm run build
```
Perintah ini akan membuat folder `dist/` yang berisikan aset website yang sudah dikompresi serta `dist/server.cjs` yang merupakan entry-point backend Anda.

Kirim semua file project Anda ke VPS (kecuali `node_modules`).

## Langkah 3: Menjalankan Server Node.js di VPS
Di terminal VPS, masuk ke folder project Anda, lalu jalankan:

```bash
npm install --omit=dev  # Install dependency untuk production
pm2 start dist/server.cjs --name "spmb-wamena"
```
Server web Anda sekarang berjalan di VPS pada port `3000`.

## Langkah 4: Konfigurasi NGINX
Buat file konfigurasi NGINX baru di VPS Anda (misalnya di `/etc/nginx/sites-available/spmb`):

```nginx
server {
    listen 80;
    server_name spmb.domain.com; # Ganti dengan domain Anda atau IP VPS

    # Mengaktifkan kompresi GZIP di level NGNIX
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;

    location / {
        proxy_pass http://127.0.0.1:3000; # Mengarahkan trafik port 80 ke server Node lokal port 3000
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Langkah 5: Aktifkan Konfigurasi NGINX
Jalankan rentetan perintah ini untuk mengaktifkan config dan memuat ulang NGINX (berlaku di Ubuntu/Debian):

```bash
sudo ln -s /etc/nginx/sites-available/spmb /etc/nginx/sites-enabled/
sudo nginx -t     # Pastikan tertulis "syntax is ok" dan "test is successful"
sudo systemctl restart nginx
```

Selesai! Sekarang website Anda sudah dapat diakses melalui mesin NGINX Anda. Jangan lupa untuk mengatur SSL (HTTPS) menggunakan *Certbot / Let's Encrypt* untuk keamanan.
