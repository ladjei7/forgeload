-- 020_pg_net_extensions_schema.sql
-- Supabase's security check flags pg_net installed in the public schema (019 used the default).
-- pg_net can't be moved with SET SCHEMA, so it is dropped and created again in "extensions".
-- Its functions stay in the "net" schema, so push_tick() keeps working unchanged.
-- Applied 2026-11-22 to forgeload-dev, then production (owner approved), with no notifications in flight.
drop extension if exists pg_net;
create extension pg_net schema extensions;
