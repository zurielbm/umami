-- Fork migration. The "fork_" prefix sorts after every numbered upstream migration,
-- so it never competes with the Umami team's sequence. See AGENTS.md.

-- CreateTable
CREATE TABLE "link_domain" (
    "link_domain_id" UUID NOT NULL,
    "hostname" VARCHAR(253) NOT NULL,
    "user_id" UUID,
    "team_id" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "link_domain_pkey" PRIMARY KEY ("link_domain_id")
);

-- AlterTable
ALTER TABLE "link" ADD COLUMN "domain_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "link_domain_hostname_key" ON "link_domain"("hostname");

-- CreateIndex
CREATE INDEX "link_domain_user_id_idx" ON "link_domain"("user_id");

-- CreateIndex
CREATE INDEX "link_domain_team_id_idx" ON "link_domain"("team_id");

-- CreateIndex
CREATE INDEX "link_domain_id_idx" ON "link"("domain_id");

-- AddForeignKey
ALTER TABLE "link_domain" ADD CONSTRAINT "link_domain_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_domain" ADD CONSTRAINT "link_domain_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("team_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link" ADD CONSTRAINT "link_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "link_domain"("link_domain_id") ON DELETE SET NULL ON UPDATE CASCADE;
