# Âm thanh tự tạo cho game (data/sounds.json → files[].synth): chỉ dùng công thức toán — sóng sin / vuông, nhiễu trắng /
# hồng, bộ lọc, đường bao âm lượng — không dùng bản ghi hay mẫu âm thanh của ai khác (xem docs/audio_credits.md).
# Mỗi công thức: hàm (sr) → mảng float32 mono; build_sfx.py cắt khoảng lặng, chuẩn hoá đỉnh, xuất MP3.
# Tất định: nhiễu lấy từ bộ sinh số ngẫu nhiên có hạt cố định → dựng lại ra đúng file cũ.
# Chỉ cần numpy (Blender có sẵn); chạy riêng để nghe thử: build_sfx.py -- --only phone,grain
import numpy as np

TAU = 2 * np.pi


def _t(sr, sec):
    return np.arange(int(sr * sec)) / sr


def _rng(name):
    return np.random.default_rng(sum(ord(c) * (i + 1) for i, c in enumerate(name)))


def _place(out, x, sr, at):
    """cộng x vào out từ giây `at` (cắt phần thừa)"""
    i = int(sr * at)
    n = min(len(x), len(out) - i)
    if n > 0:
        out[i:i + n] += x[:n]
    return out


def _env(n, sr, attack, decay):
    """lên trong `attack` giây rồi tắt dần theo hàm mũ (hằng số thời gian `decay` giây)"""
    t = np.arange(n) / sr
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-np.maximum(t - attack, 0) / decay)


def _fade(x, sr, out_s=0.01):
    k = min(len(x), int(sr * out_s))
    if k > 1:
        x[-k:] *= np.linspace(1, 0, k)
    return x


def _band(x, sr, lo=None, hi=None):
    """lọc dải tần bằng FFT (pha 0, mép mềm 1/4 quãng tám)"""
    n = len(x)
    f = np.fft.rfftfreq(n, 1 / sr)
    X = np.fft.rfft(x)
    m = np.ones_like(f)
    if lo:
        m *= 1 / (1 + (lo / np.maximum(f, 1e-3)) ** 4)
    if hi:
        m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, n).astype(np.float32)


def _pink(n, rng):
    X = np.fft.rfft(rng.standard_normal(n))
    f = np.arange(len(X))
    X[1:] /= np.sqrt(f[1:])
    X[0] = 0
    y = np.fft.irfft(X, n)
    return (y / (np.abs(y).max() + 1e-9)).astype(np.float32)


def _svf(x, sr, cutoff, q=0.7, mode="bp"):
    """bộ lọc biến trạng thái, tần số cắt đổi theo thời gian (cutoff: mảng Hz, cùng độ dài x)"""
    y = np.zeros_like(x)
    lp = bp = 0.0
    damp = 1 / q
    for i in range(len(x)):
        f = 2 * np.sin(np.pi * min(cutoff[i], sr * 0.24) / sr)
        hp = x[i] - lp - damp * bp
        bp += f * hp
        lp += f * bp
        y[i] = bp if mode == "bp" else lp if mode == "lp" else hp
    return y


def _tone(sr, sec, freq, partials=((1, 1, 1),), attack=0.002):
    """nốt nhạc: partials = (bội số tần số, biên độ, hệ số thời gian tắt so với `sec`)"""
    t = _t(sr, sec)
    y = np.zeros_like(t)
    for mult, amp, dk in partials:
        y += amp * np.sin(TAU * freq * mult * t) * _env(len(t), sr, attack, sec * dk / 4)
    return y.astype(np.float32)


# ---------------------------------------------------------------- công thức

def phone(sr):
    """tin nhắn mới: 2 nốt kiểu đàn gỗ (C6 → G6, quãng 5 đi lên)"""
    out = np.zeros(int(sr * 0.75), np.float32)
    mar = ((1, 1.0, 1.0), (3.9, 0.35, 0.35), (9.2, 0.08, 0.12))
    _place(out, _tone(sr, 0.5, 1046.5, mar), sr, 0.0)
    _place(out, _tone(sr, 0.6, 1568.0, mar) * 0.9, sr, 0.13)
    return _fade(out, sr, 0.05)


