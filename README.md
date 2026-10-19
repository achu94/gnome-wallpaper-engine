
<div align="right">
  <details>
    <summary >🌐 Language</summary>
    <div>
      <div align="center">
        <a href="https://openaitx.github.io/view.html?user=achu94&project=gnome-wallpaper-engine&lang=en">English</a>
        | <a href="https://openaitx.github.io/view.html?user=achu94&project=gnome-wallpaper-engine&lang=zh-CN">简体中文</a>
        | <a href="https://openaitx.github.io/view.html?user=achu94&project=gnome-wallpaper-engine&lang=zh-TW">繁體中文</a>
        | <a href="https://openaitx.github.io/view.html?user=achu94&project=gnome-wallpaper-engine&lang=ja">日本語</a>
        | <a href="https://openaitx.github.io/view.html?user=achu94&project=gnome-wallpaper-engine&lang=ko">한국어</a>
        | <a href="https://openaitx.github.io/view.html?user=achu94&project=gnome-wallpaper-engine&lang=hi">हिन्दी</a>
        | <a href="https://openaitx.github.io/view.html?user=achu94&project=gnome-wallpaper-engine&lang=th">ไทย</a>
        | <a href="https://openaitx.github.io/view.html?user=achu94&project=gnome-wallpaper-engine&lang=fr">Français</a>
        | <a href="https://openaitx.github.io/view.html?user=achu94&project=gnome-wallpaper-engine&lang=de">Deutsch</a>
        | <a href="https://openaitx.github.io/view.html?user=achu94&project=gnome-wallpaper-engine&lang=es">Español</a>
        | <a href="https://openaitx.github.io/view.html?user=achu94&project=gnome-wallpaper-engine&lang=it">Italiano</a>
        | <a href="https://openaitx.github.io/view.html?user=achu94&project=gnome-wallpaper-engine&lang=ru">Русский</a>
        | <a href="https://openaitx.github.io/view.html?user=achu94&project=gnome-wallpaper-engine&lang=pt">Português</a>
        | <a href="https://openaitx.github.io/view.html?user=achu94&project=gnome-wallpaper-engine&lang=nl">Nederlands</a>
        | <a href="https://openaitx.github.io/view.html?user=achu94&project=gnome-wallpaper-engine&lang=pl">Polski</a>
        | <a href="https://openaitx.github.io/view.html?user=achu94&project=gnome-wallpaper-engine&lang=ar">العربية</a>
        | <a href="https://openaitx.github.io/view.html?user=achu94&project=gnome-wallpaper-engine&lang=fa">فارسی</a>
        | <a href="https://openaitx.github.io/view.html?user=achu94&project=gnome-wallpaper-engine&lang=tr">Türkçe</a>
        | <a href="https://openaitx.github.io/view.html?user=achu94&project=gnome-wallpaper-engine&lang=vi">Tiếng Việt</a>
        | <a href="https://openaitx.github.io/view.html?user=achu94&project=gnome-wallpaper-engine&lang=id">Bahasa Indonesia</a>
        | <a href="https://openaitx.github.io/view.html?user=achu94&project=gnome-wallpaper-engine&lang=as">অসমীয়া</
      </div>
    </div>
  </details>
</div>

# 🌌 GNOME Live Wallpaper Engine

