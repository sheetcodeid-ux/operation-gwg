/**
 * Tiruan aksi server untuk pratinjau.
 *
 * Tanpa ini, seluruh lapisan server ikut terbawa ke bundel peramban — termasuk
 * modul yang membaca kredensial. Pratinjau memang hanya untuk melihat
 * tampilannya; tidak ada yang boleh benar-benar tersimpan dari sini.
 */
const tolak = async () => ({ error: "Pratinjau — tidak menyimpan apa pun." });

export const simpanActualAction = tolak;
export const simpanEntriAction = tolak;
export const hapusEntriAction = tolak;
export const simpanEfisiensiAction = tolak;
export const simpanFeeAction = tolak;
export const simpanMenuPasarAction = tolak;
export const hapusMenuPasarAction = tolak;
export const simpanPengaturanAction = tolak;
export const simpanEntriMassalAction = tolak;
export const simpanEfisiensiMassalAction = tolak;
export const simpanFeeMassalAction = tolak;
export const simpanMenuPasarMassalAction = tolak;
export const uploadKpiBuktiAction = tolak;
export const simpanOutletBulananAction = tolak;
