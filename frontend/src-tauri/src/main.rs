#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::Manager;
use std::fs;

#[tauri::command]
async fn delete_file(path: String) -> Result<(), String> {
    fs::remove_file(path).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![delete_file])
        .setup(|app| {
            let window = app.get_window("main").unwrap();
            window.show().unwrap();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
