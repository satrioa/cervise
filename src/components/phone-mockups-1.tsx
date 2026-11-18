import type { ImageItem } from "./phone-carousel";
import { PhoneCarousel } from "./phone-carousel";

/** Solace phone carousel dipakai hero dengan screenshot aplikasi sendiri. */
export default function PhoneMockupBasic({ images }: { images: ImageItem[] }) {
  return <PhoneCarousel images={images} />;
}
