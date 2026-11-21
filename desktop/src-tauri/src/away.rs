//! Is the person at the PC? Idle time and the lock state, for the timer's away detection
//! (pill/useTimer.ts). The questions it asks are the pill's own bubble window, not a Windows dialog.

/// How long since the last keyboard or mouse input, and whether the session is locked.
#[derive(serde::Serialize)]
pub struct Away {
    idle_ms: u32,
    locked: bool,
}

#[tauri::command]
pub fn away() -> Away {
    Away { idle_ms: idle_ms(), locked: locked() }
}

/// Where the cursor is (physical px) and whether a mouse button or a key is down, or was pressed
/// since the last call. While the "welcome back" bubble is up, a click elsewhere or typing
/// dismisses it (the bubble can't take focus, so it never sees those itself).
#[derive(serde::Serialize)]
pub struct Input {
    x: i32,
    y: i32,
    mouse: bool,
    key: bool,
}

#[tauri::command]
pub fn input_now() -> Input {
    input()
}

#[cfg(windows)]
fn input() -> Input {
    use windows_sys::Win32::Foundation::POINT;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;
    use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;
    // High bit: down now. Low bit: pressed since the last call, so a quick click between polls counts.
    let pressed = |vk: i32| unsafe { GetAsyncKeyState(vk) } as u16 & 0x8001 != 0;
    let mut p = POINT { x: 0, y: 0 };
    unsafe { GetCursorPos(&mut p) };
    // Codes 1–6 are mouse buttons; 8 and up are keys.
    Input { x: p.x, y: p.y, mouse: [1, 2, 4, 5, 6].into_iter().any(pressed), key: (8..=254).any(pressed) }
}

#[cfg(windows)]
fn idle_ms() -> u32 {
    use windows_sys::Win32::System::SystemInformation::GetTickCount;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
    let mut info = LASTINPUTINFO { cbSize: size_of::<LASTINPUTINFO>() as u32, dwTime: 0 };
    // Both are 32-bit tick counts; wrapping_sub stays right when they roll over every 49.7 days.
    if unsafe { GetLastInputInfo(&mut info) } == 0 {
        return 0;
    }
    unsafe { GetTickCount() }.wrapping_sub(info.dwTime)
}

/// The session's documented lock state. (Checking for the input desktop instead would also say
/// "locked" while a UAC prompt or the Ctrl+Alt+Del screen is up, and pause mid-install.)
#[cfg(windows)]
fn locked() -> bool {
    use windows_sys::Win32::System::RemoteDesktop::{
        WTSFreeMemory, WTSQuerySessionInformationW, WTSSessionInfoEx, WTSINFOEXW, WTS_CURRENT_SERVER_HANDLE, WTS_CURRENT_SESSION,
        WTS_SESSIONSTATE_LOCK,
    };
    let mut buf: windows_sys::core::PWSTR = std::ptr::null_mut();
    let mut len = 0u32;
    unsafe {
        if WTSQuerySessionInformationW(WTS_CURRENT_SERVER_HANDLE, WTS_CURRENT_SESSION, WTSSessionInfoEx, &mut buf, &mut len) == 0 || buf.is_null() {
            return false;
        }
        let info = &*(buf as *const WTSINFOEXW);
        let locked = info.Level == 1 && info.Data.WTSInfoExLevel1.SessionFlags as u32 == WTS_SESSIONSTATE_LOCK;
        WTSFreeMemory(buf.cast());
        locked
    }
}

// Elsewhere: never idle, never locked, no input (the app ships for Windows only).
#[cfg(not(windows))]
fn input() -> Input {
    Input { x: 0, y: 0, mouse: false, key: false }
}
#[cfg(not(windows))]
fn idle_ms() -> u32 {
    0
}
#[cfg(not(windows))]
fn locked() -> bool {
    false
}
