#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .on_page_load(|webview, _payload| {
            let _ = webview.eval(r#"
                document.addEventListener('keydown', e => {
                    if ((e.ctrlKey && e.key === 'r') || e.key === 'F5') {
                        e.preventDefault();
                        location.reload();
                    } else if (e.altKey && e.key === 'ArrowLeft') {
                        e.preventDefault();
                        history.back();
                    } else if (e.altKey && e.key === 'ArrowRight') {
                        e.preventDefault();
                        history.forward();
                    }
                });
            "#);
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
