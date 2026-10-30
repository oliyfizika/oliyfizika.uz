# Ro'yxatdan o'tish videosi uchun o'zbekcha diktor ovozi (edge-tts).
# Har bir qator alohida mp3 + so'z vaqtlari (JSON). Ishga tushirish:
#   pip install edge-tts && python3 tts.py
import asyncio, json, pathlib
import edge_tts

LINES = [
    "Oliy Fizika nuqta uz saytida ro'yxatdan o'tish atigi uch qadam.",
    "Saytni oching va yuqoridagi, Ro'yxatdan o'tish, tugmasini bosing.",
    "Ismingiz, familiyangiz va emailingizni kiriting.",
    "Google hisobingiz bo'lsa, Google bilan davom etish tugmasi orqali ham kirishingiz mumkin.",
    "Biz email orqali davom etamiz: Davom etish tugmasini bosing.",
    "Emailingizga tasdiqlash havolasi keladi. Xatni oching va havolani bosing.",
    "Xat kelmasa, Spam papkasini tekshiring.",
    "Endi parol yarating: kamida sakkiz belgi, bitta katta harf, raqam va maxsus belgi.",
    "Hisobni yaratish tugmasini bosing. Tayyor, xush kelibsiz!",
    "Endi simulyatsiyalar, virtual laboratoriyalar va natijalaringiz sahifasi sizga ochiq.",
    "Savollar bo'lsa, Telegramda yozing: oliyfizika uz. Hoziroq ro'yxatdan o'ting!",
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
