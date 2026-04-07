/**
 * Web-only: opens the native file picker and returns selected Files.
 * Use instead of expo-document-picker on web for consistent browser behavior.
 */
export function pickWebStatementFiles(): Promise<File[]> {
  if (typeof document === 'undefined') {
    return Promise.resolve([]);
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept =
      'application/pdf,text/csv,.csv,.txt,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    input.style.display = 'none';

    const finish = (files: File[]) => {
      input.remove();
      resolve(files);
    };

    input.addEventListener('change', () => {
      const files = input.files ? Array.from(input.files) : [];
      finish(files);
    });

    document.body.appendChild(input);
    input.click();
  });
}
