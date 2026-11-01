# Google bilan ro'yxatdan o'tish videosi uchun o'zbekcha diktor ovozi (edge-tts).
# Har bir qator alohida mp3 + so'z vaqtlari (JSON). Ishga tushirish:
#   pip install edge-tts && python3 tts.py
import asyncio, json, pathlib
import edge_tts

LINES = [
    "Oliy Fizika nuqta uz saytida Google orqali ro'yxatdan o'tish, parolsiz va tez.",
    "Saytni oching va yuqoridagi, Ro'yxatdan o'tish, tugmasini bosing.",
    "Ochilgan oynada, Google bilan davom etish, tugmasini bosing.",
    "Google oynasi ochiladi. O'zingizning Google hisobingizni tanlang.",
    "Hisobni tanlashingiz bilan tizimga kirasiz. Xush kelibsiz!",
    "Ism va emailingiz Google hisobingizdan avtomatik olinadi. Parol ham, email tasdiqlash ham kerak emas.",
    "Keyingi safar, Kirish oynasida, Google bilan davom etish tugmasini bossangiz kifoya.",
    "Telefonda Google sahifasi alohida ochilishi mumkin, so'ng saytga avtomatik qaytasiz.",
    "Endi simulyatsiyalar, virtual laboratoriyalar va natijalaringiz sahifasi sizga ochiq.",
    "Savollar bo'lsa, Telegramda yozing: oliyfizika uz. Hoziroq sinab ko'ring!",
]
VOICES = {"madina": "uz-UZ-MadinaNeural", "sardor": "uz-UZ-SardorNeural"}
OUT = pathlib.Path(__file__).parent

async def one(voice, text, mp3):
    com = edge_tts.Communicate(text, voice, rate="+5%", boundary="WordBoundary")
    words = []
    with open(mp3, "wb") as f:
        async for ch in com.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append({"w": ch["text"], "t": ch["offset"] / 1e7, "d": ch["duration"] / 1e7})
    return words

async def main():
    for key, voice in VOICES.items():
        d = OUT / key
        d.mkdir(exist_ok=True)
        meta = []
        for i, line in enumerate(LINES, 1):
            mp3 = d / f"{i:02d}.mp3"
            meta.append({"i": i, "text": line, "words": await one(voice, line, mp3)})
        (d / "words.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1))
        print(key, "ok")

asyncio.run(main())
