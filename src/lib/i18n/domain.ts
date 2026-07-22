import type { Lang } from "./dict";

/**
 * Domain-term dictionary for data-driven labels (checklist items, section
 * names, rating labels) that live in `constants.ts` in a single language.
 * Keyed by the canonical label; `translateTerm` returns the canonical label
 * itself when no translation exists (NO cross-language fallback), so a term
 * only changes when we have a real translation for the requested language.
 *
 * Hygiene content is canonical Indonesian → provide English in `en`.
 * Hospitality content is canonical English → provide Indonesian in `id`.
 */
const DOMAIN: Record<Lang, Record<string, string>> = {
  en: {
    // hygiene sections
    "Area Depan Outlet": "Outlet Front Area",
    Kasir: "Cashier",
    Gudang: "Warehouse",
    // hygiene items
    "Kaca depan": "Front glass",
    "Pintu masuk": "Entrance door",
    "Handle pintu": "Door handle",
    "Area parkir": "Parking area",
    "Tempat sampah": "Trash bin",
    "Lantai area depan": "Front floor area",
    "Kondisi tanaman": "Plant condition",
    "Rumput liar": "Weeds",
    "Meja customer": "Customer table",
    "Kursi customer": "Customer chair",
    Lantai: "Floor",
    "AC/Kipas": "AC/Fan",
    Dekorasi: "Decoration",
    "Musik/Ambience": "Music/Ambience",
    "Debu plafon": "Ceiling dust",
    "Meja kasir": "Cashier desk",
    "Laci uang": "Cash drawer",
    Kabel: "Cables",
    "Peralatan kerja": "Work equipment",
    "Meja kerja": "Work table",
    "Peralatan masak": "Cooking equipment",
    "Lantai kitchen": "Kitchen floor",
    "Lemari penyimpanan": "Storage cabinet",
    "Sarung tangan": "Gloves",
    "Penutup kepala": "Head cover",
    "Penutup mulut": "Mouth cover",
    Closet: "Toilet bowl",
    Wastafel: "Sink / Basin",
    Cermin: "Mirror",
    "Sabun tangan": "Hand soap",
    "Aroma ruangan": "Room fragrance",
    "Rak penyimpanan": "Storage rack",
    "Kardus tertata": "Boxes arranged",
    "Area lantai": "Floor area",
    // hygiene rating labels
    "Sangat Baik": "Excellent",
    Baik: "Good",
    Cukup: "Fair",
    Kurang: "Poor",
    // shift
    Pagi: "Morning",
    Siang: "Midday",
    Sore: "Afternoon",
    Malam: "Night",
  },
  id: {
    // hygiene section headers that are English in the source
    "Customer Area": "Area Pelanggan",
    Kitchen: "Dapur",
    // hospitality categories
    "Cashier Service": "Layanan Kasir",
    "F&B Service": "Layanan F&B",
    "Dining Area": "Area Makan",
    // hospitality items
    "Greeting customer": "Menyapa pelanggan",
    "Eye contact": "Kontak mata",
    Smile: "Senyum",
    "Offer menu": "Menawarkan menu",
    "Offer promotion": "Menawarkan promosi",
    "Product knowledge": "Pengetahuan produk",
    "Thank customer": "Berterima kasih ke pelanggan",
    "Product presentation": "Penyajian produk",
    "Serving speed": "Kecepatan penyajian",
    "Order accuracy": "Akurasi pesanan",
    Communication: "Komunikasi",
    Professionalism: "Profesionalisme",
    "Table cleanliness": "Kebersihan meja",
    "Chair cleanliness": "Kebersihan kursi",
    "Customer comfort": "Kenyamanan pelanggan",
    Ambience: "Suasana",
    "Customer interaction": "Interaksi pelanggan",
    // hygiene photo groups
    "Front Area": "Area Depan",
    "Plant Area": "Area Tanaman",
    // hospitality positions
    Staff: "Staf",
    // complaint categories
    Service: "Layanan",
    "Food Quality": "Kualitas Makanan",
    Cleanliness: "Kebersihan",
    "Staff Characteristics": "Karakter Staf",
    Price: "Harga",
    "Payment System": "Sistem Pembayaran",
    Ambiance: "Suasana",
    "Order Error": "Kesalahan Pesanan",
    // complaint status
    Open: "Terbuka",
    "In Progress": "Diproses",
    Close: "Selesai",
    // complaint source
    "Customer Service": "Layanan Pelanggan",
    // root cause
    Man: "Manusia",
    Method: "Metode",
    Machine: "Mesin",
    Environment: "Lingkungan",
    // priority
    Critical: "Kritis",
    High: "Tinggi",
    Medium: "Sedang",
    Low: "Rendah",
  },
};

export function translateTerm(lang: Lang, label: string): string {
  return DOMAIN[lang]?.[label] ?? label;
}