> **[Install now on GNOME Extensions](https://extensions.gnome.org/extension/9558/gnome-wallpaper-engine/)**

No complex setup. No heavy dependencies. Just mpv, ffmpeg + the extension.

Live video wallpapers for **GNOME Shell 45–50**. Multi-monitor playback and click-through to DING desktop icons are supported only on **GNOME Shell 50 Wayland**. GNOME Shell 45–49 continue to use the existing renderer and do not include these features.

Powered by **mpv** for hardware-accelerated playback and broad format support (MP4, GIF, WebM, MKV…).

If you like this project, consider giving it a star ⭐ — it really helps!

## ☕ Support & Updates

If you’d like to support the project, you can do so here:

<a href="https://nowpayments.io/donation?api_key=EWJ623W-6JTM04F-JC4F777-AR6TW2K" target="_blank" rel="noreferrer noopener"><img src="https://nowpayments.io/images/embeds/donation-button-white.svg" width="100" alt="Donate with NOWPayments"></a>
&nbsp;&nbsp;
<a href="https://ko-fi.com/achu94" target="_blank" rel="noreferrer noopener"><img src="https://ko-fi.com/img/githubbutton_sm.svg" width="160" alt="Support development on Ko-fi"></a>

I’ll also be sharing development updates, progress, and behind-the-scenes work on Ko-fi.

You don’t need to donate to see the posts — everyone is welcome to follow along and stay updated 🙂

And if you enjoy the project, a ⭐ on GitHub is always appreciated!

---

## 🎥 Demo

> Live wallpaper running on GNOME (Wayland)

![demo](https://raw.githubusercontent.com/achu94/gnome-wallpaper-engine/main/assets/demo.gif)

---

## ✨ Features

- 🎬 **Integrated Gallery:** Browse and select wallpapers directly from GNOME Settings
- 🖼️ **Thumbnail Previews:** Automatically generated previews for all wallpapers
- 📥 **Smart Import:** Add videos with one click and apply instantly
- 🚀 **Hardware decoding:** Uses mpv hardware decoding where available
- ⚡ **Very Low CPU Usage:** Typically ~1–3%
- 🔄 **Instant Apply:** Switch wallpapers in real-time
- 🖥️ **Wayland Ready:** Works reliably where most tools fail
- 📦 **Minimal Setup:** Only requires mpv and ffmpeg
- 🎞️ **Wide Format Support:** MP4, GIF, WebM, MKV and more
- 🔁 **Autostart:** Automatically start wallpaper on login
- 🧩 **Tray Icon Toggle:** Show or hide the top panel indicator
- ⏸️ **Auto Pause (Fullscreen):** Pauses when a fullscreen app is active
- 🔋 **Auto Pause (Battery):** Pauses when running on battery to save power

---

## 🚧 Roadmap

- 🎮 Steam Wallpaper Engine integration (auto-detect and list compatible wallpapers)
- 🎛️ Advanced playback settings (loop modes, speed, etc.)

---

## 🛠 Requirements

You need **mpv** and **ffmpeg** installed. GNOME Shell 50 uses the dedicated Wayland renderer; GNOME Shell 45–49 keep the existing renderer.

### Ubuntu / Debian / Zorin OS

```bash
sudo apt update && sudo apt install mpv ffmpeg
```

### Fedora

```bash
sudo dnf install mpv ffmpeg
```

### Arch Linux

```bash
sudo pacman -S mpv ffmpeg
```

### openSUSE

```bash
sudo zypper in mpv ffmpeg
```

### openSUSE

```bash
sudo zypper in mpv ffmpeg
```

## 📦 Installation

### 🎖️ Official GNOME Extensions (Easiest)
Install it directly from the GNOME Extensions website:

**[Download on GNOME Extensions](https://extensions.gnome.org/extension/9558/gnome-wallpaper-engine/)**

---

### ⚡ Quick Install (Local ZIP)

```bash
gnome-extensions install gnome-wallpaper-engine@gjs.com.zip
```

Then:

- Wayland: Log out and log back in
- X11: Press `Alt + F2`, type `r`, press Enter

Finally, enable the extension using the **Extensions** app  
(or via the top panel indicator if enabled).

---

### 🧩 Manual Install

1. Download the ZIP file from the latest release
2. Extract it to:

```
~/.local/share/gnome-shell/extensions/
```

3. Make sure the folder is named:

```
gnome-wallpaper-engine@gjs.com
```

4. Compile the GSettings schemas by running this command in your terminal:

```
glib-compile-schemas ~/.local/share/gnome-shell/extensions/gnome-wallpaper-engine@gjs.com/schemas/
```

5. Restart GNOME Shell
    - Wayland: Log out and log back in
    - X11: Press `Alt + F2`, type `r`, press Enter

6. Enable the extension using the **Extensions** app

---

## 📖 Usage

1. Open the extension settings
2. Click **"Add Video/GIF"**
3. Select a wallpaper from the gallery
4. Wallpapers are applied instantly
5. Optionally use the top panel indicator to start or stop playback
6. Optionally hide the tray icon from the settings

---

## 💡 Why this exists

I built this to solve the lack of simple and reliable live wallpaper solutions on GNOME, especially on Wayland.

---

## ⚖️ License

GPL-3.0 — free and open source.
