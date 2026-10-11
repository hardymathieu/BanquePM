// Saving and sharing a JSON file from the browser; reading one back. Nothing goes to the server.

function jsonFile(name: string, data: unknown): File {
  return new File([JSON.stringify(data, null, 2)], name, { type: 'application/json' });
}

export function downloadJson(name: string, data: unknown): void {
  const url = URL.createObjectURL(jsonFile(name, data));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** True where the share sheet takes files (Android Chrome, iOS Safari). */
export function canShareFiles(): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [jsonFile('x.json', {})] });
  } catch {
    return false;
  }
}

/** Opens the share sheet (e-mail, Drive…). False if cancelled or refused. */
export async function shareJson(name: string, data: unknown, title: string): Promise<boolean> {
  try {
    await navigator.share({ files: [jsonFile(name, data)], title });
    return true;
  } catch {
    return false;
  }
}

/** Parses a picked file as JSON; null if it isn't. */
export async function readJsonFile(file: File): Promise<unknown> {
  try {
    return JSON.parse(await file.text()) as unknown;
  } catch {
    return null;
  }
}
