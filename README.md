# HERCOTIK Typing Race — Cloudflare Online (Revisi 19 Sep 2026)

## Revisi yang diterapkan

1. Race screen memakai `public/assets/bg-race.png`.
2. Tombol peserta setelah isi nama adalah **READY**.
3. Tidak ada waiting timer 20 detik. Race hanya dimulai saat server menekan **START**. Peserta melihat **Waiting server to start race**.
4. Waiting room memakai `public/assets/bg-waiting-room.png`.
5. Result screen memakai `public/assets/bg-result.jpg`.
6. Countdown **3 → 2 → 1 → GO!** diperpanjang; 3/2/1 memakai efek lampu merah dan GO memakai efek lampu hijau.
7. Typo bersifat kumulatif permanen per race. Setiap karakter salah yang diketik menambah TYPO dan tidak berkurang meskipun karakter dihapus/diperbaiki.
8. Tidak ada indikator typo tambahan di bagian bawah typing box; indikator TYPO tetap ada di panel statistik atas.
9. Typing box dipersempit dan target dibuat sekitar 2 baris agar pandangan tidak terlalu melebar.
10. Result layout dipadatkan sehingga tombol NEXT tetap terlihat tanpa perlu zoom-out.
11. Logo HERCOTIK dihapus dari result/podium screen.
12. Server mempunyai tombol **FINISH RACE** untuk memaksa race selesai walau masih ada peserta yang belum finish.
13. Result server menampilkan top 3 dalam card besar dengan Rank/WPM/Typo/Total Time; peserta di bawah top 3 ditampilkan sebagai rank ringkas.
14. Peserta yang belum finish saat server menekan FINISH RACE tetap mendapat nomor rank, tetapi WPM/Typo/Total Time ditampilkan `-`.
15. Tombol **NEW RACE** mengembalikan flow ke waiting room. Server mereset room untuk semua peserta.
16. Teks race: `Ras4 kaNg3n teRob\@ti dEn6an mndEn9ark4N RekAm4N 5uAra km!,.. #m!$sy0uSoMuCh :\*`

## Perbaikan teknis tambahan

- Server tidak lagi ikut dihitung sebagai peserta/ranking.
- Timer WPM/race menggunakan waktu epoch yang konsisten sehingga tidak menghasilkan waktu negatif.
- Countdown dan race start disinkronkan dengan timestamp `countdownAt` / `raceAt`.
- Jika semua peserta sudah finish secara natural, result otomatis ditampilkan. FINISH RACE tetap bisa dipakai untuk DNF.
- Data TYPO di server tidak bisa turun karena update lama/terlambat.
- Nama peserta di-render aman agar tidak menyisipkan HTML.

## Background assets

File yang digunakan oleh UI:

- `public/assets/bg-race.png` — race screen
- `public/assets/bg-waiting-room.png` — waiting room
- `public/assets/bg-result.jpg` — result & top-3 screen
- `public/assets/bg-main.png` — launcher & input nama

## Deploy ke Cloudflare

```bash
npm install -g wrangler
wrangler login
wrangler deploy
```

Setelah deploy, buka URL Worker sebagai server. Server akan membuat room dan memberikan player link.
