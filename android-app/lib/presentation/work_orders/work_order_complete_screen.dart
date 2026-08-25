import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme.dart';
import '../../models/work_order.dart';
import '../../providers/cafm_provider.dart';

class WorkOrderCompleteScreen extends ConsumerStatefulWidget {
  final WorkOrderModel workOrder;
  const WorkOrderCompleteScreen({super.key, required this.workOrder});

  @override
  ConsumerState<WorkOrderCompleteScreen> createState() => _WorkOrderCompleteScreenState();
}

class _WorkOrderCompleteScreenState extends ConsumerState<WorkOrderCompleteScreen> {
  final _workPerformedController = TextEditingController(text: 'Serviced equipment and replaced worn components.');
  final _rootCauseController = TextEditingController(text: 'Wear and tear from high duty cycle operation.');
  final _remarksController = TextEditingController(text: 'Tested under full operational load. Verified normal parameters.');

  void _submitCompletion() {
    if (_workPerformedController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please describe the work performed.')),
      );
      return;
    }

    ref.read(cafmProvider.notifier).updateWorkOrderStatus(
      widget.workOrder.id,
      'Completed',
      workPerformed: _workPerformedController.text,
      rootCause: _rootCauseController.text,
      remarks: _remarksController.text,
    );

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Work order completed and submitted for supervisor review!')),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Complete Work Order', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Work Performed Field
            const Text('Work Performed *', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 6),
            TextField(
              controller: _workPerformedController,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'Describe actions taken...',
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
              ),
            ),
            const SizedBox(height: 14),

            // Root Cause Field
            const Text('Root Cause', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 6),
            TextField(
              controller: _rootCauseController,
              decoration: InputDecoration(
                hintText: 'e.g. Belt slip, thermal trip, clogged strainer...',
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
              ),
            ),
            const SizedBox(height: 14),

            // Photo Attachment Section
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.camera_alt, color: AppColors.primaryDark),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text('Before / After Photos', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        Text('2 photos attached', style: TextStyle(fontSize: 11, color: AppColors.completed, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                  const Icon(Icons.check_circle, color: AppColors.completed),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Digital Signature Section
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppColors.accent.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.draw, color: AppColors.primaryDark),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text('Technician Digital Signature', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        Text('Signed digitally (Rashid Khan)', style: TextStyle(fontSize: 11, color: AppColors.completed, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                  const Icon(Icons.check_circle, color: AppColors.completed),
                ],
              ),
            ),
            const SizedBox(height: 24),

            ElevatedButton(
              onPressed: _submitCompletion,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.completed,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: const Text('SUBMIT COMPLETION FOR APPROVAL', style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1)),
            ),
          ],
        ),
      ),
    );
  }
}
