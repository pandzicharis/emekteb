import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ComparisonChartProps {
  data: Array<{
    name: string;
    ucenik?: number;
    razred?: number;
    grupa?: number;
  }>;
  title?: string;
}

export default function ComparisonChart({ data, title }: ComparisonChartProps) {
  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
      {title && <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          {data[0]?.ucenik !== undefined && <Bar dataKey="ucenik" fill="#3b82f6" name="Učenik" />}
          {data[0]?.razred !== undefined && <Bar dataKey="razred" fill="#10b981" name="Razred" />}
          {data[0]?.grupa !== undefined && <Bar dataKey="grupa" fill="#f59e0b" name="Grupa" />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}



