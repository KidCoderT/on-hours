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

// Elsewhere: never idle, never locked (the app ships for Windows only).
#[cfg(not(windows))]
fn idle_ms() -> u32 {
    0
}
#[cfg(not(windows))]
fn locked() -> bool {
    false
}