def grain(sr):
    """hạt lúa vàng: 3 tiếng chuông nhỏ đi lên (A5, C#6, E6) + lấp lánh"""
    rng = _rng("grain")
    out = np.zeros(int(sr * 1.0), np.float32)
    bell = ((1, 1.0, 1.0), (2.76, 0.4, 0.45), (5.4, 0.18, 0.2), (8.93, 0.06, 0.1))
    for i, f in enumerate((880.0, 1108.7, 1318.5)):
        _place(out, _tone(sr, 0.7, f, bell) * (0.8 + 0.1 * i), sr, 0.065 * i)
    # lấp lánh: các chấm nhiễu rất ngắn, tần cao, thưa dần
    n = int(sr * 0.6)
    dots = np.zeros(n, np.float32)
    for _ in range(26):
        at = rng.uniform(0.02, 0.55) ** 1.4
        i = int(at * sr)
        k = int(sr * 0.004)
        if i + k < n:
            dots[i:i + k] += rng.standard_normal(k).astype(np.float32) * np.hanning(k) * rng.uniform(0.3, 1)
    dots = _band(dots, sr, lo=6000, hi=14000) * _env(n, sr, 0.01, 0.25)
    _place(out, dots * 0.5, sr, 0.03)
    return _fade(out, sr, 0.08)


def progress(sr):
    """thanh tải 1,1 giây: tiếng ngân nhẹ đi lên + nhịp tích tắc"""
    sec = 1.1
    t = _t(sr, sec)
    f = 520 * (2 ** (t / sec))                       # đi lên 1 quãng tám
    ph = TAU * np.cumsum(f) / sr
    y = 0.6 * np.sin(ph) + 0.15 * np.sin(2 * ph)
    trem = 0.6 + 0.4 * (0.5 + 0.5 * np.cos(TAU * 11 * t))
    amp = np.clip(t / 0.12, 0, 1) * np.clip((sec - t) / 0.15, 0, 1)
    return (y * trem * amp).astype(np.float32)


def shutter(sr):
    """máy ảnh: tách (màn trập mở) – rè rất ngắn – tách (đóng)"""
    rng = _rng("shutter")
    out = np.zeros(int(sr * 0.2), np.float32)

    def click(freq, sec, gain):
        n = int(sr * sec)
        nz = _band(rng.standard_normal(n).astype(np.float32), sr, lo=1500, hi=9000) * _env(n, sr, 0.0005, sec / 5)
        ping = np.sin(TAU * freq * np.arange(n) / sr) * _env(n, sr, 0.0005, sec / 4)
        return (nz * 0.7 + ping * 0.5) * gain

    _place(out, click(3200, 0.03, 1.0), sr, 0.0)
    n = int(sr * 0.05)
    whirr = _band(rng.standard_normal(n).astype(np.float32), sr, lo=600, hi=3000) * np.hanning(n) * 0.12
    _place(out, whirr, sr, 0.02)
    _place(out, click(1900, 0.035, 0.8), sr, 0.085)
    return _fade(out, sr, 0.01)


def splash(sr):
    """nước đổ lại vào giếng: tiếng ào (nhiễu lọc thấp dần) + bọt nước (tiếng 'bụp' tần số đi lên)"""
    rng = _rng("splash")
    sec = 0.8
    n = int(sr * sec)
    t = np.arange(n) / sr
    nz = rng.standard_normal(n).astype(np.float32)
    cut = 5500 * np.exp(-t / 0.18) + 700
    body = _svf(nz, sr, cut, q=0.8, mode="lp") * _env(n, sr, 0.008, 0.16)
    out = body * 0.9
    for _ in range(14):
        at = rng.uniform(0.03, 0.6)
        f0 = rng.uniform(500, 1600)
        d = rng.uniform(0.02, 0.05)
        tt = _t(sr, d)
        f = f0 * (1 + 0.8 * tt / d)
        b = np.sin(TAU * np.cumsum(f) / sr) * _env(len(tt), sr, 0.002, d / 3) * rng.uniform(0.15, 0.4)
        _place(out, b.astype(np.float32), sr, at)
    return _fade(out.astype(np.float32), sr, 0.05)


