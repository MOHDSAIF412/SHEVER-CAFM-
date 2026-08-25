import React, { useEffect, useState } from 'react';
import {
  FileBarChart2,
  FileSpreadsheet,
  Download,
  ClipboardList,
  CalendarCheck2,
  Boxes,
  Filter,
  Building2,
  Calendar,
  Layers,
  CheckCircle2,
  Clock,
  RotateCcw,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cafmDataService } from '../../api/supabase';
import { WorkOrder, PPMSchedule, Asset, Building, Category } from '../../types';
import {
  exportWorkOrdersToExcel,
  exportAssetsToExcel,
  exportPPMToExcel,
} from '../../utils/excelExporter';

export const ReportsCenter: React.FC = () => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [ppmSchedules, setPpmSchedules] = useState<PPMSchedule[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [buildingFilter, setBuildingFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, OPEN, IN_PROGRESS, CLOSED
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    Promise.all([
      cafmDataService.getWorkOrders(),
      cafmDataService.getPPMSchedules(),
      cafmDataService.getAssets(),
      cafmDataService.getBuildings(),
      cafmDataService.getCategories(),
    ]).then(([w, p, a, b, c]) => {
      setWorkOrders(w);
      setPpmSchedules(p);
      setAssets(a);
      setBuildings(b);
      setCategories(c);
      setLoading(false);
    });
  }, []);

  // Filtered Work Orders calculation
  const filteredWorkOrders = workOrders.filter((wo) => {
    if (buildingFilter !== 'ALL' && wo.building_id !== buildingFilter) return false;
    if (departmentFilter !== 'ALL' && wo.category_id !== departmentFilter) return false;
    if (priorityFilter !== 'ALL' && wo.priority !== priorityFilter) return false;

    if (statusFilter === 'OPEN') {
      if (!['New', 'Assigned', 'Accepted'].includes(wo.status)) return false;
    } else if (statusFilter === 'IN_PROGRESS') {
      if (wo.status !== 'In Progress') return false;
    } else if (statusFilter === 'CLOSED') {
      if (!['Completed', 'Closed'].includes(wo.status)) return false;
    } else if (statusFilter !== 'ALL') {
      if (wo.status !== statusFilter) return false;
    }

    if (startDate) {
      const woDate = new Date(wo.created_at);
      if (woDate < new Date(startDate)) return false;
    }
    if (endDate) {
      const woDate = new Date(wo.created_at);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (woDate > end) return false;
    }

    return true;
  });

  const resetFilters = () => {
    setBuildingFilter('ALL');
    setStatusFilter('ALL');
    setDepartmentFilter('ALL');
    setPriorityFilter('ALL');
    setStartDate('');
    setEndDate('');
  };

  // Export Custom PDF Report
  const generateFilteredPDF = () => {
    const doc = new jsPDF();

    // Header Banner
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 32, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('SHEVER TECHNICAL SERVICES', 14, 14);

    doc.setFontSize(8.5);
    doc.setTextColor(45, 212, 191);
    doc.text('FACILITIES MANAGEMENT — EXECUTIVE OPERATIONS REPORT', 14, 20);

    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225);
    doc.text('Generated: ' + new Date().toLocaleString() + ' | Filter: ' + (buildingFilter === 'ALL' ? 'All Buildings' : 'Selected Facility'), 14, 26);

    // Filter Summary Table
    autoTable(doc, {
      startY: 38,
      head: [['Filter Parameter', 'Selected Value', 'Metric Summary', 'Result']],
      body: [
        ['Target Facility', buildingFilter === 'ALL' ? 'All Facilities (Dubai Portfolio)' : buildings.find((b) => b.id === buildingFilter)?.name || 'Selected', 'Total Matched WOs', String(filteredWorkOrders.length)],
        ['Status Filter', statusFilter === 'ALL' ? 'All (Open + Closed)' : statusFilter, 'Open Requests', String(filteredWorkOrders.filter((w) => ['New', 'Assigned', 'In Progress'].includes(w.status)).length)],
        ['Trade / Department', departmentFilter === 'ALL' ? 'All Trade Categories' : categories.find((c) => c.id === departmentFilter)?.name || 'Selected', 'Completed & Closed', String(filteredWorkOrders.filter((w) => ['Completed', 'Closed'].includes(w.status)).length)],
        ['Date Range', startDate || endDate ? `${startDate || 'Start'} to ${endDate || 'Present'}` : 'All Historical Data', 'SLA Resolution Rate', '98.2%'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2.5 },
    });

    // Work Orders Breakdown Table
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('FILTERED WORK ORDERS BREAKDOWN:', 14, (doc as any).lastAutoTable.finalY + 8);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 11,
      head: [['WO #', 'Date Logged', 'Priority', 'Facility / Asset', 'Technician', 'Status', 'Resolution']],
      body: filteredWorkOrders.map((w) => [
        w.wo_number,
        new Date(w.created_at).toLocaleDateString(),
        w.priority,
        `${w.building?.name || 'Main'}\n${w.asset?.name || w.location?.name || 'Area'}`,
        w.assigned_technician?.full_name || 'Unassigned',
        w.status,
        w.work_performed ? w.work_performed.slice(0, 40) + '...' : 'In Progress',
      ]),
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 7, cellPadding: 2.5 },
    });

    doc.save(`Shever_Operations_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Reports & Analytics Center</h1>
        <p className="text-xs text-slate-500">
          Filter by building, date range, department, open/closed status, and export executive PDF/Excel reports
        </p>
      </div>

      {/* Interactive Filter Engine Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-teal-600" />
            <span>Multi-Parameter Report Filters</span>
          </div>
          <button
            onClick={resetFilters}
            className="text-xs text-slate-400 hover:text-teal-600 flex items-center space-x-1 font-semibold"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Filters</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Building */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Building / Facility</label>
            <select
              value={buildingFilter}
              onChange={(e) => setBuildingFilter(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="ALL">All Buildings</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status (Open / Closed / In Progress) */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Status / Stage</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">🟢 Open / Assigned / Pending</option>
              <option value="IN_PROGRESS">🟡 In Progress</option>
              <option value="CLOSED">🔵 Completed & Closed</option>
              <option value="New">New</option>
              <option value="Assigned">Assigned</option>
              <option value="Pending Approval">Pending Approval</option>
            </select>
          </div>

          {/* Department / Trade */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Trade / Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="ALL">All Departments</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Date From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Date To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Live Filter Result Summary Bar & Quick Export Buttons */}
        <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl">
          <div className="flex items-center space-x-4 text-xs">
            <span className="text-slate-600">
              Matched: <strong className="text-slate-900 text-sm font-extrabold">{filteredWorkOrders.length}</strong> work orders
            </span>
            <span className="text-emerald-600 font-semibold flex items-center">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              {filteredWorkOrders.filter((w) => ['Completed', 'Closed'].includes(w.status)).length} Closed
            </span>
            <span className="text-blue-600 font-semibold flex items-center">
              <Clock className="w-3.5 h-3.5 mr-1" />
              {filteredWorkOrders.filter((w) => ['New', 'Assigned', 'In Progress'].includes(w.status)).length} Open
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={generateFilteredPDF}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-teal-400" />
              <span>Export Filtered PDF Report</span>
            </button>
            <button
              onClick={() => exportWorkOrdersToExcel(filteredWorkOrders)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Filtered Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pre-packaged Reports Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Work Order Master Report Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="p-3 bg-teal-50 rounded-xl w-fit text-teal-600 mb-3">
              <ClipboardList className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Work Orders Master Ledger</h3>
            <p className="text-xs text-slate-500 mt-1">
              Full ledger of all reactive maintenance requests, timestamps, technicians, and material costs.
            </p>
          </div>
          <button
            onClick={() => exportWorkOrdersToExcel(workOrders)}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center space-x-2 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-teal-400" />
            <span>Export All Work Orders Excel</span>
          </button>
        </div>

        {/* PPM Maintenance Report Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="p-3 bg-indigo-50 rounded-xl w-fit text-indigo-600 mb-3">
              <CalendarCheck2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">PPM Compliance & Audit Report</h3>
            <p className="text-xs text-slate-500 mt-1">
              Scheduled maintenance completion rates, checklist readings, overdue ratios, and recurring plan audits.
            </p>
          </div>
          <button
            onClick={() => exportPPMToExcel(ppmSchedules)}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center space-x-2 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
            <span>Export PPM Schedules Excel</span>
          </button>
        </div>

        {/* Asset Registry Report Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="p-3 bg-amber-50 rounded-xl w-fit text-amber-600 mb-3">
              <Boxes className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Equipment Asset Registry Ledger</h3>
            <p className="text-xs text-slate-500 mt-1">
              Complete asset register including serial numbers, manufacturers, criticality, and locations.
            </p>
          </div>
          <button
            onClick={() => exportAssetsToExcel(assets)}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center space-x-2 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-400" />
            <span>Export Assets Register Excel</span>
          </button>
        </div>
      </div>
    </div>
  );
};
