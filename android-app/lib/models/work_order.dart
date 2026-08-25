class WorkOrderModel {
  final String id;
  final String woNumber;
  final String buildingName;
  final String floorLocation;
  final String? assetNumber;
  final String? assetName;
  final String categoryName;
  final String priority;
  final String problemDescription;
  String status;
  final String? targetCompletionTime;
  String? workPerformed;
  String? rootCause;
  String? remarks;
  final DateTime createdAt;

  WorkOrderModel({
    required this.id,
    required this.woNumber,
    required this.buildingName,
    required this.floorLocation,
    this.assetNumber,
    this.assetName,
    required this.categoryName,
    required this.priority,
    required this.problemDescription,
    required this.status,
    this.targetCompletionTime,
    this.workPerformed,
    this.rootCause,
    this.remarks,
    required this.createdAt,
  });

  bool get isEmergency => priority == 'Emergency';
  bool get isHigh => priority == 'High';
  bool get isCompleted => status == 'Completed' || status == 'Closed';
}
