-- NetOnline Digital Signage — Migration v3.2.0
-- Günlük zamanlama kolonları
-- Idempotent: tekrar çalıştırılabilir.

ALTER TABLE videos ADD COLUMN IF NOT EXISTS schedule_days       jsonb;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS schedule_time_start text;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS schedule_time_end   text;

-- schedule_days formatı: [1,2,3,4,5] (1=Pazartesi ... 7=Pazar), null = her gün
-- schedule_time_start: "09:00" formatı, null = tüm gün
-- schedule_time_end:   "18:00" formatı, null = tüm gün
