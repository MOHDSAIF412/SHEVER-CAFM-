class PPMChecklistItemModel {
  final String id;
  final String taskDescription;
  final String fieldType; // pass_fail, numeric_reading, text, yes_no
  final String? unitOfMeasure;
  final double? minValue;
  final double? maxValue;
  String? statusResult; // Pass, Fail
  double? numericValue;
  String? textValue;
  String? remarks;

  PPMChecklistItemModel({
    required this.id,
    required this.taskDescription,
    required this.fieldType,
    this.unitOfMeasure,
    this.minValue,
    this.maxValue,
    this.statusResult,
    this.numericValue,
    this.textValue,
    this.remarks,
  });
}

class PPMScheduleModel {
  final String id;
  final String scheduleNumber;
  final String planTitle;
  final String assetName;
  final String buildingName;
  final String frequency;
  final String dueDate;
  String status;
  final List<PPMChecklistItemModel> checklist;

  PPMScheduleModel({
    required this.id,
    required this.scheduleNumber,
    required this.planTitle,
    required this.assetName,
    required this.buildingName,
    required this.frequency,
    required this.dueDate,
    required this.status,
    required this.checklist,
  });

  bool get isCompleted => status == 'Completed' || status == 'Closed';
}
