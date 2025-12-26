import { useState } from 'react';
import axios from 'axios';
import { API_URL } from './constants';

interface FinalReviewStepProps {
  studentData: any;
  customComments: Record<string, string>;
  diplomaData: {
    imePrezime: string;
    nivo: string;
    datum: string;
    godina: string;
  };
  nastavnaGodinaId: string;
}

export default function FinalReviewStep({
  studentData,
  customComments,
  diplomaData,
  nastavnaGodinaId,
}: FinalReviewStepProps) {
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const handleFinish = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      
      // Generate both PDFs
      console.log('Generating report and diploma...', { diplomaData });
      
      // Generate report first
      const reportResponse = await axios.post(
        `${API_URL}/reports/year-conclusion/generate-report`,
        {
          ucenikId: studentData.ucenik.id,
          nastavnaGodinaId,
          customComments,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: 'blob',
        }
      ).catch((error) => {
        console.error('Error generating report:', error);
        throw new Error('Greška pri generisanju izvještaja');
      });

      // Generate diploma separately so we can handle errors better
      let diplomaResponse = null;
      let diplomaError = null;
      
      try {
        console.log('Generating diploma with payload:', {
          ucenikId: studentData.ucenik.id,
          nastavnaGodinaId,
          imePrezime: diplomaData.imePrezime,
          nivo: diplomaData.nivo,
          datum: diplomaData.datum,
          godina: diplomaData.godina,
        });

        diplomaResponse = await axios.post(
          `${API_URL}/reports/year-conclusion/generate-diploma`,
          {
            ucenikId: studentData.ucenik.id,
            nastavnaGodinaId,
            imePrezime: diplomaData.imePrezime,
            nivo: diplomaData.nivo,
            datum: diplomaData.datum,
            godina: diplomaData.godina,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            responseType: 'blob',
          }
        );
        
        console.log('Diploma response received:', {
          status: diplomaResponse.status,
          dataType: diplomaResponse.data?.constructor?.name,
          dataSize: diplomaResponse.data?.size,
          contentType: diplomaResponse.headers['content-type'],
        });
        
        if (!diplomaResponse.data) {
          throw new Error('Diploma response data is null or undefined');
        }
        
        // Check content type
        const contentType = diplomaResponse.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          // Response is JSON (error), try to parse it
          const blobText = await new Response(diplomaResponse.data).text();
          const errorJson = JSON.parse(blobText);
          throw new Error(errorJson.message || 'Greška pri generisanju diplome');
        }
        
        if (diplomaResponse.data.size === 0) {
          throw new Error('Diploma response data is empty');
        }
        
        // Verify it's a PDF by checking first bytes (create a copy first since reading consumes the blob)
        const blobCopy = diplomaResponse.data.slice(0, 4);
        const arrayBuffer = await blobCopy.arrayBuffer();
        const firstBytes = new Uint8Array(arrayBuffer);
        const pdfHeader = String.fromCharCode(...firstBytes);
        if (pdfHeader !== '%PDF') {
          console.warn('Response might not be a valid PDF, but proceeding with download');
        }
        
        console.log('Diploma generated successfully, size:', diplomaResponse.data.size, 'bytes');
      } catch (error: any) {
        console.error('Error generating diploma:', error);
        console.error('Diploma error response:', error.response);
        
        // Try to read error message if it's a JSON response
        if (error.response?.data) {
          try {
            const errorText = await error.response.data.text();
            console.error('Diploma error response text:', errorText);
            try {
              const errorJson = JSON.parse(errorText);
              diplomaError = errorJson.message || 'Greška pri generisanju diplome';
            } catch (e) {
              diplomaError = errorText || 'Greška pri generisanju diplome';
            }
          } catch (e) {
            diplomaError = error.response?.statusText || 'Greška pri generisanju diplome';
          }
        } else {
          diplomaError = error.message || 'Greška pri generisanju diplome';
        }
      }

      // Verify report response is valid
      if (!reportResponse.data || reportResponse.data.size === 0) {
        throw new Error('Izvještaj je prazan');
      }

      console.log('Report generated successfully', {
        reportSize: reportResponse.data.size,
      });

      // Helper function to download file
      const downloadFile = (blob: Blob, filename: string) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        
        // Cleanup after a delay
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }, 100);
      };

      // Download report
      console.log('Downloading report...');
      downloadFile(
        new Blob([reportResponse.data], { type: 'application/pdf' }),
        `izvjestaj_${studentData.ucenik.ime}_${studentData.ucenik.prezime}.pdf`
      );

      // Download diploma if it was generated successfully
      if (diplomaResponse && diplomaResponse.data && diplomaResponse.data.size > 0) {
        console.log('Diploma generated successfully, size:', diplomaResponse.data.size);
        console.log('Downloading diploma...');

        // Wait longer before downloading diploma to avoid browser blocking multiple downloads
        await new Promise(resolve => setTimeout(resolve, 1000));

        downloadFile(
          new Blob([diplomaResponse.data], { type: 'application/pdf' }),
          `diploma_${studentData.ucenik.ime}_${studentData.ucenik.prezime}.pdf`
        );
        
        console.log('Diploma download initiated');
      } else {
        // Show warning if diploma generation failed
        console.error('Diploma generation failed:', diplomaError);
        alert(`Izvještaj je uspješno generisan, ali diploma nije: ${diplomaError || 'Nepoznata greška'}`);
      }

      setGenerated(true);
    } catch (error: any) {
      console.error('Error generating PDFs:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Greška pri generisanju dokumenata';
      alert(errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-4 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Finalni pregled</h2>
        <p className="text-sm text-gray-600">
          Pregledajte sve podatke prije generisanja dokumenata
        </p>
      </div>

      {/* Student Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Podaci o učeniku</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Ime i prezime</p>
            <p className="text-base font-medium text-gray-900">
              {studentData.ucenik.ime} {studentData.ucenik.prezime}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Nastavna godina</p>
            <p className="text-base font-medium text-gray-900">{studentData.nastavnaGodina.naziv}</p>
          </div>
        </div>
      </div>

      {/* Statistics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Prisustvo</p>
          <p className="text-2xl font-bold text-indigo-600">
            {studentData.attendance?.summaryByStudent?.[0]?.procenatPrisustva || 0}%
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Prosječna ocjena</p>
          <p className="text-2xl font-bold text-green-600">
            {studentData.grades?.statistics?.prosjek?.toFixed(2) || 'N/A'}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Progres lekcija</p>
          <p className="text-2xl font-bold text-purple-600">
            {studentData.stats?.postotakPredjenogGradiva?.toFixed(0) || 0}%
          </p>
        </div>
      </div>

      {/* Diploma Data Review */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Podaci za diplomu</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Ime i prezime</p>
            <p className="text-base font-medium text-gray-900">{diplomaData.imePrezime}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Nivo</p>
            <p className="text-base font-medium text-gray-900">{diplomaData.nivo}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Datum</p>
            <p className="text-base font-medium text-gray-900">
              {new Date(diplomaData.datum).toLocaleDateString('bs-BA')}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Godina</p>
            <p className="text-base font-medium text-gray-900">{diplomaData.godina}</p>
          </div>
        </div>
      </div>

      {/* Comments Review */}
      {customComments.general && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Komentari za izvještaj</h3>
          <p className="text-base text-gray-700 whitespace-pre-wrap">{customComments.general}</p>
        </div>
      )}

      {/* Success Message */}
      {generated && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm font-medium text-green-800">
              Dokumenti su uspješno generisani i preuzeti!
            </p>
          </div>
        </div>
      )}

      {/* Finish Button */}
      <div className="flex justify-end">
        <button
          onClick={handleFinish}
          disabled={generating}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 text-sm font-semibold shadow-lg shadow-indigo-500/20 hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Generisanje...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Generiši i preuzmi dokumente
            </>
          )}
        </button>
      </div>
    </div>
  );
}

