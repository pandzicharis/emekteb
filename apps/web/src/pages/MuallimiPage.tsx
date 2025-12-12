import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Muallim {
  id: string;
  ime: string | null;
  prezime: string | null;
  email: string | null;
  aktivan: boolean;
  fotografija: string | null;
  pin: string | null;
  kreiran: string;
  azuriran: string;
}

export default function MuallimiPage() {
  const [muallimi, setMuallimi] = useState<Muallim[]>([]);
  const [selectedMuallim, setSelectedMuallim] = useState<Muallim | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    ime: '',
    prezime: '',
    email: '',
    lozinka: '',
    pin: '',
    aktivan: true,
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cropData, setCropData] = useState<{ x: number; y: number; size: number } | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMuallimi();
  }, []);

  const fetchMuallimi = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get<Muallim[]>(`${API_URL}/muallimi`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMuallimi(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Greška pri učitavanju muallima');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMuallim = (muallim: Muallim) => {
    setSelectedMuallim(muallim);
    setIsCreating(false);
    setFormData({
      ime: muallim.ime || '',
      prezime: muallim.prezime || '',
      email: muallim.email || '',
      lozinka: '',
      pin: muallim.pin || '',
      aktivan: muallim.aktivan,
    });
    setPhotoFile(null);
    setPhotoPreview(muallim.fotografija ? `${API_URL}${muallim.fotografija}` : null);
    setCropData(null);
    setIsCropping(false);
    setError(null);
  };

  const handleCreateNew = () => {
    setSelectedMuallim(null);
    setIsCreating(true);
    setFormData({
      ime: '',
      prezime: '',
      email: '',
      lozinka: '',
      pin: '',
      aktivan: true,
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setCropData(null);
    setIsCropping(false);
    setError(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Ne postavljaj photoFile ovdje - čekaj da se kropuje
      // setPhotoFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
        setIsCropping(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCrop = () => {
    if (!imageRef.current || !canvasRef.current || !cropData || !containerRef.current) return;

    const img = imageRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    
    // Izračunaj stvarnu poziciju i veličinu slike unutar container-a (object-contain)
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const containerAspect = containerRect.width / containerRect.height;
    
    let displayWidth, displayHeight, offsetX, offsetY;
    
    if (imgAspect > containerAspect) {
      // Slika je šira - fit po širini
      displayWidth = containerRect.width;
      displayHeight = containerRect.width / imgAspect;
      offsetX = 0;
      offsetY = (containerRect.height - displayHeight) / 2;
    } else {
      // Slika je viša - fit po visini
      displayWidth = containerRect.height * imgAspect;
      displayHeight = containerRect.height;
      offsetX = (containerRect.width - displayWidth) / 2;
      offsetY = 0;
    }
    
    // Skaliraj cropData koordinate na originalnu sliku
    const scaleX = img.naturalWidth / displayWidth;
    const scaleY = img.naturalHeight / displayHeight;
    
    // Izračunaj poziciju crop area u odnosu na sliku (ne container)
    // cropData.x i cropData.y su u odnosu na container, trebamo ih prilagoditi za offset slike
    const cropX = Math.max(0, (cropData.x - offsetX) * scaleX);
    const cropY = Math.max(0, (cropData.y - offsetY) * scaleY);
    const cropSize = cropData.size * scaleX;
    
    // Ograniči crop size da ne prelazi granice slike
    const finalCropSize = Math.min(cropSize, img.naturalWidth - cropX, img.naturalHeight - cropY);

    canvas.width = 300;
    canvas.height = 300;

    ctx.drawImage(
      img,
      cropX,
      cropY,
      finalCropSize,
      finalCropSize,
      0,
      0,
      300,
      300
    );

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' });
        console.log('✅ Kropovana slika kreirana:', { 
          name: file.name, 
          size: file.size, 
          type: file.type 
        });
        setPhotoFile(file);
        setPhotoPreview(canvas.toDataURL());
        setIsCropping(false);
        setCropData(null);
      } else {
        console.error('❌ Greška pri kreiranju blob-a');
      }
    }, 'image/jpeg', 0.9);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const token = localStorage.getItem('token');

      let savedMuallim: Muallim;

      if (isCreating) {
        // Create new muallim
        if (!formData.ime || !formData.prezime || !formData.email || !formData.lozinka) {
          setError('Sva polja su obavezna');
          setSaving(false);
          return;
        }

        const createData = {
          ime: formData.ime,
          prezime: formData.prezime,
          email: formData.email,
          lozinka: formData.lozinka,
          ...(formData.pin && { pin: formData.pin }),
        };

        const response = await axios.post<Muallim>(
          `${API_URL}/muallimi`,
          createData,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        savedMuallim = response.data;

        // Upload photo if selected
        if (photoFile && savedMuallim.id) {
          console.log('📷 Uploading photo for new muallim:', { 
            file: photoFile.name, 
            size: photoFile.size 
          });
          await uploadPhoto(savedMuallim.id, photoFile);
        }
      } else if (selectedMuallim) {
        // Update existing muallim
        const updateData: any = {
          ime: formData.ime,
          prezime: formData.prezime,
          email: formData.email,
          aktivan: formData.aktivan,
        };
        
        if (formData.lozinka) {
          updateData.lozinka = formData.lozinka;
        }

        // Šalji PIN samo ako je unesen (ne šalji prazan string)
        if (formData.pin && formData.pin.trim()) {
          updateData.pin = formData.pin.trim();
        } else if (formData.pin === '') {
          // Ako je eksplicitno prazan string, šalji ga da backend generiše novi
          updateData.pin = '';
        }

        const response = await axios.put<Muallim>(
          `${API_URL}/muallimi/${selectedMuallim.id}`,
          updateData,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        savedMuallim = response.data;

        // Upload photo if selected
        if (photoFile && savedMuallim.id) {
          console.log('📷 Uploading photo for updated muallim:', { 
            file: photoFile.name, 
            size: photoFile.size 
          });
          await uploadPhoto(savedMuallim.id, photoFile);
        }
      } else {
        return;
      }

      await fetchMuallimi();
      handleSelectMuallim(savedMuallim);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Greška pri čuvanju podataka');
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (id: string, file: File) => {
    console.log('📤 Uploading photo:', { 
      name: file.name, 
      size: file.size, 
      type: file.type,
      isCropped: file.name === 'cropped.jpg'
    });
    
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('photo', file);

    await axios.post(
      `${API_URL}/muallimi/${id}/photo`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    
    console.log('✅ Photo uploaded successfully');
  };


  const getInitials = (muallim: Muallim) => {
    const ime = muallim.ime?.charAt(0).toUpperCase() || '';
    const prezime = muallim.prezime?.charAt(0).toUpperCase() || '';
    return ime + prezime || 'M';
  };

  return (
    <div className="bg-gray-50 min-h-full p-6 lg:p-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Muallimi</h1>
          <p className="text-sm text-gray-600 mt-1">Upravljajte podacima muallima</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {muallimi.length === 0 && (
              <div className="col-span-full text-sm text-gray-500">Nema kreiranih muallima.</div>
            )}
            {muallimi.map((muallim) => (
              <button
                key={muallim.id}
                onClick={() => handleSelectMuallim(muallim)}
                className={`border rounded-xl p-4 bg-white shadow-sm text-left hover:shadow-lg hover:-translate-y-0.5 transition-all ${
                  selectedMuallim?.id === muallim.id
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    {muallim.fotografija ? (
                      <img
                        src={`${API_URL}${muallim.fotografija}`}
                        alt={`${muallim.ime} ${muallim.prezime}`}
                        className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                        {getInitials(muallim)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-semibold text-gray-900 truncate">
                      {muallim.ime} {muallim.prezime}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 truncate flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {muallim.email}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          muallim.aktivan
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {muallim.aktivan ? 'Aktivan' : 'Neaktivan'}
                      </span>
                      <div className="flex items-center gap-1 text-blue-600 font-medium">
                        <span className="text-xs">Detalji</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
            <button
              onClick={handleCreateNew}
              className="border border-dashed border-gray-300 rounded-xl p-4 bg-white text-left hover:border-green-400 hover:shadow-md transition-all flex flex-col justify-center gap-2 min-h-[120px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <div className="text-base font-semibold text-gray-900">Novi muallim</div>
                  <div className="text-xs text-gray-500 mt-1">Dodaj novog muallima</div>
                </div>
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-2 mt-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Kreiraj novog muallima
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Modal za formu */}
      {(selectedMuallim || isCreating) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {isCreating ? 'Novi Muallim' : 'Uredi Muallima'}
                </h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  {isCreating ? 'Dodaj novog muallima u sistem' : 'Ažuriraj podatke muallima'}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedMuallim(null);
                  setIsCreating(false);
                  setIsCropping(false);
                  setCropData(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Photo Upload Section */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
                <label className="block text-sm font-semibold text-gray-900 mb-4">
                  Fotografija
                </label>
                
                {!isCropping ? (
                  <div className="flex flex-col items-center justify-center gap-4">
                    <div className="relative">
                      {photoPreview ? (
                        <div className="relative">
                          <img
                            src={photoPreview}
                            alt="Preview"
                            className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                          />
                          <button
                            onClick={() => {
                              setPhotoPreview(null);
                              setPhotoFile(null);
                              setCropData(null);
                            }}
                            className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center border-4 border-white shadow-lg">
                          <svg className="w-16 h-16 text-white opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <label className="cursor-pointer">
                      <div className="px-4 py-2 bg-white border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-center">
                        <div className="flex items-center justify-center gap-2 text-sm font-medium text-gray-700">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {photoPreview ? 'Promijeni fotografiju' : 'Dodaj fotografiju'}
                        </div>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                    </label>
                    <p className="text-xs text-gray-500 text-center">JPEG, PNG ili WebP (max 5MB)</p>
                  </div>
                ) : (
                  <div className="space-y-4 flex flex-col items-center">
                    <div 
                      ref={containerRef}
                      className="relative bg-gray-900 rounded-lg overflow-hidden cursor-move flex items-center justify-center mx-auto" 
                      style={{ aspectRatio: '1/1', maxHeight: '400px' }}
                      onMouseDown={(e) => {
                        if (!imageRef.current || !cropData) return;
                        const rect = containerRef.current?.getBoundingClientRect();
                        if (!rect) return;
                        setIsDragging(true);
                        setDragStart({
                          x: e.clientX - cropData.x,
                          y: e.clientY - cropData.y,
                        });
                      }}
                      onMouseMove={(e) => {
                        if (!isDragging || !dragStart || !imageRef.current || !cropData || !containerRef.current) return;
                        const rect = containerRef.current.getBoundingClientRect();
                        const newX = Math.max(0, Math.min(e.clientX - rect.left - dragStart.x, rect.width - cropData.size));
                        const newY = Math.max(0, Math.min(e.clientY - rect.top - dragStart.y, rect.height - cropData.size));
                        setCropData({ ...cropData, x: newX, y: newY });
                      }}
                      onMouseUp={() => {
                        setIsDragging(false);
                        setDragStart(null);
                      }}
                      onMouseLeave={() => {
                        setIsDragging(false);
                        setDragStart(null);
                      }}
                    >
                      <img
                        ref={imageRef}
                        src={photoPreview || ''}
                        alt="Crop"
                        className="max-w-full max-h-full object-contain select-none"
                        draggable={false}
                        onLoad={(e) => {
                          const container = containerRef.current;
                          const img = e.currentTarget;
                          if (!container || !img) return;
                          
                          // Izračunaj stvarnu veličinu slike unutar container-a (object-contain)
                          const imgAspect = img.naturalWidth / img.naturalHeight;
                          const containerAspect = container.offsetWidth / container.offsetHeight;
                          
                          let displayWidth, displayHeight;
                          if (imgAspect > containerAspect) {
                            displayWidth = container.offsetWidth;
                            displayHeight = container.offsetWidth / imgAspect;
                          } else {
                            displayWidth = container.offsetHeight * imgAspect;
                            displayHeight = container.offsetHeight;
                          }
                          
                          // Crop area je pola veličine slike
                          const cropSize = Math.min(displayWidth, displayHeight) * 0.5;
                          
                          // Centriraj crop area
                          const offsetX = (container.offsetWidth - displayWidth) / 2;
                          const offsetY = (container.offsetHeight - displayHeight) / 2;
                          
                          setCropData({
                            x: offsetX + (displayWidth - cropSize) / 2,
                            y: offsetY + (displayHeight - cropSize) / 2,
                            size: cropSize,
                          });
                        }}
                      />
                      {cropData && (
                        <>
                          <div
                            className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-20 cursor-move"
                            style={{
                              left: `${cropData.x}px`,
                              top: `${cropData.y}px`,
                              width: `${cropData.size}px`,
                              height: `${cropData.size}px`,
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              if (!containerRef.current) return;
                              const rect = containerRef.current.getBoundingClientRect();
                              const startX = e.clientX - (cropData.x + rect.left);
                              const startY = e.clientY - (cropData.y + rect.top);

                              const onMouseMove = (e: MouseEvent) => {
                                if (!containerRef.current) return;
                                const rect = containerRef.current.getBoundingClientRect();
                                const newX = Math.max(0, Math.min(e.clientX - rect.left - startX, rect.width - cropData.size));
                                const newY = Math.max(0, Math.min(e.clientY - rect.top - startY, rect.height - cropData.size));
                                setCropData({ ...cropData, x: newX, y: newY });
                              };

                              const onMouseUp = () => {
                                document.removeEventListener('mousemove', onMouseMove);
                                document.removeEventListener('mouseup', onMouseUp);
                              };

                              document.addEventListener('mousemove', onMouseMove);
                              document.addEventListener('mouseup', onMouseUp);
                            }}
                          />
                          <div
                            className="absolute w-5 h-5 bg-blue-500 border-2 border-white rounded-full cursor-se-resize shadow-lg z-10"
                            style={{
                              left: `${cropData.x + cropData.size - 10}px`,
                              top: `${cropData.y + cropData.size - 10}px`,
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              const startX = e.clientX;
                              const startY = e.clientY;
                              const startSize = cropData.size;
                              const startCropX = cropData.x;
                              const startCropY = cropData.y;

                              const onMouseMove = (e: MouseEvent) => {
                                if (!containerRef.current) return;
                                const rect = containerRef.current.getBoundingClientRect();
                                const deltaX = e.clientX - startX;
                                const deltaY = e.clientY - startY;
                                const delta = Math.max(deltaX, deltaY);
                                const maxSize = Math.min(rect.width - startCropX, rect.height - startCropY);
                                const minSize = 100;
                                const newSize = Math.max(minSize, Math.min(maxSize, startSize + delta));
                                setCropData({ ...cropData, size: newSize });
                              };

                              const onMouseUp = () => {
                                document.removeEventListener('mousemove', onMouseMove);
                                document.removeEventListener('mouseup', onMouseUp);
                              };

                              document.addEventListener('mousemove', onMouseMove);
                              document.addEventListener('mouseup', onMouseUp);
                            }}
                          />
                        </>
                      )}
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="flex gap-3 justify-center items-center">
                      <div className="flex gap-3 w-full max-w-md">
                        <button
                          onClick={handleCrop}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Potvrdi
                        </button>
                        <button
                          onClick={() => {
                            setIsCropping(false);
                            setCropData(null);
                            setPhotoPreview(null);
                            setPhotoFile(null);
                          }}
                          className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                        >
                          Odustani
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Ime <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="ime"
                    value={formData.ime}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                    placeholder="Unesite ime"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Prezime <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="prezime"
                    value={formData.prezime}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                    placeholder="Unesite prezime"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                    placeholder="muallim@example.com"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Lozinka {isCreating && <span className="text-red-500">*</span>}
                    {!isCreating && <span className="text-xs text-gray-500 font-normal ml-2">(ostavite prazno da ne promijenite)</span>}
                  </label>
                  <input
                    type="password"
                    name="lozinka"
                    value={formData.lozinka}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                    placeholder={isCreating ? 'Unesite lozinku' : 'Nova lozinka (opciono)'}
                    required={isCreating}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    PIN za brzi login
                    {!isCreating && <span className="text-xs text-gray-500 font-normal ml-2">(ostavite prazno da se generiše novi)</span>}
                  </label>
                  <input
                    type="password"
                    name="pin"
                    value={formData.pin}
                    onChange={handleInputChange}
                    maxLength={6}
                    pattern="[0-9]*"
                    inputMode="numeric"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white font-mono text-lg font-bold tracking-widest text-center"
                    placeholder={isCreating ? 'Unesite PIN (opciono)' : 'Ostavite prazno za auto-generisanje'}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {isCreating 
                      ? 'Ako ne unesete PIN, biće automatski generisan. PIN mora biti jedinstven (4-6 cifara).'
                      : 'Ostavite prazno da se generiše novi PIN, ili unesite novi PIN (mora biti jedinstven).'
                    }
                  </p>
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-700 mb-1">Status</div>
                      <p className="text-xs text-gray-600">Aktivan muallim može pristupiti sistemu</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-4">
                      <input
                        type="checkbox"
                        name="aktivan"
                        checked={formData.aktivan}
                        onChange={handleInputChange}
                        className="sr-only peer"
                      />
                      <div className={`relative w-11 h-6 rounded-full transition-colors ${
                        formData.aktivan
                          ? 'bg-green-600'
                          : 'bg-gray-300'
                      }`}>
                        <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-transform ${
                          formData.aktivan ? 'translate-x-5' : 'translate-x-0'
                        }`}></div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSelectedMuallim(null);
                    setIsCreating(false);
                    setIsCropping(false);
                    setCropData(null);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Odustani
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Čuvanje...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Sačuvaj
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
