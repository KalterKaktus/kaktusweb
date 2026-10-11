// Local PostgreSQL-in-WASM harness. Never connects to the hosted Supabase project.
// Install @electric-sql/pglite in an ignored directory, or set PGLITE_MODULE to
// its absolute dist/index.js path; it is deliberately not a website dependency.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const testUsers = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
export async function createCasinoTestDb({ through = '99999999999999', afterExisting } = {}) {
  const modulePath = process.env.PGLITE_MODULE || path.join(projectRoot, 'games/LuckyLounge/_dev/sql-check/node_modules/@electric-sql/pglite/dist/index.js');
  const { PGlite } = await import(pathToFileURL(modulePath).href);
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
    create table public.profiles(id uuid primary key references auth.users(id),username text not null,is_banned boolean not null default false);
    alter table public.profiles enable row level security;
    create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());
    grant select on public.profiles to authenticated;
    create table public.game_saves(user_id uuid,game_id text,payload jsonb);
    alter table public.game_saves enable row level security;
    create publication supabase_realtime;
    insert into auth.users(id) values('${testUsers[0]}'),('${testUsers[1]}');
    insert into public.profiles(id,username) values('${testUsers[0]}','Alice'),('${testUsers[1]}','Bob');
    insert into public.game_saves(user_id,game_id,payload) values('${testUsers[0]}','lucky-lounge','{"chips":1000,"spins":7,"biggestWin":42,"totalWagered":51,"totalWon":67}');
  `);
  const directory = path.join(projectRoot, 'supabase/migrations');
  const files = (await fs.readdir(directory)).filter(name => name.includes('lucky_lounge') && name.endsWith('.sql') && name.slice(0,14) <= through).sort();
  let called = false;
  for (const file of files) {
    if (!called && file.slice(0,14) > '20261010050000') {
      if (afterExisting) await afterExisting(db);
      called = true;
    }
    try { await db.exec(await fs.readFile(path.join(directory, file), 'utf8')); }
    catch (error) { throw new Error(`Migration ${file}: ${error.message}`, { cause: error }); }
  }
  if (!called && afterExisting) await afterExisting(db);
  await loginTestUser(db, testUsers[0]);
  return db;
}
export async function loginTestUser(db, userId) {
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [userId || '']);
}
export async function rpc(db, expression, parameters = []) {
  const result = await db.query(`select ${expression} as result`, parameters);
  return result.rows[0].result;
}
