-- Speichert die vom User im Site-Nav gewählte Sprache. Wird beim Login
-- angewendet, wenn auf dem Gerät noch keine Wahl in localStorage steht.
-- Werte auf whitelist beschränken damit RLS-Update-Bugs kein garbage reinlegen.

alter table public.profiles
    add column if not exists preferred_language text;

alter table public.profiles
    drop constraint if exists profiles_preferred_language_check;

alter table public.profiles
    add constraint profiles_preferred_language_check
    check (preferred_language is null or preferred_language in ('de', 'ru'));

-- profiles_public View braucht KEIN preferred_language exposure — die Sprache
-- ist rein clientseitig, nichts womit man andere User anzeigen müsste.
