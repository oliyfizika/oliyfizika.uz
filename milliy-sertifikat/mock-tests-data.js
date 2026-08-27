const pdfLinks = ["1ONWqlVqQVlI8bOvbhsVSGb2jzxJrH-xs", "1J1Z2c_IA3C93OX1pY5U240ZjCSGj96yi", "1jlmq3xJCYjkUTQJ_AM0Co4UPsOVjM9l8", "19u7kfLNkAd3FnV7ElitxOD7lVj_jLtKl", "1RKHMV_0Zl8p-KB7QySK9EaOx-_GG0nDm", "1hiY6k9rvsv7zqpuC_mNn4KkHBUVkosPS", "10czKZeIbpmmpixpJGC8hhPpxBiXgFty0", "1LId9yk6cFuJwyvf-vXF_SKuxDisN_LRv", "1QgLnVYAjtiiDSKiRsSGYuGkN9vqmdXvt", "1M9gHjjJRdcma-qYs37JBbfZcezmi4d_5"];
const videoIds = [
  ["PghFGgZ8KhI", "CdD-bbynDnA", "Tp86DCTxWRc", "Fu_ZWVj6BpM", "z6_5-J6-ip0", "PgUBaNVfkms", "7T2JBERVsWY", "bLc-a5qr0Aw", "Uk60Q1ipaqQ"],
  ["d8Sz3d5s_T8", "ilOhvEspTlk", "qzIWfVs7vSU", "5jXhrDFMFU4", "UpWAltNX_m4", "J9kPasrbxEg", "2l_8qtHlSHY", "yX03Eed2l1Y", "UBQPOdIRM5o"],
  ["yJMsBa6PU54", "X7cU21kD12Q", "p4I4HOSOh3s", "EmG2qgFf5WQ", "McbGOhO6xZ4", "OFiI_3plbZg", "fmRwMjyQR8o", "CtX1aXwaueE", "kwG4r-HZQJA"],
  ["XDQbjkEtVdY", "3dHIFEWJ1S8", "6KeN14QU2ag", "Lg9MCT_HJj0", "dEU74mJNiJI", "-EC12IunhHQ", "JiMCJPfEn2c", "5ofP2m_KCvI", "fcOexl05tY4"],
  ["8isVR1-i1D0", "9K6EibqCRCE", "Y5wlV_JM7q4", "Y5wlV_JM7q4", "NElte-TXSMA", "4vhzGi0vAmY", "Ug0Q0x7pGJc", "YOYfQfdNtzQ", "g0rBkzA87Vw"],
  ["81cUIp7-708", "oJjpvZnl37c", "oCaWvK0RLW0", "thtMkUZ7HZg", "ucjvG7Tk-tM", "X1Zab5jastg", "rxEYCDb0OuI", "T3mN1-0VLIc", "uegZLHB4gTQ"],
  ["gdljJeltCTs", "4kIWs5rPZao", "IgRAOoygDPs", "Fs4-3jXlii8", "12Xrdq7i55A", "6ECK1ufG4Z4", "SPDhhsp3dP8", "MZt8DGG_WVA", "HlaKemhldRI"],
  ["au64nnILmb0", "NgbPOr2H7uo", "_y4V0l8Ocs4", "f-YryQsO5E0", "_XiO1RINWWQ", "ucFOevfhoXs", "WJM2Ih9ieys", "0nLJasDnfjU", "5ypk0Lf2UPQ"],
  ["SkM7dvI_T2A", "CO6z1d4q8s4", "L2C_iUgyF0M", "4gqcgnnWk8Q", "hVhgtZj2gsc", "1vqR_alvXQM", "UxpVrnZPYnE", "wxHKHAJPNCA", "a2xfttuRmzI"],
  ["YhIdr2lmpf0", "qKr1zn3UZDM", "RcbEnB9Qw34", "Rwirz8PYvCk", "uCmqHBLpBBo", "mZp38P2Dwa8", "LPwzRGWji_Q", "_GhilHWFgy0", "a-zOyMga238"]
];
export const mockTests = pdfLinks.map((fileId, testIndex) => ({ id: testIndex + 1, title: `Mock test №${testIndex + 1}`, pdf: `https://drive.google.com/file/d/${fileId}/view?usp=drive_link`, videos: videoIds[testIndex].map((youtubeId, videoIndex) => ({ id: videoIndex + 1, title: `Video ${videoIndex + 1} — ${videoIndex * 5 + 1}–${videoIndex * 5 + 5}-savollar`, youtubeId })) }));
