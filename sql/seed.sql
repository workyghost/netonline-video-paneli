-- sql/seed.sql

-- 1. Ensure you have created your Admin user via the Supabase Auth UI before using this.
-- Sign up using email 'admin@netonline.com' and password 'admin123'.

-- 2. Insert Mock Firms
insert into firms (id, name) values
  ('d8b8a5b2-3c4a-4710-bb97-b1a1361c713b', 'Nethouse Networks'),
  ('b9b6e8f4-6a06-4078-a429-0d19de4bbd72', 'Kuzey Kıbrıs Turkcell'),
  ('33f2e132-75d8-4f1e-9e79-880fa1fe0672', 'Creditwest Bank'),
  ('c3194aab-61d0-4d53-b09e-76e9a657c917', 'Eziç Restaurant');

-- 3. Insert Mock Videos
insert into videos (id, title, firm_id, orientation, file_name, file_url, thumbnail_url, is_active) values
  ('ee1dd410-0931-4e4b-9eab-d2ed9c03b145', 'Nethouse Kampanya 2026', 'd8b8a5b2-3c4a-4710-bb97-b1a1361c713b', 'horizontal', 'camp26.mp4', 'https://example.com/camp26.mp4', 'https://example.com/thumb.jpg', true),
  ('12a76db2-b6ab-4fef-9a71-6c1d1a1b1a12', 'KKTCELL Platinum', 'b9b6e8f4-6a06-4078-a429-0d19de4bbd72', 'vertical', 'plat.mp4', 'https://example.com/plat.mp4', 'https://example.com/thumb2.jpg', true);

-- 4. Insert Mock Playlists
insert into playlists (id, firm_id, name, items) values
  ('fa2bb450-4820-4a81-9b16-928cc2ab83dd', 'd8b8a5b2-3c4a-4710-bb97-b1a1361c713b', 'Sabah Yayını', '[{"videoId": "ee1dd410-0931-4e4b-9eab-d2ed9c03b145", "order": 0, "durationOverride": null}]'::jsonb);

-- 5. Insert Mock Screens
insert into screens (id, firm_id, name, location, orientation, status, playlist_id) values
  ('6c23ce02-12af-40af-a827-02450c2ab1e2', 'd8b8a5b2-3c4a-4710-bb97-b1a1361c713b', 'Giriş Ekranı', 'Resepsiyon', 'horizontal', 'offline', 'fa2bb450-4820-4a81-9b16-928cc2ab83dd'),
  ('44a56c4d-df41-4774-9f20-b3b4f6b4d32a', 'b9b6e8f4-6a06-4078-a429-0d19de4bbd72', 'Kiosk Yanı', 'AVM Zemin Kat', 'vertical', 'offline', null);
