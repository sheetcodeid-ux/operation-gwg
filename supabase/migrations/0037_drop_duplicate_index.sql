-- Indeks kembar di hc_requests.
--
-- `hc_requests_kind_status_idx` dan `idx_hc_requests_kind_status` isinya persis
-- sama. Indeks kembar tidak mempercepat apa pun — pembacaan tetap memakai satu
-- saja — tapi SETIAP penulisan harus memperbarui keduanya, dan keduanya makan
-- tempat. Yang bernama sesuai konvensi dipertahankan.
drop index if exists public.idx_hc_requests_kind_status;
