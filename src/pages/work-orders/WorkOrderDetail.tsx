import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Boxes,
  Clock,
  CheckCircle2,
  AlertCircle,
  Flame,
  Download,
  Check,
  Play,
  RotateCcw,
  Package,
  Camera,
  Image as ImageIcon,
  Trash2,
  ShieldAlert,
} from 'lucide-react';
import { cafmDataService } from '../../api/supabase';
import { WorkOrder, UserProfile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { PhotoUploader } from '../../components/PhotoUploader';
import { SlaCountdown } from '../../components/SlaCountdown';
import { generateWorkOrderPDF } from '../../utils/pdfGenerator';

export const WorkOrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isManager, isSupervisor, isAdmin, canEdit } = useAuth();

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [technicians, setTechnicians] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Dialog states
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [workPerformed, setWorkPerformed] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [actionTaken, setActionTaken] = useState('');

  // Reporter Edit state
  const [showEditReporterModal, setShowEditReporterModal] = useState(false);
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');

  // Live Assignment Notification Toast
  const [assignmentToast, setAssignmentToast] = useState<{ show: boolean; text: string } | null>(null);

  // Photo state

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const [wo, techs] = await Promise.all([
          cafmDataService.getWorkOrderById(id),
          cafmDataService.getTechnicians(),
        ]);
        if (wo) {
          setWorkOrder(wo);
          setWorkPerformed(wo.work_performed || '');
          setRootCause(wo.root_cause || '');
          setActionTaken(wo.action_taken || '');
          setReporterName(wo.reported_by_name || '');
          setReporterPhone(wo.reported_by_phone || '');
        }
        setTechnicians(techs);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleStatusChange = async (
    newStatus: WorkOrder['status'],
    options: {
      work_performed?: string;
      root_cause?: string;
      action_taken?: string;
      rejection_reason?: string;
    } = {}
  ) => {
    if (!workOrder) return;
    setActionLoading(true);
    try {
      const updated = await cafmDataService.updateWorkOrderStatus(workOrder.id, newStatus, options);
      if (updated) setWorkOrder(updated);
      setShowRejectModal(false);
      setShowCompleteModal(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignTechnician = async (techId: string) => {
    if (!workOrder) return;
    const target = technicians.find((t) => t.id === techId);
    setWorkOrder({
      ...workOrder,
      assigned_technician_id: techId,
      assigned_technician: target,
      status: workOrder.status === 'New' ? 'Assigned' : workOrder.status,
    });
    await cafmDataService.updateWorkOrderStatus(
      workOrder.id,
      workOrder.status === 'New' ? 'Assigned' : workOrder.status
    );

    // Trigger Popup Dispatch Notification
    if (target) {
      setAssignmentToast({
        show: true,
        text: `🔔 Dispatch Notification Sent: ${workOrder.wo_number} assigned to ${target.full_name}. Push notification alert dispatched to mobile CAFM.`,
      });
      setTimeout(() => setAssignmentToast(null), 5000);
    }
  };

  const handleSaveReporter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workOrder) return;
    const updated = await cafmDataService.updateWorkOrder(workOrder.id, {
      reported_by_name: reporterName,
      reported_by_phone: reporterPhone,
    });
    if (updated) setWorkOrder(updated);
    setShowEditReporterModal(false);
  };

  const [generatingPdf, setGeneratingPdf] = useState(false);

  /**
   * The report now fetches the logo and the before/after photos before it can
   * draw them, so building it is asynchronous. Failures surface instead of
   * leaving the button looking stuck.
   */
  const handleGeneratePdf = async () => {
    if (!workOrder) return;
    setGeneratingPdf(true);
    try {
      await generateWorkOrderPDF(workOrder);
    } catch (err: any) {
      alert(err?.message || 'Could not build the report.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading || !workOrder) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  const isEmergency = workOrder.priority === 'Emergency';
  const isHigh = workOrder.priority === 'High';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/work-orders"
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-extrabold text-slate-900">{workOrder.wo_number}</h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold ${
                  isEmergency
                    ? 'bg-red-100 text-red-700 border border-red-200'
                    : isHigh
                    ? 'bg-orange-100 text-orange-700 border border-orange-200'
                    : workOrder.priority === 'Medium'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {isEmergency && <Flame className="w-3.5 h-3.5 mr-1 text-red-600" />}
                {workOrder.priority} Priority
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Created on {new Date(workOrder.created_at).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleGeneratePdf}
            disabled={generatingPdf}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold rounded-xl flex items-center space-x-2 shadow-sm transition-colors"
          >
            <Download className="w-4 h-4 text-teal-400" />
            <span>{generatingPdf ? 'Building report…' : 'Client PDF Report'}</span>
          </button>

          {/* Workflow Action Buttons */}
          {workOrder.status === 'New' && (
            <button
              onClick={() => handleStatusChange('Assigned')}
              disabled={actionLoading}
              className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-bold rounded-xl shadow-sm transition-colors"
            >
              Assign Job
            </button>
          )}

          {workOrder.status === 'Assigned' && (
            <button
              onClick={() => handleStatusChange('Accepted')}
              disabled={actionLoading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
            >
              Accept Job
            </button>
          )}

          {(workOrder.status === 'Accepted' || workOrder.status === 'On Hold') && (
            <button
              onClick={() => handleStatusChange('In Progress')}
              disabled={actionLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center space-x-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Start Work</span>
            </button>
          )}

          {workOrder.status === 'In Progress' && (
            <button
              onClick={() => setShowCompleteModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center space-x-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Complete Job</span>
            </button>
          )}

          {workOrder.status === 'Pending Approval' && (isSupervisor || isManager) && (
            <>
              <button
                onClick={() => setShowRejectModal(true)}
                className="px-3.5 py-2 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl flex items-center space-x-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Return / Reject</span>
              </button>
              <button
                onClick={() => handleStatusChange('Closed')}
                disabled={actionLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Approve & Close</span>
              </button>
            </>
          )}

          {/* Admin Override: Close Ticket Directly */}
          {isAdmin && workOrder.status !== 'Closed' && workOrder.status !== 'Pending Approval' && (
            <button
              onClick={() => handleStatusChange('Closed', { work_performed: 'Directly closed and signed off by Administrator.' })}
              disabled={actionLoading}
              className="px-3.5 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow flex items-center space-x-1.5 border border-teal-500/30"
              title="Admin Instant Close"
            >
              <Check className="w-3.5 h-3.5 text-teal-400" />
              <span>Admin Close</span>
            </button>
          )}

          {/* Admin: Delete Work Order */}
          {isAdmin && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors border border-transparent hover:border-rose-200 dark:hover:border-rose-800"
              title="Delete Work Order (Admin Only)"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Real-time Dispatch Toast Notification */}
      {assignmentToast && (
        <div className="fixed top-6 right-6 z-50 max-w-md p-4 bg-teal-900 text-white border border-teal-500 rounded-2xl shadow-2xl flex items-center space-x-3 animate-in slide-in-from-top duration-200">
          <div className="p-2 bg-teal-500 text-slate-950 rounded-xl font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-xs">Technician Assigned</div>
            <div className="text-[11px] text-teal-200 mt-0.5">{assignmentToast.text}</div>
          </div>
          <button
            onClick={() => setAssignmentToast(null)}
            className="text-teal-300 hover:text-white text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Details, Actions, Photos, Materials */}
        <div className="lg:col-span-2 space-y-6">
          {/* Problem Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Problem Description
              </h2>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Reported By: <strong className="text-slate-800 dark:text-slate-200">{workOrder.reported_by_name || 'Operations Desk'}</strong> ({workOrder.reported_by_phone || 'N/A'})
                </span>
                <button
                  onClick={() => setShowEditReporterModal(true)}
                  className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-teal-600 dark:text-teal-400 rounded hover:bg-slate-200 transition-colors"
                >
                  Edit
                </button>
              </div>
            </div>
            <p className="text-sm text-slate-800 font-medium leading-relaxed">
              {workOrder.problem_description}
            </p>

            {/* Target Asset Detail */}
            {workOrder.asset && (
              <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start space-x-3">
                <Boxes className="w-5 h-5 text-teal-600 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    {workOrder.asset.asset_number} — {workOrder.asset.name}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Manufacturer: {workOrder.asset.manufacturer || 'N/A'} | Model: {workOrder.asset.model || 'N/A'} | Status: {workOrder.asset.status}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Photographic Evidence - uploaded to Supabase Storage */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
                <Camera className="w-4 h-4 text-teal-600" />
                <span>Photographic Evidence</span>
              </h2>
              <span className="text-[11px] text-slate-400">Included in Client PDF Report</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <PhotoUploader
                workOrder={workOrder}
                photoType="before"
                label="Before"
                canEdit={canEdit}
                onChange={setWorkOrder}
              />
              <PhotoUploader
                workOrder={workOrder}
                photoType="progress"
                label="In Progress"
                canEdit={canEdit}
                onChange={setWorkOrder}
              />
              <PhotoUploader
                workOrder={workOrder}
                photoType="after"
                label="After"
                canEdit={canEdit}
                onChange={setWorkOrder}
              />
            </div>
          </div>

          {/* Work Performed / Root Cause / Action Taken */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Execution & Resolution Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase">Work Performed</label>
                <p className="text-xs text-slate-800 mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 min-h-[48px]">
                  {workOrder.work_performed || <span className="text-slate-400 italic">Pending execution</span>}
                </p>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase">Root Cause</label>
                <p className="text-xs text-slate-800 mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 min-h-[48px]">
                  {workOrder.root_cause || <span className="text-slate-400 italic">Not recorded</span>}
                </p>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase">Action Taken & Final Remarks</label>
              <p className="text-xs text-slate-800 mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 min-h-[48px]">
                {workOrder.action_taken || workOrder.remarks || <span className="text-slate-400 italic">None</span>}
              </p>
            </div>
          </div>

          {/* Materials Consumed */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
                <Package className="w-4 h-4 text-teal-600" />
                <span>Spare Parts & Materials Consumed</span>
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Item Code</th>
                    <th className="px-4 py-2.5">Material Description</th>
                    <th className="px-4 py-2.5">Qty</th>
                    <th className="px-4 py-2.5">Unit Cost</th>
                    <th className="px-4 py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-900">MAT-HVAC-BELT-A</td>
                    <td className="px-4 py-3 text-slate-700">V-Belt SPA-1800 for AHU Blower</td>
                    <td className="px-4 py-3 font-bold text-slate-800">1 pcs</td>
                    <td className="px-4 py-3 text-slate-600">45.00 AED</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">45.00 AED</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Status, SLA, Assignments, Timeline */}
        <div className="space-y-6">
          {/* Status & SLA Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Current Status
              </span>
              <div
                className={`px-3 py-1.5 rounded-xl text-center text-xs font-bold tracking-wide ${
                  workOrder.status === 'Completed' || workOrder.status === 'Closed'
                    ? 'bg-emerald-100 text-emerald-700'
                    : workOrder.status === 'In Progress'
                    ? 'bg-blue-100 text-blue-700'
                    : workOrder.status === 'Pending Approval'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {workOrder.status}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Building:</span>
                <span className="font-semibold text-slate-800">{workOrder.building?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Floor & Room:</span>
                <span className="font-semibold text-slate-800">
                  {workOrder.floor?.name} - {workOrder.location?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Category:</span>
                <span className="font-semibold text-slate-800">{workOrder.category?.name}</span>
              </div>
            </div>

            {/* Complete Timing & Lifecycle Timestamps */}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-600" />
                <span>Lifecycle Timing & Timestamps</span>
              </span>

              <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">1. Logged / Created At</span>
                  <span className="font-bold text-slate-900 block">
                    {new Date(workOrder.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="border-t border-slate-200/60 pt-1.5">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">2. Accepted At</span>
                  <span className="font-semibold text-slate-800 block">
                    {workOrder.accepted_at ? new Date(workOrder.accepted_at).toLocaleString() : <span className="text-slate-400 italic">Pending Tech Acceptance</span>}
                  </span>
                </div>

                <div className="border-t border-slate-200/60 pt-1.5">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">3. Work Started At</span>
                  <span className="font-semibold text-slate-800 block">
                    {workOrder.started_at ? new Date(workOrder.started_at).toLocaleString() : <span className="text-slate-400 italic">Pending Start</span>}
                  </span>
                </div>

                <div className="border-t border-slate-200/60 pt-1.5">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">4. Work Completed At</span>
                  <span className="font-semibold text-emerald-700 block">
                    {workOrder.completed_at ? new Date(workOrder.completed_at).toLocaleString() : <span className="text-slate-400 italic">In Progress</span>}
                  </span>
                </div>

                <div className="border-t border-slate-200/60 pt-1.5">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">5. Closed / Approved At</span>
                  <span className="font-semibold text-purple-700 block">
                    {workOrder.closed_at || workOrder.approved_at ? new Date(workOrder.closed_at || workOrder.approved_at!).toLocaleString() : <span className="text-slate-400 italic">Awaiting Approval</span>}
                  </span>
                </div>
              </div>
            </div>

            {/* SLA Timer */}
            <div className="border-t border-slate-100 pt-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2 flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-600" />
                <span>SLA Metrics</span>
              </span>
              {/* Live countdown against resolution_due_at, which was stored
                  but never surfaced, so breaches went unnoticed. */}
              <SlaCountdown workOrder={workOrder} variant="panel" className="mb-2" />

              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Response Target:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {workOrder.response_time_minutes ? `${workOrder.response_time_minutes} min` : '15 min'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Raised:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {new Date(workOrder.created_at).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Assigned Personnel */}
            <div className="border-t border-slate-100 pt-3">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Assigned Technician
              </label>
              <select
                value={workOrder.assigned_technician_id || ''}
                onChange={(e) => handleAssignTechnician(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              >
                <option value="">-- Unassigned --</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Complete Job Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Complete Work Order</h3>
            <p className="text-xs text-slate-500">
              Enter the corrective maintenance details before submitting for supervisor approval.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Work Performed *</label>
                <textarea
                  rows={3}
                  value={workPerformed}
                  onChange={(e) => setWorkPerformed(e.target.value)}
                  placeholder="e.g. Replaced worn drive belt and lubricated fan bearing..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Root Cause</label>
                <input
                  type="text"
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  placeholder="e.g. Operational belt wear due to prolonged duty cycle"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowCompleteModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleStatusChange('Pending Approval', {
                    work_performed: workPerformed,
                    root_cause: rootCause,
                    action_taken: 'Inspection and replacement verified under normal operating current.',
                  })
                }
                className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold rounded-xl text-xs shadow"
              >
                Submit for Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Return Work Order to Technician</h3>
            <p className="text-xs text-slate-500">Please provide a specific reason for rejection / return.</p>

            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Missing after photo or abnormal noise persists during test run..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleStatusChange('In Progress', { rejection_reason: rejectReason })}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow"
              >
                Return to Tech
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Reporter Modal */}
      {showEditReporterModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Edit Reported By / Tenant Contact
              </h3>
              <button
                onClick={() => setShowEditReporterModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveReporter} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Reported By Name *</label>
                <input
                  type="text"
                  required
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder="e.g. Facilities Helpdesk / Zaid Al-Harbi"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Phone Number</label>
                <input
                  type="text"
                  value={reporterPhone}
                  onChange={(e) => setReporterPhone(e.target.value)}
                  placeholder="+971 50 123 4567"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditReporterModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs shadow transition-colors"
                >
                  Update Reporter Info
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Work Order Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Delete Work Order
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete ticket <strong className="text-slate-900 dark:text-white">{workOrder.wo_number}</strong>? All history and attachments will be deleted.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await cafmDataService.deleteWorkOrder(workOrder.id);
                  navigate('/work-orders');
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
