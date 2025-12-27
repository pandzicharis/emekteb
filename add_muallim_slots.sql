-- SQL skripta za dodavanje slotova muallimu muhidin.topcagic
-- Koristi se za dodavanje rasporeda (slotova) za muallima

-- 1. Pronađi muallima po emailu
DO $$
DECLARE
    v_korisnik_id UUID;
    v_ucenik_id UUID;
    v_nastavna_godina_id UUID;
    v_razred_id UUID;
    v_razred_nastavna_godina_id UUID;
    v_grupa_id UUID;
    v_raspored_id UUID;
BEGIN
    -- Pronađi korisnika
    SELECT id INTO v_korisnik_id
    FROM korisnici
    WHERE email = 'muhidin.topcagic';
    
    IF v_korisnik_id IS NULL THEN
        RAISE EXCEPTION 'Korisnik sa emailom muhidin.topcagic nije pronađen';
    END IF;
    
    -- Provjeri da li ima Ucenik zapis, ako nema kreiraj ga
    SELECT id INTO v_ucenik_id
    FROM ucenici
    WHERE "korisnikId" = v_korisnik_id;
    
    IF v_ucenik_id IS NULL THEN
        INSERT INTO ucenici (id, "korisnikId", status, "kreiran", "azuriran")
        VALUES (gen_random_uuid(), v_korisnik_id, 'AKTIVAN', NOW(), NOW())
        RETURNING id INTO v_ucenik_id;
        
        RAISE NOTICE 'Kreiran Ucenik zapis za muallima: %', v_ucenik_id;
    END IF;
    
    -- Pronađi aktivnu nastavnu godinu
    SELECT id INTO v_nastavna_godina_id
    FROM nastavne_godine
    WHERE status = 'ACTIVE'
    ORDER BY "kreiran" DESC
    LIMIT 1;
    
    IF v_nastavna_godina_id IS NULL THEN
        RAISE EXCEPTION 'Nema aktivne nastavne godine';
    END IF;
    
    RAISE NOTICE 'Koristi se nastavna godina: %', v_nastavna_godina_id;
    
    -- Pronađi ili kreiraj razred (npr. ILMIHAL_I)
    -- Prvo provjeri da li postoji neki razred
    SELECT id INTO v_razred_id
    FROM razredi
    WHERE status = true
    ORDER BY "kreiran" ASC
    LIMIT 1;
    
    IF v_razred_id IS NULL THEN
        -- Kreiraj razred ako ne postoji
        INSERT INTO razredi (id, name, ilmihal, status, "kreiran", "azuriran")
        VALUES (gen_random_uuid(), 'Ilmihal I', 'ILMIHAL_I', true, NOW(), NOW())
        RETURNING id INTO v_razred_id;
        
        RAISE NOTICE 'Kreiran razred: %', v_razred_id;
    END IF;
    
    -- Provjeri da li već postoji RazredNastavnaGodina za ovog muallima i razred
    SELECT id INTO v_razred_nastavna_godina_id
    FROM razred_nastavna_godina
    WHERE "nastavnaGodinaId" = v_nastavna_godina_id
      AND "razredId" = v_razred_id
      AND "muallimId" = v_ucenik_id;
    
    IF v_razred_nastavna_godina_id IS NULL THEN
        -- Kreiraj RazredNastavnaGodina
        INSERT INTO razred_nastavna_godina (id, "nastavnaGodinaId", "razredId", "muallimId", split, "kreiran", "azuriran")
        VALUES (gen_random_uuid(), v_nastavna_godina_id, v_razred_id, v_ucenik_id, false, NOW(), NOW())
        RETURNING id INTO v_razred_nastavna_godina_id;
        
        RAISE NOTICE 'Kreiran RazredNastavnaGodina: %', v_razred_nastavna_godina_id;
    ELSE
        RAISE NOTICE 'RazredNastavnaGodina već postoji: %', v_razred_nastavna_godina_id;
    END IF;
    
    -- Provjeri da li već postoji grupa "A" za ovaj razred
    SELECT id INTO v_grupa_id
    FROM grupe
    WHERE "razredNastavnaGodinaId" = v_razred_nastavna_godina_id
      AND naziv = 'A';
    
    IF v_grupa_id IS NULL THEN
        -- Kreiraj grupu "A"
        INSERT INTO grupe (id, "razredNastavnaGodinaId", naziv, kuran, sufara, "kreiran", "azuriran")
        VALUES (gen_random_uuid(), v_razred_nastavna_godina_id, 'A', false, false, NOW(), NOW())
        RETURNING id INTO v_grupa_id;
        
        RAISE NOTICE 'Kreirana grupa: %', v_grupa_id;
    ELSE
        RAISE NOTICE 'Grupa već postoji: %', v_grupa_id;
    END IF;
    
    -- Provjeri da li već postoji raspored za ovu grupu
    SELECT id INTO v_raspored_id
    FROM rasporedi
    WHERE "grupaId" = v_grupa_id;
    
    IF v_raspored_id IS NULL THEN
        -- Kreiraj slotove za subotu i nedjelju
        -- Subota slotovi
        INSERT INTO rasporedi (id, "grupaId", dan, slot, lokacija, trajanje, "kreiran", "azuriran")
        VALUES 
            (gen_random_uuid(), v_grupa_id, 'subota', '09:00', 'Džamija', 45, NOW(), NOW()),
            (gen_random_uuid(), v_grupa_id, 'subota', '10:00', 'Džamija', 45, NOW(), NOW()),
            (gen_random_uuid(), v_grupa_id, 'subota', '11:00', 'Džamija', 45, NOW(), NOW());
        
        -- Nedjelja slotovi
        INSERT INTO rasporedi (id, "grupaId", dan, slot, lokacija, trajanje, "kreiran", "azuriran")
        VALUES 
            (gen_random_uuid(), v_grupa_id, 'nedjelja', '09:00', 'Džamija', 45, NOW(), NOW()),
            (gen_random_uuid(), v_grupa_id, 'nedjelja', '10:00', 'Džamija', 45, NOW(), NOW()),
            (gen_random_uuid(), v_grupa_id, 'nedjelja', '11:00', 'Džamija', 45, NOW(), NOW());
        
        RAISE NOTICE 'Kreirani slotovi za grupu: %', v_grupa_id;
    ELSE
        RAISE NOTICE 'Raspored već postoji za grupu: %', v_grupa_id;
    END IF;
    
    RAISE NOTICE 'Uspješno dodani podaci za muallima muhidin.topcagic';
    RAISE NOTICE 'Korisnik ID: %', v_korisnik_id;
    RAISE NOTICE 'Ucenik ID: %', v_ucenik_id;
    RAISE NOTICE 'RazredNastavnaGodina ID: %', v_razred_nastavna_godina_id;
    RAISE NOTICE 'Grupa ID: %', v_grupa_id;
    
END $$;

