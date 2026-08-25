class AssetModel {
  final String id;
  final String assetNumber;
  final String name;
  final String type;
  final String categoryName;
  final String manufacturer;
  final String model;
  final String serialNumber;
  final String buildingName;
  final String locationName;
  final String status;
  final String criticality;

  AssetModel({
    required this.id,
    required this.assetNumber,
    required this.name,
    required this.type,
    required this.categoryName,
    required this.manufacturer,
    required this.model,
    required this.serialNumber,
    required this.buildingName,
    required this.locationName,
    required this.status,
    required this.criticality,
  });
}
