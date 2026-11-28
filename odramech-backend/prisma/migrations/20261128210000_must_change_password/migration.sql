-- Troca de senha obrigatória no primeiro acesso de quem foi cadastrado pela oficina.
-- Usuários que já existem ficam sem a obrigação (default false).
ALTER TABLE "odramech"."cad_user" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;
