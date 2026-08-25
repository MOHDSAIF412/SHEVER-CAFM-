import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/work_order.dart';
import '../models/ppm_plan.dart';
import '../models/asset.dart';
import '../core/mock_data.dart';

class CafmState {
  final List<WorkOrderModel> workOrders;
  final List<PPMScheduleModel> ppmSchedules;
  final List<AssetModel> assets;
  final String syncStatus; // 'Online', 'Offline', 'Syncing'
  final String currentUserName;

  CafmState({
    required this.workOrders,
    required this.ppmSchedules,
    required this.assets,
    required this.syncStatus,
    required this.currentUserName,
  });

  CafmState copyWith({
    List<WorkOrderModel>? workOrders,
    List<PPMScheduleModel>? ppmSchedules,
    List<AssetModel>? assets,
    String? syncStatus,
    String? currentUserName,
  }) {
    return CafmState(
      workOrders: workOrders ?? this.workOrders,
      ppmSchedules: ppmSchedules ?? this.ppmSchedules,
      assets: assets ?? this.assets,
      syncStatus: syncStatus ?? this.syncStatus,
      currentUserName: currentUserName ?? this.currentUserName,
    );
  }
}

class CafmNotifier extends StateNotifier<CafmState> {
  CafmNotifier()
      : super(CafmState(
          workOrders: initialWorkOrders,
          ppmSchedules: initialPPMSchedules,
          assets: initialAssets,
          syncStatus: 'Online - Synced',
          currentUserName: 'Rashid Khan (HVAC Tech)',
        ));

  void updateWorkOrderStatus(String id, String newStatus, {String? workPerformed, String? rootCause, String? remarks}) {
    state = state.copyWith(
      workOrders: state.workOrders.map((wo) {
        if (wo.id == id) {
          wo.status = newStatus;
          if (workPerformed != null) wo.workPerformed = workPerformed;
          if (rootCause != null) wo.rootCause = rootCause;
          if (remarks != null) wo.remarks = remarks;
        }
        return wo;
      }).toList(),
    );
  }

  void updatePPMStatus(String id, String newStatus) {
    state = state.copyWith(
      ppmSchedules: state.ppmSchedules.map((s) {
        if (s.id == id) {
          s.status = newStatus;
        }
        return s;
      }).toList(),
    );
  }

  void updateChecklistItem(String scheduleId, String itemId, {String? statusResult, double? numericValue, String? textValue}) {
    state = state.copyWith(
      ppmSchedules: state.ppmSchedules.map((s) {
        if (s.id == scheduleId) {
          for (var item in s.checklist) {
            if (item.id == itemId) {
              if (statusResult != null) item.statusResult = statusResult;
              if (numericValue != null) item.numericValue = numericValue;
              if (textValue != null) item.textValue = textValue;
            }
          }
        }
        return s;
      }).toList(),
    );
  }
}

final cafmProvider = StateNotifierProvider<CafmNotifier, CafmState>((ref) {
  return CafmNotifier();
});
