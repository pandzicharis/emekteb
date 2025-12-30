-- CreateEnum
CREATE TYPE "TipNotifikacije" AS ENUM ('OCJENA', 'PRISUSTVO', 'POHVALA', 'OPOMENA', 'GENERAL');

-- CreateTable
CREATE TABLE "poruke" (
    "id" TEXT NOT NULL,
    "posiljalacId" TEXT NOT NULL,
    "primalacId" TEXT NOT NULL,
    "naslov" TEXT NOT NULL,
    "sadrzaj" TEXT NOT NULL,
    "procitana" BOOLEAN NOT NULL DEFAULT false,
    "kreiran" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "azuriran" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poruke_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifikacije" (
    "id" TEXT NOT NULL,
    "korisnikId" TEXT NOT NULL,
    "tip" "TipNotifikacije" NOT NULL,
    "naslov" TEXT NOT NULL,
    "poruka" TEXT NOT NULL,
    "link" TEXT,
    "procitana" BOOLEAN NOT NULL DEFAULT false,
    "kreiran" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "azuriran" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifikacije_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "poruke" ADD CONSTRAINT "poruke_posiljalacId_fkey" FOREIGN KEY ("posiljalacId") REFERENCES "korisnici"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poruke" ADD CONSTRAINT "poruke_primalacId_fkey" FOREIGN KEY ("primalacId") REFERENCES "korisnici"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifikacije" ADD CONSTRAINT "notifikacije_korisnikId_fkey" FOREIGN KEY ("korisnikId") REFERENCES "korisnici"("id") ON DELETE CASCADE ON UPDATE CASCADE;


