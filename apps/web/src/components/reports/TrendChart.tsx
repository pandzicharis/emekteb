import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TrendChartProps {
  data: Array<{
    name: string;
    prosjekOcjena?: number;
    stopaPrisustva?: number;
    [key: string]: any;
  }>;
  title?: string;
  dataKeys?: Array<{ key: string; name: string; color: string }>;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];

export default function TrendChart({ data, title, dataKeys }: TrendChartProps) {
  const defaultDataKeys = dataKeys || [
    { key: 'prosjekOcjena', name: 'Prosjek ocjena', color: '#3b82f6' },
    { key: 'stopaPrisustva', name: 'Stopa prisustva (%)', color: '#10b981' },
  ];

  // Format month names
  const formattedData = data.map((item) => {
    const monthNum = parseInt(item.name);
    return {
      ...item,
      name: MONTHS[monthNum - 1] || item.name,
    };
  });

  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
      {title && <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={formattedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          {defaultDataKeys.map((dk) => (
            <Line
              key={dk.key}
              type="monotone"
              dataKey={dk.key}
              stroke={dk.color}
              name={dk.name}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}



