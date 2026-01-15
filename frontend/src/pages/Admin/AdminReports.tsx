import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface SalesGraph {
  date: string;
  total: number;
}

interface PieSlice {
  name: string;
  value: number;
}

export default function AdminReports() {
  const [todaySales, setTodaySales] = useState<number>(0);
  const [monthlySales, setMonthlySales] = useState<number>(0);
  const [lostAuctions, setLostAuctions] = useState<number>(0);
  const [graphData, setGraphData] = useState<SalesGraph[]>([]);
  const [lineData, setLineData] = useState<SalesGraph[]>([]);
  const [pieData, setPieData] = useState<PieSlice[]>([]);

  const PIE_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  useEffect(() => {
    // ✅ Dummy data (replace with real API calls)
    setTodaySales(1200);
    setMonthlySales(24500);
    setLostAuctions(5);

    const bar = [
      { date: "09/01", total: 3000 },
      { date: "09/02", total: 2500 },
      { date: "09/03", total: 4000 },
      { date: "09/04", total: 1500 },
      { date: "09/05", total: 3500 },
      { date: "09/06", total: 5000 },
      { date: "09/07", total: 2800 },
    ];

    // line data could show cumulative or same daily values
    const line = bar.map((d, idx) => ({ date: d.date, total: d.total + idx * 200 }));

    const pie = [
      { name: "Buy Now", value: 4000 },
      { name: "Bids", value: 3000 },
      { name: "Reserved", value: 1500 },
      { name: "Refunds", value: 500 },
    ];

    setGraphData(bar);
    setLineData(line);
    setPieData(pie);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Admin Reports & Analytics</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Today’s Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">${todaySales.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">${monthlySales.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lost Auctions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{lostAuctions}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts: Bar, Line, Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar Chart (Sales per day) */}
        <Card>
          <CardHeader>
            <CardTitle>Sales Per Day (This Month)</CardTitle>
          </CardHeader>
          <CardContent>
            {graphData.length === 0 ? (
              <p>No sales data available</p>
            ) : (
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={graphData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                    <Bar dataKey="total" fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Line Chart (Trend) */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {lineData.length === 0 ? (
              <p>No trend data</p>
            ) : (
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                    <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart (Distribution) full-width on smaller screens */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sales Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p>No distribution data</p>
            ) : (
              <div style={{ width: "100%", height: 360 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                    <Legend />
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
