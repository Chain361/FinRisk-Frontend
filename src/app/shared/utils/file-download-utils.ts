/** trigger browser download จาก blob ที่ได้จาก HttpClient (responseType: 'blob')
 * ใช้แทน <a href> ตรงๆ เพราะ browser navigation ไม่แนบ Authorization header ผ่าน authInterceptor */
export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** ขนาดไฟล์อ่านง่าย (bytes → B/KB/MB) */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
