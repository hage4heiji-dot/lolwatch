// 通報は投稿から1時間以内・同じ端末(deviceId)からのみ編集できる。
// APIルートとページ側の両方から同じ値を参照する。
export const REPORT_EDIT_WINDOW_MS = 60 * 60 * 1000;

export function canEditReport(params: {
  viewerDeviceId: string | null;
  reportDeviceId: string;
  createdAt: Date;
}): boolean {
  const { viewerDeviceId, reportDeviceId, createdAt } = params;
  if (!viewerDeviceId || viewerDeviceId !== reportDeviceId) return false;
  return Date.now() - createdAt.getTime() <= REPORT_EDIT_WINDOW_MS;
}
