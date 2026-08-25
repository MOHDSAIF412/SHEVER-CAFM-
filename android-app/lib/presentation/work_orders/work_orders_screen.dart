import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme.dart';
import '../../providers/cafm_provider.dart';
import '../../models/work_order.dart';
import 'work_order_detail_screen.dart';

class WorkOrdersScreen extends ConsumerStatefulWidget {
  const WorkOrdersScreen({super.key});

  @override
  ConsumerState<WorkOrdersScreen> createState() => _WorkOrdersScreenState();
}

class _WorkOrdersScreenState extends ConsumerState<WorkOrdersScreen> {
  String _selectedTab = 'All';

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(cafmProvider);

    List<WorkOrderModel> list = state.workOrders;
    if (_selectedTab == 'Active') {
      list = list.where((w) => w.status != 'Completed' && w.status != 'Closed').toList();
    } else if (_selectedTab == 'Completed') {
      list = list.where((w) => w.status == 'Completed' || w.status == 'Closed').toList();
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Work Orders', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
      ),
      body: Column(
        children: [
          // Filter Tabs
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: ['All', 'Active', 'Completed'].map((tab) {
                final isSelected = _selectedTab == tab;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(tab),
                    selected: isSelected,
                    selectedColor: AppColors.primary,
                    labelStyle: TextStyle(
                      color: isSelected ? Colors.white : Colors.black87,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                    onSelected: (_) => setState(() => _selectedTab = tab),
                  ),
                );
              }).toList(),
            ),
          ),

          // List
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: list.length,
              itemBuilder: (context, index) {
                final wo = list[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => WorkOrderDetailScreen(workOrder: wo),
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
                                wo.woNumber,
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                  color: AppColors.primaryDark,
                                ),
                              ),
                              _buildStatusBadge(wo.status),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              _buildPriorityTag(wo.priority),
                              const SizedBox(width: 8),
                              Text(
                                wo.categoryName,
                                style: TextStyle(color: Colors.grey[700], fontSize: 12, fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            wo.problemDescription,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 13, color: Colors.black87),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Icon(Icons.location_on_outlined, size: 14, color: Colors.grey[600]),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  wo.floorLocation,
                                  style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bg = Colors.grey[200]!;
    Color text = Colors.grey[800]!;
    if (status == 'In Progress') {
      bg = AppColors.inProgress.withValues(alpha: 0.15);
      text = AppColors.inProgress;
    } else if (status == 'Completed' || status == 'Closed') {
      bg = AppColors.completed.withValues(alpha: 0.15);
      text = AppColors.completed;
    } else if (status == 'Accepted') {
      bg = AppColors.medium.withValues(alpha: 0.15);
      text = AppColors.medium;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
      child: Text(status, style: TextStyle(color: text, fontSize: 11, fontWeight: FontWeight.bold)),
    );
  }

  Widget _buildPriorityTag(String priority) {
    Color color = AppColors.low;
    if (priority == 'Emergency') color = AppColors.emergency;
    if (priority == 'High') color = AppColors.high;
    if (priority == 'Medium') color = AppColors.medium;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        priority,
        style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold),
      ),
    );
  }
}
