import { useEffect, useState, ReactNode } from 'react';

interface ChartsWrapperProps {
  children: (components: any) => ReactNode;
}

export default function ChartsWrapper({ children }: ChartsWrapperProps) {
  const [components, setComponents] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('recharts')
        .then((module) => {
          setComponents({
            LineChart: module.LineChart,
            Line: module.Line,
            BarChart: module.BarChart,
            Bar: module.Bar,
            PieChart: module.PieChart,
            Pie: module.Pie,
            Cell: module.Cell,
            XAxis: module.XAxis,
            YAxis: module.YAxis,
            CartesianGrid: module.CartesianGrid,
            Tooltip: module.Tooltip,
            Legend: module.Legend,
            ResponsiveContainer: module.ResponsiveContainer,
          });
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  if (loading || !components) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Učitavanje grafika...</div>
      </div>
    );
  }

  return <>{children(components)}</>;
}

