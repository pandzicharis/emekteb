import { API_URL } from './constants';

interface StudentInfoStepProps {
  studentData: any;
}

export default function StudentInfoStep({ studentData }: StudentInfoStepProps) {
  const ucenik = studentData.ucenik;
  const nastavnaGodina = studentData.nastavnaGodina;

  return (
    <div className="space-y-6">
      {/* Student Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center gap-4">
          {ucenik.fotografija ? (
            <img
              src={`${API_URL}${ucenik.fotografija}`}
              alt={`${ucenik.ime} ${ucenik.prezime}`}
              className="w-20 h-20 rounded-full object-cover border-4 border-white"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold border-4 border-white">
              {ucenik.ime.charAt(0).toUpperCase()}
              {ucenik.prezime.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold">
              {ucenik.ime} {ucenik.prezime}
            </h2>
            <p className="text-indigo-100 mt-1">{nastavnaGodina.naziv}</p>
            {studentData.razredi.length > 0 && (
              <p className="text-indigo-100 text-sm mt-1">
                {studentData.razredi.map((r: any) => r.razred.name).join(', ')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Osnovni podaci</h3>
          <div className="space-y-3">
            {ucenik.datumRodjenja && (
              <div>
                <p className="text-sm text-gray-500">Datum rođenja</p>
                <p className="text-base font-medium text-gray-900">
                  {new Date(ucenik.datumRodjenja).toLocaleDateString('bs-BA')}
                </p>
              </div>
            )}
            {ucenik.spol && (
              <div>
                <p className="text-sm text-gray-500">Spol</p>
                <p className="text-base font-medium text-gray-900">
                  {ucenik.spol === 'MUSKO' ? 'Muško' : 'Žensko'}
                </p>
              </div>
            )}
            {ucenik.mjestoRodjenja && (
              <div>
                <p className="text-sm text-gray-500">Mjesto rođenja</p>
                <p className="text-base font-medium text-gray-900">{ucenik.mjestoRodjenja}</p>
              </div>
            )}
            {ucenik.adresaStanovanja && (
              <div>
                <p className="text-sm text-gray-500">Adresa stanovanja</p>
                <p className="text-base font-medium text-gray-900">{ucenik.adresaStanovanja}</p>
              </div>
            )}
          </div>
        </div>

        {/* Education Information */}
        {ucenik.obrazovanje && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Obrazovanje</h3>
            <div className="space-y-3">
              {ucenik.obrazovanje.nivoObrazovanja && (
                <div>
                  <p className="text-sm text-gray-500">Nivo obrazovanja</p>
                  <p className="text-base font-medium text-gray-900">{ucenik.obrazovanje.nivoObrazovanja}</p>
                </div>
              )}
              {ucenik.obrazovanje.razred && (
                <div>
                  <p className="text-sm text-gray-500">Razred</p>
                  <p className="text-base font-medium text-gray-900">{ucenik.obrazovanje.razred}</p>
                </div>
              )}
              {ucenik.obrazovanje.mektebStepen && (
                <div>
                  <p className="text-sm text-gray-500">Mekteb stepen</p>
                  <p className="text-base font-medium text-gray-900">{ucenik.obrazovanje.mektebStepen}</p>
                </div>
              )}
              {ucenik.obrazovanje.osnovnaNaziv && (
                <div>
                  <p className="text-sm text-gray-500">Osnovna škola</p>
                  <p className="text-base font-medium text-gray-900">{ucenik.obrazovanje.osnovnaNaziv}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Contact Information */}
      {ucenik.kontakti && ucenik.kontakti.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Kontakt informacije</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ucenik.kontakti.map((kontakt: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-sm text-gray-500 capitalize">{kontakt.tip.toLowerCase()}:</span>
                <span className="text-base font-medium text-gray-900">{kontakt.vrijednost}</span>
                {kontakt.primarni && (
                  <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">Primarni</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Parent Information */}
      {ucenik.roditelji && ucenik.roditelji.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Roditelji</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {ucenik.roditelji.map((roditelj: any, idx: number) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">
                  {roditelj.tip === 'MAJKA' ? 'Majka' : 'Otac'}
                </h4>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-gray-500">Ime i prezime</p>
                    <p className="text-base font-medium text-gray-900">{roditelj.imePrezime}</p>
                  </div>
                  {roditelj.mobitel && (
                    <div>
                      <p className="text-sm text-gray-500">Mobitel</p>
                      <p className="text-base font-medium text-gray-900">{roditelj.mobitel}</p>
                    </div>
                  )}
                  {roditelj.email && (
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="text-base font-medium text-gray-900">{roditelj.email}</p>
                    </div>
                  )}
                  {roditelj.zanimanje && (
                    <div>
                      <p className="text-sm text-gray-500">Zanimanje</p>
                      <p className="text-base font-medium text-gray-900">{roditelj.zanimanje}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Academic Year Information */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Nastavna godina</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">Naziv</p>
            <p className="text-base font-medium text-gray-900">{nastavnaGodina.naziv}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Datum od</p>
            <p className="text-base font-medium text-gray-900">
              {new Date(nastavnaGodina.datumOd).toLocaleDateString('bs-BA')}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Datum do</p>
            <p className="text-base font-medium text-gray-900">
              {new Date(nastavnaGodina.datumDo).toLocaleDateString('bs-BA')}
            </p>
          </div>
        </div>
        {nastavnaGodina.nastavniPlan && (
          <div className="mt-4">
            <p className="text-sm text-gray-500">Nastavni plan</p>
            <p className="text-base font-medium text-gray-900">{nastavnaGodina.nastavniPlan.naziv}</p>
          </div>
        )}
      </div>
    </div>
  );
}


