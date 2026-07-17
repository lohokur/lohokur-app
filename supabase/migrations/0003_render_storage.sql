-- Render media storage.
--
-- Generated images are stored in a public Storage bucket ("renders") and the
-- canvas keeps only the URL, instead of embedding base64 in projects.flow.
--
-- The bucket is also created lazily in code (lib/storage.ts -> ensureBucket) so
-- prod self-heals, but we declare it here so the schema is reproducible.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('renders', 'renders', true, 20971520, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read is served via the bucket's `public` flag; uploads happen with the
-- service-role key (bypasses RLS), so no additional storage.objects policy is
-- required for the app's use.
