# Shever Technical Services — Database Setup Guide

This directory contains the complete PostgreSQL database schema, security policies, automation triggers, and seed data for the **Shever Technical Services Facilities Management System (CAFM)**.

## Execution Order

When initializing your Supabase or PostgreSQL instance, execute the SQL files in this exact sequence:

1. **`01_schema.sql`**: Creates all 25 normalized tables, primary keys, foreign keys, and indexes.
2. **`02_rls_policies.sql`**: Configures Row Level Security (RLS) and role-based policies for `admin`, `fm_manager`, `supervisor`, and `technician`.
3. **`03_triggers_and_functions.sql`**: Installs automated sequence numbering (`WO-YYYY-XXXXXX`, `PPM-YYYY-XXXXXX`), SLA calculation engines, status transition history hooks, inventory auto-deductions, and automatic next PPM schedule generators.
4. **`04_seed_data.sql`**: Populates demo buildings, floors, locations, equipment assets with QR codes, checklist templates, spare parts inventory, PPM schedules, and realistic work orders.

## Cloud Storage Buckets
Ensure the following Supabase Storage buckets are created with public/authenticated read access:
- `work-order-photos`
- `ppm-photos`
- `signatures`
- `asset-docs`
