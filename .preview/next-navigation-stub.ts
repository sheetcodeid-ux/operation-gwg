export const useRouter = () => ({ push: (h: string) => { window.location.hash = h.split("/").pop() ?? ""; window.location.reload(); } });
export const usePathname = () => "/kpi";
export const useSearchParams = () => new URLSearchParams();
