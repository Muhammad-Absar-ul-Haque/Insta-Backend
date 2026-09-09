-- CreateTable
CREATE TABLE "restricted_users" (
    "id" SERIAL NOT NULL,
    "restrictor_id" INTEGER NOT NULL,
    "restricted_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restricted_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "muted_users" (
    "id" SERIAL NOT NULL,
    "muter_id" INTEGER NOT NULL,
    "muted_id" INTEGER NOT NULL,
    "mute_posts" BOOLEAN NOT NULL DEFAULT true,
    "mute_stories" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "muted_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "restricted_users_restrictor_id_restricted_id_key" ON "restricted_users"("restrictor_id", "restricted_id");

-- CreateIndex
CREATE UNIQUE INDEX "muted_users_muter_id_muted_id_key" ON "muted_users"("muter_id", "muted_id");

-- AddForeignKey
ALTER TABLE "restricted_users" ADD CONSTRAINT "restricted_users_restrictor_id_fkey" FOREIGN KEY ("restrictor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restricted_users" ADD CONSTRAINT "restricted_users_restricted_id_fkey" FOREIGN KEY ("restricted_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "muted_users" ADD CONSTRAINT "muted_users_muter_id_fkey" FOREIGN KEY ("muter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "muted_users" ADD CONSTRAINT "muted_users_muted_id_fkey" FOREIGN KEY ("muted_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
