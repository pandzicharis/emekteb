import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { RasporedItem } from '../types/raspored';

type TipCasa = 'LEKCIJA' | 'PROVJERA' | 'POSEBNO';
type PrisustvoStatus = 'PRISUTAN' | 'OPRAVDAN' | 'NEOPRAVDAN';

type Lesson = { id: string; naslov: string; tip?: 'ILMIHAL' | 'KURAN' | 'SUFARA' | null };
type Student = { id: string; ime: string; prezime: string; godinaRodjenja?: number | null };

type OcjenaRecord = Record<string, { ocjena: number | null; komentar: string }>;
type OcjeneState = Record<string, OcjenaRecord>;

interface Props {
  open: boolean;
  slot: RasporedItem | null;
  slotDate?: Date | null; // Datum za koji se unosi čas
  onClose: () => void;
  onSave?: (payload: unknown) => Promise<void> | void;
}

const API_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3000';

const tipoviCasa: { id: TipCasa; label: string; desc: string }[] = [
  { id: 'LEKCIJA', label: 'Lekcija', desc: 'Redovni tok' },
  { id: 'PROVJERA', label: 'Provjera znanja', desc: 'Test, kviz' },
  { id: 'POSEBNO', label: 'Posebna aktivnost', desc: 'Radionica, posjeta' },
];