def door_swing(sr):
    """cánh cửa kính mở: tiếng gió lùa nhẹ (nhiễu hồng, dải giữa trượt lên)"""
    rng = _rng("door_swing")
    sec = 1.0
    n = int(sr * sec)
    t = np.arange(n) / sr
    nz = _pink(n, rng)
    cen = 380 + 520 * np.clip(t / 0.5, 0, 1)
    y = _svf(nz, sr, cen, q=1.2, mode="bp")
    amp = np.clip(t / 0.28, 0, 1) ** 1.5 * np.exp(-np.maximum(t - 0.28, 0) / 0.25)
    return _fade((y * amp).astype(np.float32), sr, 0.06)


def card_ok(sr):
    """đầu đọc thẻ: 2 tiếng bíp cao ngắn (thẻ hợp lệ)"""
    out = np.zeros(int(sr * 0.32), np.float32)
    for at in (0.0, 0.14):
        t = _t(sr, 0.09)
        y = np.sin(TAU * 2350 * t) + 0.12 * np.sin(TAU * 7050 * t)
        y *= np.clip(t / 0.004, 0, 1) * np.clip((0.09 - t) / 0.006, 0, 1)
        _place(out, y.astype(np.float32), sr, at)
    return out


def card_fail(sr):
    """đầu đọc thẻ: 2 tiếng rè trầm (thẻ báo đỏ)"""
    out = np.zeros(int(sr * 0.48), np.float32)
    for at in (0.0, 0.22):
        t = _t(sr, 0.17)
        y = sum(np.sin(TAU * 330 * k * t) / k for k in range(1, 12, 2))   # sóng vuông giới hạn dải
        y *= np.clip(t / 0.005, 0, 1) * np.clip((0.17 - t) / 0.01, 0, 1)
        _place(out, (_band(y.astype(np.float32), sr, hi=3500) * 0.8), sr, at)
    return out


def bus_door(sr):
    """cửa xe bus: xì hơi nén rồi 'cạch' khi cánh cửa chạm khung"""
    rng = _rng("bus_door")
    out = np.zeros(int(sr * 0.95), np.float32)
    n = int(sr * 0.6)
    t = np.arange(n) / sr
    nz = rng.standard_normal(n).astype(np.float32)
    hiss = _svf(nz, sr, 4200 - 1400 * t / 0.6, q=0.9, mode="bp") * _env(n, sr, 0.012, 0.22)
    _place(out, hiss * 0.9, sr, 0.0)
    m = int(sr * 0.12)
    tt = np.arange(m) / sr
    thud = np.sin(TAU * 95 * tt) * _env(m, sr, 0.001, 0.035)
    knock = _band(rng.standard_normal(m).astype(np.float32), sr, lo=300, hi=1800) * _env(m, sr, 0.0005, 0.012)
    _place(out, (thud * 0.9 + knock * 0.6).astype(np.float32), sr, 0.62)
    return _fade(out, sr, 0.02)


def bus_brake(sr):
    """xe bus dừng: xả hơi phanh (xì mạnh, tắt dần)"""
    rng = _rng("bus_brake")
    n = int(sr * 0.9)
    t = np.arange(n) / sr
    nz = rng.standard_normal(n).astype(np.float32)
    y = _svf(nz, sr, 6200 - 2200 * np.clip(t / 0.8, 0, 1), q=0.7, mode="bp")
    y = y * _env(n, sr, 0.02, 0.3) + _band(nz, sr, lo=8000) * _env(n, sr, 0.005, 0.08) * 0.3
    return _fade(y.astype(np.float32), sr, 0.05)


RECIPES = {f.__name__: f for f in (phone, grain, progress, shutter, splash, door_swing, card_ok, card_fail, bus_door, bus_brake)}
