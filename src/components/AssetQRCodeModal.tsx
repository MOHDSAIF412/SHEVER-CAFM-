import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Asset } from '../types';
import { Printer, X } from 'lucide-react';

export const AssetQRCodeModal: React.FC<{ asset: Asset; onClose: () => void }> = ({ asset, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Asset QR Badge</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Badge Area */}
        <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl space-y-3 print:border-solid print:m-0">
          <div className="flex items-center justify-center space-x-2">
            <img src="/shever-logo.png" alt="Shever" className="h-6 object-contain" />
            <span className="text-xs font-extrabold text-slate-900 tracking-wide">SHEVER TECHNICAL</span>
          </div>

          <div className="flex justify-center p-3 bg-white rounded-lg shadow-sm">
            <QRCodeSVG value={asset.asset_number} size={150} level="H" includeMargin />
          </div>

          <div>
            <h4 className="text-sm font-extrabold text-slate-900">{asset.asset_number}</h4>
            <p className="text-xs font-semibold text-slate-700 mt-0.5">{asset.name}</p>
            <p className="text-[11px] text-slate-500">{asset.building?.name || 'Main Facility'}</p>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-950 rounded-xl text-xs font-bold shadow flex items-center space-x-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>Print Badge</span>
          </button>
        </div>
      </div>
    </div>
  );
};
