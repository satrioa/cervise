// Fonnte WA integration - lightweight fetch
export async function sendFonnteWA(phone: string, message: string) {
  const token = process.env.FONNTE_TOKEN;
  if (!token) return { skip: true };
  const res = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: token,
    },
    body: new URLSearchParams({ target: phone, message }),
  });
  if (!res.ok) {
    throw new Error(`Fonnte request failed with status ${res.status}`);
  }
  return res.json() as Promise<unknown>;
}

// Example: on status change Masuk->Selesai
export function servisStatusMessage(status: string, device: string) {
  return `Halo, update servis ${device} Cervise: status sekarang *${status}*. Garansi 3 bulan berlaku setelah Sudah Diambil.`;
}
