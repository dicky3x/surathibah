// Vercel Serverless Function: baca nomor perjanjian hibah (tulisan tangan) dengan Claude vision.
// Env: ANTHROPIC_API_KEY (wajib), APP_CODE (opsional, kode akses), ANTHROPIC_MODEL (opsional)
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(501).json({ error: 'ANTHROPIC_API_KEY belum diset di Vercel' });
  if (process.env.APP_CODE && req.headers['x-access-code'] !== process.env.APP_CODE)
    return res.status(401).json({ error: 'Kode akses salah' });
  const image = req.body && req.body.image;
  if (typeof image !== 'string' || !image.startsWith('data:image/jpeg;base64,') || image.length > 3_000_000)
    return res.status(400).json({ error: 'Gambar tidak valid' });

  const prompt =
    'Ini bagian atas "Naskah Perjanjian Hibah" Indonesia. Ada dua baris NOMOR. Baris pertama = nomor perjanjian ' +
    'dari pemberi hibah (sering ditulis tangan, contoh bentuk: 900.1.5/BKBP-Wasnas/187). Baris kedua = nomor penerima ' +
    '(cetak, mengandung KPN/PN). Baca HANYA baris NOMOR pertama persis seperti tertulis, jangan menebak karakter yang ' +
    'tidak jelas. Balas hanya JSON: {"nomor":"...","yakin":true|false}. Jika tidak terbaca, {"nomor":"","yakin":false}.';
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 200,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image.split(',')[1] } },
          { type: 'text', text: prompt }] }],
      }),
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: (j.error && j.error.message) || 'Gagal memanggil API' });
    const text = (j.content || []).map(c => c.text || '').join('');
    const m = text.match(/\{[\s\S]*\}/);
    const out = m ? JSON.parse(m[0]) : {};
    return res.status(200).json({ nomor: String(out.nomor || '').trim(), yakin: out.yakin !== false });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
