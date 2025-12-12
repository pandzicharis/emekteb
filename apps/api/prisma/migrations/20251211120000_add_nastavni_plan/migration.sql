-- CreateTable
CREATE TABLE "nastavni_planovi" (
    "id" TEXT NOT NULL,
    "naziv" TEXT NOT NULL,
    "opis" TEXT NOT NULL,
    "datumUsvajanja" TIMESTAMP(3) NOT NULL,
    "aktivan" BOOLEAN NOT NULL DEFAULT true,
    "kreiran" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "azuriran" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nastavni_planovi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nastavni_plan_razredi" (
    "id" TEXT NOT NULL,
    "nastavniPlanId" TEXT NOT NULL,
    "razredId" TEXT NOT NULL,
    "lekcijePostavke" JSONB NOT NULL,

    CONSTRAINT "nastavni_plan_razredi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nastavni_plan_razredi_nastavniPlanId_razredId_key" ON "nastavni_plan_razredi"("nastavniPlanId", "razredId");

-- AddForeignKey
ALTER TABLE "nastavni_plan_razredi" ADD CONSTRAINT "nastavni_plan_razredi_nastavniPlanId_fkey" FOREIGN KEY ("nastavniPlanId") REFERENCES "nastavni_planovi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nastavni_plan_razredi" ADD CONSTRAINT "nastavni_plan_razredi_razredId_fkey" FOREIGN KEY ("razredId") REFERENCES "razredi"("id") ON DELETE CASCADE ON UPDATE CASCADE;





