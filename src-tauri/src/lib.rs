use tauri_plugin_fs::FsExt;

/// Grant the frontend filesystem access to one vault folder, and only that folder.
///
/// The vault is chosen at runtime, so it cannot appear in the static capability scope. Instead the
/// frontend calls this immediately after the user picks a folder, and the fs plugin's scope is
/// widened to exactly that directory. Everything outside it stays unreachable, which is the point:
/// a bug in path handling on the JS side cannot reach the rest of the disk, because the Rust side
/// never allowed it in the first place.
#[tauri::command]
fn allow_vault(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let vault = std::path::PathBuf::from(&path);

    if !vault.is_dir() {
        return Err(format!("{path} is not a folder"));
    }

    let scope = app.fs_scope();
    scope
        .allow_directory(&vault, true)
        .map_err(|e| format!("Could not grant access to {path}: {e}"))?;

    // tauri-plugin-fs's glob matching treats a leading dot literally by default on Unix, the same
    // way a shell's own `*` skips hidden files — and unlike the *declared* capability scope, the
    // scope widened here at runtime is built with that behaviour hard-coded, so `requireLiteralLeadingDot`
    // in tauri.conf.json has no effect on it. A `**` under the vault root therefore never matches
    // `.obsidian`, `.lull`, or any other dot-folder a vault has — so every dot-entry at the vault
    // root is allowed explicitly here, by its own exact path rather than by wildcard.
    if let Ok(entries) = std::fs::read_dir(&vault) {
        for entry in entries.flatten() {
            if !entry.file_name().to_string_lossy().starts_with('.') {
                continue;
            }
            let entry_path = entry.path();
            let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
            let allowed = if is_dir {
                scope.allow_directory(&entry_path, true)
            } else {
                scope.allow_file(&entry_path)
            };
            if let Err(e) = allowed {
                log::warn!("Could not widen scope for {}: {e}", entry_path.display());
            }
        }
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![allow_vault])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
