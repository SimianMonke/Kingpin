import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin/auth';

/**
 * GET /api/admin/status
 * Check if current user is an admin and return their role
 */
export async function GET() {
  try {
    const admin = await getAdminSession();

    if (!admin) {
      return NextResponse.json({
        isAdmin: false,
        role: null,
      });
    }

    return NextResponse.json({
      isAdmin: true,
      role: admin.role,
      username: admin.username,
      userId: admin.userId,
    });
  } catch (error) {
    console.error('Admin status check error:', error);
    return NextResponse.json(
      { isAdmin: false, role: null, error: 'Failed to check admin status' },
      { status: 500 }
    );
  }
}
