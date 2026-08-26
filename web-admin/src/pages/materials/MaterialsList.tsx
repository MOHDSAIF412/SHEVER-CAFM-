import React, { useEffect, useState } from 'react';
import { Package, Search, PlusCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cafmDataService } from '../../api/supabase';
import { Material } from '../../types';

export const MaterialsList: React.FC = () => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cafmDataService.getMaterials().then((mats) => {
      setMaterials(mats);
      setLoading(false);
    });
  }, []);

  const filtered = materials.filter(
    (m) =>
      m.item_code.toLowerCase().includes(search.toLowerCase()) ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Spare Parts & Materials Inventory</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track warehouse stock levels, min-stock reorder thresholds, and maintenance consumption
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search spare parts by code, name or trade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Item Code</th>
                <th className="px-5 py-3.5">Material Description</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">In Stock</th>
                <th className="px-5 py-3.5">Min Stock</th>
                <th className="px-5 py-3.5">Unit Cost</th>
                <th className="px-5 py-3.5">Store Location</th>
                <th className="px-5 py-3.5">Stock Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filtered.map((mat) => {
                const isLow = mat.quantity_in_stock <= mat.min_stock_level;
                return (
                  <tr key={mat.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4 font-bold text-teal-700 dark:text-teal-400">{mat.item_code}</td>
                    <td className="px-5 py-4 font-semibold text-slate-800 dark:text-slate-200">{mat.name}</td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-400">{mat.category}</td>
                    <td className="px-5 py-4 font-bold text-slate-900 dark:text-slate-100">
                      {mat.quantity_in_stock} {mat.unit}
                    </td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{mat.min_stock_level} {mat.unit}</td>
                    <td className="px-5 py-4 font-semibold text-slate-800 dark:text-slate-200">{mat.unit_cost.toFixed(2)} AED</td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-400">{mat.location}</td>
                    <td className="px-5 py-4">
                      {isLow ? (
                        <span className="inline-flex items-center text-[10px] font-bold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded">
                          <AlertTriangle className="w-3 h-3 mr-1 text-red-600" /> Reorder Alert
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> Healthy
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
