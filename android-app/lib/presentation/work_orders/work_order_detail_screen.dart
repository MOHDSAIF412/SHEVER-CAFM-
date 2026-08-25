import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme.dart';
import '../../models/work_order.dart';
import '../../providers/cafm_provider.dart';
import 'work_order_complete_screen.dart';

class WorkOrderDetailScreen extends ConsumerWidget {
  final WorkOrderModel workOrder;
  const WorkOrderDetailScreen({super.key, required this.workOrder});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(cafmProvider);
    final currentWo = state.workOrders.firstWhere((w) => w.id == workOrder.id, orElse: () => workOrder);

    return Scaffold(
      appBar: AppBar(
        title: Text(currentWo.woNumber, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Status & Priority Banner
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('STATUS', style: TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 2),
                      Text(
                        currentWo.status,
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.primaryDark),
                      ),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text('PRIORITY', style: TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 2),
                      Text(
                        currentWo.priority,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: currentWo.isEmergency ? AppColors.emergency : AppColors.high,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // Location & Asset Info Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('LOCATION & ASSET', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey)),
                  const SizedBox(height: 8),
                  Text(currentWo.buildingName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.bgDark)),
                  Text(currentWo.floorLocation, style: TextStyle(color: Colors.grey[700], fontSize: 13)),
                  if (currentWo.assetNumber != null) ...[
                    const Divider(height: 20),
                    Row(
                      children: [
                        const Icon(Icons.inventory_2, size: 16, color: AppColors.primary),
                        const SizedBox(width: 6),
                        Text(
                          '${currentWo.assetNumber} — ${currentWo.assetName ?? ''}',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.primaryDark),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 14),

            // Problem Description
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('REPORTED PROBLEM', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey)),
                  const SizedBox(height: 6),
                  Text(
                    currentWo.problemDescription,
                    style: const TextStyle(fontSize: 14, color: Colors.black87, height: 1.4),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Large Action Buttons according to workflow
            if (currentWo.status == 'New' || currentWo.status == 'Assigned') ...[
              ElevatedButton.icon(
                onPressed: () {
                  ref.read(cafmProvider.notifier).updateWorkOrderStatus(currentWo.id, 'Accepted');
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Job accepted! GPS location recorded.')),
                  );
                },
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                icon: const Icon(Icons.check),
                label: const Text('ACCEPT JOB', style: TextStyle(letterSpacing: 1)),
              ),
            ] else if (currentWo.status == 'Accepted') ...[
              ElevatedButton.icon(
                onPressed: () {
                  ref.read(cafmProvider.notifier).updateWorkOrderStatus(currentWo.id, 'In Progress');
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Job started! Response time timer logged.')),
                  );
                },
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.inProgress),
                icon: const Icon(Icons.play_arrow),
                label: const Text('START JOB', style: TextStyle(letterSpacing: 1)),
              ),
            ] else if (currentWo.status == 'In Progress') ...[
              ElevatedButton.icon(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => WorkOrderCompleteScreen(workOrder: currentWo),
                    ),
                  );
                },
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.completed),
                icon: const Icon(Icons.task_alt),
                label: const Text('COMPLETE WORK', style: TextStyle(letterSpacing: 1)),
              ),
            ] else ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.completed.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: const [
                    Icon(Icons.check_circle, color: AppColors.completed),
                    SizedBox(width: 8),
                    Text(
                      'Work Completed & Submitted',
                      style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.completed),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
