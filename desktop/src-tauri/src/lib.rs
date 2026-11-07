// ponytail: quit lives here until the tray icon exists (the pill has no close button).
#[tauri::command]
fn quit(app: tauri::AppHandle) {
    app.exit(0);
}

// Never edit a migration that has shipped; add the next version instead.
fn migrations() -> Vec<tauri_plugin_sql::Migration> {
    vec![tauri_plugin_sql::Migration {
        version: 1,
        description: "init",
        sql: include_str!("../migrations/0001_init.sql"),
        kind: tauri_plugin_sql::MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // The DB is opened and migrated at startup (see `plugins.sql.preload` in tauri.conf.json).
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:hormozi.db", migrations())
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Remember where windows were. Position only: sizes come from tauri.conf.json,
            // and the hidden settings window must not reopen visible.
            #[cfg(desktop)]
            app.handle().plugin(
                tauri_plugin_window_state::Builder::new()
                    .with_state_flags(tauri_plugin_window_state::StateFlags::POSITION)
                    .build(),
            )?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![quit])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
