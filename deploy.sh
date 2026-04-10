#!/bin/bash
# NetOnline Digital Signage — VPS Deploy Script
# Kullanım: SUPABASE_URL="https://..." SUPABASE_ANON_KEY="eyJ..." ./deploy.sh

set -e

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "HATA: SUPABASE_URL ve SUPABASE_ANON_KEY ortam değişkenleri gerekli."
  echo "Kullanım: SUPABASE_URL=\"https://...\" SUPABASE_ANON_KEY=\"eyJ...\" ./deploy.sh"
  exit 1
fi

echo "→ Credentials enjekte ediliyor..."
for file in index.html dashboard.html player.html; do
  sed -i "s|%%SUPABASE_URL%%|${SUPABASE_URL}|g" "$file"
  sed -i "s|%%SUPABASE_ANON_KEY%%|${SUPABASE_ANON_KEY}|g" "$file"
  echo "  ✓ $file"
done

echo "→ Deploy tamamlandı."
echo "  Dosyaları VPS'e kopyalayın: scp -r ./* user@server:/var/www/netonline-video-paneli/"
