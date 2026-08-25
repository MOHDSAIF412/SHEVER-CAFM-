import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme.dart';
import '../../providers/cafm_provider.dart';
import 'ppm_checklist_screen.dart';

class PPMListScreen extends ConsumerWidget {
  const PPMListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(cafmProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Preventive Maintenance (PPM)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: state.ppmSchedules.length,
        itemBuilder: (context, index) {
          final s = state.ppmSchedules[index];
          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => PPMChecklistScreen(schedule: s),
                  ),
                );
              },
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          s.scheduleNumber,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.primaryDark),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: s.status == 'Overdue'
                                ? AppColors.emergency.withValues(alpha: 0.15)
                                : s.isCompleted
                                    ? AppColors.completed.withValues(alpha: 0.15)
                                    : AppColors.primary.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            s.status,
                            style: TextStyle(
                              color: s.status == 'Overdue'
                                  ? AppColors.emergency
                                  : s.isCompleted
                                      ? AppColors.completed
                                      : AppColors.primaryDark,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      s.planTitle,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.black87),
                    ),
                    const SizedBox(height: 4),
                    Text('Asset: ${s.assetName}', style: TextStyle(color: Colors.grey[700], fontSize: 12)),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('📅 Due: ${s.dueDate}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: AppColors.primaryDark)),
                        Text('${s.checklist.length} Checklist Tasks', style: TextStyle(color: Colors.grey[600], fontSize: 11)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
