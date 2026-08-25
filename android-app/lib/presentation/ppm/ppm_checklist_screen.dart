import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme.dart';
import '../../models/ppm_plan.dart';
import '../../providers/cafm_provider.dart';

class PPMChecklistScreen extends ConsumerStatefulWidget {
  final PPMScheduleModel schedule;
  const PPMChecklistScreen({super.key, required this.schedule});

  @override
  ConsumerState<PPMChecklistScreen> createState() => _PPMChecklistScreenState();
}

class _PPMChecklistScreenState extends ConsumerState<PPMChecklistScreen> {
  late Map<String, String> _passFailState;
  late Map<String, TextEditingController> _numericControllers;

  @override
  void initState() {
    super.initState();
    _passFailState = {};
    _numericControllers = {};
    for (var item in widget.schedule.checklist) {
      _passFailState[item.id] = item.statusResult ?? 'Pass';
      _numericControllers[item.id] = TextEditingController(
        text: item.numericValue != null ? item.numericValue.toString() : (item.minValue != null ? '${(item.minValue! + item.maxValue!) / 2}' : ''),
      );
    }
  }

  void _submitPPM() {
    ref.read(cafmProvider.notifier).updatePPMStatus(widget.schedule.id, 'Completed');
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('PPM Checklist verified! Next due date automatically created.')),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.schedule.scheduleNumber, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Plan Info
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.schedule.planTitle, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.bgDark)),
                  const SizedBox(height: 4),
                  Text('Target: ${widget.schedule.assetName}', style: TextStyle(color: Colors.grey[700], fontSize: 12)),
                  const SizedBox(height: 4),
                  Text('Recurrence: ${widget.schedule.frequency}', style: const TextStyle(color: AppColors.primaryDark, fontWeight: FontWeight.bold, fontSize: 12)),
                ],
              ),
            ),
            const SizedBox(height: 16),

            const Text('Inspection Checklist Tasks', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.bgDark)),
            const SizedBox(height: 8),

            ...widget.schedule.checklist.map((item) {
              final isNumeric = item.fieldType == 'numeric_reading';
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.taskDescription,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.black87),
                    ),
                    const SizedBox(height: 10),

                    if (isNumeric) ...[
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _numericControllers[item.id],
                              keyboardType: TextInputType.number,
                              decoration: InputDecoration(
                                labelText: 'Recorded Value (${item.unitOfMeasure ?? ''})',
                                helperText: 'Safe Range: ${item.minValue} - ${item.maxValue} ${item.unitOfMeasure}',
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ] else ...[
                      Row(
                        children: [
                          ChoiceChip(
                            label: const Text('PASS'),
                            selected: _passFailState[item.id] == 'Pass',
                            selectedColor: AppColors.completed,
                            labelStyle: TextStyle(
                              color: _passFailState[item.id] == 'Pass' ? Colors.white : Colors.black87,
                              fontWeight: FontWeight.bold,
                            ),
                            onSelected: (_) => setState(() => _passFailState[item.id] = 'Pass'),
                          ),
                          const SizedBox(width: 8),
                          ChoiceChip(
                            label: const Text('FAIL'),
                            selected: _passFailState[item.id] == 'Fail',
                            selectedColor: AppColors.emergency,
                            labelStyle: TextStyle(
                              color: _passFailState[item.id] == 'Fail' ? Colors.white : Colors.black87,
                              fontWeight: FontWeight.bold,
                            ),
                            onSelected: (_) => setState(() => _passFailState[item.id] = 'Fail'),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              );
            }),

            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: _submitPPM,
              icon: const Icon(Icons.check_circle_outline),
              label: const Text('SIGN & SUBMIT PPM INSPECTION', style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1)),
            ),
          ],
        ),
      ),
    );
  }
}
