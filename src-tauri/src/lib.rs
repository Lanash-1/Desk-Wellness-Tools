//! Desk Wellness desktop shell.
//!
//! The Rust side is deliberately thin: it registers plugins, owns the tray icon,
//! and emits a 1-second `heartbeat` event so the JS scheduler keeps ticking even
//! when the webview is hidden and its own timers are throttled.

use serde::Deserialize;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime,
};
use tauri_plugin_autostart::MacosLauncher;

const TRAY_ID: &str = "main";
const MAIN_WINDOW: &str = "main";

#[derive(Debug, Deserialize)]
pub struct TrayMenuItemSpec {
    id: String,
    label: String,
    #[serde(default = "default_true")]
    enabled: bool,
}

fn default_true() -> bool {
    true
}

fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn build_menu<R: Runtime>(
    app: &AppHandle<R>,
    items: &[TrayMenuItemSpec],
) -> tauri::Result<Menu<R>> {
    let menu = Menu::new(app)?;
    for item in items {
        if item.id == "separator" {
            menu.append(&PredefinedMenuItem::separator(app)?)?;
        } else {
            menu.append(&MenuItem::with_id(
                app,
                &item.id,
                &item.label,
                item.enabled,
                None::<&str>,
            )?)?;
        }
    }
    Ok(menu)
}

fn default_menu_items() -> Vec<TrayMenuItemSpec> {
    vec![
        TrayMenuItemSpec {
            id: "show".into(),
            label: "Open Desk Wellness".into(),
            enabled: true,
        },
        TrayMenuItemSpec {
            id: "separator".into(),
            label: String::new(),
            enabled: true,
        },
        TrayMenuItemSpec {
            id: "quit".into(),
            label: "Quit".into(),
            enabled: true,
        },
    ]
}

#[tauri::command]
fn tray_set_tooltip<R: Runtime>(app: AppHandle<R>, text: String) -> Result<(), String> {
    let tray = app.tray_by_id(TRAY_ID).ok_or("tray not found")?;
    tray.set_tooltip(Some(text)).map_err(|e| e.to_string())
}

fn tray_icon(state: &str) -> tauri::Result<Image<'static>> {
    let bytes: &'static [u8] = match state {
        "focus" => include_bytes!("../icons/tray-focus@2x.png"),
        "break" => include_bytes!("../icons/tray-break@2x.png"),
        "paused" => include_bytes!("../icons/tray-paused@2x.png"),
        _ => include_bytes!("../icons/tray-idle@2x.png"),
    };
    Image::from_bytes(bytes)
}

#[tauri::command]
fn tray_set_state<R: Runtime>(app: AppHandle<R>, state: String) -> Result<(), String> {
    let tray = app.tray_by_id(TRAY_ID).ok_or("tray not found")?;
    let label = match state.as_str() {
        "focus" => "Focusing",
        "break" => "On a break",
        "paused" => "Reminders paused",
        _ => "Idle",
    };
    tray.set_tooltip(Some(format!("Desk Wellness – {label}")))
        .map_err(|e| e.to_string())?;
    let icon = tray_icon(&state).map_err(|e| e.to_string())?;
    tray.set_icon(Some(icon)).map_err(|e| e.to_string())?;
    Ok(())
}

/// macOS: hide the Dock icon so the app lives in the menu bar only.
#[tauri::command]
fn set_dock_visible<R: Runtime>(app: AppHandle<R>, visible: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use tauri::ActivationPolicy;
        let policy = if visible {
            ActivationPolicy::Regular
        } else {
            ActivationPolicy::Accessory
        };
        app.set_activation_policy(policy)
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, visible);
    }
    Ok(())
}

#[tauri::command]
fn tray_set_menu<R: Runtime>(
    app: AppHandle<R>,
    items: Vec<TrayMenuItemSpec>,
) -> Result<(), String> {
    let tray = app.tray_by_id(TRAY_ID).ok_or("tray not found")?;
    let menu = build_menu(&app, &items).map_err(|e| e.to_string())?;
    tray.set_menu(Some(menu)).map_err(|e| e.to_string())
}

#[tauri::command]
fn quit_app<R: Runtime>(app: AppHandle<R>) {
    app.exit(0);
}

fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let menu = build_menu(app, &default_menu_items())?;
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(tray_icon("idle")?)
        .icon_as_template(false)
        .tooltip("Desk Wellness")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            let id = event.id().as_ref().to_string();
            match id.as_str() {
                "show" => show_main_window(app),
                "quit" => app.exit(0),
                // Everything else is handled by the JS side.
                _ => {
                    let _ = app.emit("tray-menu", id);
                }
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
                    if window.is_visible().unwrap_or(false) && window.is_focused().unwrap_or(false)
                    {
                        let _ = window.hide();
                    } else {
                        show_main_window(app);
                    }
                }
            }
        })
        .build(app)?;
    Ok(())
}

fn start_heartbeat<R: Runtime>(app: AppHandle<R>) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(1));
        loop {
            interval.tick().await;
            let now_ms = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            let _ = app.emit("heartbeat", now_ms);
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // A second launch just brings the existing window forward.
            show_main_window(app);
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            tray_set_tooltip,
            tray_set_state,
            tray_set_menu,
            set_dock_visible,
            quit_app
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            setup_tray(&handle)?;
            start_heartbeat(handle.clone());
            // Launched by autostart: stay in the tray.
            if std::env::args().any(|a| a == "--minimized") {
                if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
                    let _ = window.hide();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Desk Wellness");
}
