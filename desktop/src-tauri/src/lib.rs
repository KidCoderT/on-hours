// Settings' Quit button. The tray menu quits directly.
#[tauri::command]
fn quit(app: tauri::AppHandle) {
    app.exit(0);
}

/// The one global hotkey (pause/resume), and the combo currently registered for it.
#[cfg(desktop)]
#[derive(Default)]
struct Hotkey(std::sync::Mutex<Option<tauri_plugin_global_shortcut::Shortcut>>);

/// Move the hotkey to `combo` (e.g. "Ctrl+Alt+Shift+O"); "" turns it off. Pressing it makes the
/// pill toggle, exactly like the tray's Start / Pause. Errors are shown to the user as-is.
/// The old combo is released only after the new one is taken, so a failure changes nothing.
#[cfg(desktop)]
#[tauri::command]
fn set_hotkey(app: tauri::AppHandle, state: tauri::State<Hotkey>, combo: String) -> Result<(), String> {
    use tauri::Emitter;
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

    let next = match combo.trim() {
        "" => None,
        c => Some(c.parse::<Shortcut>().map_err(|_| "That isn't a valid shortcut.".to_string())?),
    };
    let mut current = state.0.lock().unwrap();
    if *current == next {
        return Ok(());
    }
    let keys = app.global_shortcut();
    if let Some(s) = next {
        keys.on_shortcut(s, |app, _, e| {
            if e.state == ShortcutState::Pressed {
                let _ = app.emit_to("main", "tray-toggle", ());
            }
        })
        .map_err(|_| "Another app is already using that shortcut.".to_string())?;
    }
    if let Some(old) = current.take() {
        let _ = keys.unregister(old);
    }
    *current = next;
    Ok(())
}

#[cfg(desktop)]
fn show_settings(app: &tauri::AppHandle) {
    use tauri::Manager;
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// The pill has no taskbar entry and no close button, so the tray is the way back to it.
/// Left-click opens settings; right-click shows the menu.
#[cfg(desktop)]
fn tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
    use tauri::{Emitter, Manager};

    // ponytail: one "Start / Pause" item, not a label that tracks the timer. Sync it if people ask.
    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, "toggle", "Start / Pause", true, None::<&str>)?,
            &MenuItem::with_id(app, "pill", "Show pill", true, None::<&str>)?,
            &MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "quit", "Quit On Hours", true, None::<&str>)?,
        ],
    )?;

    TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().expect("bundle icon").clone())
        .tooltip("On Hours")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, e| match e.id().as_ref() {
            // The timer lives in the pill's webview, so ask it to toggle.
            "toggle" => {
                let _ = app.emit_to("main", "tray-toggle", ());
            }
            // Show only, never hide: a hidden pill is a forgotten timer.
            "pill" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.unminimize();
                    let _ = w.show();
                    let _ = w.set_always_on_top(true); // re-raise it if another app has covered it
                }
            }
            "settings" => show_settings(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, e| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = e
            {
                show_settings(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

// Never edit a migration that has shipped; add the next version instead.
fn migrations() -> Vec<tauri_plugin_sql::Migration> {
    vec![
        tauri_plugin_sql::Migration {
            version: 1,
            description: "init",
            sql: include_str!("../migrations/0001_init.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 2,
            description: "week start",
            sql: include_str!("../migrations/0002_start_day.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 3,
            description: "show in recordings",
            sql: include_str!("../migrations/0003_show_in_recordings.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 4,
            description: "pill theme",
            sql: include_str!("../migrations/0004_pill_theme.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // Desktop-only plugins (their crates are only in Cargo.toml for non-mobile targets).
    #[cfg(desktop)]
    let builder = builder
        // Start at login. Windows itself stores whether it's on (no DB setting), so the
        // Settings switch reads/writes it directly via isEnabled / enable / disable.
        .plugin(tauri_plugin_autostart::Builder::new().build())
        // Remember where windows were. Position only: sizes come from tauri.conf.json,
        // and the hidden settings window must not reopen visible.
        // Must be registered on the builder (not in .setup()): it hooks window creation,
        // and the config windows already exist by the time .setup() runs.
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(tauri_plugin_window_state::StateFlags::POSITION)
                .build(),
        )
        // Updates from GitHub Releases, signed with the key in tauri.conf.json. See pill/useAutoUpdate.ts.
        .plugin(tauri_plugin_updater::Builder::new().build())
        // The global pause/resume hotkey. Registered from set_hotkey below.
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(Hotkey::default());

    builder
        // The DB is opened and migrated at startup (see `plugins.sql.preload` in tauri.conf.json).
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:on-hours.db", migrations())
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![quit, set_hotkey])
        .setup(|_app| {
            #[cfg(desktop)]
            tray(_app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(all(test, desktop))]
mod tests {
    /// Every combo the settings recorder can produce (lib/hotkey.ts) must parse.
    #[test]
    fn recorder_combos_parse() {
        use tauri_plugin_global_shortcut::Shortcut;
        for c in ["Ctrl+Alt+Shift+O", "Alt+1", "Ctrl+Shift+Space", "Ctrl+F9", "Alt+ArrowUp", "Ctrl+Numpad5", "Ctrl+Backquote", "Ctrl+Enter"] {
            assert!(c.parse::<Shortcut>().is_ok(), "{c}");
        }
        assert!("Ctrl+Nonsense".parse::<Shortcut>().is_err());
    }
}
