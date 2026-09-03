export const useRouter = () => ({ push: (h: string) => { window.location.hash = h.split("/").pop() ?? ""; window.location.reload(); } });
export const usePathname = () => "/kpi";
export const useSearchParams = () => new URLSearchParams();
export const redirect = (h: string) => {
  throw new Error(`Pratinjau: redirect ke ${h} tidak dijalankan.`);
};
export const notFound = () => {
  throw new Error("Pratinjau: notFound tidak dijalankan.");
};
