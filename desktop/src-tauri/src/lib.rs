// ponytail: quit lives here until the tray icon exists (the pill has no close button).
#[tauri::command]
fn quit(app: tauri::AppHandle) {
    app.exit(0);
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
        );

    builder
        // The DB is opened and migrated at startup (see `plugins.sql.preload` in tauri.conf.json).
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:hormozi.db", migrations())
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![quit])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
