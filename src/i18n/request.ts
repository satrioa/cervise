import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import idMessages from "../../messages/id.json";
import enMessages from "../../messages/en.json";

// Import statis: dynamic import berbasis template literal tidak bisa dibundle
// sebagai chunk di Cloudflare Worker dan menyebabkan Context.externalImport
// gagal saat render Server Component (React error #441).
const messages = {
  id: idMessages,
  en: enMessages,
};

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as any)) locale = routing.defaultLocale;
  return {
    locale,
    messages: messages[locale as keyof typeof messages] ?? messages.id,
  };
});
