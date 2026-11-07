// ponytail: quit lives here until the tray icon exists (the pill has no close button).
#[tauri::command]
fn quit(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
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
