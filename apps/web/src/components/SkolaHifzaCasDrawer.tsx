import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { RasporedItem } from '../types/raspored';
import UcenikDetailsDrawer from './UcenikDetailsDrawer';

type PrisustvoStatus = 'PRISUTAN' | 'OPRAVDAN' | 'NEOPRAVDAN';

type Lekcija = { id: string; naslov: string; brojAjeta?: number };
type Student = { id: string; ime: string; prezime: string; godinaRodjenja?: number | null };

interface Napredak {
  [suraName: string]: number[]; // Array of learned ajeta numbers
}

interface Props {
  open: boolean;
  slot: RasporedItem | null;
  slotDate?: Date | null;
  onClose: () => void;
  onSave?: (payload: unknown) => Promise<void> | void;
}

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

export default function SkolaHifzaCasDrawer({ open, slot, slotDate, onClose, onSave }: Props) {
  const [lekcije, setLekcije] = useState<Lekcija[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSura, setStudentSura] = useState<Record<string, string[]>>({});
  const [selectedAjetaByStudentSura, setSelectedAjetaByStudentSura] = useState<Record<string, Record<string, Set<number>>>>({});
  const [komentarByStudentSura, setKomentarByStudentSura] = useState<Record<string, Record<string, string>>>({});
  const [existingCasId, setExistingCasId] = useState<string | null>(null);
  const [ucenikNapredak, setUcenikNapredak] = useState<Record<string, Napredak | null>>({});
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [prisutnost, setPrisutnost] = useState<Record<string, PrisustvoStatus>>({});
  const [napomena, setNapomena] = useState<string>('');
  const [expandedStudentCards, setExpandedStudentCards] = useState<Set<string>>(new Set());
  const [expandedSuraByStudent, setExpandedSuraByStudent] = useState<Record<string, Set<string>>>({});
  const [openLessonStudentId, setOpenLessonStudentId] = useState<string | null>(null);
  const [lessonInputByStudent, setLessonInputByStudent] = useState<Record<string, string>>({});
  const [ajetaInputByStudentSura, setAjetaInputByStudentSura] = useState<Record<string, Record<string, string>>>({});
  const [selectedUcenikForDetails, setSelectedUcenikForDetails] = useState<string | null>(null);
  const lessonDropdownRef = useRef<HTMLDivElement | null>(null);
  const HIFZ_BASE = `${API_URL}/skola-hifza`;

  // Fetch lekcije & students when slot changes, and load existing cas if available
  useEffect(() => {
    if (!open || !slot) return;
    const run = async () => {
      setLoading(true);
      try {
        // Učitaj lekcije za SKOLA_HIFZA
        const lekcijeRes = await axios.get<Lekcija[]>(`${API_URL}/lekcije`, {
          params: { tip: 'SKOLA_HIFZA' },
        });
        const fetchedLekcije = lekcijeRes.data.sort((a, b) => a.naslov.localeCompare(b.naslov));
        setLekcije(fetchedLekcije);

        // Učitaj učenike - kombinuj iz različitih izvora (kao u CasEntryDrawer)
        const studentsMap = new Map<string, Student>();
        
        // 1. Prvo pokušaj iz direktnog endpointa za učenike iz grupe (najpouzdaniji izvor)
        try {
          const uceniciRes = await axios.get(`${API_URL}/cas/grupa/${slot.grupa.id}/ucenici`);
          if (uceniciRes?.data && Array.isArray(uceniciRes.data) && uceniciRes.data.length > 0) {
            uceniciRes.data.forEach((u: any) => {
              if (u.id) {
                studentsMap.set(u.id, {
                  id: u.id,
                  ime: u.ime || '',
                  prezime: u.prezime || '',
                  godinaRodjenja: u.godinaRodjenja ?? null,
                });
              }
            });
          }
        } catch (err) {
          console.warn('Error fetching ucenici from endpoint:', err);
        }
        
        // 2. Pokušaj iz slot.grupa.ucenici (ako su dostupni) - dodaj ako već nisu u mapi
        if (slot.grupa.ucenici && slot.grupa.ucenici.length > 0) {
          slot.grupa.ucenici.forEach((u) => {
            if (u.id && !studentsMap.has(u.id)) {
              studentsMap.set(u.id, {
                id: u.id,
                ime: u.ime || '',
                prezime: u.prezime || '',
                godinaRodjenja: u.godinaRodjenja ?? null,
              });
            }
          });
        }
        
        // 3. Ako još uvijek nema učenika, pokušaj sa dashboard endpointom (fallback)
        if (studentsMap.size === 0) {
          try {
            const dashboardRes = await axios.get(`${API_URL}/muallimi/dashboard`, {
              params: { dan: slot.dan },
            });
            
            // Pronađi grupu u dashboard podacima - prvo u razredima
            let grupa = dashboardRes.data?.razredi
              ?.flatMap((r: any) => r.grupe || [])
              .find((g: any) => g.id === slot.grupa.id);
            
            // Ako nije u razredima, pokušaj u raspored objektu
            if (!grupa) {
              const rasporedItem = dashboardRes.data?.raspored?.find((r: any) => 
                r.grupa?.id === slot.grupa.id
              );
              if (rasporedItem?.grupa) {
                grupa = rasporedItem.grupa;
              }
            }
            
            // Ako je grupa pronađena i ima učenike, dodaj ih
            if (grupa?.ucenici && grupa.ucenici.length > 0) {
              grupa.ucenici.forEach((u: any) => {
                if (u.id) {
                  studentsMap.set(u.id, {
                    id: u.id,
                    ime: u.ime || '',
                    prezime: u.prezime || '',
                    godinaRodjenja: u.godinaRodjenja ?? null,
                  });
                }
              });
            }
          } catch (dashboardErr) {
            console.error('Error fetching students from dashboard:', dashboardErr);
          }
        }

        const fetchedStudents = Array.from(studentsMap.values());
        console.log('📊 [SKOLA_HIFZA_DRAWER] Fetched students:', fetchedStudents.length, fetchedStudents);

        // Učitaj postojeći čas ako postoji
        const dateForCas = slotDate ? new Date(slotDate) : new Date();
        dateForCas.setHours(0, 0, 0, 0);
        const formatDateForQuery = (date: Date): string => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        // Pokušaj pronaći postojeći čas za ovaj slot i datum
        let existingCas: any = null;
        try {
          const formattedDate = formatDateForQuery(dateForCas);
          const casRes = await axios.get(
            `${HIFZ_BASE}/cas/slot/${slot.id}/date/${formattedDate}`
          );
          existingCas = casRes.data;
          console.log('📦 [SKOLA_HIFZA_DRAWER] Loaded existing cas:', existingCas?.id);
          console.log('📦 [SKOLA_HIFZA_DRAWER] Existing cas napredak:', existingCas?.napredak);
          console.log('📦 [SKOLA_HIFZA_DRAWER] Existing cas komentari:', existingCas?.komentari);
        } catch (err: any) {
          if (err.response?.status !== 404) {
            console.warn('Error finding existing cas:', err);
          } else {
            console.log('ℹ️ [SKOLA_HIFZA_DRAWER] No existing cas found for this slot and date');
          }
        }

        // Učitaj napredak za sve učenike (PRIJE učitavanja časa, da bi mogli da uporedimo)
        let napredakMap: Record<string, Napredak | null> = {};
        if (slot.grupa.razred.ilmihal === 'SKOLA_HIFZA') {
          // Pronađi SkolaHifza za nastavnu godinu
          try {
            const nastavnaGodinaRes = await axios.get(`${API_URL}/muallimi/dashboard`);
            const nastavnaGodinaId = nastavnaGodinaRes.data?.nastavnaGodina?.id;
            if (nastavnaGodinaId) {
              const skolaHifzaRes = await axios.get(
                `${API_URL}/skola-hifza/nastavna-godina/${nastavnaGodinaId}`
              );
              const skolaHifzaId = skolaHifzaRes.data?.id;
              if (skolaHifzaId) {
                const napredakPromises = fetchedStudents.map(async (student) => {
                  try {
                    const napredakRes = await axios.get(
                      `${API_URL}/skola-hifza/${skolaHifzaId}/ucenici/${student.id}/napredak`
                    );
                    return { studentId: student.id, napredak: napredakRes.data?.napredak || null };
                  } catch {
                    return { studentId: student.id, napredak: null };
                  }
                });
                const napredakResults = await Promise.all(napredakPromises);
                napredakResults.forEach((r) => {
                  napredakMap[r.studentId] = r.napredak;
                });
                setUcenikNapredak(napredakMap);
              }
            }
          } catch (err) {
            console.warn('Error loading napredak:', err);
          }
        }

        // Inicijalno ne postavljamo status prisustva - muallim će eksplicitno označiti
        const defaultPresence: Record<string, PrisustvoStatus> = {};

        const defaultStudentSura: Record<string, string[]> = {};
        const defaultSelectedAjeta: Record<string, Record<string, Set<number>>> = {};
        const defaultKomentari: Record<string, Record<string, string>> = {};
        const defaultLessonInputs: Record<string, string> = {};
        const defaultAjetaInputs: Record<string, Record<string, string>> = {};
        fetchedStudents.forEach((s) => {
          defaultStudentSura[s.id] = [];
          defaultSelectedAjeta[s.id] = {};
          defaultKomentari[s.id] = {};
          defaultLessonInputs[s.id] = '';
          defaultAjetaInputs[s.id] = {};
        });

        // Ako postoji postojeći čas, učitaj podatke
        if (existingCas) {
          setExistingCasId(existingCas.id);
          setNapomena(existingCas.napomena || '');
          
          // Učitaj prisustvo
          if (existingCas.prisustva) {
            const prisutnostMap: Record<string, PrisustvoStatus> = {};
            existingCas.prisustva.forEach((p: any) => {
              prisutnostMap[p.ucenikId] = p.status;
            });
            setPrisutnost(prisutnostMap);
          }

          // Učitaj napredak (sure i ajeta koje su ocijenjeni na ovom času)
          // Napredak u času je kombinovani (sve ajeta koje su ikada naučene),
          // ali trebamo prikazati sve sure koje imaju ajeta u ovom času.
          const studentSuraMap: Record<string, string[]> = { ...defaultStudentSura };
          const selectedAjetaMap: Record<string, Record<string, Set<number>>> = { ...defaultSelectedAjeta };
          
          if (existingCas.napredak) {
            const casNapredak: Record<string, { [suraName: string]: number[] }> = existingCas.napredak;
            
            console.log('📚 [SKOLA_HIFZA_DRAWER] Loading napredak from existing cas:', JSON.stringify(casNapredak, null, 2));
            console.log('📚 [SKOLA_HIFZA_DRAWER] Available lekcije:', fetchedLekcije.map(l => l.naslov));
            console.log('📚 [SKOLA_HIFZA_DRAWER] Fetched students:', fetchedStudents.map(s => ({ id: s.id, name: `${s.ime} ${s.prezime}` })));
            
            // Prođi kroz sve studente koji imaju napredak u času
            Object.entries(casNapredak).forEach(([studentId, studentCasNapredak]) => {
              // Provjeri da li student postoji u listi učenika
              const student = fetchedStudents.find(s => s.id === studentId);
              if (!student) {
                console.warn(`⚠️ [SKOLA_HIFZA_DRAWER] Student ${studentId} not found in fetched students`);
                return;
              }
              
              const suraIds: string[] = [];
              const ajetaMap: Record<string, Set<number>> = {};

              // Prođi kroz sve sure u napretku iz ovog časa
              Object.entries(studentCasNapredak).forEach(([suraName, casAjeta]) => {
                // Pokušaj pronaći lekciju po tačnom nazivu
                let lekcija = fetchedLekcije.find((l) => l.naslov === suraName);
                
                // Ako nije pronađena, pokušaj case-insensitive pretragu
                if (!lekcija) {
                  lekcija = fetchedLekcije.find((l) => l.naslov.toLowerCase() === suraName.toLowerCase());
                }
                
                if (!lekcija) {
                  console.warn(`⚠️ [SKOLA_HIFZA_DRAWER] Lekcija "${suraName}" nije pronađena u listi lekcija`);
                  return;
                }

                if (casAjeta && Array.isArray(casAjeta) && casAjeta.length > 0) {
                  // Dodaj suru - prikazujemo sve sure koje imaju ajeta u ovom času
                  if (!suraIds.includes(lekcija.id)) {
                    suraIds.push(lekcija.id);
                  }
                  
                  // Prikaži sve ajeta iz časa (kombinovani napredak)
                  ajetaMap[lekcija.id] = new Set(casAjeta);
                  console.log(`✅ [SKOLA_HIFZA_DRAWER] Loaded sura ${lekcija.naslov} for student ${student.ime} ${student.prezime} (${studentId}): ${casAjeta.length} ajeta`);
                }
              });
              
              // Uvek postavi studentSuraMap i selectedAjetaMap za učenike koji imaju napredak
              // čak i ako nema sura (što ne bi trebalo da se desi, ali za svaki slučaj)
                studentSuraMap[studentId] = suraIds;
                selectedAjetaMap[studentId] = ajetaMap;
              if (suraIds.length > 0) {
                console.log(`📋 [SKOLA_HIFZA_DRAWER] Student ${student.ime} ${student.prezime} (${studentId}) has ${suraIds.length} sura with graded ajeta`);
              }
            });
            
            console.log('📊 [SKOLA_HIFZA_DRAWER] Final studentSuraMap:', JSON.stringify(studentSuraMap, null, 2));
            console.log('📊 [SKOLA_HIFZA_DRAWER] Final selectedAjetaMap keys:', Object.keys(selectedAjetaMap));
          } else {
            console.log('⚠️ [SKOLA_HIFZA_DRAWER] No napredak data in existing cas');
          }
            
            // Postavi state NAKON što su svi podaci pripremljeni
            setStudentSura(studentSuraMap);
            setSelectedAjetaByStudentSura(selectedAjetaMap);
            
            // Automatski proširi kartice učenika koji imaju ocjenjene lekcije
            const studentsWithGradedLessons = Object.keys(studentSuraMap).filter(
            studentId => studentSuraMap[studentId] && studentSuraMap[studentId].length > 0
            );
            if (studentsWithGradedLessons.length > 0) {
              setExpandedStudentCards(new Set(studentsWithGradedLessons));
              console.log('🔓 [SKOLA_HIFZA_DRAWER] Auto-expanded cards for', studentsWithGradedLessons.length, 'students:', studentsWithGradedLessons);
          }
          
          // Učitaj komentare
          if (existingCas.komentari) {
            const komentari: Record<string, { [suraName: string]: string }> = existingCas.komentari;
            const komentariMap: Record<string, Record<string, string>> = {};
            
            Object.entries(komentari).forEach(([studentId, studentKomentari]) => {
              const studentKomentariMap: Record<string, string> = {};
              
              Object.entries(studentKomentari).forEach(([suraName, komentar]) => {
                // Pokušaj pronaći lekciju po tačnom nazivu
                let lekcija = fetchedLekcije.find((l) => l.naslov === suraName);
                
                // Ako nije pronađena, pokušaj case-insensitive pretragu
                if (!lekcija) {
                  lekcija = fetchedLekcije.find((l) => l.naslov.toLowerCase() === suraName.toLowerCase());
                }
                
                if (lekcija && komentar) {
                  studentKomentariMap[lekcija.id] = komentar;
                }
              });
              
              if (Object.keys(studentKomentariMap).length > 0) {
                komentariMap[studentId] = studentKomentariMap;
              }
            });
            
            setKomentarByStudentSura(komentariMap);
          }
        } else {
          setExistingCasId(null);
          // Ako nema postojećeg časa, postavi default vrijednosti
          setStudentSura(defaultStudentSura);
          setSelectedAjetaByStudentSura(defaultSelectedAjeta);
          setKomentarByStudentSura(defaultKomentari);
          setPrisutnost(defaultPresence);
        }

        // Postavi lessonInputByStudent i ajetaInputByStudentSura za sve učenike
        setLessonInputByStudent(defaultLessonInputs);
        setAjetaInputByStudentSura(defaultAjetaInputs);

        // Postavi studente NAKON što su svi podaci učitani
        setStudents(fetchedStudents);
      } catch (err: any) {
        console.error('Error loading data:', err);
        alert('Greška pri učitavanju podataka: ' + (err.response?.data?.message || err.message));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [open, slot, slotDate]);

  // Zatvori dropdown za lekciju kada se klikne izvan njega
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        openLessonStudentId &&
        lessonDropdownRef.current &&
        !lessonDropdownRef.current.contains(event.target as Node)
      ) {
        setOpenLessonStudentId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openLessonStudentId]);

  const filteredStudents = useMemo(
    () =>
      students.filter((s) =>
        `${s.ime} ${s.prezime}`.toLowerCase().includes(studentSearch.trim().toLowerCase()),
      ),
    [students, studentSearch],
  );

  // Filtrirano za ispitivanje - samo prisutni učenici
  const filteredStudentsForIspitivanje = useMemo(
    () =>
      filteredStudents.filter((s) => prisutnost[s.id] === 'PRISUTAN'),
    [filteredStudents, prisutnost],
  );

  const handleToggleAjet = (studentId: string, suraId: string, ajet: number) => {
    setSelectedAjetaByStudentSura((prev) => {
      const next = { ...prev };
      if (!next[studentId]) {
        next[studentId] = {};
      }
      const currentSet = next[studentId][suraId] || new Set<number>();
      const newSet = new Set(currentSet);
      if (newSet.has(ajet)) {
        newSet.delete(ajet);
      } else {
        newSet.add(ajet);
      }
      next[studentId] = {
        ...next[studentId],
        [suraId]: newSet,
      };
      return next;
    });
  };

  const handleSelectAllAjeta = (studentId: string, suraId: string, maxAjeta: number) => {
    const allAjeta = Array.from({ length: maxAjeta }, (_, i) => i + 1);
    setSelectedAjetaByStudentSura((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [suraId]: new Set(allAjeta),
      },
    }));
  };

  const handleDeselectAllAjeta = (studentId: string, suraId: string) => {
    setSelectedAjetaByStudentSura((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [suraId]: new Set(),
      },
    }));
  };

  const toggleStudentCard = (studentId: string) => {
    setExpandedStudentCards((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const addSuraToStudent = (studentId: string, suraId: string) => {
    setStudentSura((prev) => {
      const currentSura = prev[studentId] || [];
      if (currentSura.includes(suraId)) {
        return prev; // Already added
      }
      return {
        ...prev,
        [studentId]: [...currentSura, suraId],
      };
    });
    // Initialize ajeta selection if it doesn't exist
    setSelectedAjetaByStudentSura((prev) => {
      if (!prev[studentId]?.[suraId]) {
        return {
          ...prev,
          [studentId]: {
            ...(prev[studentId] || {}),
            [suraId]: new Set<number>(),
          },
        };
      }
      return prev;
    });
    // Initialize comment if it doesn't exist
    setKomentarByStudentSura((prev) => {
      if (!prev[studentId]?.[suraId]) {
        return {
          ...prev,
          [studentId]: {
            ...(prev[studentId] || {}),
            [suraId]: '',
          },
        };
      }
      return prev;
    });

    setExpandedSuraByStudent((prev) => {
      const current = prev[studentId] || new Set();
      return { ...prev, [studentId]: new Set([...current, suraId]) };
    });
  };

  const removeSuraFromStudent = (studentId: string, suraId: string) => {
    const lekcija = lekcije.find((l) => l.id === suraId);
    if (!lekcija) return;
    
    const napredak = ucenikNapredak[studentId] || {};
    const existingAjeta = napredak[lekcija.naslov] || [];
    const maxAjeta = lekcija.brojAjeta || 0;
    
    // Provjeri da li su svi ajeta naučeni - ako nisu, ne dozvoli brisanje
    if (existingAjeta.length < maxAjeta) {
      const missingCount = maxAjeta - existingAjeta.length;
      if (!confirm(`Sura "${lekcija.naslov}" nije potpuno završena. Još ${missingCount} ajeta nije naučeno. Da li ste sigurni da želite ukloniti suru iz ovog časa? (Napredak će ostati sačuvan)`)) {
        return;
      }
    }
    
    setStudentSura((prev) => {
      const currentSura = prev[studentId] || [];
      return {
        ...prev,
        [studentId]: currentSura.filter((id) => id !== suraId),
      };
    });
    // Clear ajeta selection za ovaj čas (ali ne briše postojeći napredak)
    setSelectedAjetaByStudentSura((prev) => {
      if (prev[studentId]?.[suraId]) {
        const newStudentData = { ...prev[studentId] };
        delete newStudentData[suraId];
        return {
          ...prev,
          [studentId]: newStudentData,
        };
      }
      return prev;
    });
    // Clear comment
    setKomentarByStudentSura((prev) => {
      if (prev[studentId]?.[suraId]) {
        const newStudentData = { ...prev[studentId] };
        delete newStudentData[suraId];
        return {
          ...prev,
          [studentId]: newStudentData,
        };
      }
      return prev;
    });

    setExpandedSuraByStudent((prev) => {
      if (prev[studentId]?.has(suraId)) {
        const newSet = new Set(prev[studentId]);
        newSet.delete(suraId);
        return { ...prev, [studentId]: newSet };
      }
      return prev;
    });
  };
  
  const removeAjetFromStudent = (studentId: string, suraId: string, ajet: number) => {
    setSelectedAjetaByStudentSura((prev) => {
      const next = { ...prev };
      if (!next[studentId]) {
        next[studentId] = {};
      }
      if (!next[studentId][suraId]) {
        next[studentId][suraId] = new Set<number>();
      }
      const currentSet = next[studentId][suraId];
      const newSet = new Set(currentSet);
      newSet.delete(ajet);
      next[studentId] = {
        ...next[studentId],
        [suraId]: newSet,
      };
      return next;
    });
  };

  const toggleSuraExpanded = (studentId: string, suraId: string) => {
    setExpandedSuraByStudent((prev) => {
      const current = prev[studentId] || new Set<string>();
      const nextSet = new Set(current);
      if (nextSet.has(suraId)) nextSet.delete(suraId);
      else nextSet.add(suraId);
      return { ...prev, [studentId]: nextSet };
    });
  };

  const updatePrisustvo = (studentId: string, status: PrisustvoStatus) => {
    setPrisutnost((prev) => {
      const current = prev[studentId];
      const nextPrisutnost = { ...prev };

      // Ako ponovo klikneš isti status, brišemo ga (vrati na "nije odabrano")
      if (current === status) {
        delete nextPrisutnost[studentId];
      } else {
        nextPrisutnost[studentId] = status;
      }

      return nextPrisutnost;
    });
  };

  const renderPrisustvoIcon = (status: PrisustvoStatus, active: boolean) => {
    if (status === 'PRISUTAN') {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    }
    if (status === 'OPRAVDAN') {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  };

  const payloadPreview = useMemo(() => {
    if (!slot) return null;

    const prisutniArray = Object.entries(prisutnost).map(([ucenikId, status]) => ({
      ucenikId,
      status,
    }));

    // Pripremi napredak za svakog učenika - kombinuj sve sura
    const napredakByStudent: Record<string, Napredak> = {};
    students.forEach((student) => {
      const studentSuraList = studentSura[student.id] || [];
          const existingNapredak = ucenikNapredak[student.id] || {};
      const combinedNapredak: Napredak = { ...existingNapredak };
      
      // Za svaku suru koju je učenik odabrao, dodaj ajeta
      studentSuraList.forEach((suraId) => {
        const lekcija = lekcije.find((l) => l.id === suraId);
        if (lekcija) {
          const selectedAjeta = selectedAjetaByStudentSura[student.id]?.[suraId] || new Set<number>();
          const existingAjeta = existingNapredak[lekcija.naslov] || [];
          
          // Kombinuj postojeće i nove ajeta
          const allAjeta = Array.from(new Set([...existingAjeta, ...Array.from(selectedAjeta)])).sort((a, b) => a - b);
          
          combinedNapredak[lekcija.naslov] = allAjeta;
        }
      });
      
      if (Object.keys(combinedNapredak).length > 0) {
        napredakByStudent[student.id] = combinedNapredak;
      }
    });

    // Transformiši komentare: iz studentId -> suraId -> komentar u studentId -> suraName -> komentar
    const komentariByStudent: Record<string, { [suraName: string]: string }> = {};
    Object.entries(komentarByStudentSura).forEach(([studentId, studentKomentari]) => {
      const komentariBySura: { [suraName: string]: string } = {};
      Object.entries(studentKomentari).forEach(([suraId, komentar]) => {
        const lekcija = lekcije.find((l) => l.id === suraId);
        if (lekcija && komentar) {
          komentariBySura[lekcija.naslov] = komentar;
        }
      });
      if (Object.keys(komentariBySura).length > 0) {
        komentariByStudent[studentId] = komentariBySura;
      }
    });

    return {
      slotId: slot.id,
      prisutni: prisutniArray,
      napredak: napredakByStudent,
      komentari: komentariByStudent,
      napomena: napomena,
    };
  }, [slot, selectedAjetaByStudentSura, komentarByStudentSura, prisutnost, studentSura, students, lekcije, ucenikNapredak, napomena]);

  const handleSave = async () => {
    if (!payloadPreview || !slot) return;
    setSaving(true);
    try {
      const dateForCas = slotDate ? new Date(slotDate) : new Date();
      dateForCas.setHours(0, 0, 0, 0);
      const formatDateForAPI = (date: Date): string => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();
        const utcDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
        return utcDate.toISOString();
      };

      const formattedDate = formatDateForAPI(dateForCas);

      const payload = {
        rasporedId: slot.id, // Koristimo direktno ID iz regularnog Raspored
        datum: formattedDate,
        napomena: payloadPreview.napomena,
        napredak: payloadPreview.napredak,
        prisutni: payloadPreview.prisutni,
      };

      const url = existingCasId 
        ? `${HIFZ_BASE}/cas/${existingCasId}` 
        : `${HIFZ_BASE}/cas`;
      
      console.log('📤 Šaljem request na:', url, 'Payload:', payload);

      if (existingCasId) {
        await axios.put(url, payload);
      } else {
        await axios.post(url, payload);
      }

      // Ažuriraj napredak za sve učenike
      if (payloadPreview.napredak) {
        try {
          const nastavnaGodinaRes = await axios.get(`${API_URL}/muallimi/dashboard`);
          const nastavnaGodinaId = nastavnaGodinaRes.data?.nastavnaGodina?.id;
          if (nastavnaGodinaId) {
            const skolaHifzaRes = await axios.get(
              `${API_URL}/skola-hifza/nastavna-godina/${nastavnaGodinaId}`
            );
            const skolaHifzaId = skolaHifzaRes.data?.id;
            if (skolaHifzaId) {
              await Promise.all(
                Object.entries(payloadPreview.napredak).map(async ([studentId, studentNapredak]) => {
                  await axios.post(
                    `${API_URL}/skola-hifza/${skolaHifzaId}/ucenici/${studentId}/napredak`,
                    { napredak: studentNapredak }
                  );
                })
              );
            }
          }
        } catch (err) {
          console.warn('Error updating napredak:', err);
        }
      }

      if (onSave) {
        await onSave(payload);
      }

      // Očisti formu nakon uspješnog spremanja
      setStudentSura({});
      setSelectedAjetaByStudentSura({});
      setKomentarByStudentSura({});
      setPrisutnost({});
      setNapomena('');
      setExpandedStudentCards(new Set());
      setExpandedSuraByStudent({});
      setOpenLessonStudentId(null);
      setLessonInputByStudent({});
      setAjetaInputByStudentSura({});

      onClose();
    } catch (err: any) {
      console.error('Greška pri spremanju časa', err);
      const errorMessage = err.response?.data?.message || err.message || 'Greška pri spremanju časa. Molimo pokušajte ponovo.';
      const statusCode = err.response?.status;
      const url = err.config?.url;
      console.error('Error details:', { statusCode, url, errorMessage });
      alert(`${errorMessage}${statusCode ? ` (Status: ${statusCode})` : ''}`);
    } finally {
      setSaving(false);
    }
  };

  if (!open || !slot) return null;

  const isEditing = !!existingCasId;

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    return `${hours}:${minutes}`;
  };

  const getEndTime = (startTime: string, durationMinutes: number) => {
    const [h, m] = startTime.split(':').map(Number);
    const total = h * 60 + m + durationMinutes;
    const endH = Math.floor(total / 60);
    const endM = total % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 right-0 w-full max-w-5xl bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 shadow-2xl border-l border-slate-200 flex flex-col animate-[slideIn_0.25s_ease-out]">
        <style>{`
          @keyframes slideIn {
            from { transform: translateX(12px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-10">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-purple-700">
              <span className="inline-flex h-2 w-2 rounded-full bg-purple-600 animate-pulse"></span>
              {isEditing ? 'Ažuriranje časa' : 'Unos časa'}
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-semibold">{slot.dan}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-600 text-white px-2 py-0.5 border border-purple-700">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span className="text-[10px] font-semibold normal-case">
                  {(() => {
                    const d = slotDate ? new Date(slotDate) : new Date();
                    const day = d.getDate().toString().padStart(2, '0');
                    const month = (d.getMonth() + 1).toString().padStart(2, '0');
                    const year = d.getFullYear();
                    return `${day}.${month}.${year}.`;
                  })()}
                </span>
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900">
              Škola Hifza • Grupa {slot.grupa.naziv}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-100 font-semibold">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatTime(slot.slot)} – {getEndTime(slot.slot, slot.trajanje)}
              </span>
              <span className="text-slate-400">|</span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0L6.343 16.657A8 8 0 1117.657 16.657z" />
                </svg>
                {slot.lokacija
                  ? slot.lokacija === 'divanhana'
                    ? 'Divanhana'
                    : slot.lokacija === 'ucionica'
                      ? 'Učionica'
                      : slot.lokacija
                  : 'Lokacija nije određena'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
            aria-label="Zatvori"
          >
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 bg-gradient-to-b from-slate-50 via-slate-100/60 to-slate-50">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex items-center gap-3 text-slate-600 bg-white px-4 py-3 rounded-xl shadow border border-slate-200">
                <div className="h-8 w-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                <span className="text-sm font-semibold">Učitavanje podataka...</span>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4 max-w-5xl mx-auto">
                {/* Prisustvo */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">Prisustvo</h3>
                      <p className="text-xs text-slate-500">
                        Označi ko je prisutan ili ima izostanak (opravdan / neopravdan).
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-[11px] text-slate-500">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const updated: Record<string, PrisustvoStatus> = {};
                          students.forEach((s) => (updated[s.id] = 'PRISUTAN'));
                          setPrisutnost(updated);
                        }}
                        className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg hover:bg-emerald-100"
                      >
                        Označi sve kao prisutne
                      </button>
                      <button
                        onClick={() => {
                          const updated: Record<string, PrisustvoStatus> = {};
                          students.forEach((s) => (updated[s.id] = 'NEOPRAVDAN'));
                          setPrisutnost(updated);
                        }}
                        className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-lg hover:bg-rose-100"
                      >
                        Označi sve kao odsutne
                      </button>
                    </div>
                  </div>
                </div>

                {/* Search */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="relative flex-1">
                    <svg
                      className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
                    </svg>
                    <input
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Pretraži učenike po imenu ili prezimenu..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="text-xs text-slate-500 font-medium px-2 py-1 bg-slate-100 rounded-lg border border-slate-200">
                    {filteredStudents.length}/{students.length}
                  </div>
                </div>

                {/* Lista učenika */}
                {filteredStudents.length === 0 ? (
                  <div className="text-sm text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-xl px-4 py-3">
                    Nema učenika za prikaz. Provjerite da li su učenici dodijeljeni ovoj grupi.
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-3">
                    {filteredStudents.map((student) => {
                      const status = prisutnost[student.id];
                      const isSelected = !!status;

                      return (
                        <div
                          key={student.id}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                            isSelected
                              ? 'border-blue-200 bg-blue-50/60 shadow-sm'
                              : 'border-slate-200 bg-slate-50/80'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedUcenikForDetails(student.id)}
                            className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity"
                          >
                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-700">
                            {(student.ime || '').charAt(0).toUpperCase()}
                            {(student.prezime || '').charAt(0).toUpperCase()}
                          </div>
                          <div className="space-y-1">
                            <div className="text-sm font-semibold text-slate-900 leading-tight">
                              {student.ime || ''} {student.prezime || ''}
                            </div>
                          </div>
                          </button>
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="inline-flex rounded-full bg-slate-100 p-1.5 gap-1.5">
                            {[
                              {
                                id: 'PRISUTAN',
                                title: 'Prisutan',
                                className: 'bg-emerald-500 text-white',
                              },
                              {
                                id: 'OPRAVDAN',
                                title: 'Opravdan',
                                className: 'bg-amber-500 text-white',
                              },
                              {
                                id: 'NEOPRAVDAN',
                                title: 'Neopravdan',
                                className: 'bg-rose-500 text-white',
                              },
                            ].map((opt) => {
                              const active = status === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => updatePrisustvo(student.id, opt.id as PrisustvoStatus)}
                                  className={`w-9 h-9 text-[11px] font-bold rounded-full flex items-center justify-center transition-all ${
                                    active
                                      ? opt.className + ' shadow-sm'
                                      : 'bg-transparent text-slate-500 hover:bg-white'
                                  }`}
                                  title={opt.title}
                                >
                                  {renderPrisustvoIcon(opt.id as PrisustvoStatus, active)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                )}
                {/* Legenda statusa */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Prisutan
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Opravdan
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Neopravdan
                  </span>
                </div>
              </div>

              {/* Ispitivanje */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600 border border-violet-100">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">Ispitivanje</h3>
                      <p className="text-xs text-slate-500">
                        Odaberi suru i označi naučene ajeta za svakog učenika.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Lista učenika za ispitivanje */}
                {filteredStudentsForIspitivanje.length === 0 ? (
                  <div className="text-sm text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-xl px-4 py-3">
                    {Object.keys(prisutnost).filter(id => prisutnost[id] === 'PRISUTAN').length === 0
                      ? 'Nema prisutnih učenika. Označite učenike kao prisutne u sekciji "Prisustvo" da biste mogli unijeti ispitivanje.'
                      : 'Nema učenika za ispitivanje nakon filtriranja. Provjerite da li su učenici dodijeljeni ovoj grupi i označeni kao prisutni.'}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredStudentsForIspitivanje.map((student) => {
                      const studentSuraList = studentSura[student.id] || [];
                    const napredak = ucenikNapredak[student.id] || null;
                      const suraTodayCount = studentSuraList.length;
                      const isCardOpen = expandedStudentCards.has(student.id);

                    return (
                        <div key={student.id} className="border border-slate-200 rounded-xl bg-slate-50/70">
                          <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 py-3">
                          <button
                            type="button"
                            onClick={() => toggleStudentCard(student.id)}
                              className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity"
                          >
                          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-700">
                            {(student.ime || '').charAt(0).toUpperCase()}
                            {(student.prezime || '').charAt(0).toUpperCase()}
                          </div>
                              <div className="space-y-0.5 text-left">
                            <div className="text-sm font-semibold text-slate-900">
                              {student.ime} {student.prezime}
                            </div>
                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                                    Sure danas: {suraTodayCount}
                                  </span>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                    Prisustvo: {prisutnost[student.id] || '—'}
                                  </span>
                          </div>
                        </div>
                            </button>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedUcenikForDetails(student.id)}
                                className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                                title="Prikaži detalje o učeniku"
                              >
                                Detalji
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleStudentCard(student.id)}
                                className="flex items-center gap-2 text-[11px] text-slate-500 hover:text-slate-700 transition-colors"
                              >
                                <span>Prikaži detalje</span>
                                <svg
                                  className={`w-4 h-4 transition-transform ${isCardOpen ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                          </button>
                            </div>
                          </div>

                          {isCardOpen && (
                            <div className="px-3 pb-3 space-y-3">
                              <p className="text-xs font-semibold text-slate-700">
                                Sure i ajeta ocijenjeni na ovom času
                              </p>

                              <div className="space-y-3">
                                {studentSuraList.length > 0 ? (
                                  <div className="space-y-3">
                                    {studentSuraList.map((suraId) => {
                                      const lekcija = lekcije.find((l) => l.id === suraId);
                                      if (!lekcija) return null;

                                      const selectedAjeta =
                                        selectedAjetaByStudentSura[student.id]?.[suraId] || new Set<number>();
                                      const komentar = komentarByStudentSura[student.id]?.[suraId] || '';
                                      const existingAjeta = napredak?.[lekcija.naslov] || [];
                                      const maxAjeta = lekcija.brojAjeta || 0;
                                      const allSelected =
                                        Array.from(selectedAjeta).length === maxAjeta && maxAjeta > 0;
                                      const noneSelected = selectedAjeta.size === 0;
                                      
                                      // Kombinovani ajeta (postojeći + novi za ovaj čas)
                                      const combinedAjeta = Array.from(new Set([...existingAjeta, ...Array.from(selectedAjeta)])).sort((a, b) => a - b);
                                      const isComplete = combinedAjeta.length === maxAjeta && maxAjeta > 0;
                                      const progressPercent = maxAjeta > 0 ? Math.round((combinedAjeta.length / maxAjeta) * 100) : 0;

                          const isExpanded = expandedSuraByStudent[student.id]?.has(suraId) ?? false;

                          return (
                                        <div key={suraId} className={`border rounded-xl overflow-hidden transition-all ${
                                          isComplete 
                                            ? 'border-emerald-300 bg-emerald-50/30' 
                                            : 'border-slate-200 bg-white'
                                        }`}>
                                          {/* Header - uvijek vidljiv sa osnovnim informacijama */}
                                          <button
                                            type="button"
                                            onClick={() => toggleSuraExpanded(student.id, suraId)}
                                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                                          >
                                            <div className="flex items-center gap-3 flex-1 text-left">
                                              <svg
                                                className={`w-4 h-4 text-slate-500 transition-transform ${
                                                  isExpanded ? 'rotate-90' : ''
                                                }`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                              >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                              </svg>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                  <span className="text-sm font-semibold text-slate-900">
                                                  {lekcija.naslov}
                                                </span>
                                                {isComplete && (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-semibold">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Završeno
                                                  </span>
                                                )}
                                              </div>
                                                <div className="flex items-center gap-3 text-xs text-slate-600">
                                                  {selectedAjeta.size > 0 ? (
                                                    <span className="text-purple-700 font-semibold">
                                                      {selectedAjeta.size} ajeta ocijenjeno na ovom času
                                                  </span>
                                                  ) : (
                                                    <span className="text-slate-400">
                                                      Nema ocijenjenih ajeta
                                                  </span>
                                                  )}
                                                  </div>
                                                </div>
                                                  </div>
                                            <div className="flex items-center gap-2">
                                              {isComplete && (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeSuraFromStudent(student.id, suraId);
                                                  }}
                                                  className="p-1.5 text-emerald-600 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                                  title="Ukloni suru (završena)"
                                                >
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                  </svg>
                                                </button>
                                              )}
                                            </div>
                                                    </button>

                                          {/* Detalji - prikazuju se kada je prošireno */}
                                          {isExpanded && (
                                            <div className="px-4 pb-4 space-y-3 border-t border-slate-200">
                                              {/* Prikaz ajeta ocijenjenih na ovom času - samo kvadratici */}
                                              <div className="flex flex-wrap gap-2">
                                                    {Array.from({ length: maxAjeta }, (_, i) => {
                                                      const ajetNum = i + 1;
                                                      const isSelected = selectedAjeta.has(ajetNum);
                                                      const wasExisting = existingAjeta.includes(ajetNum);
                                                      
                                                      return (
                                                    <button
                                                          key={ajetNum}
                                                      type="button"
                                                      onClick={() => {
                                                        if (wasExisting) return; // Ne može se ukloniti postojeći
                                                        if (isSelected) {
                                                          removeAjetFromStudent(student.id, suraId, ajetNum);
                                                        } else {
                                                          handleToggleAjet(student.id, suraId, ajetNum);
                                                        }
                                                      }}
                                                      disabled={wasExisting}
                                                      className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-sm font-semibold transition-all ${
                                                            wasExisting
                                                              ? 'bg-emerald-100 border-emerald-300 text-emerald-800 cursor-not-allowed'
                                                              : isSelected
                                                          ? 'bg-purple-600 border-purple-700 text-white shadow-md hover:bg-purple-700'
                                                          : 'bg-white border-slate-300 text-slate-700 hover:border-purple-400 hover:bg-purple-50'
                                                      }`}
                                                      title={wasExisting ? 'Već naučeno' : isSelected ? 'Klikni da ukloniš' : 'Klikni da dodaš'}
                                                    >
                                                      {ajetNum}
                                                            </button>
                                                      );
                                                    })}
                                              </div>


                                              {/* Komentar */}
                                              <div>
                                                <label className="block text-xs font-semibold text-slate-700 mb-2">Komentar</label>
                                                <textarea
                                                  value={komentar}
                                                  onChange={(e) =>
                                                    setKomentarByStudentSura((prev) => ({
                                                      ...prev,
                                                      [student.id]: {
                                                        ...(prev[student.id] || {}),
                                                        [suraId]: e.target.value,
                                                      },
                                                    }))
                                                  }
                                                  placeholder="Kratak komentar o napretku učenika za ovu suru (opcionalno)"
                                                  rows={3}
                                                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white align-top"
                                                />
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="text-sm text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-xl px-4 py-3 text-center">
                                    Nema dodanih sura. Kliknite "Dodaj suru" da dodate prvu.
                                  </div>
                                )}

                                <div
                                  className="relative"
                                  ref={openLessonStudentId === student.id ? lessonDropdownRef : null}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenLessonStudentId(openLessonStudentId === student.id ? null : student.id)
                                    }
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-purple-400 hover:bg-purple-50 text-sm font-semibold text-slate-700 hover:text-purple-700 transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    Dodaj suru
                                  </button>

                                  {openLessonStudentId === student.id && (
                                    <div className="absolute left-0 right-0 top-full mt-2 rounded-xl border border-slate-200 bg-white shadow-lg z-40 w-full max-w-[600px]">
                                      <div className="p-2 border-b border-slate-200">
                                        <div className="relative">
                                          <svg
                                            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z"
                                            />
                                          </svg>
                                          <input
                                            value={lessonInputByStudent[student.id] ?? ''}
                                    onChange={(e) => {
                                              setLessonInputByStudent((prev) => ({
                                                ...prev,
                                                [student.id]: e.target.value,
                                              }));
                                            }}
                                            placeholder="Pretraži sure..."
                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                            autoFocus
                                          />
                                        </div>
                                      </div>
                                      <div className="py-1 max-h-[280px] overflow-y-auto">
                                        {(() => {
                                          const filterTerm = (lessonInputByStudent[student.id] || '').trim().toLowerCase();
                                          const filteredLekcije = filterTerm
                                            ? lekcije.filter((l) =>
                                                l.naslov.toLowerCase().includes(filterTerm)
                                              )
                                            : lekcije;

                                          const availableLekcije = filteredLekcije.filter(
                                            (l) => !studentSuraList.includes(l.id)
                                          );

                                          if (availableLekcije.length === 0) {
                                            return (
                                              <div className="px-3 py-2 text-slate-500 text-center text-sm">
                                                {filterTerm ? 'Nema rezultata' : 'Sve sure su već dodane'}
                                              </div>
                                            );
                                          }

                                          return (
                                            <div className="p-2 space-y-1">
                                              {availableLekcije.map((lekcija) => {
                                                const existingAjeta = napredak?.[lekcija.naslov] || [];
                                                const existingCount = existingAjeta.length;
                                                const maxAjeta = lekcija.brojAjeta || 0;
                                                const progressPercent = maxAjeta > 0 ? Math.round((existingCount / maxAjeta) * 100) : 0;
                                                
                                                return (
                                                  <button
                                                    key={lekcija.id}
                                                    type="button"
                                                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left hover:bg-purple-50 transition-colors border border-slate-100"
                                                    onClick={() => {
                                                      addSuraToStudent(student.id, lekcija.id);
                                                      const lekcijaObj = lekcije.find((l) => l.id === lekcija.id);
                                        
                                        // Automatski učitaj postojeće ajeta ako sura već ima napredak
                                                      if (lekcijaObj && napredak?.[lekcijaObj.naslov]) {
                                                        const existingAjetaForLekcija = napredak[lekcijaObj.naslov];
                                          setSelectedAjetaByStudentSura((prev) => ({
                                            ...prev,
                                            [student.id]: {
                                              ...(prev[student.id] || {}),
                                                            [lekcija.id]: new Set(existingAjetaForLekcija),
                                            },
                                          }));
                                        }
                                        
                                                      setLessonInputByStudent((prev) => ({
                                                        ...prev,
                                                        [student.id]: '',
                                                      }));
                                                      setOpenLessonStudentId(null);
                                                    }}
                                                  >
                                                    <div className="flex-1">
                                                      <div className="text-sm font-semibold text-slate-900">
                                                        {lekcija.naslov}
                                                      </div>
                                                      <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs text-slate-600">
                                                          {maxAjeta} ajeta
                                                        </span>
                                                        {existingCount > 0 && (
                                                          <>
                                                            <span className="text-slate-400">•</span>
                                                            <span className="text-xs text-purple-600 font-semibold">
                                                              {existingCount}/{maxAjeta} naučeno ({progressPercent}%)
                                                            </span>
                                                          </>
                                                        )}
                                                      </div>
                                                    </div>
                                                    {existingCount > 0 && (
                                                      <div className="flex-shrink-0">
                                                        <div className="w-16 bg-slate-200 rounded-full h-2">
                                                          <div
                                                            className="bg-purple-600 h-2 rounded-full transition-all"
                                                            style={{ width: `${progressPercent}%` }}
                                                          />
                                                        </div>
                                                      </div>
                                                    )}
                                                  </button>
                                        );
                                      })}
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                        {napredak && Object.keys(napredak).length > 0 && (
                          <div className="mt-4 border border-slate-200 rounded-lg bg-white p-3">
                            <button
                              type="button"
                              className="w-full flex items-center justify-between text-left"
                              onClick={() =>
                                      setExpandedStudentId((prev) => (prev === student.id ? null : student.id))
                              }
                            >
                              <div className="flex flex-col">
                                      <span className="text-xs font-semibold text-slate-900">Historija napretka</span>
                                <span className="text-[10px] text-slate-400">
                                  Pregled naučenih sura i ajeta ({Object.keys(napredak).length} sura)
                                </span>
                              </div>
                              <svg
                                className={`w-4 h-4 text-slate-500 transition-transform ${
                                  expandedStudentId === student.id ? 'rotate-180' : ''
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            {expandedStudentId === student.id && (
                              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                                  {Object.entries(napredak).map(([sura, ajeta]) => {
                                    const lekcija = lekcije.find((l) => l.naslov === sura);
                                    const maxAjeta = lekcija?.brojAjeta || 0;
                                    const sortedAjeta = ajeta.sort((a, b) => a - b);
                                    const procenat = maxAjeta > 0 ? Math.round((ajeta.length / maxAjeta) * 100) : 0;
                                    
                                    return (
                                      <div key={sura} className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="font-semibold text-sm text-slate-900">{sura}</span>
                                          <span className="text-xs text-purple-600 font-semibold">
                                            {ajeta.length}/{maxAjeta}
                                          </span>
                                        </div>
                                        <div className="mt-2">
                                          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                                            <div
                                              className="bg-purple-600 h-2 rounded-full transition-all"
                                              style={{ width: `${procenat}%` }}
                                            ></div>
                                          </div>
                                                <div className="text-[10px] text-slate-600">{procenat}% naučeno</div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/30">
                                        <span className="text-xs font-semibold text-slate-900 mb-3 block">Ukupni napredak</span>
                                  {(() => {
                                    const totalAjeta = lekcije.reduce((sum, l) => sum + (l.brojAjeta || 0), 0);
                                          const learnedAjeta = Object.values(napredak).reduce(
                                            (sum, ajeta) => sum + ajeta.length,
                                            0,
                                          );
                                    const totalProcenat = totalAjeta > 0 ? Math.round((learnedAjeta / totalAjeta) * 100) : 0;
                                    
                                    return (
                                      <div className="space-y-3">
                                        <div className="text-center">
                                          <div className="text-2xl font-bold text-purple-600">{totalProcenat}%</div>
                                          <div className="text-xs text-slate-600">
                                            {learnedAjeta} / {totalAjeta} ajeta
                                          </div>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-4">
                                          <div
                                            className="bg-gradient-to-r from-purple-500 to-purple-600 h-4 rounded-full transition-all"
                                            style={{ width: `${totalProcenat}%` }}
                                          ></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                                          <div className="text-center p-2 bg-white rounded border border-slate-200">
                                            <div className="font-semibold text-purple-700">{Object.keys(napredak).length}</div>
                                            <div className="text-slate-600">Naučeno sura</div>
                                          </div>
                                          <div className="text-center p-2 bg-white rounded border border-slate-200">
                                            <div className="font-semibold text-purple-700">{lekcije.length}</div>
                                            <div className="text-slate-600">Ukupno sura</div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                                    </div>
                                  )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  </div>
                )}
              </div>

              {/* Napomena */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 border border-slate-200">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20h9m-9-4h6M5 4h14a2 2 0 012 2v3.5a2 2 0 01-.586 1.414l-8.5 8.5A2 2 0 0110.5 20H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">Napomena za čas</h3>
                      <p className="text-xs text-slate-500">
                        Sažetak časa, domaća zadaća ili posebna zapažanja.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">Opcionalno</span>
                </div>
                <textarea
                  value={napomena}
                  onChange={(e) => setNapomena(e.target.value)}
                  placeholder="Npr. ponovili smo prethodnu suru, zadali smo učenje nove sure, pohvalio/la sam aktivnost grupe..."
                  rows={5}
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
                />
              </div>
              </div>

              {/* Brze provjere + akcije – ispod svega */}
              <div className="mt-4 max-w-5xl mx-auto">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600 border border-sky-100">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 17v-2a4 4 0 014-4h6m-6-4h.01M7 9h.01M7 13h.01M7 17h.01"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Sažetak unosa</h3>
                        <p className="text-xs text-slate-500">
                          Brza provjera šta je popunjeno za ovaj čas.
                        </p>
                      </div>
                    </div>
                    <ul className="text-xs text-slate-600 space-y-1 pl-1">
                      <li className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="font-medium">Prisustvo uneseno za:</span>
                        <span className="ml-0.5 font-semibold text-slate-900">
                          {Object.keys(prisutnost).length}
                        </span>
                        <span className="ml-0.5 text-slate-500">učenika</span>
                      </li>
                      <li className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        <span className="font-medium">Ispitivanje uneseno za:</span>
                        <span className="ml-0.5 font-semibold text-slate-900">
                          {Object.entries(studentSura)
                            .filter(([studentId, sura]) => 
                              sura.length > 0 && prisutnost[studentId] === 'PRISUTAN'
                            ).length}
                        </span>
                        <span className="ml-0.5 text-slate-500">prisutnih učenika</span>
                      </li>
                      <li className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        <span className="font-medium">Ukupno sura uneseno:</span>
                        <span className="ml-0.5 font-semibold text-slate-900">
                          {Object.values(studentSura).reduce((sum, sura) => sum + sura.length, 0)}
                        </span>
                      </li>
                    </ul>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end min-w-[220px]">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 text-white px-4 py-3 text-sm font-semibold shadow-lg shadow-purple-500/20 hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Spremam...' : isEditing ? 'Ažuriraj čas' : 'Sačuvaj čas'}
                    </button>
                    <button
                      onClick={onClose}
                      className="flex-1 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 px-4 py-3 text-sm font-semibold hover:bg-slate-50 transition-colors"
                    >
                      Odustani
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* UcenikDetailsDrawer za prikaz detalja o učeniku */}
      <UcenikDetailsDrawer
        open={selectedUcenikForDetails !== null}
        ucenikId={selectedUcenikForDetails}
        onClose={() => setSelectedUcenikForDetails(null)}
        onSave={async () => {
          // Refresh podatke nakon što se sačuvaju promjene u UcenikDetailsDrawer
          // Ovo će se automatski desiti kada se drawer zatvori i ponovo otvori
        }}
      />
    </div>
  );
}
