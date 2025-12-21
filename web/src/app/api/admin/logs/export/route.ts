import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth, AdminContext } from '@/lib/admin/auth';

// =============================================================================
// GET /api/admin/logs/export
// Export audit logs to CSV format
// =============================================================================

export const GET = withAdminAuth(async (req: NextRequest, context: AdminContext) => {
  const { searchParams } = new URL(req.url);

  // Parse filters
  const category = searchParams.get('category') || undefined;
  const action = searchParams.get('action') || undefined;
  const adminId = searchParams.get('admin_id') ? parseInt(searchParams.get('admin_id')!) : undefined;
  const fromDate = searchParams.get('from') ? new Date(searchParams.get('from')!) : undefined;
  const toDate = searchParams.get('to') ? new Date(searchParams.get('to')!) : undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') || '1000'), 10000);

  // Build where clause
  const where: Record<string, unknown> = {};

  if (category) {
    where.category = category;
  }

  if (action) {
    where.action = { contains: action, mode: 'insensitive' };
  }

  if (adminId) {
    where.admin_id = adminId;
  }

  if (fromDate || toDate) {
    where.created_at = {};
    if (fromDate) {
      (where.created_at as Record<string, Date>).gte = fromDate;
    }
    if (toDate) {
      (where.created_at as Record<string, Date>).lte = toDate;
    }
  }

  // Moderators can only export their own logs
  if (context.admin.role !== 'owner') {
    where.admin_id = context.admin.userId;
  }

  // Fetch logs
  const logs = await prisma.admin_audit_log.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: limit,
  });

  // Generate CSV
  const csvHeaders = [
    'ID',
    'Timestamp',
    'Admin ID',
    'Admin Name',
    'Action',
    'Category',
    'Target Type',
    'Target ID',
    'Target Name',
    'Reason',
    'IP Address',
    'Old Value',
    'New Value',
  ];

  const csvRows = logs.map(log => [
    log.id.toString(),
    log.created_at.toISOString(),
    log.admin_id.toString(),
    escapeCSV(log.admin_name),
    escapeCSV(log.action),
    escapeCSV(log.category),
    escapeCSV(log.target_type || ''),
    escapeCSV(log.target_id || ''),
    escapeCSV(log.target_name || ''),
    escapeCSV(log.reason || ''),
    escapeCSV(log.ip_address || ''),
    escapeCSV(log.old_value ? JSON.stringify(log.old_value) : ''),
    escapeCSV(log.new_value ? JSON.stringify(log.new_value) : ''),
  ]);

  const csv = [
    csvHeaders.join(','),
    ...csvRows.map(row => row.join(',')),
  ].join('\n');

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `kingpin-audit-logs-${timestamp}.csv`;

  // Return CSV response
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Escape a value for CSV format
 */
function escapeCSV(value: string): string {
  if (!value) return '';

  // If the value contains quotes, commas, or newlines, wrap in quotes and escape internal quotes
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}
