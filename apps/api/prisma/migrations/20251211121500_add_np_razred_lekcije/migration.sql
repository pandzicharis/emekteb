-- CreateTable
CREATE TABLE "nastavni_plan_razred_lekcije" (
    "id" TEXT NOT NULL,
    "nastavniPlanRazredId" TEXT NOT NULL,
    "lekcijaId" TEXT NOT NULL,

    CONSTRAINT "nastavni_plan_razred_lekcije_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nastavni_plan_razred_lekcije_nastavniPlanRazredId_lekcijaId_key" ON "nastavni_plan_razred_lekcije"("nastavniPlanRazredId", "lekcijaId");

-- AddForeignKey
ALTER TABLE "nastavni_plan_razred_lekcije" ADD CONSTRAINT "nastavni_plan_razred_lekcije_nastavniPlanRazredId_fkey" FOREIGN KEY ("nastavniPlanRazredId") REFERENCES "nastavni_plan_razredi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nastavni_plan_razred_lekcije" ADD CONSTRAINT "nastavni_plan_razred_lekcije_lekcijaId_fkey" FOREIGN KEY ("lekcijaId") REFERENCES "lekcije"("id") ON DELETE CASCADE ON UPDATE CASCADE;