export default function CasEntryDrawer({ open, slot, slotDate, onClose, onSave }: Props) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lessonSearch, setLessonSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentLessons, setStudentLessons] = useState<Record<string, string[]>>({});
  const [lessonInputByStudent, setLessonInputByStudent] = useState<Record<string, string>>({});
  const [openLessonStudentId, setOpenLessonStudentId] = useState<string | null>(null);
  const [expandedLessonsByStudent, setExpandedLessonsByStudent] = useState<Record<string, Set<string>>>({});
  const [expandedStudentCards, setExpandedStudentCards] = useState<Set<string>>(new Set());
  const lessonDropdownRef = useRef<HTMLDivElement | null>(null);
  const [gradeStudentSearch, setGradeStudentSearch] = useState('');
  const [existingCasId, setExistingCasId] = useState<string | null>(null);
  const [studentLessonStats, setStudentLessonStats] = useState<
    | {
        totalLessonsForRazred: number;
        nastavnaGodinaNaziv: string | null;
        students: Record<
          string,
          {
            ucenikId: string;
            totalLessons: number;
            learnedLessonsCount: number;
            averageGrade: number | null;
            totalGrades: number;
            lessons: {
              lekcijaId: string;
              naslov: string;
              tip: string | null;
              averageGrade: number;
              lastGrade: number;
              gradesCount: number;
              lastDate: string;
              ocjene: {
                ocjena: number;
                komentar: string | null;
                datum: string;
              }[];
            }[];
          }
        >;
      }
    | null
  >(null);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [casFormData, setCasFormData] = useState<{
    tipoviCasa: TipCasa[];
    lekcije: string[];
    napomena: string;
    prisutnost: Record<string, PrisustvoStatus>;
    ocjene: OcjeneState;
  }>({
    tipoviCasa: ['LEKCIJA'],
    lekcije: [],
    napomena: '',
    prisutnost: {},
    ocjene: {},
  });

  // Fetch lessons & students when slot changes, and load existing cas if available
  useEffect(() => {
    if (!open || !slot) return;
    const run = async () => {
      setLoading(true);
      try {
        const razredId = slot.grupa.razred.id;
        
        // Učitaj lekcije i postojeći čas (ako postoji) paralelno
        const promises: Promise<any>[] = [
          axios.get<Lesson[]>(`${API_URL}/lekcije`, { params: { razredId } }),
        ];
        
        // Koristi slotDate ako je dostupan, inače koristi današnji datum
        const dateForCas = slotDate ? new Date(slotDate) : new Date();
        dateForCas.setHours(0, 0, 0, 0);
        
        // Formatiraj datum za API poziv (YYYY-MM-DD format)
        const formatDateForQuery = (date: Date): string => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        
        // Ako slot ima trenutniCasId, učitaj postojeći čas
        if (slot.trenutniCasId) {
          promises.push(axios.get(`${API_URL}/cas/${slot.trenutniCasId}`));
        } else {
          // Pokušaj da nađeš čas po slotId i datumu
          promises.push(
            axios
              .get(`${API_URL}/cas/slot/${slot.id}`, {
                params: { datum: formatDateForQuery(dateForCas) },
              })
              .catch(() => null), // Ignoriši grešku ako ne postoji
          );
        }

        // Statistika lekcija i ocjena za sve učenike grupe
        promises.push(axios.get(`${API_URL}/cas/grupa/${slot.grupa.id}/lekcije-stats`));
        
        // Uvijek dohvati učenike iz grupe (kritično za nove slotove)
        promises.push(
          axios
            .get(`${API_URL}/cas/grupa/${slot.grupa.id}/ucenici`)
            .catch((err) => {
              console.error('Error fetching ucenici from endpoint:', err);
              return { data: null };
            })
        );
        
        const [lessonsRes, existingCasRes, statsRes, uceniciRes] = await Promise.all(promises);

        // Dedup lekcije po ID-u – ako backend vrati duplikate, čuvamo samo prvi zapis
        const rawLessons = lessonsRes.data ?? [];
        const lessonsById = new Map<string, Lesson>();
        rawLessons.forEach((l: Lesson) => {
          if (!l?.id) return;
          if (!lessonsById.has(l.id)) {
            lessonsById.set(l.id, l);
          }
        });
        const fetchedLessons = Array.from(lessonsById.values());
        
        // Dohvati učenike - kombinuj iz različitih izvora
        const studentsMap = new Map<string, Student>();
        
        // 1. Prvo pokušaj iz direktnog endpointa za učenike iz grupe (najpouzdaniji izvor)
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
        
        // 3. Ako postojeći čas ima prisustva, dodaj učenike iz prisustva (za slučaj da nisu u grupi)
        // Ovo je važno jer postojeći čas može imati učenike koji nisu u grupi ili imaju bolje podatke
        if (existingCasRes?.data?.prisustva && existingCasRes.data.prisustva.length > 0) {
          existingCasRes.data.prisustva.forEach((p: any) => {
            const ucenikId = p.ucenik?.id || p.ucenikId;
            if (ucenikId) {
              // Ako učenik već postoji u mapi, ažuriraj ime/prezime ako su bolji podaci
              const existingStudent = studentsMap.get(ucenikId);
              const imeFromPresence = p.ucenik?.korisnik?.ime || p.ucenik?.ime || '';
              const prezimeFromPresence = p.ucenik?.korisnik?.prezime || p.ucenik?.prezime || '';
              
              if (existingStudent) {
                // Ažuriraj ime/prezime ako su prazni ili ako su bolji podaci iz prisustva
                if ((!existingStudent.ime && imeFromPresence) || (!existingStudent.prezime && prezimeFromPresence)) {
                  studentsMap.set(ucenikId, {
                    ...existingStudent,
                    ime: existingStudent.ime || imeFromPresence,
                    prezime: existingStudent.prezime || prezimeFromPresence,
                  });
                }
              } else {
                // Dodaj novog učenika iz prisustva
                studentsMap.set(ucenikId, {
                  id: ucenikId,
                  ime: imeFromPresence,
                  prezime: prezimeFromPresence,
                  godinaRodjenja: p.ucenik?.datumRodjenja 
                    ? new Date(p.ucenik.datumRodjenja).getFullYear() 
                    : null,
                });
              }
            }
          });
        }
        
        // 4. Ako još uvijek nema učenika, pokušaj sa dashboard endpointom (fallback)
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
        
        // 5. Ako statistika ima učenike, dodaj ih (za slučaj da nisu u prethodnim izvorima)
        if (statsRes?.data?.students && studentsMap.size === 0) {
          Object.values(statsRes.data.students).forEach((s: any) => {
            if (s.ucenikId && !studentsMap.has(s.ucenikId)) {
              studentsMap.set(s.ucenikId, {
                id: s.ucenikId,
                ime: '', // Statistika možda nema ime/prezime
                prezime: '',
                godinaRodjenja: null,
              });
            }
          });
        }
        
        const fetchedStudents = Array.from(studentsMap.values());
        
        // Debug log za provjeru
        console.log('Fetched students:', fetchedStudents.length, fetchedStudents);

        // Inicijalizuj podrazumijevane vrednosti
        const defaultPresence: Record<string, PrisustvoStatus> = {};
        fetchedStudents.forEach((s) => {
          defaultPresence[s.id] = 'NEOPRAVDAN';
        });

        const defaultGrades: OcjeneState = {};
        fetchedLessons.forEach((lesson) => {
          defaultGrades[lesson.id] = {};
          fetchedStudents.forEach((s) => {
            defaultGrades[lesson.id][s.id] = { ocjena: null, komentar: '' };
          });
        });

        const defaultStudentLessons: Record<string, string[]> = {};
        const defaultLessonInputs: Record<string, string> = {};
        fetchedStudents.forEach((s) => {
          defaultStudentLessons[s.id] = [];
          defaultLessonInputs[s.id] = '';
        });

        // Ako postoji postojeći čas, popuni formu sa njegovim podacima
        const initialFormData = {
          tipoviCasa: ['LEKCIJA'] as TipCasa[],
          lekcije: [] as string[],
          napomena: '',
          prisutnost: defaultPresence,
          ocjene: defaultGrades,
        };
        
        const initialStudentLessons = { ...defaultStudentLessons };
        const initialLessonInputs = { ...defaultLessonInputs };
        let casId: string | null = null;

        if (existingCasRes?.data) {
          const cas = existingCasRes.data;
          casId = cas.id;
          
          // Popuni tipove časa
          initialFormData.tipoviCasa = (cas.tipovi || []) as TipCasa[];
          
          // Popuni lekcije
          initialFormData.lekcije = (cas.lekcije || []).map((cl: any) => cl.lekcija?.id || cl.lekcijaId).filter(Boolean);
          
          // Popuni napomenu
          initialFormData.napomena = cas.napomena || '';
          
          // Popuni prisustvo
          const presence: Record<string, PrisustvoStatus> = {};
          (cas.prisustva || []).forEach((p: any) => {
            const ucenikId = p.ucenik?.id || p.ucenikId;
            if (ucenikId) {
              presence[ucenikId] = (p.status || 'NEOPRAVDAN') as PrisustvoStatus;
            }
          });
          initialFormData.prisutnost = { ...defaultPresence, ...presence };
          
          // Popuni ocjene
          const grades: OcjeneState = {};
          fetchedLessons.forEach((lesson) => {
            grades[lesson.id] = {};
            fetchedStudents.forEach((s) => {
              grades[lesson.id][s.id] = { ocjena: null, komentar: '' };
            });
          });

          // Popuni studentLessons iz postojećih ocjena - izvuci sve lekcije koje imaju ocjene za svakog učenika
          const lessonsByStudent: Record<string, Set<string>> = {};
          fetchedStudents.forEach((s) => {
            lessonsByStudent[s.id] = new Set();
          });

          (cas.ocjene || []).forEach((o: any) => {
            const lekcijaId = o.lekcija?.id || o.lekcijaId;
            const ucenikId = o.ucenik?.id || o.ucenikId;
            if (lekcijaId && ucenikId && grades[lekcijaId]) {
              grades[lekcijaId][ucenikId] = {
                ocjena: o.ocjena ?? null,
                komentar: o.komentar || '',
              };

              // Dodaj lekciju u listu lekcija za ovog učenika
              if (lessonsByStudent[ucenikId]) {
                lessonsByStudent[ucenikId].add(lekcijaId);
              }
            }
          });

          // Konvertuj Set u array za svakog učenika
          Object.entries(lessonsByStudent).forEach(([ucenikId, lessonSet]) => {
            initialStudentLessons[ucenikId] = Array.from(lessonSet);
          });

          initialFormData.ocjene = grades;
        }

        setLessons(fetchedLessons);
        setStudents(fetchedStudents);
        setExistingCasId(casId);
        setCasFormData(initialFormData);
        setStudentLessons(initialStudentLessons);
        setLessonInputByStudent(initialLessonInputs);
        setStudentLessonStats(
          statsRes?.data
            ? {
                totalLessonsForRazred: statsRes.data.totalLessonsForRazred ?? 0,
                nastavnaGodinaNaziv: statsRes.data.nastavnaGodinaNaziv ?? null,
                students: statsRes.data.students ?? {},
              }
            : null,
        );
      } catch (err) {
        console.error('Greška pri učitavanju podataka za čas', err);
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

  const filteredLessons = useMemo(() => {
    const term = lessonSearch.trim().toLowerCase();
    if (!term) return lessons;
    return lessons.filter((l) => {
      const titleMatch = l.naslov.toLowerCase().includes(term);
      const tipLabel =
        l.tip === 'KURAN' ? 'kuran' : l.tip === 'SUFARA' ? 'sufara' : 'ilmihal';
      const tipMatch = tipLabel.toLowerCase().includes(term);
      return titleMatch || tipMatch;
    });
  }, [lessons, lessonSearch]);

  // Grupiši lekcije po tipovima
  const lessonsByType = useMemo(() => {
    const grouped: {
      ILMIHAL: Lesson[];
      KURAN: Lesson[];
      SUFARA: Lesson[];
    } = {
      ILMIHAL: [],
      KURAN: [],
      SUFARA: [],
    };

    filteredLessons.forEach((lesson) => {
      const tip = (lesson.tip ?? 'ILMIHAL') as 'ILMIHAL' | 'KURAN' | 'SUFARA';
      grouped[tip].push(lesson);
    });

    return grouped;
  }, [filteredLessons]);

  const filteredStudents = useMemo(
    () =>
      students.filter((s) =>
        `${s.ime} ${s.prezime}`.toLowerCase().includes(studentSearch.trim().toLowerCase()),
      ),
    [students, studentSearch],
  );

  const toggleLesson = (lessonId: string) => {
    setCasFormData((prev) => {
      const exists = prev.lekcije.includes(lessonId);
      const updated = exists ? prev.lekcije.filter((id) => id !== lessonId) : [...prev.lekcije, lessonId];
      return { ...prev, lekcije: updated };
    });
  };

  const updatePrisustvo = (studentId: string, status: PrisustvoStatus) => {
    setCasFormData((prev) => {
      const current = prev.prisutnost[studentId];
      const nextPrisutnost = { ...prev.prisutnost };

      // Ako ponovo klikneš isti status, brišemo ga (vrati na "nije odabrano")
      if (current === status) {
        delete nextPrisutnost[studentId];
      } else {
        nextPrisutnost[studentId] = status;
      }

      return {
        ...prev,
        prisutnost: nextPrisutnost,
      };
    });
  };

  const updateOcjena = (lessonId: string, studentId: string, ocjena: number | null, komentar?: string) => {
    setCasFormData((prev) => ({
      ...prev,
      ocjene: {
        ...prev.ocjene,
        [lessonId]: {
          ...(prev.ocjene[lessonId] || {}),
          [studentId]: {
            ocjena,
            komentar: komentar ?? prev.ocjene[lessonId]?.[studentId]?.komentar ?? '',
          },
        },
      },
    }));
  };

  const addLessonToStudent = (studentId: string, lessonId: string) => {
    setStudentLessons((prev) => {
      const currentLessons = prev[studentId] || [];
      if (currentLessons.includes(lessonId)) {
        return prev; // Already added
      }
      return {
        ...prev,
        [studentId]: [...currentLessons, lessonId],
      };
    });
    // Initialize grade entry if it doesn't exist
    setCasFormData((prev) => {
      if (!prev.ocjene[lessonId]?.[studentId]) {
        return {
          ...prev,
          ocjene: {
            ...prev.ocjene,
            [lessonId]: {
              ...(prev.ocjene[lessonId] || {}),
              [studentId]: { ocjena: null, komentar: '' },
            },
          },
        };
      }
      return prev;
    });
    // Expand the accordion for this lesson
    setExpandedLessonsByStudent((prev) => {
      const current = prev[studentId] || new Set();
      return {
        ...prev,
        [studentId]: new Set([...current, lessonId]),
      };
    });
  };

  const removeLessonFromStudent = (studentId: string, lessonId: string) => {
    setStudentLessons((prev) => {
      const currentLessons = prev[studentId] || [];
      return {
        ...prev,
        [studentId]: currentLessons.filter((id) => id !== lessonId),
      };
    });
    // Clear the grade entry
    setCasFormData((prev) => {
      const newOcjene = { ...prev.ocjene };
      if (newOcjene[lessonId]?.[studentId]) {
        newOcjene[lessonId] = { ...newOcjene[lessonId] };
        delete newOcjene[lessonId][studentId];
      }
      return {
        ...prev,
        ocjene: newOcjene,
      };
    });
    // Collapse the accordion
    setExpandedLessonsByStudent((prev) => {
      const current = prev[studentId] || new Set();
      const newSet = new Set(current);
      newSet.delete(lessonId);
      return {
        ...prev,
        [studentId]: newSet,
      };
    });
  };

  const toggleLessonExpanded = (studentId: string, lessonId: string) => {
    setExpandedLessonsByStudent((prev) => {
      const current = prev[studentId] || new Set();
      const newSet = new Set(current);
      if (newSet.has(lessonId)) {
        newSet.delete(lessonId);
      } else {
        newSet.add(lessonId);
      }
      return {
        ...prev,
        [studentId]: newSet,
      };
    });
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

  const payloadPreview = useMemo(() => {
    if (!slot) return null;
    const prisutniArray = Object.entries(casFormData.prisutnost).map(([ucenikId, status]) => ({
      ucenikId,
      status,
    }));

    const ocjeneArray: { ucenikId: string; lekcijaId: string; ocjena: number; komentar?: string }[] = [];
    Object.entries(casFormData.ocjene || {}).forEach(([lessonId, byStudent]) => {
      Object.entries(byStudent || {}).forEach(([studentId, value]) => {
        if (value.ocjena !== null && value.ocjena !== undefined) {
          ocjeneArray.push({
            ucenikId: studentId,
            lekcijaId: lessonId,
            ocjena: value.ocjena,
            komentar: value.komentar?.trim() ? value.komentar : undefined,
          });
        }
      });
    });

    return {
      slotId: slot.id,
      tipoviCasa: casFormData.tipoviCasa,
      lekcije: casFormData.lekcije,
      prisutni: prisutniArray,
      ocjene: ocjeneArray,
      napomena: casFormData.napomena,
    };
  }, [casFormData, slot]);

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

  const renderTipIcon = (tip: TipCasa, active: boolean) => {
    const base = active ? 'text-white' : 'text-blue-600';
    if (tip === 'LEKCIJA') {
      // Book / learning
      return (
        <svg className={`w-5 h-5 ${base}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6l-2-1-2 1m4-1l2-1 2 1m-4-1v14m0 0l-2-1-2 1m4-1l2-1 2 1M4 7v10l4-2 4 2 4-2 4 2V7"
          />
        </svg>
      );
    }
    if (tip === 'PROVJERA') {
      // Clipboard check
      return (
        <svg className={`w-5 h-5 ${base}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5h6m-5 4h4m-2 8l-3-3m0 0l-2 2m2-2l2 2m7-11h-3.17a3 3 0 01-5.66 0H6a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2z"
          />
        </svg>
      );
    }
    // POSEBNO – sparkles
    return (
      <svg className={`w-5 h-5 ${base}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 3l1.5 3.5L10 8l-3.5 1.5L5 13l-1.5-3.5L0 8l3.5-1.5L5 3zm12 4l1.2 2.8L21 11l-2.8 1.2L17 15l-1.2-2.8L13 11l2.8-1.2L17 7zm-5 4l1.5 3.5L17 16l-3.5 1.5L12 21l-1.5-3.5L7 16l3.5-1.5L12 11z"
        />
      </svg>
    );
  };

  const renderPrisustvoIcon = (status: PrisustvoStatus, active: boolean) => {
    const base = active ? 'text-white' : 'text-slate-500';
    if (status === 'PRISUTAN') {
      return (
        <svg className={`w-4 h-4 ${base}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    }
    if (status === 'OPRAVDAN') {
      return (
        <svg className={`w-4 h-4 ${base}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    }
    // NEOPRAVDAN
    return (
      <svg className={`w-4 h-4 ${base}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  };

  const handleSave = async () => {
    if (!payloadPreview || !slot) return;
    setSaving(true);
    try {
      // Koristi slotDate ako je dostupan (datum iz filtera), inače koristi današnji datum
      const dateForCas = slotDate ? new Date(slotDate) : new Date();
      dateForCas.setHours(0, 0, 0, 0);
      
      console.log('CasEntryDrawer handleSave:', {
        slotDate,
        dateForCas: dateForCas.toISOString(),
        dateForCasLocal: `${dateForCas.getFullYear()}-${String(dateForCas.getMonth() + 1).padStart(2, '0')}-${String(dateForCas.getDate()).padStart(2, '0')}`,
      });
      
      // Formatiraj datum kao ISO string - backend očekuje ISO format koji može parsirati
      // Koristimo UTC vrijeme na ponoć da izbjegnemo probleme s vremenskom zonom
      const formatDateForAPI = (date: Date): string => {
        // Kreiraj UTC datum na ponoć
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();
        const utcDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
        // Vrati kao ISO string - backend će ga parsirati
        return utcDate.toISOString();
      };
      
      const formattedDate = formatDateForAPI(dateForCas);
      console.log('Formatted date for API:', formattedDate);
      
      const payload = {
        ...payloadPreview,
        datum: formattedDate,
      };
      
      console.log('Payload being sent:', payload);

      // Uvijek pozovi API direktno (axios interceptor će automatski dodati token)
      if (existingCasId) {
        // Ažuriraj postojeći čas
        await axios.put(`${API_URL}/cas/${existingCasId}`, payload);
      } else {
        // Kreiraj novi čas
        await axios.post(`${API_URL}/cas`, payload);
      }
      
      // Ako postoji callback, pozovi ga nakon uspješnog spremanja
      if (onSave) {
        await onSave(payload);
      }
      
      onClose();
    } catch (err: any) {
      console.error('Greška pri spremanju časa', err);
      alert(err.response?.data?.message || 'Greška pri spremanju časa. Molimo pokušajte ponovo.');
    } finally {
      setSaving(false);
    }
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
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-700">
              <span className="inline-flex h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
              {isEditing ? 'Ažuriranje časa' : 'Unos časa'}
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-semibold">{slot.dan}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 text-white px-2 py-0.5 border border-blue-700">
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
              {slot.grupa.razred.name} • Grupa {slot.grupa.naziv}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-semibold">
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
                {/* Tip časa */}
                <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6l-2-1-2 1m4-1l2-1 2 1m-4-1v14m0 0l-2-1-2 1m4-1l2-1 2 1M4 7v10l4-2 4 2 4-2 4 2V7"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">Tip časa</h3>
                        <p className="text-xs text-slate-500">
                          Možeš kombinovati više tipova (multi-select)
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {tipoviCasa.map((opt) => {
                      const active = casFormData.tipoviCasa.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          onClick={() =>
                            setCasFormData((prev) => {
                              const already = prev.tipoviCasa.includes(opt.id);
                              return {
                                ...prev,
                                tipoviCasa: already
                                  ? prev.tipoviCasa.filter((t) => t !== opt.id)
                                  : [...prev.tipoviCasa, opt.id],
                              };
                            })
                          }
                          className={`group text-left rounded-xl border px-4 py-3 transition-all flex items-start gap-3 ${
                            active
                              ? 'border-blue-500 bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md'
                              : 'border-slate-200 bg-slate-50/60 hover:border-blue-200 hover:bg-white'
                          }`}
                        >
                          <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-full ${
                            active ? 'bg-white/15' : 'bg-blue-50 text-blue-700'
                          }`}>
                            {renderTipIcon(opt.id, active)}
                          </div>
                          <div>
                            <div className={`text-sm font-semibold ${active ? 'text-white' : 'text-slate-900'}`}>{opt.label}</div>
                            <div className={`text-xs mt-1 ${active ? 'text-blue-100' : 'text-slate-500'}`}>{opt.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Lekcije – multiselect lista sa checkboxima i tip badgevima (bez chipova) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">Lekcije</h3>
                        <p className="text-xs text-slate-500">
                          Odaberi jednu ili više lekcija (ILMIHAL / KURAN / SUFARA)
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setCasFormData((prev) => ({ ...prev, lekcije: [] }))}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Očisti odabir
                    </button>
                  </div>

                  {/* Search + brojač */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="relative flex-1">
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
                        value={lessonSearch}
                        onChange={(e) => setLessonSearch(e.target.value)}
                        placeholder="Pretraži po nazivu ili tipu lekcije (npr. kuran, sufara, ilmihal)..."
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="text-xs text-slate-500 font-medium px-2 py-1 bg-slate-100 rounded-lg border border-slate-200">
                      {filteredLessons.length}/{lessons.length}
                    </div>
                  </div>

                  {/* Scrollable multiselect lista - podijeljena po tipovima u tri kolone */}
                  <div className="border border-slate-200 rounded-xl bg-slate-50 max-h-96 overflow-y-auto">
                    {filteredLessons.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-slate-500">
                        Nema lekcija za prikaz sa zadatim filterom.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3">
                        {/* ILMIHAL kolona */}
                        <div className="flex flex-col h-[320px] border border-slate-200 rounded-lg bg-white overflow-hidden">
                          <div className="flex-shrink-0 bg-slate-50 px-3 py-2 border-b border-slate-200">
                            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                              Ilmihal
                              <span className="ml-auto text-[10px] font-normal text-slate-500">
                                ({lessonsByType.ILMIHAL.length})
                              </span>
                            </h4>
                          </div>
                          <div className="flex-1 overflow-y-auto">
                            <ul className="space-y-1 p-2">
                              {lessonsByType.ILMIHAL.length === 0 ? (
                                <li className="text-[11px] text-slate-400 italic px-2 py-1">
                                  Nema lekcija
                                </li>
                              ) : (
                                lessonsByType.ILMIHAL.map((lesson) => {
                                  const selected = casFormData.lekcije.includes(lesson.id);
                                  return (
                                    <li key={lesson.id}>
                                      <label
                                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                                          selected
                                            ? 'bg-blue-50 border border-blue-200'
                                            : 'hover:bg-slate-100/60'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={!!selected}
                                          onChange={() => toggleLesson(lesson.id)}
                                          className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 flex-shrink-0"
                                        />
                                        <span className="text-xs text-slate-900 leading-tight">
                                          {lesson.naslov}
                                        </span>
                                      </label>
                                    </li>
                                  );
                                })
                              )}
                            </ul>
                          </div>
                        </div>

                        {/* KURAN kolona */}
                        <div className="flex flex-col h-[320px] border border-emerald-200 rounded-lg bg-white overflow-hidden">
                          <div className="flex-shrink-0 bg-emerald-50 px-3 py-2 border-b border-emerald-200">
                            <h4 className="text-xs font-semibold text-emerald-700 uppercase tracking-wide flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              Kuran
                              <span className="ml-auto text-[10px] font-normal text-emerald-600">
                                ({lessonsByType.KURAN.length})
                              </span>
                            </h4>
                          </div>
                          <div className="flex-1 overflow-y-auto">
                            <ul className="space-y-1 p-2">
                              {lessonsByType.KURAN.length === 0 ? (
                                <li className="text-[11px] text-slate-400 italic px-2 py-1">
                                  Nema lekcija
                                </li>
                              ) : (
                                lessonsByType.KURAN.map((lesson) => {
                                  const selected = casFormData.lekcije.includes(lesson.id);
                                  return (
                                    <li key={lesson.id}>
                                      <label
                                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                                          selected
                                            ? 'bg-emerald-50 border border-emerald-200'
                                            : 'hover:bg-emerald-50/40'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={!!selected}
                                          onChange={() => toggleLesson(lesson.id)}
                                          className="w-3.5 h-3.5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 flex-shrink-0"
                                        />
                                        <span className="text-xs text-slate-900 leading-tight">
                                          {lesson.naslov}
                                        </span>
                                      </label>
                                    </li>
                                  );
                                })
                              )}
                            </ul>
                          </div>
                        </div>

                        {/* SUFARA kolona */}
                        <div className="flex flex-col h-[320px] border border-cyan-200 rounded-lg bg-white overflow-hidden">
                          <div className="flex-shrink-0 bg-cyan-50 px-3 py-2 border-b border-cyan-200">
                            <h4 className="text-xs font-semibold text-cyan-700 uppercase tracking-wide flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                              Sufara
                              <span className="ml-auto text-[10px] font-normal text-cyan-600">
                                ({lessonsByType.SUFARA.length})
                              </span>
                            </h4>
                          </div>
                          <div className="flex-1 overflow-y-auto">
                            <ul className="space-y-1 p-2">
                              {lessonsByType.SUFARA.length === 0 ? (
                                <li className="text-[11px] text-slate-400 italic px-2 py-1">
                                  Nema lekcija
                                </li>
                              ) : (
                                lessonsByType.SUFARA.map((lesson) => {
                                  const selected = casFormData.lekcije.includes(lesson.id);
                                  return (
                                    <li key={lesson.id}>
                                      <label
                                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                                          selected
                                            ? 'bg-cyan-50 border border-cyan-200'
                                            : 'hover:bg-cyan-50/40'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={!!selected}
                                          onChange={() => toggleLesson(lesson.id)}
                                          className="w-3.5 h-3.5 text-cyan-600 border-slate-300 rounded focus:ring-cyan-500 flex-shrink-0"
                                        />
                                        <span className="text-xs text-slate-900 leading-tight">
                                          {lesson.naslov}
                                        </span>
                                      </label>
                                    </li>
                                  );
                                })
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="mt-2 text-[11px] text-slate-400">
                    Lekcije mogu ostati prazne ako je fokus samo na provjeri znanja ili prisustvu.
                  </p>
                </div>

                {/* Prisustvo – fokus na biranje prisutnih, sa lijepim status bedževima */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">Prisustvo</h3>
                        <p className="text-xs text-slate-500">
                          Podrazumijevano niko nema postavljen status – označi ko je prisutan ili ima
                          izostanak (opravdan / neopravdan).
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-[11px] text-slate-500">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const updated: Record<string, PrisustvoStatus> = {};
                            students.forEach((s) => (updated[s.id] = 'PRISUTAN'));
                            setCasFormData((prev) => ({ ...prev, prisutnost: updated }));
                          }}
                          className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg hover:bg-emerald-100"
                        >
                          Označi sve kao prisutne
                        </button>
                        <button
                          onClick={() => {
                            const updated: Record<string, PrisustvoStatus> = {};
                            students.forEach((s) => (updated[s.id] = 'NEOPRAVDAN'));
                            setCasFormData((prev) => ({ ...prev, prisutnost: updated }));
                          }}
                          className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-lg hover:bg-rose-100"
                        >
                          Označi sve kao odsutne
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Search + brojač učenika */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="relative flex-1">
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
                  <div className="grid md:grid-cols-2 gap-3">
                    {filteredStudents.map((student) => {
                      const status = casFormData.prisutnost[student.id];
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
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-700">
                              {(student.ime || '').charAt(0).toUpperCase()}
                              {(student.prezime || '').charAt(0).toUpperCase()}
                            </div>
                            <div className="space-y-1">
                              <div className="text-sm font-semibold text-slate-900 leading-tight">
                                {student.ime || ''} {student.prezime || ''}
                                {!student.ime && !student.prezime && <span className="text-slate-400 italic">Nepoznat učenik</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <div className="inline-flex rounded-full bg-slate-100 p-1.5 gap-1.5">
                              {[
                                {
                                  id: 'PRISUTAN',
                                  title: 'Prisutan',
                                  className:
                                    'bg-emerald-500 text-white',
                                },
                                {
                                  id: 'OPRAVDAN',
                                  title: 'Opravdan',
                                  className:
                                    'bg-amber-500 text-white',
                                },
                                {
                                  id: 'NEOPRAVDAN',
                                  title: 'Neopravdan',
                                  className:
                                    'bg-rose-500 text-white',
                                },
                              ].map((opt) => {
                                const active = status === opt.id;
                                return (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() =>
                                      updatePrisustvo(student.id, opt.id as PrisustvoStatus)
                                    }
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
                            {/* Bez dodatnog teksta "Poništi" da UI ostane čistiji */}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Legenda statusa ispod liste učenika */}
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

                {/* Ocjene */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600 border border-violet-100">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6v12m-6-6h12"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">Ocjenjivanje</h3>
                        <p className="text-xs text-slate-500">
                          Odaberi lekciju i ocjenu za svakog učenika (lekcije ovog razreda).
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">
                      Ocjene se pamte samo ako su popunjene
                    </span>
                  </div>
                  {lessons.length === 0 || students.length === 0 ? (
                    <div className="text-sm text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-xl px-4 py-3">
                      Nema dostupnih lekcija ili učenika za ocjenjivanje.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Search učenika za ocjenjivanje */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="relative flex-1">
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
                            value={gradeStudentSearch}
                            onChange={(e) => setGradeStudentSearch(e.target.value)}
                            placeholder="Filtriraj učenike za ocjenjivanje po imenu ili prezimenu..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium px-2 py-1 bg-slate-100 rounded-lg border border-slate-200">
                          {
                            filteredStudents.filter(
                              (student) =>
                                casFormData.prisutnost[student.id] === 'PRISUTAN' &&
                                (gradeStudentSearch.trim()
                                  ? `${student.ime} ${student.prezime}`
                                      .toLowerCase()
                                      .includes(gradeStudentSearch.trim().toLowerCase())
                                  : true),
                            ).length
                          }
                          /{filteredStudents.filter((s) => casFormData.prisutnost[s.id] === 'PRISUTAN').length}{' '}
                          učenika
                        </div>
                      </div>

                      {filteredStudents
                        .filter((student) => casFormData.prisutnost[student.id] === 'PRISUTAN')
                        .filter((student) =>
                          gradeStudentSearch.trim()
                            ? `${student.ime} ${student.prezime}`
                                .toLowerCase()
                                .includes(gradeStudentSearch.trim().toLowerCase())
                            : true,
                        )
                        // Sortiraj učenike po prosjeku (silazno) – najbolji prvi
                        .slice()
                        .sort((a, b) => {
                          const statsA = studentLessonStats?.students?.[a.id];
                          const statsB = studentLessonStats?.students?.[b.id];
                          const avgA = statsA?.averageGrade ?? 0;
                          const avgB = statsB?.averageGrade ?? 0;
                          return avgB - avgA;
                        })
                        .map((student) => {
                          const studentLessonsList = studentLessons[student.id] || [];
                          const lessonsTodayCount = studentLessonsList.length;
                          const isCardOpen = expandedStudentCards.has(student.id);

                          const getActiveGradeClasses = (grade: number) => {
                            switch (grade) {
                              case 5:
                                return 'bg-emerald-100 border-emerald-300 text-emerald-700';
                              case 4:
                                return 'bg-emerald-50 border-emerald-200 text-emerald-700';
                              case 3:
                                return 'bg-amber-50 border-amber-200 text-amber-700';
                              case 2:
                                return 'bg-orange-50 border-orange-200 text-orange-700';
                              case 1:
                              default:
                                return 'bg-rose-50 border-rose-200 text-rose-700';
                            }
                          };

                          const stats = studentLessonStats?.students?.[student.id] ?? null;
                          const totalLessons =
                            studentLessonStats?.totalLessonsForRazred ??
                            stats?.totalLessons ??
                            0;
                          const learned = stats?.learnedLessonsCount ?? 0;
                          const percent =
                            totalLessons > 0 ? Math.round((learned / totalLessons) * 100) : 0;
                          const avg =
                            stats?.averageGrade != null
                              ? Math.round(stats.averageGrade * 10) / 10
                              : null;

                          const showHistoryDetails =
                            expandedStudentId === student.id &&
                            !!studentLessonStats?.students?.[student.id];

                          return (
                            <div
                              key={student.id}
                              className="rounded-lg bg-slate-50/70 border border-slate-200"
                            >
                              {/* Student header (full row) */}
                              <button
                                type="button"
                                onClick={() => toggleStudentCard(student.id)}
                                className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 py-3 hover:bg-slate-100/60 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-700">
                                    {student.ime.charAt(0)}
                                    {student.prezime.charAt(0)}
                                  </div>
                                  <div className="space-y-0.5 text-left">
                                    <div className="text-sm font-semibold text-slate-900">
                                      {student.ime} {student.prezime}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                                        Lekcije danas: {lessonsTodayCount}
                                      </span>
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                        Naučeno: {percent}%
                                      </span>
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                        {learned}/{totalLessons || '—'} lekcija
                                    </span>
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
                                        Prosjek: {avg != null ? avg.toFixed(1) : '—'}
                                    </span>
                                  </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-[11px] text-slate-500">Prikaži detalje</span>
                                  <svg
                                    className={`w-4 h-4 text-slate-500 transition-transform ${isCardOpen ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </button>

                              {isCardOpen && (
                                <div className="px-3 pb-3 space-y-3">
                                  <p className="text-xs font-semibold text-slate-700">
                                    Lekcije ocijenjene na ovom času
                                  </p>
                                  <div className="space-y-2">
                                    {studentLessonsList.length > 0 ? (
                                      <div className="space-y-2">
                                        {studentLessonsList.map((lessonId) => {
                                          const lesson = lessons.find((l) => l.id === lessonId);
                                          if (!lesson) return null;
                                          const record = casFormData.ocjene[lessonId]?.[student.id] || {
                                            ocjena: null,
                                            komentar: '',
                                          };
                                          const isExpanded = expandedLessonsByStudent[student.id]?.has(lessonId) ?? false;

                                    return (
                                            <div
                                              key={lessonId}
                                              className="border border-slate-200 rounded-xl bg-white overflow-hidden"
                                            >
                                        <button
                                          type="button"
                                                onClick={() => toggleLessonExpanded(student.id, lessonId)}
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
                                                  <span className="text-sm font-semibold text-slate-900">
                                                    {lesson.naslov}
                                                  </span>
                                                  {lesson.tip && (
                                                    <span
                                                      className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                                        lesson.tip === 'KURAN'
                                                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                          : lesson.tip === 'SUFARA'
                                                          ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                                                          : 'bg-slate-100 text-slate-700 border-slate-200'
                                                      }`}
                                                    >
                                                      {lesson.tip === 'KURAN'
                                                        ? 'Kuran'
                                                        : lesson.tip === 'SUFARA'
                                                          ? 'Sufara'
                                                          : 'Ilmihal'}
                                                    </span>
                                                  )}
                                                  {record.ocjena !== null && (
                                                    <span
                                                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                                                        getActiveGradeClasses(record.ocjena)
                                                      }`}
                                                    >
                                                      {record.ocjena}
                                                    </span>
                                                  )}
                                                </div>
                                                    <button
                                                      type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeLessonFromStudent(student.id, lessonId);
                                                  }}
                                                  className="ml-2 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                                  title="Ukloni lekciju"
                                                >
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                  </svg>
                                                    </button>
                                              </button>

                                              {isExpanded && (
                                                <div className="px-4 pb-4 space-y-3 border-t border-slate-200">
                                                  <div>
                                                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                                                      Ocjena
                                                    </label>
                                <div className="flex items-center gap-1">
                                  {[5, 4, 3, 2, 1].map((g) => {
                                    const active = record.ocjena === g;
                                    return (
                                      <button
                                        key={g}
                                                            onClick={() => updateOcjena(lessonId, student.id, g)}
                                        className={`w-10 h-10 rounded-lg border text-sm font-semibold transition-all ${
                                          active
                                            ? getActiveGradeClasses(g)
                                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-200 hover:text-blue-700'
                                        }`}
                                      >
                                        {g}
                                      </button>
                                    );
                                  })}
                                  <button
                                                        onClick={() => updateOcjena(lessonId, student.id, null)}
                                    className="w-10 h-10 rounded-lg border border-slate-200 text-xs text-slate-500 hover:border-rose-200 hover:text-rose-600"
                                    title="Obriši ocjenu"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>

                                                  <div>
                                                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                                                      Komentar
                                                    </label>
                              <textarea
                                value={record.komentar}
                                onChange={(e) =>
                                                        updateOcjena(lessonId, student.id, record.ocjena, e.target.value)
                                }
                                placeholder="Kratak komentar (opcionalno)"
                                rows={3}
                                                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
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
                                        Nema dodanih lekcija. Kliknite "Dodaj lekciju" da dodate prvu.
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
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50 text-sm font-semibold text-slate-700 hover:text-blue-700 transition-colors"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                        Dodaj lekciju
                                      </button>

                                      {openLessonStudentId === student.id && (
                                        <div className="absolute left-0 right-0 top-full mt-2 rounded-xl border border-slate-200 bg-white shadow-lg z-40 w-[600px]">
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
                                                placeholder="Pretraži lekcije..."
                                                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                autoFocus
                                              />
                                            </div>
                                          </div>
                                          <div className="py-1">
                                            {(() => {
                                              const filterTerm = (lessonInputByStudent[student.id] || '').trim().toLowerCase();
                                              const filteredLessons = filterTerm
                                                ? lessons.filter((l) =>
                                                    l.naslov.toLowerCase().includes(filterTerm) ||
                                                    (l.tip === 'KURAN' && 'kuran'.includes(filterTerm)) ||
                                                    (l.tip === 'SUFARA' && 'sufara'.includes(filterTerm)) ||
                                                    (l.tip === 'ILMIHAL' && 'ilmihal'.includes(filterTerm))
                                                  )
                                                : lessons;

                                              // Filtriraj lekcije koje su već ocijenjene (iz studentLessonStats)
                                              const gradedLessonIds = new Set<string>();
                                              const studentStats = studentLessonStats?.students?.[student.id];
                                              if (studentStats?.lessons) {
                                                studentStats.lessons.forEach((l) => {
                                                  gradedLessonIds.add(l.lekcijaId);
                                                });
                                              }
                                              
                                              // Filtriraj lekcije koje nisu već dodane u ovom času i nisu već ocijenjene
                                              const availableLessons = filteredLessons.filter(
                                                (l) => !studentLessonsList.includes(l.id) && !gradedLessonIds.has(l.id)
                                              );

                                              if (availableLessons.length === 0) {
                                                return (
                                                  <div className="px-3 py-2 text-slate-500 text-center text-sm">
                                                    {filterTerm ? 'Nema rezultata' : 'Sve lekcije su već dodane'}
                                                  </div>
                                                );
                                              }

                                              // Grupiši dostupne lekcije po tipovima
                                              const groupedByType: {
                                                ILMIHAL: Lesson[];
                                                KURAN: Lesson[];
                                                SUFARA: Lesson[];
                                              } = {
                                                ILMIHAL: [],
                                                KURAN: [],
                                                SUFARA: [],
                                              };

                                              availableLessons.forEach((l) => {
                                                const tip = (l.tip ?? 'ILMIHAL') as 'ILMIHAL' | 'KURAN' | 'SUFARA';
                                                groupedByType[tip].push(l);
                                              });

                                              return (
                                                <div className="grid grid-cols-3 gap-2 p-2 max-h-[280px]">
                                                  {/* ILMIHAL kolona */}
                                                  <div className="flex flex-col h-[260px] border border-slate-200 rounded-lg bg-white overflow-hidden">
                                                    <div className="flex-shrink-0 bg-slate-50 px-2 py-1.5 border-b border-slate-200">
                                                      <h5 className="text-[10px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                                        Ilmihal
                                                        <span className="ml-auto text-[9px] font-normal text-slate-500">
                                                          ({groupedByType.ILMIHAL.length})
                                                        </span>
                                                      </h5>
                                                    </div>
                                                    <div className="flex-1 overflow-y-auto">
                                                      <ul className="space-y-0.5 p-1.5">
                                                        {groupedByType.ILMIHAL.length === 0 ? (
                                                          <li className="text-[10px] text-slate-400 italic px-1.5 py-1">
                                                            Nema
                                                          </li>
                                                        ) : (
                                                          groupedByType.ILMIHAL.map((l) => (
                                                            <li key={l.id}>
                                                              <button
                                                                type="button"
                                                                className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-left hover:bg-slate-50 transition-colors"
                                                                onClick={() => {
                                                                  addLessonToStudent(student.id, l.id);
                                                                  setLessonInputByStudent((prev) => ({
                                                                    ...prev,
                                                                    [student.id]: '',
                                                                  }));
                                                                  setOpenLessonStudentId(null);
                                                                }}
                                                              >
                                                                <span className="text-[10px] text-slate-900 leading-tight truncate">
                                                                  {l.naslov}
                                                                </span>
                                                              </button>
                                                            </li>
                                                          ))
                                                        )}
                                                      </ul>
                                                    </div>
                                                  </div>

                                                  {/* KURAN kolona */}
                                                  <div className="flex flex-col h-[260px] border border-emerald-200 rounded-lg bg-white overflow-hidden">
                                                    <div className="flex-shrink-0 bg-emerald-50 px-2 py-1.5 border-b border-emerald-200">
                                                      <h5 className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                        Kuran
                                                        <span className="ml-auto text-[9px] font-normal text-emerald-600">
                                                          ({groupedByType.KURAN.length})
                                                        </span>
                                                      </h5>
                                                    </div>
                                                    <div className="flex-1 overflow-y-auto">
                                                      <ul className="space-y-0.5 p-1.5">
                                                        {groupedByType.KURAN.length === 0 ? (
                                                          <li className="text-[10px] text-slate-400 italic px-1.5 py-1">
                                                            Nema
                                                          </li>
                                                        ) : (
                                                          groupedByType.KURAN.map((l) => (
                                                            <li key={l.id}>
                                                              <button
                                                                type="button"
                                                                className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-left hover:bg-emerald-50/40 transition-colors"
                                                                onClick={() => {
                                                                  addLessonToStudent(student.id, l.id);
                                                                  setLessonInputByStudent((prev) => ({
                                                                    ...prev,
                                                                    [student.id]: '',
                                                                  }));
                                                                  setOpenLessonStudentId(null);
                                                                }}
                                                              >
                                                                <span className="text-[10px] text-slate-900 leading-tight truncate">
                                                                  {l.naslov}
                                                                </span>
                                                              </button>
                                                            </li>
                                                          ))
                                                        )}
                                                      </ul>
                                                    </div>
                                                  </div>

                                                  {/* SUFARA kolona */}
                                                  <div className="flex flex-col h-[260px] border border-cyan-200 rounded-lg bg-white overflow-hidden">
                                                    <div className="flex-shrink-0 bg-cyan-50 px-2 py-1.5 border-b border-cyan-200">
                                                      <h5 className="text-[10px] font-semibold text-cyan-700 uppercase tracking-wide flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                                                        Sufara
                                                        <span className="ml-auto text-[9px] font-normal text-cyan-600">
                                                          ({groupedByType.SUFARA.length})
                                                        </span>
                                                      </h5>
                                                    </div>
                                                    <div className="flex-1 overflow-y-auto">
                                                      <ul className="space-y-0.5 p-1.5">
                                                        {groupedByType.SUFARA.length === 0 ? (
                                                          <li className="text-[10px] text-slate-400 italic px-1.5 py-1">
                                                            Nema
                                                          </li>
                                                        ) : (
                                                          groupedByType.SUFARA.map((l) => (
                                                            <li key={l.id}>
                                                              <button
                                                                type="button"
                                                                className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-left hover:bg-cyan-50/40 transition-colors"
                                                                onClick={() => {
                                                                  addLessonToStudent(student.id, l.id);
                                                                  setLessonInputByStudent((prev) => ({
                                                                    ...prev,
                                                                    [student.id]: '',
                                                                  }));
                                                                  setOpenLessonStudentId(null);
                                                                }}
                                                              >
                                                                <span className="text-[10px] text-slate-900 leading-tight truncate">
                                                                  {l.naslov}
                                                                </span>
                                                              </button>
                                                            </li>
                                                          ))
                                                        )}
                                                      </ul>
                                                    </div>
                                                  </div>
                                                </div>
                                              );
                                            })()}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                              {/* Historija ocjena – accordion za nastavnu godinu */}
                              {studentLessonStats && studentLessonStats.students?.[student.id] && (
                                <div className="mt-2 md:col-span-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-700">
                                  {/* Header accordiona – uvijek vidljiv */}
                                  <button
                                    type="button"
                                    className="w-full flex items-center justify-between text-left"
                                    onClick={() =>
                                      setExpandedStudentId((prev) =>
                                        prev === student.id ? null : student.id,
                                      )
                                    }
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-semibold text-slate-900">
                                        Nastavna godina{' '}
                                        {studentLessonStats.nastavnaGodinaNaziv
                                          ? `– ${studentLessonStats.nastavnaGodinaNaziv}`
                                          : ''}
                                      </span>
                                      <span className="text-slate-400">
                                        Historija ocjena za ovog učenika
                                      </span>
                                    </div>
                                    <svg
                                      className={`w-4 h-4 text-slate-500 transition-transform ${
                                        showHistoryDetails ? 'rotate-180' : ''
                                      }`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 9l-7 7-7-7"
                                      />
                                    </svg>
                                  </button>

                                  {/* Sadržaj accordiona – podijeljen na lijevu (lista) i desnu (graf) stranu */}
                                  {showHistoryDetails && (
                                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {/* Lijevo: detaljna lista lekcija i ocjena */}
                                      <div className="max-h-40 overflow-y-auto pr-1 border border-slate-100 rounded-lg">
                                        <ul className="divide-y divide-slate-100">
                                          {studentLessonStats.students[student.id].lessons.map(
                                            (l, idx) => (
                                              <li
                                                key={l.lekcijaId}
                                                className="py-1.5 px-2 flex flex-col gap-0.5"
                                              >
                                                <div className="flex items-center gap-2">
                                                  <span className="text-[10px] font-semibold text-slate-500">
                                                    {idx + 1}.
                                                  </span>
                                                  <span className="font-semibold text-slate-900 truncate">
                                                    {l.naslov}
                                                  </span>
                                                  <span className="ml-auto text-[9px] px-1 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                                    {l.tip ?? 'LEKCIJA'}
                                                  </span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-600">
                                                  <span>
                                                    <span className="font-semibold">Ocjena:</span>{' '}
                                                    <span>{l.lastGrade}</span>
                                                  </span>
                                                  <span>
                                                    <span className="font-semibold">Datum:</span>{' '}
                                                    <span>
                                                      {(() => {
                                                        const d = new Date(l.lastDate);
                                                        const day = d
                                                          .getDate()
                                                          .toString()
                                                          .padStart(2, '0');
                                                        const month = (d.getMonth() + 1)
                                                          .toString()
                                                          .padStart(2, '0');
                                                        const year = d.getFullYear();
                                                        return `${day}.${month}.${year}.`;
                                                      })()}
                                                    </span>
                                                  </span>
                                                </div>
                                                {l.ocjene && l.ocjene.length > 0 && l.ocjene[0].komentar && (
                                                  <div className="mt-0.5 text-[10px] text-slate-600">
                                                    <span className="font-semibold">Komentar:</span>{' '}
                                                    <span>{l.ocjene[0].komentar}</span>
                                                  </div>
                                                )}
                                              </li>
                                            ),
                                          )}
                                        </ul>
                                      </div>

                                      {/* Desno: graf raspodjele ocjena */}
                                      <div className="border border-slate-100 rounded-lg p-2 flex flex-col gap-2">
                                        <span className="text-[11px] font-semibold text-slate-900">
                                          Graf ocjena
                                        </span>
                                        {(() => {
                                          const buckets = [5, 4, 3, 2, 1];
                                          const counts: Record<number, number> = {
                                            5: 0,
                                            4: 0,
                                            3: 0,
                                            2: 0,
                                            1: 0,
                                          };

                                          studentLessonStats.students[student.id].lessons.forEach(
                                            (l) => {
                                              (l.ocjene || []).forEach((o) => {
                                                if (o.ocjena >= 1 && o.ocjena <= 5) {
                                                  counts[o.ocjena] = (counts[o.ocjena] || 0) + 1;
                                                }
                                              });
                                            },
                                          );

                                          const total =
                                            buckets.reduce((sum, g) => sum + (counts[g] || 0), 0) ||
                                            1;

                                          const barColor = (g: number) => {
                                            switch (g) {
                                              case 5:
                                                return 'bg-emerald-200';
                                              case 4:
                                                return 'bg-emerald-100';
                                              case 3:
                                                return 'bg-amber-100';
                                              case 2:
                                                return 'bg-orange-100';
                                              case 1:
                                              default:
                                                return 'bg-rose-100';
                                            }
                                          };

                                          return (
                                            <div className="space-y-1.5">
                                              {buckets.map((g) => {
                                                const count = counts[g] || 0;
                                                const pct = Math.round((count / total) * 100);
                                                return (
                                                  <div
                                                    key={g}
                                                    className="flex items-center gap-2 text-[11px]"
                                                  >
                                                    <span className="w-4 text-right font-semibold text-slate-700">
                                                      {g}
                                                    </span>
                                                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                                                      <div
                                                        className={`h-full ${barColor(
                                                          g,
                                                        )} rounded-full`}
                                                        style={{ width: `${pct}%` }}
                                                      />
                                                    </div>
                                                    <span className="w-10 text-right text-slate-500">
                                                      {count}x
                                                    </span>
                                                  </div>
                                                );
                                              })}
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
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 20h9m-9-4h6M5 4h14a2 2 0 012 2v3.5a2 2 0 01-.586 1.414l-8.5 8.5A2 2 0 0110.5 20H5a2 2 0 01-2-2V6a2 2 0 012-2z"
                          />
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
                    value={casFormData.napomena}
                    onChange={(e) =>
                      setCasFormData((prev) => ({ ...prev, napomena: e.target.value }))
                    }
                    placeholder="Npr. ponovili smo prethodnu lekciju, zadali smo učenje sure El-Fatiha, pohvalio/la sam aktivnost grupe..."
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
                        <span className="font-medium">Tip časa:</span>
                        <span className={casFormData.tipoviCasa.length > 0 ? 'ml-0.5 text-emerald-600 font-semibold' : 'ml-0.5 text-rose-600'}>
                          {casFormData.tipoviCasa.length > 0 ? casFormData.tipoviCasa.join(', ') : 'nije odabrano'}
                        </span>
                      </li>
                      <li className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <span className="font-medium">Lekcije odabrane:</span>
                        <span className="ml-0.5 font-semibold text-slate-900">{casFormData.lekcije.length}</span>
                      </li>
                      <li className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span className="font-medium">Prisustvo uneseno za:</span>
                        <span className="ml-0.5 font-semibold text-slate-900">
                          {Object.keys(casFormData.prisutnost).length}
                        </span>
                        <span className="ml-0.5 text-slate-500">učenika</span>
                      </li>
                      <li className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                        <span className="font-medium">Ocjene unesene:</span>
                        <span className="ml-0.5 font-semibold text-slate-900">
                          {payloadPreview?.ocjene?.length ?? 0}
                        </span>
                        <span className="ml-0.5 text-slate-500">zapisa</span>
                      </li>
                    </ul>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end min-w-[220px]">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white px-4 py-3 text-sm font-semibold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors disabled:opacity-50"
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

              {/* JSON preview – potpuno na dnu, za dev */}
              <div className="px-1 pt-4 max-w-5xl mx-auto">
                <div className="bg-slate-900 text-slate-50 rounded-2xl border border-slate-800 shadow-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">Payload za backend</h3>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">Live JSON</span>
                  </div>
                  <pre className="text-xs leading-relaxed bg-slate-950/50 border border-slate-800 rounded-xl p-3 overflow-x-auto">{JSON.stringify(payloadPreview ?? {}, null, 2)}</pre>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

