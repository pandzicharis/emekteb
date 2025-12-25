interface AIInsightsProps {
  data: {
    brojUcenika: number;
    prosjekPrisustva: number;
    prosjekOcjena: number;
    ukupnoCasova: number;
    planiraniCasovi?: number;
    neodrzaniCasovi?: number;
    postotakOdrzanihCasova?: number;
    postotakPredjenogGradiva: number;
    najredovnijiUcenici: Array<{ ime: string; prezime: string; stopaPrisustva: number }>;
    najboljiUcenici: Array<{ ime: string; prezime: string; prosjekOcjena: number }>;
    uceniciKojiTrebajuPomoc: Array<{ ime: string; prezime: string; prosjekOcjena: number; stopaPrisustva: number; razlog: string }>;
    grupe: Array<{ naziv: string; prosjekPrisustva: number; prosjekOcjena: number }>;
  };
}

export default function AIInsights({ data }: AIInsightsProps) {
  const summary: string[] = [];

  // Kratka analiza prisustva
  if (data.prosjekPrisustva >= 90) {
    summary.push(`✅ Odlično prisustvo (${data.prosjekPrisustva.toFixed(1)}%)`);
  } else if (data.prosjekPrisustva >= 70) {
    summary.push(`⚠️ Solidno prisustvo (${data.prosjekPrisustva.toFixed(1)}%)`);
  } else {
    summary.push(`🔴 Niska stopa prisustva (${data.prosjekPrisustva.toFixed(1)}%)`);
  }

  // Kratka analiza ocjena
  if (data.prosjekOcjena >= 4.0) {
    summary.push(`⭐ Odličan prosjek ocjena (${data.prosjekOcjena.toFixed(2)})`);
  } else if (data.prosjekOcjena >= 3.0) {
    summary.push(`📊 Solidan prosjek ocjena (${data.prosjekOcjena.toFixed(2)})`);
  } else {
    summary.push(`⚠️ Potrebna dodatna podrška (${data.prosjekOcjena.toFixed(2)})`);
  }

  // Kratka analiza održanih časova
  if (data.planiraniCasovi !== undefined && data.postotakOdrzanihCasova !== undefined) {
    if (data.postotakOdrzanihCasova >= 90) {
      summary.push(`✅ Nastava po planu (${data.postotakOdrzanihCasova.toFixed(1)}%)`);
    } else if (data.postotakOdrzanihCasova >= 70) {
      summary.push(`⚠️ ${data.neodrzaniCasovi} časova još nije održano`);
    } else {
      summary.push(`🔴 Niska stopa održanih časova (${data.postotakOdrzanihCasova.toFixed(1)}%)`);
    }
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow p-4 border border-blue-200">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 bg-blue-500 rounded-md p-2">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">AI Summary</h3>
          <div className="flex flex-wrap gap-2">
            {summary.map((item, index) => (
              <span key={index} className="text-xs bg-white px-3 py-1 rounded-full border border-blue-200 text-gray-700">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

